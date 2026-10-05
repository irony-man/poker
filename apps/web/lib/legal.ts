import { DEFAULT_LEGAL_DOCS, normalizeLegalDocs, type LegalDocs } from '@poker/protocol';

/** Seconds before an admin edit to the legal pages shows up on /privacy and /terms. */
export const LEGAL_REVALIDATE_SECONDS = 300;

/** Same upstream as the `/api/*` rewrite in next.config (in-compose host when available). */
export function serverApiBase(): string {
  return (
    process.env.API_REWRITE_TARGET ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:4000'
  ).replace(/\/$/, '');
}

/** Server-side fetch of the admin-edited legal docs; falls back to the bundled defaults. */
export async function fetchLegalDocs(): Promise<LegalDocs> {
  try {
    const res = await fetch(`${serverApiBase()}/api/site/legal`, {
      next: { revalidate: LEGAL_REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return DEFAULT_LEGAL_DOCS;
    return normalizeLegalDocs(await res.json());
  } catch {
    return DEFAULT_LEGAL_DOCS;
  }
}
