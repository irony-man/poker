/** Parse `ADMIN_USERNAMES=alice,bob` into a lowercased set (empty → no admins). */
export function parseAdminUsernames(raw: string | undefined | null): Set<string> {
  if (!raw?.trim()) return new Set();
  const set = new Set<string>();
  for (const part of raw.split(',')) {
    const key = part.trim().toLowerCase();
    if (key) set.add(key);
  }
  return set;
}

export function isAdminUsername(
  username: string | null | undefined,
  allowlist: Set<string>,
): boolean {
  if (!username || allowlist.size === 0) return false;
  return allowlist.has(username.trim().toLowerCase());
}
