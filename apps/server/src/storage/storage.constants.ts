export const ALLOWED_AVATAR_CONTENT_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

export type AllowedAvatarContentType = keyof typeof ALLOWED_AVATAR_CONTENT_TYPES;

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
export const PRESIGNED_UPLOAD_EXPIRES_SEC = 300;
