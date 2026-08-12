/** Resolve a public asset path against S3_PUBLIC_BASE_URL when configured. */
export function assetUrl(path: string): string {
  const base = process.env.S3_PUBLIC_BASE_URL?.replace(/\/$/, '');
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}/static${normalized}` : normalized;
}
