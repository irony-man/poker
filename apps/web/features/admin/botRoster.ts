import { BOT_PERSONALITY_IDS, type BotPersonalityId } from '@poker/engine';
import type { BotGroup } from '@/lib/api';

export const MAX_BOT_GROUPS = 20;

export const DEFAULT_BOT_NAMES =
  'AceBot, aggro\nRiverRat, caller\nBluffByte, lag\nPotOdds, balanced\nChipShark, aggro\nFoldBot, nit\nAllInAnnie, maniac\nNutsNova, tight\nCallCart, caller\nRaiseRex, aggro';

export const DEFAULT_BOT_NAME_LIST = DEFAULT_BOT_NAMES.split('\n').map(
  (line) => line.split(',')[0]!.trim(),
);

export const PERSONALITY_LABELS: Record<BotPersonalityId, string> = {
  balanced: 'Balanced',
  tight: 'Tight',
  loose: 'Loose',
  aggro: 'Aggressive',
  passive: 'Passive',
  maniac: 'Maniac',
  caller: 'Caller',
  nit: 'Nit',
  lag: 'LAG',
};

const PERSONALITY_TOKEN_TO_ID: Record<string, BotPersonalityId> = (() => {
  const map: Record<string, BotPersonalityId> = {};
  for (const id of BOT_PERSONALITY_IDS) {
    map[id.toLowerCase()] = id;
    map[PERSONALITY_LABELS[id].toLowerCase()] = id;
  }
  return map;
})();

export function resolvePersonalityToken(raw: string): BotPersonalityId | null {
  const key = raw.trim().toLowerCase();
  if (!key) return null;
  return PERSONALITY_TOKEN_TO_ID[key] ?? null;
}

export function pruneNamePersonalities(
  names: string[],
  map: Record<string, BotPersonalityId> | undefined,
): Record<string, BotPersonalityId> {
  const out: Record<string, BotPersonalityId> = {};
  if (!map) return out;
  for (const n of names) {
    const id = map[n];
    if (id && (BOT_PERSONALITY_IDS as readonly string[]).includes(id)) out[n] = id;
  }
  return out;
}

export function normalizeAdminBotGroup(g: BotGroup): BotGroup {
  const names = g.names?.length ? g.names : DEFAULT_BOT_NAME_LIST;
  return {
    id: g.id,
    name: g.name,
    names,
    isDefault: Boolean(g.isDefault),
    defaultPersonality: g.defaultPersonality ?? null,
    namePersonalities: pruneNamePersonalities(names, g.namePersonalities),
  };
}

export function rosterToBulkText(
  names: string[],
  namePersonalities: Record<string, BotPersonalityId> | undefined,
): string {
  return names
    .map((n) => {
      const p = namePersonalities?.[n];
      return p ? `${n}, ${p}` : n;
    })
    .join('\n');
}

export type BulkBotRosterResult =
  | { ok: true; names: string[]; namePersonalities: Record<string, BotPersonalityId> }
  | { ok: false; errors: string[] };

export function parseBulkBotRoster(text: string): BulkBotRosterResult {
  const errors: string[] = [];
  const names: string[] = [];
  const namePersonalities: Record<string, BotPersonalityId> = {};
  const seen = new Set<string>();
  const validHint = BOT_PERSONALITY_IDS.join(', ');
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const raw = lines[i]!.trim();
    if (!raw) continue;

    const firstComma = raw.indexOf(',');
    let namePart: string;
    let stylePart: string | null = null;

    if (firstComma >= 0) {
      namePart = raw.slice(0, firstComma).trim();
      stylePart = raw.slice(firstComma + 1).trim();
      if (stylePart.includes(',')) {
        errors.push(`Line ${lineNo}: use one personality after the comma (valid: ${validHint})`);
        continue;
      }
    } else {
      namePart = raw;
    }

    if (!namePart) {
      errors.push(`Line ${lineNo}: missing display name before the comma`);
      continue;
    }
    if (namePart.length > 24) {
      errors.push(`Line ${lineNo}: name longer than 24 characters ("${namePart.slice(0, 24)}…")`);
      continue;
    }

    if (stylePart !== null) {
      if (!stylePart) {
        errors.push(
          `Line ${lineNo}: missing personality after comma for "${namePart}" (valid: ${validHint})`,
        );
        continue;
      }
      const styleId = resolvePersonalityToken(stylePart);
      if (!styleId) {
        errors.push(
          `Line ${lineNo}: unknown personality "${stylePart}" for "${namePart}" (valid: ${validHint})`,
        );
        continue;
      }
      namePersonalities[namePart] = styleId;
    }

    const key = namePart.toLowerCase();
    if (seen.has(key)) {
      errors.push(`Line ${lineNo}: duplicate name "${namePart}"`);
      continue;
    }
    seen.add(key);
    names.push(namePart);

    if (names.length > 40) {
      errors.push('Too many names (max 40)');
      break;
    }
  }

  if (names.length === 0 && errors.length === 0) {
    errors.push('Add at least one bot name (one per line; optional ", style")');
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, names, namePersonalities };
}

export function groupBulkText(group: BotGroup, drafts: Record<string, string>): string {
  return drafts[group.id] ?? rosterToBulkText(group.names, group.namePersonalities);
}

export function slugBotGroupId(raw: string, fallback: string): string {
  const s = raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return s.length > 0 ? s : fallback;
}

export function emptyBotGroup(): BotGroup {
  const parsed = parseBulkBotRoster(DEFAULT_BOT_NAMES);
  const names = parsed.ok ? parsed.names : DEFAULT_BOT_NAME_LIST;
  const namePersonalities = parsed.ok ? parsed.namePersonalities : {};
  return {
    id: `group-${Date.now().toString(36)}`,
    name: 'New group',
    names,
    isDefault: false,
    defaultPersonality: null,
    namePersonalities,
  };
}
