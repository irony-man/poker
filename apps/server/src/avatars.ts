/** Matches web `/public/avatars/avatar-0.png` … `avatar-7.png`. */
export const AVATAR_PRESET_COUNT = 8;

export function clampAvatarId(id: number | undefined | null, fallback = 0): number {
  if (id == null || !Number.isInteger(id)) return fallback % AVATAR_PRESET_COUNT;
  return ((id % AVATAR_PRESET_COUNT) + AVATAR_PRESET_COUNT) % AVATAR_PRESET_COUNT;
}

export function avatarIdFromUserId(userId: string): number {
  let h = 2166136261;
  for (let i = 0; i < userId.length; i++) {
    h ^= userId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % AVATAR_PRESET_COUNT;
}
