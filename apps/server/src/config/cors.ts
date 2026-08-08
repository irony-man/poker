/** CORS origin allowlist (matches prior Express server). */
export function isAllowedOrigin(
  origin: string | undefined,
  extraOrigins: string[],
): boolean {
  if (!origin) return true;
  if (extraOrigins.includes(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+\.onrender\.com$/i.test(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/i.test(origin)) return true;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return true;
  return false;
}

export function parseExtraOrigins(raw: string | undefined): string[] {
  return (raw ?? 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
