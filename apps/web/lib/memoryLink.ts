/** Full URL friends can open to join this Memory board (requires sign-in). */
export function buildMemoryJoinLink(memoryId: string, inviteCode: string, origin?: string): string {
  const base = origin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  const params = new URLSearchParams({ invite: inviteCode });
  return `${base}/memory/${encodeURIComponent(memoryId)}?${params}`;
}

/** Plain-text blurb for clipboard / native share sheets. */
export function buildMemoryJoinShareText(
  memoryId: string,
  inviteCode: string,
  origin?: string,
): string {
  const link = buildMemoryJoinLink(memoryId, inviteCode, origin);
  return `Join my POKR Memory Match\nCode: ${inviteCode}\n${link}`;
}
