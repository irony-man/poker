import { BOT_PERSONALITY_IDS, type BotPersonalityId } from '@poker/engine';
import type { BotGroup } from '@/lib/api';

export const MAX_BOT_GROUPS = 20;

export const DEFAULT_BOT_NAMES =
  'AceBot, aggro\nRiverRat, caller\nBluffByte, lag\nPotOdds, balanced\nChipShark, aggro\nFoldBot, nit\nAllInAnnie, maniac\nNutsNova, tight\nCallCart, caller\nRaiseRex, aggro\nHumanoid, humanoid';

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
  humanoid: 'Humanoid',
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

export const MAX_BOT_GROUP_NAME_LEN = 48;
export const MAX_BOT_DISPLAY_NAME_LEN = 24;
export const MAX_BOT_NAMES_PER_GROUP = 40;

export type BotGroupsImportMode = 'merge' | 'replace';

export type ParseBotGroupsJsonResult =
  | { ok: true; groups: BotGroup[] }
  | { ok: false; errors: string[] };

export type ApplyBotGroupsImportResult =
  | { ok: true; groups: BotGroup[]; added: number; replaced: number }
  | { ok: false; errors: string[] };

const VALID_PERSONALITY_HINT = BOT_PERSONALITY_IDS.join(', ');

function ensureOneDefault(groups: BotGroup[]): BotGroup[] {
  if (groups.length === 0) return groups;
  const defaultIdx = groups.findIndex((g) => g.isDefault);
  const keep = defaultIdx >= 0 ? defaultIdx : 0;
  return groups.map((g, i) => ({ ...g, isDefault: i === keep }));
}

function parseImportedNames(
  raw: unknown,
  label: string,
  errors: string[],
): string[] | null {
  if (!Array.isArray(raw)) {
    errors.push(`${label}: "names" must be an array of strings`);
    return null;
  }
  const names: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (typeof item !== 'string') {
      errors.push(`${label}: names[${i}] must be a string`);
      continue;
    }
    const name = item.trim();
    if (!name) {
      errors.push(`${label}: names[${i}] is empty`);
      continue;
    }
    if (name.length > MAX_BOT_DISPLAY_NAME_LEN) {
      errors.push(
        `${label}: names[${i}] longer than ${MAX_BOT_DISPLAY_NAME_LEN} characters ("${name.slice(0, MAX_BOT_DISPLAY_NAME_LEN)}…")`,
      );
      continue;
    }
    const key = name.toLowerCase();
    if (seen.has(key)) {
      errors.push(`${label}: duplicate name "${name}"`);
      continue;
    }
    seen.add(key);
    names.push(name);
    if (names.length > MAX_BOT_NAMES_PER_GROUP) {
      errors.push(`${label}: too many names (max ${MAX_BOT_NAMES_PER_GROUP})`);
      break;
    }
  }
  if (names.length === 0) {
    errors.push(`${label}: add at least one display name in "names"`);
    return null;
  }
  return names;
}

function parseImportedNamePersonalities(
  raw: unknown,
  names: string[],
  label: string,
  errors: string[],
): Record<string, BotPersonalityId> {
  if (raw == null) return {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    errors.push(`${label}: "namePersonalities" must be an object`);
    return {};
  }
  const nameSet = new Set(names);
  const out: Record<string, BotPersonalityId> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!nameSet.has(key)) {
      errors.push(`${label}: namePersonalities key "${key}" is not in names`);
      continue;
    }
    if (typeof value !== 'string') {
      errors.push(`${label}: namePersonalities["${key}"] must be a string`);
      continue;
    }
    const styleId = resolvePersonalityToken(value);
    if (!styleId) {
      errors.push(
        `${label}: unknown personality "${value}" for "${key}" (valid: ${VALID_PERSONALITY_HINT})`,
      );
      continue;
    }
    out[key] = styleId;
  }
  return out;
}

function parseOneImportedGroup(raw: unknown, index: number, errors: string[]): BotGroup | null {
  const label = `Group ${index + 1}`;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    errors.push(`${label}: expected an object`);
    return null;
  }
  const o = raw as Record<string, unknown>;
  const fallbackId = `group-${index + 1}`;
  const idRaw = typeof o.id === 'string' ? o.id.trim() : '';
  const id = slugBotGroupId(idRaw || fallbackId, fallbackId);

  let name =
    typeof o.name === 'string' ? o.name.trim().slice(0, MAX_BOT_GROUP_NAME_LEN) : '';
  if (!name) name = `Group ${index + 1}`;

  const names = parseImportedNames(o.names, label, errors);
  if (!names) return null;

  let defaultPersonality: BotPersonalityId | null = null;
  if (o.defaultPersonality != null && o.defaultPersonality !== '') {
    if (typeof o.defaultPersonality !== 'string') {
      errors.push(`${label}: "defaultPersonality" must be a string or null`);
    } else {
      const styleId = resolvePersonalityToken(o.defaultPersonality);
      if (!styleId) {
        errors.push(
          `${label}: unknown defaultPersonality "${o.defaultPersonality}" (valid: ${VALID_PERSONALITY_HINT})`,
        );
      } else {
        defaultPersonality = styleId;
      }
    }
  }

  const namePersonalities = parseImportedNamePersonalities(
    o.namePersonalities,
    names,
    label,
    errors,
  );

  return {
    id,
    name,
    names,
    isDefault: Boolean(o.isDefault),
    defaultPersonality,
    namePersonalities,
  };
}

