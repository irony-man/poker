/**
 * Contrast for the palette-v2 contexts the app actually paints.
 * Run via vitest (lib/themeColours.test.ts).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { contrastRatio } from '../design-tokens/contrast.ts';
import { roleStatus, type ModeName } from '../design-tokens/resolve.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(path.join(root, 'app/theme.colours.generated.css'), 'utf8');

type Bag = Record<string, string>;

function parseBlocks(source: string): { selector: string; decls: Bag }[] {
  const blocks: { selector: string; decls: Bag }[] = [];
  const re = /([^{}]+)\{([^}]+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) {
    const selector = match[1]!.replace(/\/\*[\s\S]*?\*\//g, '').trim();
    if (!selector || selector.startsWith('/*')) continue;
    const decls: Bag = {};
    for (const line of match[2]!.split(';')) {
      const idx = line.indexOf(':');
      if (idx < 0) continue;
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (key.startsWith('--') && /^\d+\s+\d+\s+\d+$/.test(value)) decls[key] = value;
    }
    if (Object.keys(decls).length) blocks.push({ selector, decls });
  }
  return blocks;
}

const parsed = parseBlocks(css);

function lookup(selectors: string[]): Bag {
  const bag: Bag = {};
  for (const selector of selectors) {
    const block = parsed.find((item) => item.selector === selector);
    if (!block) throw new Error(`missing selector\n${selector}`);
    Object.assign(bag, block.decls);
  }
  return bag;
}

const classicRoot = "html[data-palette='v2']";
const arcadeRoot = "html[data-palette='v2'][data-ui-theme='v2']";
const glassRoot = "html[data-palette='v2'][data-ui-theme='v3']";

export type ContrastCase = {
  id: string;
  mode: ModeName;
  fg: string;
  bg: string;
  fgName: string;
  bgName: string;
  min: number;
};

function casesFor(mode: ModeName, rootSel: string, lobbySel: string, hudSel: string): ContrastCase[] {
  const root = lookup([classicRoot, rootSel].filter((sel, i, all) => all.indexOf(sel) === i));
  const lobby = { ...root, ...lookup([lobbySel]) };
  const hud = { ...root, ...lookup([hudSel]) };
  const pair = (id: string, fgBag: Bag, fgName: string, bgBag: Bag, bgName: string, min: number): ContrastCase => ({
    id: `${mode}:${id}`,
    mode,
    fg: fgBag[fgName]!,
    bg: bgBag[bgName]!,
    fgName,
    bgName,
    min,
  });
  const body = 4.5;
  const ui = 3;
  /* Page ink sits on the page and on lobby paper. Dark panels use HUD / on-chrome text. */
  return [
    pair('text/page', root, '--text-primary', root, '--bg-page', body),
    pair('text/panel', lobby, '--text-primary', lobby, '--bg-panel', body),
    pair('text/raised', lobby, '--text-primary', lobby, '--bg-raised', body),
    pair('secondary/page', root, '--text-muted', root, '--bg-page', body),
    pair('secondary/panel', lobby, '--text-muted', lobby, '--bg-panel', body),
    pair('secondary/raised', lobby, '--text-muted', lobby, '--bg-raised', body),
    pair('hud/panel', hud, '--text-primary', root, '--bg-panel', body),
    pair('on-chrome', root, '--on-chrome', root, '--bg-chrome', body),
    pair('on-accent', root, '--ds-on-accent', root, '--brass', body),
    pair('danger/page', root, '--danger', root, '--bg-page', body),
    pair('danger/panel', root, '--danger', lobby, '--bg-panel', body),
    pair('success/page', root, '--ds-success-text', root, '--bg-page', body),
    pair('success/panel', root, '--ds-success-text', lobby, '--bg-panel', body),
    pair('focus/page', root, '--focus-ring', root, '--bg-page', ui),
    pair('focus/panel', root, '--focus-ring', lobby, '--bg-panel', ui),
    pair('placeholder/input', root, '--ds-text-placeholder', lobby, '--bg-panel', body),
  ];
}

export function contrastCases(): ContrastCase[] {
  return [
    ...casesFor(
      'Classic',
      classicRoot,
      "html[data-palette='v2'] .lobby-shell,\nhtml[data-palette='v2'] .lobby-paper",
      "html[data-palette='v2'] .hud-panel",
    ),
    ...casesFor(
      'Arcade',
      arcadeRoot,
      "html[data-palette='v2'][data-ui-theme='v2'] .lobby-shell,\nhtml[data-palette='v2'][data-ui-theme='v2'] .lobby-paper",
      "html[data-palette='v2'][data-ui-theme='v2'] .hud-panel",
    ),
    ...casesFor(
      'Glass',
      glassRoot,
      "html[data-palette='v2'][data-ui-theme='v3'] .lobby-shell,\nhtml[data-palette='v2'][data-ui-theme='v3'] .lobby-paper",
      glassRoot,
    ),
  ];
}

export type ContrastFailure = ContrastCase & { ratio: number; status: string };

export function contrastFailures(): ContrastFailure[] {
  const failures: ContrastFailure[] = [];
  for (const item of contrastCases()) {
    if (!item.fg || !item.bg) throw new Error(`unresolved ${item.id}`);
    const ratio = contrastRatio(item.fg, item.bg);
    if (ratio + 1e-6 < item.min) {
      const role = item.fgName.replace('--ds-', '').replace('--', '').replaceAll('-', '_');
      failures.push({ ...item, ratio, status: safeStatus(item.mode, role) });
    }
  }
  return failures;
}

function safeStatus(mode: ModeName, role: string): string {
  const alias: Record<string, string> = { focus_ring: 'focus', text_muted: 'text_secondary' };
  try {
    return roleStatus(mode, alias[role] ?? role);
  } catch {
    return 'derived';
  }
}

/** Designer values that miss AA. Any other miss fails the suite. */
const ALLOWED_MISSES = new Set(['Classic:success/page', 'Arcade:focus/page']);

if (process.argv[1]?.includes('check-contrast')) {
  const failures = contrastFailures();
  for (const failure of failures) {
    console.log(
      `${failure.id} ${failure.ratio.toFixed(2)}:1 < ${failure.min} (${failure.fg} on ${failure.bg}) [${failure.status}]`,
    );
  }
  const ids = new Set(failures.map((failure) => failure.id));
  const unexpected = [...ids].filter((id) => !ALLOWED_MISSES.has(id));
  const missing = [...ALLOWED_MISSES].filter((id) => !ids.has(id));
  if (unexpected.length || missing.length) {
    console.error('unexpected', unexpected, 'missing', missing);
    process.exit(1);
  }
}
