export type UploadImageProfile = 'avatar' | 'site' | 'avatarPreset';

const PROFILE_MAX_EDGE: Record<UploadImageProfile, number> = {
  avatar: 512,
  site: 1920,
  avatarPreset: 256,
};

const MAX_BYTES: Record<UploadImageProfile, number> = {
  avatar: 2 * 1024 * 1024,
  site: 4 * 1024 * 1024,
  avatarPreset: 4 * 1024 * 1024,
};

const WEBP_QUALITY = 0.82;
const JPEG_QUALITY = 0.85;

export type OptimizedUploadImage = {
  blob: Blob;
  contentType: 'image/webp' | 'image/jpeg';
  contentLength: number;
};

function loadBitmap(file: File): Promise<ImageBitmap> {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file, { imageOrientation: 'from-image' });
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not process image'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      createImageBitmap(canvas)
        .then(resolve)
        .catch(reject);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image'));
    };
    img.src = url;
  });
}

function targetSize(
  width: number,
  height: number,
  maxEdge: number,
  squareCrop: boolean,
): { w: number; h: number; sx: number; sy: number; sw: number; sh: number } {
  if (squareCrop) {
    const side = Math.min(width, height);
    const sx = Math.floor((width - side) / 2);
    const sy = Math.floor((height - side) / 2);
    const out = Math.min(maxEdge, side);
    return { w: out, h: out, sx, sy, sw: side, sh: side };
  }
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  return { w, h, sx: 0, sy: 0, sw: width, sh: height };
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: 'image/webp' | 'image/jpeg',
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Could not encode image'));
      },
      type,
      quality,
    );
  });
}

async function encodeBitmap(
  bitmap: ImageBitmap,
  profile: UploadImageProfile,
): Promise<OptimizedUploadImage> {
  const maxEdge = PROFILE_MAX_EDGE[profile];
  const maxBytes = MAX_BYTES[profile];
  const squareCrop = profile === 'avatar' || profile === 'avatarPreset';
  const { w, h, sx, sy, sw, sh } = targetSize(bitmap.width, bitmap.height, maxEdge, squareCrop);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process image');
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, w, h);
  bitmap.close();

  let blob = await canvasToBlob(canvas, 'image/webp', WEBP_QUALITY);
  let contentType: 'image/webp' | 'image/jpeg' = 'image/webp';
  if (blob.type !== 'image/webp' || blob.size === 0) {
    blob = await canvasToBlob(canvas, 'image/jpeg', JPEG_QUALITY);
    contentType = 'image/jpeg';
  }

  if (blob.size > maxBytes) {
    throw new Error(
      `Optimized image is still too large (${Math.ceil(blob.size / 1024)} KB). Try a smaller photo.`,
    );
  }

  return { blob, contentType, contentLength: blob.size };
}

/** Resize, crop, and compress an image for presigned S3 upload. */
export async function optimizeImageFile(
  file: File,
  profile: UploadImageProfile,
): Promise<OptimizedUploadImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Use JPEG, PNG, or WebP');
  }
  const bitmap = await loadBitmap(file);
  try {
    return await encodeBitmap(bitmap, profile);
  } catch (err) {
    bitmap.close();
    throw err;
  }
}
