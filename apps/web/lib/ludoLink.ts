/** Full URL friends can open to join this Ludo board (requires sign-in). */
export function buildLudoJoinLink(ludoId: string, inviteCode: string, origin?: string): string {
  const base = origin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  const params = new URLSearchParams({ invite: inviteCode });
  return `${base}/ludo/${encodeURIComponent(ludoId)}?${params}`;
}

/** Plain-text blurb for clipboard / native share sheets. */
export function buildLudoJoinShareText(ludoId: string, inviteCode: string, origin?: string): string {
  const link = buildLudoJoinLink(ludoId, inviteCode, origin);
  return `Join my POKR Ludo board\nCode: ${inviteCode}\n${link}`;
}
