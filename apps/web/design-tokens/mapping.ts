/**
 * Palette v2 mapping (§5). Baseline triplets are the colours in theme.css today.
 * Palette refs resolve through tokens-modes.json / tokens.json when the
 * `data-palette="v2"` flag is on. `keep` leaves the baseline triplet.
 *
 * Assumptions are called out in ROLLOUT.md (G1–G8).
 */

export type ModeName = 'Classic' | 'Glass' | 'Arcade';

export type ColourRef =
  | { kind: 'keep' }
  | { kind: 'role'; role: string }
  | { kind: 'hex'; hex: string }
  | { kind: 'primitive'; match: string }
  | { kind: 'raw'; value: string };

export type Block = {
  /** Selector as it appears in theme.css. `:root` is Classic. */
  selector: string;
  mode: ModeName;
  baseline: Record<string, string>;
  /**
   * Palette overrides. Custom props are RGB triplets (or a full `color:` value
   * when the key is `color`). Omitted keys stay on the baseline.
   */
  palette: Record<string, ColourRef>;
};

const brand = { kind: 'role', role: 'brand' } as const;
const page = { kind: 'role', role: 'bg_page' } as const;
const subtle = { kind: 'role', role: 'bg_subtle' } as const;
const card = { kind: 'role', role: 'card' } as const;
const raised = { kind: 'role', role: 'raised' } as const;
const text = { kind: 'role', role: 'text_primary' } as const;
const secondary = { kind: 'role', role: 'text_secondary' } as const;
const focus = { kind: 'role', role: 'focus' } as const;
const accent = { kind: 'role', role: 'accent' } as const;
const accentText = { kind: 'role', role: 'accent_text' } as const;
const danger = { kind: 'role', role: 'danger' } as const;
const success = { kind: 'role', role: 'success' } as const;
const borderStrong = { kind: 'role', role: 'border_strong' } as const;
const gold300 = { kind: 'primitive', match: '--gold-300' } as const;

/** Dark pigment so existing `/NN` alphas still read (§5.3). */
const pigmentDark = { kind: 'hex', hex: '#1e0536' } as const;
const pigmentLight = { kind: 'hex', hex: '#ffffff' } as const;
const creamMuted = { kind: 'hex', hex: '#c4b2d6' } as const;
const aubergine900 = { kind: 'primitive', match: '--aubergine-900' } as const;
const aubergine700 = { kind: 'primitive', match: '--aubergine-700' } as const;
const aubergine950 = { kind: 'primitive', match: '--aubergine-950' } as const;
const aubergine800 = { kind: 'hex', hex: '#2b0b4a' } as const;
const glassEnd = { kind: 'hex', hex: '#0c0518' } as const;
const white = { kind: 'hex', hex: '#ffffff' } as const;

