/** Server mirror of apps/web/lib/cardFaceTheme.ts — keep in sync. */

import { DEFAULT_LAYER_SVG, sanitizeCardFaceSvg } from './card-face-svg.js';

export type CardFaceLayerKind = 'rank' | 'suit' | 'svg';

export type SuitKey = 'h' | 'd' | 'c' | 's';

export const SUIT_KEYS: readonly SuitKey[] = ['h', 'd', 'c', 's'] as const;

export interface CardFaceLayer {
  id: string;
  kind: CardFaceLayerKind;
  name: string;
  x: number;
  y: number;
  size: number;
  opacity: number;
  svg?: string;
}

export type CardFaceElementId = 'rank' | 'cornerSuit' | 'centerSuit';

export interface CardFaceElementLayout {
  x: number;
  y: number;
  size: number;
}

export type CardFaceElements = Record<CardFaceElementId, CardFaceElementLayout>;

export interface CardFaceSuitColors {
  h: string;
  d: string;
  c: string;
  s: string;
}

export type CardFaceLayersBySuit = Record<SuitKey, CardFaceLayer[]>;

export interface CardFaceTheme {
  id: string;
  name: string;
  isDefault?: boolean;
  suitColors: CardFaceSuitColors;
  layersBySuit: CardFaceLayersBySuit;
}

export const MAX_CARD_FACE_THEMES = 12;
export const MAX_CARD_FACE_LAYERS = 24;
export const DEFAULT_CARD_THEME_ID = 'classic';

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

const LEGACY_ELEMENT_META: { id: CardFaceElementId; kind: CardFaceLayerKind; name: string }[] = [
  { id: 'rank', kind: 'rank', name: 'Rank (number)' },
  { id: 'cornerSuit', kind: 'suit', name: 'Corner suit' },
  { id: 'centerSuit', kind: 'suit', name: 'Center suit' },
];

export function defaultClassicElements(): CardFaceElements {
  return {
    rank: { x: 0.08, y: 0.06, size: 0.14 },
    cornerSuit: { x: 0.08, y: 0.14, size: 0.1 },
    centerSuit: { x: 0.5, y: 0.54, size: 0.33 },
  };
}

export function layersFromLegacyElements(elements: CardFaceElements): CardFaceLayer[] {
  return LEGACY_ELEMENT_META.map((meta) => ({
    id: meta.id,
    kind: meta.kind,
    name: meta.name,
    opacity: 1,
    ...elements[meta.id],
  }));
}

export function defaultClassicLayers(): CardFaceLayer[] {
  return layersFromLegacyElements(defaultClassicElements());
}

export function defaultClassicSuitColors(): CardFaceSuitColors {
  return {
    h: '#C8102E',
    d: '#C8102E',
    c: '#1A1A1A',
    s: '#1A1A1A',
  };
}

export function cloneLayers(layers: CardFaceLayer[]): CardFaceLayer[] {
  return layers.map((l) => ({ ...l }));
}

export function defaultLayersBySuit(base?: CardFaceLayer[]): CardFaceLayersBySuit {
  const seed = cloneLayers(base ?? defaultClassicLayers());
  return {
    h: cloneLayers(seed),
    d: cloneLayers(seed),
    c: cloneLayers(seed),
    s: cloneLayers(seed),
  };
}

export function defaultCardFaceThemes(): CardFaceTheme[] {
  return [
    {
      id: DEFAULT_CARD_THEME_ID,
      name: 'Classic',
      isDefault: true,
      suitColors: defaultClassicSuitColors(),
      layersBySuit: defaultLayersBySuit(),
    },
  ];
}

export function themeLayersForSuit(theme: CardFaceTheme, suit: SuitKey): CardFaceLayer[] {
  return theme.layersBySuit[suit] ?? theme.layersBySuit.h;
}

export function copySuitLayers(
  from: CardFaceLayersBySuit,
  source: SuitKey,
  target: SuitKey,
): CardFaceLayersBySuit {
  if (source === target) return from;
  return {
    ...from,
    [target]: cloneLayers(from[source] ?? from.h),
  };
}

