/** App path for a player's public profile page. */
export function publicProfileHref(username: string): string {
  return `/u/${encodeURIComponent(username.trim())}`;
}