export const blocks: Block[] = [
  {
    selector: ':root',
    mode: 'Classic',
    baseline: {
      '--bg-page': '230 217 215',
      '--bg-panel': '29 4 50',
      '--bg-raised': '46 16 72',
      '--bg-overlay': '8 3 14',
      '--bg-chrome': '29 4 50',
      '--text-primary': '29 4 50',
      '--text-muted': '68 48 74',
      '--on-chrome': '230 217 215',
      '--border-subtle': '29 4 50',
      '--border-strong': '29 4 50',
      '--focus-ring': '29 4 50',
      '--ink': '14 6 24',
      '--ink-panel': '29 4 50',
      '--ink-raised': '46 16 72',
      '--ink-overlay': '8 3 14',
      '--sidebar': '29 4 50',
      '--mushroom': '230 217 215',
      '--lobby-card': '237 228 226',
      '--ink-strong': '29 4 50',
      '--ink-strong-muted': '68 48 74',
      '--felt': '29 4 50',
      '--felt-deep': '18 2 32',
      '--felt-rim': '18 2 32',
      '--felt-rim-edge': '168 140 162',
      '--brass': '214 186 128',
      '--brass-light': '236 218 176',
      '--brass-dim': '118 92 48',
      '--cream': '242 234 232',
      '--cream-muted': '206 190 204',
      '--danger': '192 57 43',
      '--positive': '72 168 122',
      '--patina': '186 162 198',
      '--patina-dim': '88 62 112',
      '--card-face': '250 247 240',
      '--card-back': '230 217 215',
      '--card-red': '200 16 46',
      '--card-ink': '26 26 26',
      '--glass-fill': '255 252 250',
      '--glass-fill-strong': '255 255 255',
      '--glass-stroke': '255 255 255',
      '--glass-highlight': '255 255 255',
    },
    palette: {
      '--bg-page': page,
      '--bg-panel': aubergine900,
      '--bg-raised': aubergine700,
      '--bg-overlay': aubergine950,
      '--bg-chrome': brand,
      '--text-primary': text,
      '--text-muted': secondary,
      '--on-chrome': page,
      '--border-subtle': pigmentDark,
      '--border-strong': borderStrong,
      '--focus-ring': focus,
      '--ink': aubergine950,
      '--ink-panel': brand,
      '--ink-raised': aubergine700,
      '--ink-overlay': aubergine950,
      '--sidebar': brand,
      '--mushroom': page,
      '--lobby-card': subtle,
      '--ink-strong': text,
      '--ink-strong-muted': secondary,
      '--felt': { kind: 'keep' },
      '--felt-deep': { kind: 'keep' },
      '--felt-rim': { kind: 'keep' },
      '--felt-rim-edge': { kind: 'keep' },
      '--brass': accent,
      '--brass-light': gold300,
      '--brass-dim': accentText,
      '--cream': page,
      '--cream-muted': creamMuted,
      '--danger': danger,
      '--positive': success,
      '--patina': { kind: 'keep' },
      '--patina-dim': { kind: 'keep' },
      '--card-face': { kind: 'keep' },
      '--card-back': { kind: 'keep' },
      '--card-red': { kind: 'keep' },
      '--card-ink': { kind: 'keep' },
      '--glass-fill': { kind: 'keep' },
      '--glass-fill-strong': { kind: 'keep' },
      '--glass-stroke': { kind: 'keep' },
      '--glass-highlight': { kind: 'keep' },
    },
  },
  {
    selector: '.hud-panel',
    mode: 'Classic',
    baseline: {
      '--text-primary': '242 234 232',
      '--text-muted': '206 190 204',
      '--border-subtle': '230 217 215',
      '--border-strong': '230 217 215',
      '--focus-ring': '230 217 215',
    },
    palette: {
      /* G8: dark HUD has no Classic role. Light text from the Glass text scale. */
      '--text-primary': white,
      '--text-muted': creamMuted,
      '--border-subtle': page,
      '--border-strong': page,
      '--focus-ring': focus,
    },
  },
  {
    selector: '.play-chat-column,\n.chat-panel-shell,\n.play-action-dock,\n.recent-chat-ticker',
    mode: 'Classic',
    baseline: {
      '--text-primary': '29 4 50',
      '--text-muted': '68 48 74',
      '--border-subtle': '29 4 50',
      '--border-strong': '29 4 50',
      '--focus-ring': '29 4 50',
    },
    palette: {
      '--text-primary': text,
      '--text-muted': secondary,
      '--border-subtle': pigmentDark,
      '--border-strong': borderStrong,
      '--focus-ring': focus,
    },
  },
  {
    selector: '.lobby-shell,\n.lobby-paper',
    mode: 'Classic',
    baseline: {
      '--bg-panel': '255 252 250',
      '--bg-raised': '237 228 226',
      '--text-primary': '29 4 50',
      '--text-muted': '68 48 74',
      '--border-subtle': '29 4 50',
      '--border-strong': '29 4 50',
      '--focus-ring': '29 4 50',
    },
    palette: {
      '--bg-panel': card,
      '--bg-raised': subtle,
      '--text-primary': text,
      '--text-muted': secondary,
      '--border-subtle': pigmentDark,
      '--border-strong': borderStrong,
      '--focus-ring': focus,
    },
  },
  {
    selector: '.lobby-shell .hud-panel',
    mode: 'Classic',
    baseline: {
      '--bg-panel': '255 252 250',
      '--bg-raised': '237 228 226',
      '--text-primary': '29 4 50',
      '--text-muted': '68 48 74',
      '--border-subtle': '29 4 50',
      '--border-strong': '29 4 50',
      '--ink-strong': '29 4 50',
      '--ink-strong-muted': '68 48 74',
    },
    palette: {
      '--bg-panel': card,
      '--bg-raised': subtle,
      '--text-primary': text,
      '--text-muted': secondary,
      '--border-subtle': pigmentDark,
      '--border-strong': borderStrong,
      '--ink-strong': text,
      '--ink-strong-muted': secondary,
    },
  },
  {
    selector: '.lobby-sidebar',
    mode: 'Classic',
    baseline: {
      '--text-primary': '230 217 215',
      '--text-muted': '206 190 204',
      '--on-chrome': '230 217 215',
      '--border-subtle': '230 217 215',
    },
    palette: {
      '--text-primary': page,
      '--text-muted': creamMuted,
      '--on-chrome': page,
      '--border-subtle': page,
    },
  },
  {
    selector: "html[data-ui-theme='v2']",
    mode: 'Arcade',
    baseline: {
      '--bg-page': '253 233 61',
      '--bg-panel': '76 29 149',
      '--bg-raised': '109 40 217',
      '--bg-overlay': '18 6 32',
      '--bg-chrome': '91 33 182',
      '--text-primary': '26 16 40',
      '--text-muted': '72 48 96',
      '--on-chrome': '255 255 255',
      '--border-subtle': '26 16 40',
      '--border-strong': '0 0 0',
      '--focus-ring': '91 33 182',
      '--ink': '26 10 46',
      '--ink-panel': '76 29 149',
      '--ink-raised': '109 40 217',
      '--ink-overlay': '18 6 32',
      '--sidebar': '91 33 182',
      '--mushroom': '253 233 61',
      '--lobby-card': '255 245 157',
      '--ink-strong': '26 16 40',
      '--ink-strong-muted': '72 48 96',
      '--cream': '255 255 255',
      '--cream-muted': '214 196 232',
    },
    palette: {
      '--bg-page': page,
      '--bg-panel': aubergine900,
      '--bg-raised': aubergine700,
      '--bg-overlay': aubergine950,
      '--bg-chrome': brand,
      '--text-primary': text,
      '--text-muted': secondary,
      '--on-chrome': white,
      '--border-subtle': pigmentDark,
      '--border-strong': borderStrong,
      '--focus-ring': focus,
      '--ink': aubergine950,
      '--ink-panel': brand,
      '--ink-raised': aubergine700,
      '--ink-overlay': aubergine950,
      '--sidebar': brand,
      '--mushroom': page,
      '--lobby-card': subtle,
      '--ink-strong': text,
      '--ink-strong-muted': secondary,
      '--cream': white,
      '--cream-muted': creamMuted,
      '--brass': accent,
      '--brass-light': gold300,
      '--brass-dim': accentText,
      '--danger': danger,
      '--positive': success,
    },
  },
  {
    selector: "html[data-ui-theme='v2'] .lobby-shell,\nhtml[data-ui-theme='v2'] .lobby-paper",
    mode: 'Arcade',
    baseline: {
      '--bg-panel': '255 255 255',
      '--bg-raised': '255 245 157',
      '--text-primary': '26 16 40',
      '--text-muted': '72 48 96',
    },
    palette: {
      '--bg-panel': card,
      '--bg-raised': subtle,
      '--text-primary': text,
      '--text-muted': secondary,
    },
  },
  {
    selector: "html[data-ui-theme='v2'] .lobby-shell .hud-panel",
    mode: 'Arcade',
    baseline: {
      '--bg-panel': '255 255 255',
      '--bg-raised': '255 245 157',
      '--text-primary': '26 16 40',
      '--text-muted': '72 48 96',
      '--ink-strong': '26 16 40',
      '--ink-strong-muted': '72 48 96',
    },
    palette: {
      '--bg-panel': card,
      '--bg-raised': subtle,
      '--text-primary': text,
      '--text-muted': secondary,
      '--ink-strong': text,
      '--ink-strong-muted': secondary,
    },
  },
  {
    selector: "html[data-ui-theme='v2'] .lobby-sidebar",
    mode: 'Arcade',
    baseline: {
      '--mushroom': '255 255 255',
      '--cream': '255 255 255',
      '--on-chrome': '255 255 255',
      '--text-primary': '255 255 255',
      '--text-muted': '214 196 232',
    },
    palette: {
      '--mushroom': white,
      '--cream': white,
      '--on-chrome': white,
      '--text-primary': white,
      '--text-muted': creamMuted,
    },
  },
  {
    selector: "html[data-ui-theme='v2'] .hud-panel",
    mode: 'Arcade',
    baseline: {
      '--text-primary': '255 255 255',
      '--text-muted': '214 196 232',
      '--border-subtle': '255 255 255',
      '--on-chrome': '255 255 255',
    },
    palette: {
      '--text-primary': white,
      '--text-muted': creamMuted,
      '--border-subtle': pigmentLight,
      '--on-chrome': white,
    },
  },
  {
    selector: "html[data-ui-theme='v3']",
    mode: 'Glass',
    baseline: {
      '--bg-page': '42 24 72',
      '--bg-panel': '28 18 56',
      '--bg-raised': '52 36 96',
      '--bg-overlay': '6 4 16',
      '--bg-chrome': '96 64 168',
      '--text-primary': '255 255 255',
      '--text-muted': '214 204 232',
      '--on-chrome': '255 255 255',
      '--border-subtle': '214 204 232',
      '--border-strong': '210 236 255',
      '--focus-ring': '210 236 255',
      '--ink': '10 6 22',
      '--ink-panel': '28 18 56',
      '--ink-raised': '52 36 96',
      '--ink-overlay': '6 4 16',
      '--sidebar': '96 64 168',
      '--mushroom': '42 24 72',
      '--lobby-card': '244 240 250',
      '--ink-strong': '22 12 40',
      '--ink-strong-muted': '214 204 232',
      '--cream': '255 255 255',
      '--cream-muted': '214 204 232',
      '--glass-fill': '255 255 255',
      '--glass-fill-strong': '255 255 255',
      '--glass-stroke': '255 255 255',
      '--glass-highlight': '210 236 255',
    },
    palette: {
      /* G1: chrome stays aubergine, not Glass brand gold. G2: page is the flat stop. */
      '--bg-page': page,
      '--bg-panel': card,
      '--bg-raised': raised,
      '--bg-overlay': glassEnd,
      '--bg-chrome': aubergine800,
      '--text-primary': text,
      '--text-muted': secondary,
      '--on-chrome': white,
      '--border-subtle': pigmentLight,
      '--border-strong': pigmentLight,
      '--focus-ring': focus,
      '--ink': glassEnd,
      '--ink-panel': aubergine700,
      '--ink-raised': raised,
      '--ink-overlay': glassEnd,
      '--sidebar': aubergine800,
      '--mushroom': page,
      '--lobby-card': subtle,
      '--ink-strong': text,
      '--ink-strong-muted': secondary,
      '--cream': white,
      '--cream-muted': creamMuted,
      '--brass': accent,
      '--brass-light': gold300,
      '--brass-dim': accentText,
      '--danger': danger,
      '--positive': success,
      '--glass-fill': pigmentLight,
      '--glass-fill-strong': pigmentLight,
      '--glass-stroke': pigmentLight,
      '--glass-highlight': pigmentLight,
    },
  },
  {
    selector: "html[data-ui-theme='v3'] .lobby-shell,\nhtml[data-ui-theme='v3'] .lobby-paper",
    mode: 'Glass',
    baseline: {
      '--text-primary': '255 255 255',
      '--text-muted': '226 218 242',
      '--border-subtle': '214 204 232',
      '--border-strong': '210 236 255',
      '--focus-ring': '210 236 255',
      '--bg-panel': '255 252 250',
      '--bg-raised': '244 240 250',
    },
    palette: {
      /* G3: lobby paper follows the dark Glass card, with light text. */
      '--text-primary': text,
      '--text-muted': secondary,
      '--border-subtle': pigmentLight,
      '--border-strong': pigmentLight,
      '--focus-ring': focus,
      '--bg-panel': card,
      '--bg-raised': raised,
    },
  },
  {
    selector: [
      "html[data-ui-theme='v3'] .lobby-shell .hud-panel",
      "html[data-ui-theme='v3'] .surface-card",
      "html[data-ui-theme='v3'] .surface-card-lg",
      "html[data-ui-theme='v3'] .surface-modal",
      "html[data-ui-theme='v3'] .surface-row",
      "html[data-ui-theme='v3'] .surface-empty",
      "html[data-ui-theme='v3'] .surface-empty-lg",
      "html[data-ui-theme='v3'] .surface-list",
      "html[data-ui-theme='v3'] .glass-sheet",
    ].join(',\n'),
    mode: 'Glass',
    baseline: {
      '--bg-page': '255 252 250',
      '--bg-panel': '255 252 250',
      '--bg-raised': '244 240 250',
      '--text-primary': '22 12 40',
      '--text-muted': '58 40 82',
      '--border-subtle': '56 32 120',
      '--border-strong': '56 32 120',
      '--focus-ring': '56 32 120',
      '--mushroom': '255 252 250',
      '--lobby-card': '244 240 250',
      '--ink-strong': '22 12 40',
      '--ink-strong-muted': '58 40 82',
      '--sidebar': '56 32 120',
      color: 'rgb(22 12 40)',
    },
    palette: {
      '--bg-page': card,
      '--bg-panel': card,
      '--bg-raised': raised,
      '--text-primary': text,
      '--text-muted': secondary,
      '--border-subtle': pigmentLight,
      '--border-strong': pigmentLight,
      '--focus-ring': focus,
      '--mushroom': card,
      '--lobby-card': subtle,
      '--ink-strong': text,
      '--ink-strong-muted': secondary,
      '--sidebar': pigmentLight,
      color: { kind: 'raw', value: 'rgb(var(--text-primary))' },
    },
  },
  {
    selector: "html[data-ui-theme='v3'] .lobby-sidebar,\nhtml[data-ui-theme='v3'] .lobby-main > header",
    mode: 'Glass',
    baseline: {
      '--mushroom': '255 255 255',
      '--cream': '255 255 255',
      '--on-chrome': '255 255 255',
      '--text-primary': '255 255 255',
      '--text-muted': '214 204 232',
    },
    palette: {
      '--mushroom': white,
      '--cream': white,
      '--on-chrome': white,
      '--text-primary': white,
      '--text-muted': secondary,
    },
  },
  {
    selector: [
      "html[data-ui-theme='v3'] .play-chat-column",
      "html[data-ui-theme='v3'] .chat-panel-shell",
      "html[data-ui-theme='v3'] .play-action-dock",
      "html[data-ui-theme='v3'] .recent-chat-ticker",
      "html[data-ui-theme='v3'] .play-chat-column .glass-sheet",
      "html[data-ui-theme='v3'] .chat-panel-shell .glass-sheet",
      "html[data-ui-theme='v3'] .play-action-dock.glass-sheet",
      "html[data-ui-theme='v3'] .play-action-dock .glass-sheet",
    ].join(',\n'),
    mode: 'Glass',
    baseline: {
      '--bg-panel': '28 18 56',
      '--bg-raised': '52 36 96',
      '--text-primary': '255 252 250',
      '--text-muted': '214 204 232',
      '--on-chrome': '255 255 255',
      '--border-subtle': '210 236 255',
      '--mushroom': '255 252 250',
      '--ink-strong': '255 252 250',
      '--ink-strong-muted': '214 204 232',
      '--sidebar': '196 168 255',
    },
    palette: {
      '--bg-panel': card,
      '--bg-raised': raised,
      '--text-primary': text,
      '--text-muted': secondary,
      '--on-chrome': white,
      '--border-subtle': pigmentLight,
      '--mushroom': white,
      '--ink-strong': text,
      '--ink-strong-muted': secondary,
      '--sidebar': pigmentLight,
    },
  },
];

