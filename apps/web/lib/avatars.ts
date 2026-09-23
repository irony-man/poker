import { assetUrl } from '@/lib/assets';

/** Number of built-in profile picture presets (see `/public/avatars/avatar-N.webp`). */
export const AVATAR_PRESET_COUNT = 8;

export type AvatarPresetsConfig = {
  urls: string[];
};

export const DEFAULT_AVATAR_PRESET_URLS: string[] = Array.from(
  { length: AVATAR_PRESET_COUNT },
  (_, i) => assetUrl(`/avatars/avatar-${i}.webp`),
);

let presetUrls: string[] = [...DEFAULT_AVATAR_PRESET_URLS];

/** Apply site/admin preset URLs (index 0–7). */
export function configureAvatarPresets(next: AvatarPresetsConfig | null | undefined): void {
  if (!next?.urls?.length) {
    presetUrls = [...DEFAULT_AVATAR_PRESET_URLS];
    return;
  }
  const merged = [...DEFAULT_AVATAR_PRESET_URLS];
  for (let i = 0; i < AVATAR_PRESET_COUNT && i < next.urls.length; i++) {
    const v = next.urls[i]?.trim();
    if (v) merged[i] = v;
  }
  presetUrls = merged;
}

const AVATAR_KEY = 'pokr-avatar-id';
const LEGACY_AVATAR_KEY = 'felt-avatar-id';

/** Public path for a preset index. */
export function avatarSrc(id: number): string {
  const n = ((id % AVATAR_PRESET_COUNT) + AVATAR_PRESET_COUNT) % AVATAR_PRESET_COUNT;
  return presetUrls[n] ?? DEFAULT_AVATAR_PRESET_URLS[n]!;
}

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
  if (preferred != null && Number.isInteger(preferred) && preferred >= 0) {
    return preferred % AVATAR_PRESET_COUNT;
  }
  return avatarIdFromUserId(userId);
}

export function resolveAvatarSrc(input: {
  avatarUrl?: string | null;
  avatarId?: number | null;
  userId?: string | null;
}): string {
  if (input.avatarUrl) return input.avatarUrl;
  return avatarSrc(resolveAvatarId(input.userId, input.avatarId));
}

export function loadSavedAvatarId(): number {
  try {
    const raw = localStorage.getItem(AVATAR_KEY) ?? localStorage.getItem(LEGACY_AVATAR_KEY);
    if (raw == null) return 0;
    const n = Number(raw);
    if (Number.isInteger(n) && n >= 0) return n % AVATAR_PRESET_COUNT;
  } catch {
    /* ignore */
  }
  return 0;
}

export function saveAvatarId(id: number): void {
  try {
    localStorage.setItem(AVATAR_KEY, String(((id % AVATAR_PRESET_COUNT) + AVATAR_PRESET_COUNT) % AVATAR_PRESET_COUNT));
    localStorage.removeItem(LEGACY_AVATAR_KEY);
  } catch {
    /* ignore */
  }
}

export const AVATAR_LABELS = [
  'Avatar 1',
  'Avatar 2',
  'Avatar 3',
  'Avatar 4',
  'Avatar 5',
  'Avatar 6',
  'Avatar 7',
  'Avatar 8',
] as const;
