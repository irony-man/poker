import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CARD_THEME_ID,
  defaultClassicElements,
  defaultCardFaceThemes,
  layersFromLegacyElements,
  normalizeCardFaceThemes,
  resolveCardFaceTheme,
  resolveDefaultCardThemeId,
  themeLayersForSuit,
} from './cardFaceTheme';

describe('normalizeCardFaceThemes', () => {
  it('returns classic default when input is empty', () => {
    const themes = normalizeCardFaceThemes([]);
    expect(themes).toHaveLength(1);
    expect(themes[0]!.id).toBe(DEFAULT_CARD_THEME_ID);
    expect(themes[0]!.isDefault).toBe(true);
    expect(themeLayersForSuit(themes[0]!, 'h')).toHaveLength(3);
  });

  it('migrates legacy elements to layers for all suits', () => {
    const themes = normalizeCardFaceThemes([
      {
        id: 'wide',
        name: 'Wide',
        elements: {
          rank: { x: 2, y: -1, size: 2 },
          cornerSuit: { x: 0.1, y: 0.1, size: 0.08 },
          centerSuit: { x: 0.5, y: 0.5, size: 0.3 },
        },
        suitColors: { h: '#C8102E', d: '#C8102E', c: '#1A1A1A', s: '#1A1A1A' },
      },
    ]);
    const rank = themeLayersForSuit(themes[0]!, 's').find((l) => l.id === 'rank');
    expect(rank?.x).toBe(1);
    expect(rank?.y).toBe(0);
    expect(rank?.size).toBe(0.8);
  });

  it('normalizes dynamic layers into layersBySuit', () => {
    const themes = normalizeCardFaceThemes([
      {
        id: 'custom',
        name: 'Custom',
        suitColors: defaultCardFaceThemes()[0]!.suitColors,
        layers: [
          {
            id: 'rank-1',
            kind: 'rank',
            name: 'Big rank',
            x: 0.5,
            y: 0.5,
            size: 0.2,
          },
        ],
      },
    ]);
    expect(themeLayersForSuit(themes[0]!, 'h')).toHaveLength(1);
    expect(themeLayersForSuit(themes[0]!, 'h')[0]!.name).toBe('Big rank');
  });

  it('preserves per-suit layers when layersBySuit is set', () => {
    const themes = normalizeCardFaceThemes([
      {
        id: 'split',
        name: 'Split',
        suitColors: defaultCardFaceThemes()[0]!.suitColors,
        layersBySuit: {
          h: [{ id: 'rank', kind: 'rank', name: 'Hearts rank', x: 0.1, y: 0.1, size: 0.14, opacity: 1 }],
          d: [{ id: 'rank', kind: 'rank', name: 'Diamonds rank', x: 0.2, y: 0.2, size: 0.14, opacity: 1 }],
          c: [{ id: 'rank', kind: 'rank', name: 'Clubs rank', x: 0.3, y: 0.3, size: 0.14, opacity: 1 }],
          s: [{ id: 'rank', kind: 'rank', name: 'Spades rank', x: 0.4, y: 0.4, size: 0.14, opacity: 1 }],
        },
      },
    ]);
    expect(themeLayersForSuit(themes[0]!, 'd')[0]!.name).toBe('Diamonds rank');
    expect(themeLayersForSuit(themes[0]!, 's')[0]!.x).toBe(0.4);
  });

  it('ensures exactly one default theme', () => {
    const base = defaultCardFaceThemes()[0]!;
    const layersBySuit = {
      h: base.layersBySuit.h.map((l) => ({ ...l })),
      d: base.layersBySuit.d.map((l) => ({ ...l })),
      c: base.layersBySuit.c.map((l) => ({ ...l })),
      s: base.layersBySuit.s.map((l) => ({ ...l })),
    };
    const themes = normalizeCardFaceThemes([
      {
        id: 'a',
        name: 'A',
        isDefault: true,
        suitColors: base.suitColors,
        layersBySuit,
      },
      {
        id: 'b',
        name: 'B',
        isDefault: true,
        suitColors: base.suitColors,
        layersBySuit,
      },
    ]);
    expect(themes.filter((t) => t.isDefault)).toHaveLength(1);
    expect(themes[0]!.isDefault).toBe(true);
    expect(themes[1]!.isDefault).toBe(false);
  });

  it('layersFromLegacyElements preserves classic ids', () => {
    const layers = layersFromLegacyElements(defaultClassicElements());
    expect(layers.map((l) => l.id)).toEqual(['rank', 'cornerSuit', 'centerSuit']);
  });
});

describe('resolveCardFaceTheme', () => {
  it('falls back to default when id is unknown', () => {
    const themes = defaultCardFaceThemes();
    const resolved = resolveCardFaceTheme(themes, 'missing');
    expect(resolved.id).toBe(DEFAULT_CARD_THEME_ID);
  });

  it('resolveDefaultCardThemeId picks flagged default', () => {
    const base = defaultCardFaceThemes()[0]!;
    const themes = normalizeCardFaceThemes([
      {
        id: 'custom',
        name: 'Custom',
        isDefault: true,
        suitColors: base.suitColors,
        layersBySuit: {
          h: base.layersBySuit.h.map((l) => ({ ...l })),
          d: base.layersBySuit.d.map((l) => ({ ...l })),
          c: base.layersBySuit.c.map((l) => ({ ...l })),
          s: base.layersBySuit.s.map((l) => ({ ...l })),
        },
      },
    ]);
    expect(resolveDefaultCardThemeId(themes)).toBe('custom');
  });
});
