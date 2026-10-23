/**
 * Bucket every remaining colour literal. Writes design-tokens/literal-audit.md.
 *   node --experimental-strip-types scripts/audit-literals.ts
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dirs = ['app', 'components', 'features', 'lib'];

type Hit = { file: string; line: number; kind: string; token: string; bucket: string; why: string };

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|css)$/.test(name) && !name.includes('.test.')) out.push(full);
  }
  return out;
}

function bucket(file: string, text: string, token: string): { bucket: string; why: string } {
  const rel = file.replaceAll('\\', '/');
  if (/GoogleSignIn|InstagramSignIn/.test(rel)) return { bucket: 'c', why: 'Third-party brand button' };
  if (/ludo\/|ludoBoard|LudoBoard|LudoDice|PlayingCard|CardFace|cardFace|ChipStack|tableColors/.test(rel)) {
    return { bucket: 'b', why: 'Game or asset colour (board, dice, card face, chip, felt preset)' };
  }
  if (/theme\.colours\.generated\.css$/.test(rel)) {
    return { bucket: 'generated', why: 'Emitted palette value' };
  }
  if (/ogImage|layout\.tsx/.test(rel)) {
    return { bucket: 'a', why: 'Static Classic brand/page colour (OG geometry unchanged; themeColor updated)' };
  }
  if (/FriendLinkDialog/.test(rel)) return { bucket: 'c', why: 'WhatsApp and Facebook share colours' };
  if (
    /^#(?:000|fff|ffffff|FFF|FFFFFF)$/.test(token) ||
    /rgba?\(\s*0(?:\s+0\s+0|,\s*0,\s*0)/.test(token) ||
    /0_0_0/.test(token) ||
    /8 4 20/.test(token)
  ) {
    return { bucket: 'd', why: 'Neutral black shadow or scrim' };
  }
  if (
    /rgba?\(\s*255(?:\s+255\s+255|,\s*255,\s*255)/.test(token) ||
    /255_255_255|255 252 250|255 150 140/.test(token) ||
    token.toLowerCase() === '#fff'
  ) {
    return { bucket: 'd', why: 'Neutral white highlight, near-white glyph, or scrim' };
  }
  if (/globals\.css$/.test(rel) && /--felt|--table-|felt-edge|data-table-color/.test(text)) {
    return { bucket: 'b', why: 'Table felt preset (G7, left unchanged)' };
  }
  if (
    /80 200 220|168 100 255|200 80 180|210 236 255|80_200_220|210_236_255/.test(token + text) ||
    /#(?:d9f7e3|ffe1e1|f4eeec|e8ddd9|efe6e4|5a2a7a|f87171|7c2119|FFF4D6|6B4E00)/i.test(token + text)
  ) {
    return { bucket: 'd', why: 'Unmapped decorative or near-miss pigment (no designer role, not an exact token)' };
  }
  return { bucket: 'review', why: 'Remaining literal — see notes' };
}

const hits: Hit[] = [];
const files = dirs.flatMap((dir) => walk(path.join(root, dir)));
const hexRe = /#[0-9a-fA-F]{3,8}\b/g;
const rgbRe = /rgba?\([^)]*\)/g;
const arbRe = /(?:bg|text|border|from|to|via|fill|stroke|ring|shadow)-\[#/g;

for (const file of files) {
  const rel = path.relative(root, file);
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((text, index) => {
    for (const token of text.match(hexRe) ?? []) {
      if (token.length > 9) continue;
      const decided = bucket(rel, text, token);
      hits.push({ file: rel, line: index + 1, kind: 'hex', token, ...decided });
    }
    for (const token of text.match(rgbRe) ?? []) {
      if (!/rgba?\([0-9]/.test(token)) continue;
      const decided = bucket(rel, text, token);
      hits.push({ file: rel, line: index + 1, kind: 'rgb', token, ...decided });
    }
    for (const token of text.match(arbRe) ?? []) {
      const decided = bucket(rel, text, token);
      hits.push({ file: rel, line: index + 1, kind: 'arbitrary', token, ...decided });
    }
  });
}

function rgText(args: string[]): string {
  try {
    return execFileSync('rg', args, { cwd: root, encoding: 'utf8' });
  } catch (error) {
    return (error as { stdout?: string }).stdout ?? '';
  }
}

function rgCount(pattern: string): number {
  const out = rgText(['-c', pattern, ...dirs, '-g', '!*.test.*']);
  return out
    .trim()
    .split('\n')
    .filter(Boolean)
    .reduce((sum, line) => sum + Number(line.split(':').pop()), 0);
}

function rgMatches(pattern: string, paths: string[]): number {
  const out = rgText(['-o', pattern, ...paths]);
  return out.trim() ? out.trim().split('\n').length : 0;
}

const counts = {
  hex: rgCount('#[0-9a-fA-F]{3,8}\\b'),
  rgb: rgCount('rgba?\\([0-9]'),
  arbitrary: rgMatches('(bg|text|border|from|to|via|fill|stroke|ring|shadow)-\\[#', ['app', 'components', 'features']),
};

function section(id: string, title: string): string {
  const rows = hits.filter((hit) => hit.bucket === id);
  const grouped = new Map<string, Hit[]>();
  for (const hit of rows) {
    const key = `${hit.file} — ${hit.why}`;
    grouped.set(key, [...(grouped.get(key) ?? []), hit]);
  }
  const lines = [`### ${title} (${rows.length})`, ''];
  for (const [key, group] of [...grouped.entries()].sort()) {
    const sample = group
      .slice(0, 6)
      .map((hit) => `\`${hit.token}\` L${hit.line}`)
      .join(', ');
    lines.push(`- ${key}: ${group.length} (${sample}${group.length > 6 ? ', …' : ''})`);
  }
  return lines.join('\n');
}

const md = `# Literal colour audit

Counts after the palette v2 pass, from:

\`\`\`
rg -c '#[0-9a-fA-F]{3,8}\\b' apps/web/{app,components,features,lib} -g '!*.test.*'
rg -c 'rgba?\\([0-9]' apps/web/{app,components,features,lib}
rg -o '(bg|text|border|from|to|via|fill|stroke|ring|shadow)-\\[#' apps/web/{app,components,features}
\`\`\`

| Kind | Count |
| --- | --- |
| hex, rg -c lines summed | ${counts.hex} |
| rgb()/rgba(), rg -c lines summed | ${counts.rgb} |
| Tailwind arbitrary, rg -o matches | ${counts.arbitrary} |

Bucket (a) theme colours that duplicated a token were replaced with \`rgb(var(--…))\` keeping the alpha. Flag off, those vars hold the previous triplet, so the paint matches today. Flag on, they follow the designer palette.

Replaced families:

- \`29 4 50\` / \`29_4_50\` → \`--ds-brand-ink\` (baseline \`29 4 50\`, palette \`30 5 54\`)
- \`14 6 24\` ink shadow → \`--ds-literal-ink\`
- placeholder \`68 48 74\` → \`--ds-text-placeholder\`
- frost ink \`22 12 40\` → \`--ds-frost-ink\`; white-field ink → \`--ds-field-ink\`
- frost muted \`58 40 82\` → \`--ds-frost-muted\`; white-field muted → \`--ds-field-muted\`
- paper \`255 252 250\` backgrounds → \`--ds-paper\`
- Arcade \`253 233 61\` → \`--bg-page\`; \`#1a1028\` → \`--text-primary\`; card \`#fff\` → \`--ds-card\`; \`color: #fff\` on Arcade/Glass chrome → \`--on-chrome\`
- Profile look swatches → \`--ds-swatch-v*\`
- \`app/layout.tsx\` themeColor light \`#e8dad8\`, dark \`#1e0536\`
- \`lib/ogImage.tsx\` keeps the 145° three-stop linear gradient and swaps stops to Classic g_hero \`#3d1766\`, \`#1e0536\`, \`#13021f\`. Text \`#e8dad8\`.

Not replaced on purpose:

- NEW badge uses \`bg-danger\` / \`bg-brass\`, not a literal, so \`--ds-new-badge\` is emitted and unwired.
- Money still uses \`brass\` (G4). \`--ds-gold\` / \`--ds-gold-light\` / \`--ds-gold-dim\` stay on the gold primitives for a follow-up.
- \`apps/server/src/mail/mail.service.ts\` (8 hex) was not changed. Needs approval before a Classic brand/page swap.
- \`app/icon.png\` and \`app/apple-icon.png\` are rasters. Not touched.
- Felt presets in \`lib/tableColors.ts\` and \`.table-theme\` stay. The server copy (\`apps/server/src/table-colors.ts\`) only clamps the id; it does not duplicate the hex values.

${section('b', 'Bucket (b) — game and asset colours, unchanged')}

${section('c', 'Bucket (c) — third-party brand, unchanged')}

${section('d', 'Bucket (d) — neutral or unmapped, unchanged')}

${hits.some((hit) => hit.bucket === 'review') ? section('review', 'Needs another look') : '### Needs another look\n\nNone.'}

## Contrast exceptions (palette on)

These two pairs miss the threshold with the designer values. They are listed in \`scripts/check-contrast.ts\` and the suite fails if any other pair regresses.

| Pair | Ratio | Need | Suggested fix |
| --- | --- | --- | --- |
| Classic \`--ds-success-text\` \`#1d7a4d\` on page \`#e8dad8\` | 3.92:1 | 4.5:1 | Darken success text for the rose page, or use it only on card (\`#fbf7f4\`), where it passes. Status: from source. |
| Arcade focus \`#ff2e9a\` on page \`#ffd93b\` | 2.49:1 | 3:1 | Darken the neon pink or outline it against aubergine. Status: new proposal. |
`;

writeFileSync(path.join(root, 'design-tokens/literal-audit.md'), md);
console.log(counts);
console.log('review', hits.filter((hit) => hit.bucket === 'review').length);
