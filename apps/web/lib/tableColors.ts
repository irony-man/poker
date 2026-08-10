/** Preset table themes used on online and offline tables (viewer preference). */

export const TABLE_COLOR_PRESET_COUNT = 9;

/**
 * Full theme token bag. RGB values are space-separated channels
 * for `rgb(var(--x) / <alpha>)` CSS custom properties.
 */
export interface TableColorPreset {
  id: number;
  label: string;
  /** Solid swatch hex for pickers. */
  swatch: string;
  /** Contrast notes for QA (not rendered). */
  contrastNotes: string;
  felt: string;
  feltDeep: string;
  feltMid: string;
  feltEdge: string;
  feltRim: string;
  feltRimEdge: string;
  /** Seat stack / dealer chrome fill (≥4.5:1 with textOnChrome). */
  chrome: string;
  chromeRaised: string;
  textOnChrome: string;
  /** On-felt status labels (All-in, Ready) with drop-shadow. */
  textMutedOnFelt: string;
  /** Non-RGY primary accent on table (winner bar). */
  accent: string;
  accentHover: string;
  accentActive: string;
  accentFg: string;
  focusRing: string;
  chipFace: string;
  chipRim: string;
  chipInk: string;
}

/**
 * 0 Purple · 1 Indigo · 2 Royal blue · 3 Plum · 4 Charcoal
 * 5 Emerald · 6 Burgundy · 7 Teal · 8 Sand
 * Accents avoid pure red/green/yellow reserved for danger/success/warning.
 */