function slugThemeId(raw: string, fallback: string): string {
  const s = raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return s.length > 0 ? s : fallback;
}

function slugLayerId(raw: string, fallback: string): string {
  const s = raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return s.length > 0 ? s : fallback;
}

function clampUnit(n: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

function clampSize(n: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(0.8, Math.max(0.02, n));
}

function clampOpacity(n: unknown, fallback = 1): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

function normalizeLayerKind(raw: unknown): CardFaceLayerKind {
  if (raw === 'rank' || raw === 'suit' || raw === 'svg') return raw;
  return 'suit';
}

function normalizeHexColor(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback;
  const t = raw.trim();
  if (HEX_COLOR.test(t)) return t.toUpperCase();
  return fallback;
}

function normalizeElementLayout(
  raw: unknown,
  fallback: CardFaceElementLayout,
): CardFaceElementLayout {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...fallback };
  }
  const o = raw as Record<string, unknown>;
  return {
    x: clampUnit(Number(o.x), fallback.x),
    y: clampUnit(Number(o.y), fallback.y),
    size: clampSize(Number(o.size), fallback.size),
  };
}

function normalizeLegacyElements(raw: unknown): CardFaceElements {
  const fallback = defaultClassicElements();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return fallback;
  }
  const o = raw as Record<string, unknown>;
  return {
    rank: normalizeElementLayout(o.rank, fallback.rank),
    cornerSuit: normalizeElementLayout(o.cornerSuit, fallback.cornerSuit),
    centerSuit: normalizeElementLayout(o.centerSuit, fallback.centerSuit),
  };
}

function normalizeOneLayer(
  raw: unknown,
  index: number,
  usedIds: Set<string>,
): CardFaceLayer | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const kind = normalizeLayerKind(o.kind);
  const fallbackId =
    kind === 'rank' ? `rank-${index + 1}` : kind === 'svg' ? `svg-${index + 1}` : `suit-${index + 1}`;
  let id = slugLayerId(typeof o.id === 'string' ? o.id : fallbackId, fallbackId);
  if (usedIds.has(id)) {
    let n = 2;
    while (usedIds.has(`${id}-${n}`)) n += 1;
    id = `${id}-${n}`;
  }
  usedIds.add(id);
  const defaultLayout =
    kind === 'rank'
      ? { x: 0.5, y: 0.5, size: 0.14 }
      : kind === 'svg'
        ? { x: 0.5, y: 0.5, size: 0.22 }
        : { x: 0.5, y: 0.5, size: 0.2 };
  const layout = normalizeElementLayout(o, defaultLayout);
  const name =
    typeof o.name === 'string' && o.name.trim()
      ? o.name.trim().slice(0, 48)
      : kind === 'rank'
        ? 'Rank'
        : kind === 'svg'
          ? 'SVG'
          : 'Suit';
  const opacity = clampOpacity(o.opacity, 1);
  const layer: CardFaceLayer = { id, kind, name, opacity, ...layout };
  if (kind === 'svg') {
    const svgRaw = typeof o.svg === 'string' ? o.svg : DEFAULT_LAYER_SVG;
    const svg = sanitizeCardFaceSvg(svgRaw);
    if (!svg) return null;
    layer.svg = svg;
  }
  return layer;
}

function normalizeLayers(raw: unknown, legacyElements?: unknown): CardFaceLayer[] {
  const usedIds = new Set<string>();
  const out: CardFaceLayer[] = [];

  if (Array.isArray(raw)) {
    for (let i = 0; i < raw.length && out.length < MAX_CARD_FACE_LAYERS; i++) {
      const layer = normalizeOneLayer(raw[i], i, usedIds);
      if (layer) out.push(layer);
    }
  }

  if (out.length === 0 && legacyElements !== undefined) {
    return layersFromLegacyElements(normalizeLegacyElements(legacyElements));
  }

  if (out.length === 0) {
    return defaultClassicLayers();
  }

  return out;
}

