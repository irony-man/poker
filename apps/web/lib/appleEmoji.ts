/** Apple emoji PNGs via emoji-datasource-apple (jsDelivr). */

const APPLE_EMOJI_CDN =
  'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.1.2/img/apple/64';

/** Build datasource filename hex from a single emoji grapheme. */
export function emojiToAppleCodepoints(emoji: string): string {
  const points: string[] = [];
  for (const ch of emoji) {
    const cp = ch.codePointAt(0);
    if (cp == null) continue;
    points.push(cp.toString(16));
  }
  return points.join('-');
}

export function appleEmojiUrl(emoji: string): string | null {
  const trimmed = emoji.trim();
  if (!trimmed) return null;
  const codepoints = emojiToAppleCodepoints(trimmed);
  if (!codepoints) return null;
  return `${APPLE_EMOJI_CDN}/${codepoints}.png`;
}