export const TABLE_COLOR_PRESETS: readonly TableColorPreset[] = [
  {
    id: 0,
    label: 'Purple',
    // chrome #1d0432 vs text #f2eae8 ≈ 14:1; accent #d6ba80 vs fg #1a1008 ≈ 9:1
    contrastNotes: 'chrome/text ≥14:1; accent/fg ≥9:1',
    swatch: '#1d0432',
    felt: '29 4 50',
    feltDeep: '18 2 32',
    feltMid: '52 18 82',
    feltEdge: '#0a0414',
    feltRim: '18 2 32',
    feltRimEdge: '168 140 162',
    chrome: '29 4 50',
    chromeRaised: '46 16 72',
    textOnChrome: '242 234 232',
    textMutedOnFelt: '236 218 176',
    accent: '214 186 128',
    accentHover: '228 204 156',
    accentActive: '180 150 92',
    accentFg: '26 16 8',
    focusRing: '236 218 176',
    chipFace: '29 4 50',
    chipRim: '214 186 128',
    chipInk: '255 240 210',
  },
  {
    id: 1,
    label: 'Indigo',
    // chrome #121a3a vs cream ≈ 13:1; cool silver accent on dark ink
    contrastNotes: 'chrome/text ≥13:1; accent/fg ≥8:1',
    swatch: '#1a2550',
    felt: '26 40 88',
    feltDeep: '14 22 52',
    feltMid: '40 56 112',
    feltEdge: '#0a1028',
    feltRim: '28 32 48',
    feltRimEdge: '160 168 196',
    chrome: '18 26 58',
    chromeRaised: '32 42 78',
    textOnChrome: '242 240 246',
    textMutedOnFelt: '200 208 228',
    accent: '192 200 220',
    accentHover: '212 218 232',
    accentActive: '156 166 192',
    accentFg: '16 20 36',
    focusRing: '220 226 242',
    chipFace: '18 26 58',
    chipRim: '192 200 220',
    chipInk: '244 246 252',
  },
  {
    id: 2,
    label: 'Royal blue',
    // chrome #0c2248 vs cream ≈ 12:1
    contrastNotes: 'chrome/text ≥12:1; ice brass/fg ≥8:1',
    swatch: '#123060',
    felt: '18 48 96',
    feltDeep: '10 28 58',
    feltMid: '28 64 120',
    feltEdge: '#061428',
    feltRim: '28 36 52',
    feltRimEdge: '150 170 200',
    chrome: '12 34 72',
    chromeRaised: '22 48 92',
    textOnChrome: '240 244 250',
    textMutedOnFelt: '200 216 236',
    accent: '196 210 228',
    accentHover: '216 226 238',
    accentActive: '160 176 200',
    accentFg: '12 22 40',
    focusRing: '210 222 238',
    chipFace: '12 34 72',
    chipRim: '196 210 228',
    chipInk: '244 248 255',
  },
  {
    id: 3,
    label: 'Plum',
    // cool plum — not danger red; chrome vs cream ≥12:1
    contrastNotes: 'chrome/text ≥12:1; warm brass/fg ≥8:1',
    swatch: '#3a1840',
    felt: '58 28 64',
    feltDeep: '36 16 42',
    feltMid: '78 40 88',
    feltEdge: '#140818',
    feltRim: '40 24 36',
    feltRimEdge: '176 148 168',
    chrome: '42 20 52',
    chromeRaised: '62 32 72',
    textOnChrome: '246 236 240',
    textMutedOnFelt: '228 200 210',
    accent: '214 186 150',
    accentHover: '228 204 176',
    accentActive: '180 150 110',
    accentFg: '28 16 12',
    focusRing: '236 216 224',
    chipFace: '42 20 52',
    chipRim: '214 186 150',
    chipInk: '255 244 232',
  },
  {
    id: 4,
    label: 'Charcoal',
    // neutral slate; pearl brass accent
    contrastNotes: 'chrome/text ≥13:1; pearl/fg ≥9:1',
    swatch: '#24262a',
    felt: '36 38 42',
    feltDeep: '20 22 26',
    feltMid: '48 50 56',
    feltEdge: '#0a0a0c',
    feltRim: '28 24 20',
    feltRimEdge: '150 140 128',
    chrome: '28 30 34',
    chromeRaised: '44 46 52',
    textOnChrome: '242 238 234',
    textMutedOnFelt: '210 206 198',
    accent: '214 200 176',
    accentHover: '228 218 200',
    accentActive: '176 164 140',
    accentFg: '22 20 16',
    focusRing: '230 224 214',
    chipFace: '28 30 34',
    chipRim: '214 200 176',
    chipInk: '250 246 240',
  },
  {
    id: 5,
    label: 'Emerald',
    // classic casino green felt; champagne accent (not status green)
    contrastNotes: 'chrome/text ≥12:1; champagne/fg ≥9:1',
    swatch: '#0e3a28',
    felt: '14 58 40',
    feltDeep: '8 36 24',
    feltMid: '28 78 54',
    feltEdge: '#04140c',
    feltRim: '24 32 22',
    feltRimEdge: '156 180 148',
    chrome: '12 40 28',
    chromeRaised: '22 58 42',
    textOnChrome: '240 246 238',
    textMutedOnFelt: '210 224 196',
    accent: '220 198 148',
    accentHover: '232 214 176',
    accentActive: '184 160 108',
    accentFg: '18 16 8',
    focusRing: '220 228 200',
    chipFace: '12 40 28',
    chipRim: '220 198 148',
    chipInk: '252 248 236',
  },
  {
    id: 6,
    label: 'Burgundy',
    // deep wine felt; soft rose metal (not danger red)
    contrastNotes: 'chrome/text ≥12:1; rose metal/fg ≥8:1',
    swatch: '#3a1420',
    felt: '58 20 32',
    feltDeep: '36 12 20',
    feltMid: '80 32 48',
    feltEdge: '#14060a',
    feltRim: '40 22 26',
    feltRimEdge: '184 144 152',
    chrome: '44 16 26',
    chromeRaised: '64 28 40',
    textOnChrome: '248 236 238',
    textMutedOnFelt: '228 196 200',
    accent: '210 178 158',
    accentHover: '226 200 184',
    accentActive: '176 142 120',
    accentFg: '28 14 12',
    focusRing: '232 208 212',
    chipFace: '44 16 26',
    chipRim: '210 178 158',
    chipInk: '255 244 240',
  },
  {
    id: 7,
    label: 'Teal',
    // deep teal felt; cool silver accent
    contrastNotes: 'chrome/text ≥12:1; silver/fg ≥8:1',
    swatch: '#0e3a40',
    felt: '14 58 64',
    feltDeep: '8 36 42',
    feltMid: '26 78 86',
    feltEdge: '#041416',
    feltRim: '24 36 40',
    feltRimEdge: '148 180 184',
    chrome: '12 42 48',
    chromeRaised: '22 60 68',
    textOnChrome: '236 246 248',
    textMutedOnFelt: '188 220 224',
    accent: '180 208 214',
    accentHover: '204 224 228',
    accentActive: '144 176 184',
    accentFg: '12 24 28',
    focusRing: '200 228 232',
    chipFace: '12 42 48',
    chipRim: '180 208 214',
    chipInk: '244 252 254',
  },
  {
    id: 8,
    label: 'Sand',
    // warm tobacco felt; ivory pearl accent
    contrastNotes: 'chrome/text ≥12:1; pearl/fg ≥9:1',
    swatch: '#3a3020',
    felt: '58 48 32',
    feltDeep: '36 28 18',
    feltMid: '78 64 42',
    feltEdge: '#141008',
    feltRim: '40 32 22',
    feltRimEdge: '176 156 124',
    chrome: '44 36 24',
    chromeRaised: '62 52 36',
    textOnChrome: '246 240 228',
    textMutedOnFelt: '220 206 176',
    accent: '220 204 168',
    accentHover: '232 220 192',
    accentActive: '184 166 128',
    accentFg: '24 18 10',
    focusRing: '232 220 188',
    chipFace: '44 36 24',
    chipRim: '220 204 168',
    chipInk: '252 246 232',
  },
] as const;

const TABLE_COLOR_KEY = 'felt-table-color-id';

export function clampTableColorId(id: number | undefined | null, fallback = 0): number {
  if (id == null || !Number.isFinite(id) || !Number.isInteger(id)) {
    return ((fallback % TABLE_COLOR_PRESET_COUNT) + TABLE_COLOR_PRESET_COUNT) % TABLE_COLOR_PRESET_COUNT;
  }
  return ((id % TABLE_COLOR_PRESET_COUNT) + TABLE_COLOR_PRESET_COUNT) % TABLE_COLOR_PRESET_COUNT;
}

export function tableColorPreset(id: number | undefined | null): TableColorPreset {
  return TABLE_COLOR_PRESETS[clampTableColorId(id)]!;
}

export function loadSavedTableColorId(): number {
  try {
    const raw = localStorage.getItem(TABLE_COLOR_KEY);
    if (raw == null) return 0;
    const n = Number(raw);
    if (Number.isInteger(n) && n >= 0) return clampTableColorId(n);
  } catch {
    /* ignore */
  }
  return 0;
}

export function saveTableColorId(id: number): void {
  try {
    localStorage.setItem(TABLE_COLOR_KEY, String(clampTableColorId(id)));
  } catch {
    /* ignore */
  }
}
