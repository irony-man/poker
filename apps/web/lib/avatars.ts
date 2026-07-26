/** Number of built-in profile picture presets. */
export const AVATAR_PRESET_COUNT = 8;

const AVATAR_KEY = 'felt-avatar-id';

/** Stable preset index from a user id (bots + humans). */
export function avatarIdFromUserId(userId: string | null | undefined): number {
  if (!userId) return 0;
  let h = 2166136261;
  for (let i = 0; i < userId.length; i++) {
    h ^= userId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % AVATAR_PRESET_COUNT;
}

export function resolveAvatarId(
  userId: string | null | undefined,
  preferred?: number | null,
): number {
  if (preferred != null && preferred >= 0 && preferred < AVATAR_PRESET_COUNT) {
    return preferred;
  }
  return avatarIdFromUserId(userId);
}

export function loadSavedAvatarId(): number {
  try {
    const raw = localStorage.getItem(AVATAR_KEY);
    if (raw == null) return 0;
    const n = Number(raw);
    if (Number.isInteger(n) && n >= 0 && n < AVATAR_PRESET_COUNT) return n;
  } catch {
    /* ignore */
  }
  return 0;
}

export function saveAvatarId(id: number): void {
  try {
    localStorage.setItem(AVATAR_KEY, String(id % AVATAR_PRESET_COUNT));
  } catch {
    /* ignore */
  }
}

export const AVATAR_LABELS = [
  'Spade',
  'Heart',
  'Diamond',
  'Club',
  'Chip',
  'Crown',
  'Dice',
  'Ace',
] as const;
