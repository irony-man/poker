function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

/**
 * HTTP API base URL.
 * Browser: same-origin (`''`) so `/api/*` is rewritten by Next.js to the game
 * server — avoids cross-origin CORS failures on pokr.site.
 * Server (RSC/SSR): call the API host directly via NEXT_PUBLIC_API_URL.
 */
export function apiBase(): string {
  if (typeof window !== 'undefined') return '';
  return stripTrailingSlash(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000');
}

/** Absolute API host (SSR / tooling). Prefer `apiBase()` for fetch calls. */
export const API_URL = stripTrailingSlash(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000');
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:4000/ws';

export type AuthOptions = { sessionToken: string };

export function sessionHeaders(sessionToken?: string | null): HeadersInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;
  return headers;
}

/** Turn Zod `error.message` JSON dumps into a short read-only summary. */
function humanizeApiError(raw: string, fallback: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('[')) return raw;
  try {
    const issues = JSON.parse(trimmed) as Array<{
      path?: (string | number)[];
      message?: string;
      code?: string;
      received?: unknown;
      options?: unknown[];
    }>;
    if (!Array.isArray(issues) || issues.length === 0) return raw;

    const parts = issues
      .map((issue) => {
        if (typeof issue.message === 'string' && issue.message.trim()) {
          return issue.message.trim();
        }
        if (issue.code === 'invalid_enum_value' && Array.isArray(issue.options)) {
          const field = issue.path?.length ? issue.path.join('.') : 'value';
          const opts = issue.options.map(String).join(' | ');
          return `Invalid ${field}: expected ${opts}`;
        }
        if (issue.path?.length) {
          return `Invalid ${issue.path.join('.')}`;
        }
        return null;
      })
      .filter((part): part is string => !!part);

    return parts.length > 0 ? parts.join('. ') : fallback;
  } catch {
    return raw;
  }
}

export async function parseError(res: Response, fallback: string): Promise<string> {
  try {
    const text = await res.text();
    if (!text) return fallback;
    try {
      const data = JSON.parse(text) as { error?: string };
      if (data.error) return humanizeApiError(data.error, fallback);
    } catch {
      return humanizeApiError(text, fallback);
    }
  } catch {
    /* keep fallback */
  }
  return fallback;
}

export async function authedFetch(
  path: string,
  options: AuthOptions & { method?: string; body?: unknown },
) {
  const res = await fetch(`${apiBase()}${path}`, {
    method: options.method ?? 'GET',
    headers: sessionHeaders(options.sessionToken),
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    throw new Error(
      await parseError(res, res.status === 401 ? 'Sign in required' : 'Request failed'),
    );
  }
  return res.json();
}
