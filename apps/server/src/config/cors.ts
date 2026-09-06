/** Production web origins always allowed (exact match; no trailing slash). */
const BUILTIN_ORIGINS = new Set([
  'https://pokr.site',
  'https://www.pokr.site',
]);

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/$/, '');
}

/** CORS origin allowlist (matches prior Express server). */
export function isAllowedOrigin(
  origin: string | undefined,
  extraOrigins: string[],
): boolean {
  if (!origin) return true;
  const normalized = normalizeOrigin(origin);
  if (BUILTIN_ORIGINS.has(normalized)) return true;
  if (extraOrigins.includes(normalized)) return true;
  if (/^https:\/\/[a-z0-9-]+\.onrender\.com$/i.test(normalized)) return true;
  if (/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/i.test(normalized)) return true;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalized)) return true;
  return false;
}

export function parseExtraOrigins(raw: string | undefined): string[] {
  return (raw ?? 'http://localhost:3000')
    .split(',')
    .map((s) => normalizeOrigin(s))
    .filter(Boolean);
}
