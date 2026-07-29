/** Full URL friends can open to join this table (requires sign-in). */
export function buildTableJoinLink(tableId: string, inviteCode: string, origin?: string): string {
  const base = origin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  const params = new URLSearchParams({ invite: inviteCode });
  return `${base}/table/${encodeURIComponent(tableId)}?${params}`;
}

/** Plain-text blurb for clipboard / native share sheets. */
export function buildTableJoinShareText(tableId: string, inviteCode: string, origin?: string): string {
  const link = buildTableJoinLink(tableId, inviteCode, origin);
  return `Join my Felt poker table\nCode: ${inviteCode}\n${link}`;
}
