/** Full URL friends can open to join this Court Piece board (requires sign-in). */
export function buildCourtpieceJoinLink(
  courtpieceId: string,
  inviteCode: string,
  origin?: string,
): string {
  const base = origin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  const params = new URLSearchParams({ invite: inviteCode });
  return `${base}/courtpiece/${encodeURIComponent(courtpieceId)}?${params}`;
}

/** Plain-text blurb for clipboard / native share sheets. */
export function buildCourtpieceJoinShareText(
  courtpieceId: string,
  inviteCode: string,
  origin?: string,
): string {
  const link = buildCourtpieceJoinLink(courtpieceId, inviteCode, origin);
  return `Join my POKR Court Piece\nCode: ${inviteCode}\n${link}`;
}
