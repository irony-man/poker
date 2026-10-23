import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from '@/design-tokens/contrast';

const root = path.resolve(__dirname, '../..');

function hexTriplet(hex: string): string {
  const raw = hex.replace('#', '');
  const n = Number.parseInt(raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

describe('poker gradients', () => {
  it('matches tokens-modes.json and keeps text on card at AA', () => {
    const css = readFileSync(path.join(root, 'app/poker-v2.css'), 'utf8');
    const tokens = JSON.parse(readFileSync(path.join(root, 'design-tokens/tokens-modes.json'), 'utf8')) as {
      modes: Record<string, Record<string, { value: string }>>;
    };
    const classic = tokens.modes.Classic!;
    const glass = tokens.modes.Glass!;
    const arcade = tokens.modes.Arcade!;
    const compact = (value: string) => value.replace(/\s+/g, '');
    const cssCompact = compact(css);
    expect(cssCompact).toContain(compact(classic.g_hero!.value));
    expect(cssCompact).toContain(compact(classic.g_felt!.value));
    expect(cssCompact).toContain(compact(classic.g_win!.value));
    expect(cssCompact).toContain(compact(glass.g_hero!.value));
    expect(cssCompact).toContain(compact(arcade.g_felt!.value));
    expect(cssCompact).toContain(compact(arcade.g_win!.value));

    for (const mode of [classic, glass, arcade]) {
      const fg = mode.text_primary?.value;
      const bg = mode.card?.value;
      if (!fg?.startsWith('#') || !bg?.startsWith('#')) continue;
      expect(contrastRatio(hexTriplet(fg), hexTriplet(bg))).toBeGreaterThanOrEqual(4.5);
    }
  });
});
