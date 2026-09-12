/** Full URL friends can open to join this Snakes board (requires sign-in). */
export function buildSnakesJoinLink(snakesId: string, inviteCode: string, origin?: string): string {
  const base = origin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  const params = new URLSearchParams({ invite: inviteCode });
  return `${base}/snakes/${encodeURIComponent(snakesId)}?${params}`;
}

/** Plain-text blurb for clipboard / native share sheets. */
export function buildSnakesJoinShareText(
  snakesId: string,
  inviteCode: string,
  origin?: string,
): string {
  const link = buildSnakesJoinLink(snakesId, inviteCode, origin);
  return `Join my POKR Snakes & Ladders board\nCode: ${inviteCode}\n${link}`;
}
