/**
 * WCAG 2.x contrast. Triplets are space-separated RGB channels.
 */

export function channelLinear(channel: number): number {
  const s = channel / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(triplet: string): number {
  const [r, g, b] = triplet.trim().split(/\s+/).map(Number);
  return 0.2126 * channelLinear(r!) + 0.7152 * channelLinear(g!) + 0.0722 * channelLinear(b!);
}

export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

export function composite(foreground: string, background: string, alpha: number): string {
  const fg = foreground.trim().split(/\s+/).map(Number);
  const bg = background.trim().split(/\s+/).map(Number);
  const mix = fg.map((channel, i) => Math.round(channel * alpha + bg[i]! * (1 - alpha)));
  return mix.join(' ');
}
