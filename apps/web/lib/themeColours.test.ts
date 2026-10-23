import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function nodeScript(script: string, args: string[] = []): string {
  return execFileSync(
    process.execPath,
    ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', '--experimental-strip-types', script, ...args],
    { cwd: root, encoding: 'utf8' },
  );
}

describe('palette colours', () => {
  it('commits the generator output', () => {
    expect(() => nodeScript('scripts/gen-theme-colours.ts', ['--check'])).not.toThrow();
  });

  it('keeps non-colour declarations in theme.css', () => {
    const css = readFileSync(path.join(root, 'app/theme.css'), 'utf8');
    expect(css).toMatch(/--radius-lg:\s*14px/);
    expect(css).toMatch(/--glass-blur:\s*28px/);
    expect(css).toMatch(/4px 4px 0 0 #000/);
    expect(css).not.toMatch(/^\s*--[a-z0-9-]+:\s*\d+\s+\d+\s+\d+\s*;/m);
  });

  it('allows only the documented contrast misses', () => {
    const output = nodeScript('scripts/check-contrast.ts');
    expect(output.trim()).toBe(
      [
        'Classic:success/page 3.92:1 < 4.5 (29 122 77 on 232 218 216) [from source]',
        'Arcade:focus/page 2.49:1 < 3 (255 46 154 on 255 217 59) [new proposal]',
      ].join('\n'),
    );
  });
});