function normalizeSuitColors(raw: unknown, fallback: CardFaceSuitColors): CardFaceSuitColors {
  const out = { ...fallback };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const o = raw as Record<string, unknown>;
  for (const key of SUIT_KEYS) {
    out[key] = normalizeHexColor(o[key], fallback[key]);
  }
  return out;
}

function normalizeLayersForSuit(raw: unknown): CardFaceLayer[] {
  const usedIds = new Set<string>();
  const out: CardFaceLayer[] = [];
  if (!Array.isArray(raw)) return out;
  for (let i = 0; i < raw.length && out.length < MAX_CARD_FACE_LAYERS; i++) {
    const layer = normalizeOneLayer(raw[i], i, usedIds);
    if (layer) out.push(layer);
  }
  return out;
}

function normalizeLayersBySuit(
  rawBag: unknown,
  shared: CardFaceLayer[],
): CardFaceLayersBySuit {
  const fallback = shared.length > 0 ? shared : defaultClassicLayers();
  const base = defaultLayersBySuit(fallback);
  if (!rawBag || typeof rawBag !== 'object' || Array.isArray(rawBag)) {
    return base;
  }
  const bag = rawBag as Record<string, unknown>;
  const out = { ...base };
  for (const key of SUIT_KEYS) {
    const normalized = normalizeLayersForSuit(bag[key]);
    if (normalized.length > 0) {
      out[key] = normalized;
    }
  }
  return out;
}

function normalizeOneTheme(raw: unknown, index: number, usedIds: Set<string>): CardFaceTheme | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const fallbackId = `theme-${index + 1}`;
  let id = slugThemeId(typeof o.id === 'string' ? o.id : fallbackId, fallbackId);
  if (usedIds.has(id)) {
    let n = 2;
    while (usedIds.has(`${id}-${n}`)) n += 1;
    id = `${id}-${n}`;
  }
  usedIds.add(id);
  const name =
    typeof o.name === 'string' && o.name.trim()
      ? o.name.trim().slice(0, 48)
      : id === DEFAULT_CARD_THEME_ID
        ? 'Classic'
        : `Theme ${index + 1}`;
  const defaultColors = defaultClassicSuitColors();
  const shared = normalizeLayers(o.layers, o.elements);
  return {
    id,
    name,
    isDefault: o.isDefault === true,
    suitColors: normalizeSuitColors(o.suitColors, defaultColors),
    layersBySuit: normalizeLayersBySuit(o.layersBySuit, shared),
  };
}

export function normalizeCardFaceThemes(raw: unknown): CardFaceTheme[] {
  const classic = defaultCardFaceThemes()[0]!;
  if (!Array.isArray(raw) || raw.length === 0) {
    return [classic];
  }
  const usedIds = new Set<string>();
  const out: CardFaceTheme[] = [];
  for (let i = 0; i < raw.length && out.length < MAX_CARD_FACE_THEMES; i++) {
    const t = normalizeOneTheme(raw[i], i, usedIds);
    if (t) out.push(t);
  }
  if (out.length === 0) return [classic];
  const defaultIdx = out.findIndex((t) => t.isDefault);
  if (defaultIdx >= 0) {
    return out.map((t, i) => ({ ...t, isDefault: i === defaultIdx }));
  }
  const classicIdx = out.findIndex((t) => t.id === DEFAULT_CARD_THEME_ID);
  const idx = classicIdx >= 0 ? classicIdx : 0;
  return out.map((t, i) => ({ ...t, isDefault: i === idx }));
}

export function resolveDefaultCardThemeId(themes: CardFaceTheme[]): string {
  const normalized = normalizeCardFaceThemes(themes);
  return normalized.find((t) => t.isDefault)?.id ?? normalized[0]?.id ?? DEFAULT_CARD_THEME_ID;
}

export function clampCardThemeId(
  raw: string | null | undefined,
  allowedIds: readonly string[],
  fallback: string,
): string {
  const id = typeof raw === 'string' ? raw.trim().slice(0, 64) : '';
  if (id && allowedIds.includes(id)) return id;
  if (allowedIds.includes(fallback)) return fallback;
  return allowedIds[0] ?? DEFAULT_CARD_THEME_ID;
}
