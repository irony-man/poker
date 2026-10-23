import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ColourRef, ModeName } from './mapping.ts';

export type { ModeName };

const dir = path.dirname(fileURLToPath(import.meta.url));

type RoleEntry = { value: string; contrast_hex: string | null; status: string; note: string };
type TokenRow = { name: string; hex: string };

export type ModeFile = { modes: Record<ModeName, Record<string, RoleEntry>> };

const modes = JSON.parse(readFileSync(path.join(dir, 'tokens-modes.json'), 'utf8')) as ModeFile;
const primitives = JSON.parse(readFileSync(path.join(dir, 'tokens.json'), 'utf8')) as Record<string, unknown>;

export function hexToTriplet(hex: string): string {
  const raw = hex.replace('#', '').trim();
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`not a hex colour: ${hex}`);
  }
  const n = Number.parseInt(full, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

export function tripletToHex(triplet: string): string {
  const [r, g, b] = triplet.split(/\s+/).map((part) => Number(part));
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${hex(r!)}${hex(g!)}${hex(b!)}`;
}

function primitiveHex(match: string): string {
  for (const value of Object.values(primitives)) {
    if (!Array.isArray(value)) continue;
    for (const row of value as TokenRow[]) {
      if (row && typeof row.hex === 'string' && row.name?.split('/')[0]?.trim() === match) {
        return row.hex;
      }
      if (row && typeof row.name === 'string' && row.name.split('/').some((part) => part.trim() === match)) {
        return row.hex;
      }
    }
  }
  throw new Error(`primitive not found: ${match}`);
}

/** Flat RGB triplet for a role. Gradients and rgba() use contrast_hex. */
export function roleHex(mode: ModeName, role: string): string {
  const entry = modes.modes[mode]?.[role];
  if (!entry) throw new Error(`missing role ${mode}.${role}`);
  if (entry.value.startsWith('#')) return entry.value;
  if (entry.contrast_hex) return entry.contrast_hex;
  throw new Error(`no flat colour for ${mode}.${role} (${entry.value})`);
}

export function roleRaw(mode: ModeName, role: string): string {
  const entry = modes.modes[mode]?.[role];
  if (!entry) throw new Error(`missing role ${mode}.${role}`);
  return entry.value;
}

export function roleStatus(mode: ModeName, role: string): string {
  return modes.modes[mode]?.[role]?.status ?? 'unknown';
}

export function resolveRef(mode: ModeName, ref: ColourRef, baseline: string | undefined): string {
  if (ref.kind === 'raw') return ref.value;
  if (ref.kind === 'keep') {
    if (!baseline) throw new Error(`keep without baseline in ${mode}`);
    return baseline;
  }
  if (ref.kind === 'hex') return hexToTriplet(ref.hex);
  if (ref.kind === 'primitive') return hexToTriplet(primitiveHex(ref.match));
  return hexToTriplet(roleHex(mode, ref.role));
}

/** Value written into CSS. `color` and `raw` are full declarations. */
export function resolveDeclaration(mode: ModeName, key: string, ref: ColourRef, baseline: string | undefined): string {
  if (ref.kind === 'raw') return ref.value;
  if (key === 'color') return `rgb(${resolveRef(mode, ref, baseline)})`;
  return resolveRef(mode, ref, baseline);
}

export function dsTriplet(mode: ModeName, role: string): string {
  return hexToTriplet(roleHex(mode, role));
}

export { modes, primitiveHex };
