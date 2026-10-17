/** Lowercase, trim and dedupe invite addresses, dropping the sender's own email. */
export function normalizeInviteEmails(emails: string[], ownEmail?: string | null): string[] {
  const own = ownEmail?.trim().toLowerCase() || null;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of emails) {
    const email = raw.trim().toLowerCase();
    if (!email || email === own || seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

/** Split addresses into existing accounts (friend request) and unknown ones (invite email). */
export function splitInviteTargets(
  emails: string[],
  findUserId: (email: string) => string | null | undefined,
): { users: { email: string; userId: string }[]; unknown: string[] } {
  const users: { email: string; userId: string }[] = [];
  const unknown: string[] = [];
  for (const email of emails) {
    const userId = findUserId(email);
    if (userId) users.push({ email, userId });
    else unknown.push(email);
  }
  return { users, unknown };
}
