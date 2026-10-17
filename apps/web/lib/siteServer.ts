import type { PublicSitePayload } from '@/lib/api/site';
import { serverApiBase } from '@/lib/legal';

export const SITE_REVALIDATE_SECONDS = 300;

/** Server-side fetch of public site config; empty object on failure. */
export async function fetchPublicSiteServer(
  revalidateSeconds = SITE_REVALIDATE_SECONDS,
): Promise<Partial<PublicSitePayload>> {
  try {
    const res = await fetch(`${serverApiBase()}/api/site`, {
      next: { revalidate: revalidateSeconds },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return {};
    return (await res.json()) as PublicSitePayload;
  } catch {
    return {};
  }
}
