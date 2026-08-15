export const ALLOWED_AVATAR_CONTENT_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

export type AllowedAvatarContentType = keyof typeof ALLOWED_AVATAR_CONTENT_TYPES;

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
export const PRESIGNED_UPLOAD_EXPIRES_SEC = 300;

export const ALLOWED_SOUND_CONTENT_TYPES = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
} as const;

export type AllowedSoundContentType = keyof typeof ALLOWED_SOUND_CONTENT_TYPES;

export const MAX_SOUND_BYTES = 5 * 1024 * 1024;

export const ALLOWED_SITE_IMAGE_CONTENT_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

export type AllowedSiteImageContentType = keyof typeof ALLOWED_SITE_IMAGE_CONTENT_TYPES;

export const MAX_SITE_IMAGE_BYTES = 4 * 1024 * 1024;