/**
 * Parse pasted bot-group JSON. Accepts a group array, `{ groups: [...] }`,
 * or a single group object.
 */
export function parseBotGroupsJson(text: string): ParseBotGroupsJsonResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, errors: ['Paste JSON for one or more bot groups'] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed) as unknown;
  } catch {
    return { ok: false, errors: ['Invalid JSON — check brackets, commas, and quotes'] };
  }

  let list: unknown[];
  if (Array.isArray(parsed)) {
    list = parsed;
  } else if (parsed && typeof parsed === 'object') {
    const o = parsed as Record<string, unknown>;
    if (Array.isArray(o.groups)) {
      list = o.groups;
    } else if ('names' in o || 'id' in o || 'name' in o) {
      list = [parsed];
    } else {
      return {
        ok: false,
        errors: ['JSON must be an array of groups, { "groups": [...] }, or one group object'],
      };
    }
  } else {
    return {
      ok: false,
      errors: ['JSON must be an array of groups, { "groups": [...] }, or one group object'],
    };
  }

  if (list.length === 0) {
    return { ok: false, errors: ['JSON array is empty — include at least one group'] };
  }
  if (list.length > MAX_BOT_GROUPS) {
    return {
      ok: false,
      errors: [`Too many groups in JSON (max ${MAX_BOT_GROUPS}; got ${list.length})`],
    };
  }

  const errors: string[] = [];
  const groups: BotGroup[] = [];
  const usedIds = new Set<string>();

  for (let i = 0; i < list.length; i++) {
    const g = parseOneImportedGroup(list[i], i, errors);
    if (!g) continue;
    if (usedIds.has(g.id)) {
      errors.push(`Group ${i + 1}: duplicate id "${g.id}"`);
      continue;
    }
    usedIds.add(g.id);
    groups.push(g);
  }

  if (errors.length > 0) return { ok: false, errors };
  if (groups.length === 0) {
    return { ok: false, errors: ['No valid groups found in JSON'] };
  }
  return { ok: true, groups };
}

/** Serialize groups for clipboard export (pretty-printed). */
export function serializeBotGroupsJson(groups: BotGroup[]): string {
  return `${JSON.stringify(
    groups.map((g) => ({
      id: g.id,
      name: g.name,
      isDefault: g.isDefault,
      defaultPersonality: g.defaultPersonality,
      names: g.names,
      namePersonalities: g.namePersonalities,
    })),
    null,
    2,
  )}\n`;
}

/**
 * Merge imported groups into existing (by id) or replace the full list.
 * Does not auto-save — caller should update local state then Save.
 */
export function applyBotGroupsImport(
  existing: BotGroup[],
  imported: BotGroup[],
  mode: BotGroupsImportMode,
): ApplyBotGroupsImportResult {
  if (imported.length === 0) {
    return { ok: false, errors: ['Nothing to import'] };
  }

  if (mode === 'replace') {
    if (imported.length > MAX_BOT_GROUPS) {
      return {
        ok: false,
        errors: [`Import has ${imported.length} groups (max ${MAX_BOT_GROUPS})`],
      };
    }
    return {
      ok: true,
      groups: ensureOneDefault(imported.map((g) => normalizeAdminBotGroup(g))),
      added: imported.length,
      replaced: 0,
    };
  }

  const byId = new Map(existing.map((g) => [g.id, g]));
  let added = 0;
  let replaced = 0;
  for (const g of imported) {
    if (byId.has(g.id)) replaced += 1;
    else added += 1;
    byId.set(g.id, normalizeAdminBotGroup(g));
  }

  const importedIds = new Set(imported.map((g) => g.id));
  const next: BotGroup[] = [];
  for (const g of existing) {
    const updated = byId.get(g.id);
    if (updated) next.push(updated);
  }
  for (const g of imported) {
    if (!existing.some((e) => e.id === g.id)) {
      next.push(byId.get(g.id)!);
    }
  }

  if (next.length > MAX_BOT_GROUPS) {
    return {
      ok: false,
      errors: [
        `Merge would create ${next.length} groups (max ${MAX_BOT_GROUPS}). Remove some first or use Replace.`,
      ],
    };
  }

  // If any imported group claims default, prefer the first such imported id;
  // otherwise keep the existing default when still present.
  const importedDefault = imported.find((g) => g.isDefault);
  let groups: BotGroup[];
  if (importedDefault && importedIds.has(importedDefault.id)) {
    groups = next.map((g) => ({ ...g, isDefault: g.id === importedDefault.id }));
  } else {
    groups = ensureOneDefault(next);
  }

  return { ok: true, groups, added, replaced };
}
