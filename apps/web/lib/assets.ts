/** Resolve a public asset path against NEXT_PUBLIC_ASSETS_URL when configured. */
export function assetUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_ASSETS_URL?.replace(/\/$/, '');
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}/static${normalized}` : normalized;
}

/** Marketing / UI images stored under static/images/ on S3, or public root locally. */
export function imageAssetUrl(filename: string): string {
  const base = process.env.NEXT_PUBLIC_ASSETS_URL?.replace(/\/$/, '');
  const name = filename.replace(/^\//, '');
  if (base) return `${base}/static/images/${name}`;
  return `/${name}`;
}

/** Resolve a site-config or static path for display (local public/ or S3). */
export function resolvePublicImage(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  const base = process.env.NEXT_PUBLIC_ASSETS_URL?.replace(/\/$/, '');
  if (!base) return `/${normalized}`;
  if (normalized.startsWith('sounds/') || normalized.startsWith('avatars/')) {
    return assetUrl(`/${normalized}`);
  }
  if (normalized.startsWith('images/')) return `${base}/static/${normalized}`;
  if (/\.(png|jpe?g|webp|svg)$/i.test(normalized) && !normalized.includes('/')) {
    return imageAssetUrl(normalized);
  }
  return assetUrl(`/${normalized}`);
}