/** Extra palette-only selectors that live in globals.css today. */
export const paletteOnly: Block[] = [
  {
    selector: "html[data-ui-theme='v3'] .bot-chat-panel.chat-panel-shell",
    mode: 'Glass',
    baseline: {},
    palette: {
      '--bg-page': card,
      '--bg-panel': card,
      '--bg-raised': raised,
      '--text-primary': text,
      '--text-muted': secondary,
      '--border-subtle': pigmentLight,
      '--border-strong': pigmentLight,
      '--focus-ring': focus,
      '--sidebar': pigmentLight,
    },
  },
  {
    selector: "html[data-ui-theme='v3'] .chat-panel-shell .surface-modal",
    mode: 'Glass',
    baseline: {},
    palette: {
      '--bg-page': card,
      '--text-primary': text,
      '--text-muted': secondary,
      '--sidebar': pigmentLight,
    },
  },
  {
    selector: "html[data-ui-theme='v3'] .hud-input,\nhtml[data-ui-theme='v3'] .lobby-shell .hud-input,\nhtml[data-ui-theme='v3'] .field-select,\nhtml[data-ui-theme='v3'] .lobby-shell .field-select,\nhtml[data-ui-theme='v3'] .choice-chip,\nhtml[data-ui-theme='v3'] .lobby-shell .choice-chip",
    mode: 'Glass',
    baseline: {},
    palette: {
      '--text-primary': text,
      '--text-muted': secondary,
    },
  },
];

/** §5.2 roles emitted as `--ds-*` (and `--g-*` gradients). Not wired except §6. */
export const dsRoles = [
  'raised',
  'text_placeholder',
  'text_muted',
  'on_accent',
  'success_text',
  'new_badge',
  'cp_team_a',
  'cp_team_a_bg',
  'cp_team_b',
  'cp_team_b_bg',
  'tp_hero',
  'tp_win',
  'tp_pack',
  'chip',
  'whuffie',
  'felt_center',
  'felt_mid',
  'felt_edge',
  'rim',
] as const;

export const dsGradients = ['g_sidebar', 'g_hero', 'g_felt', 'g_win'] as const;
