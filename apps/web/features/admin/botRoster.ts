import {
  BOT_PERSONALITY_IDS,
  DEFAULT_BOT_GROUP_DEFS,
  DEFAULT_BOT_GROUP_LABEL_DEFS,
  MAX_BOT_GROUP_DESCRIPTION_LEN,
  MAX_BOT_GROUP_LABELS,
  resolveBotGroupLabelId,
  type BotPersonalityId,
} from '@poker/engine';
import type { BotGroup, BotGroupLabel, BotGroupLabels } from '@/lib/api';
import { DEFAULT_BOT_GROUP_LABELS } from '@/lib/api';

export const MAX_BOT_GROUPS = 20;

export const DEFAULT_BOT_NAMES =
  'AceBot, aggro\nRiverRat, caller\nBluffByte, lag\nPotOdds, balanced\nChipShark, aggro\nFoldBot, nit\nAllInAnnie, maniac\nNutsNova, tight\nCallCart, caller\nRaiseRex, aggro\nHumanoid, humanoid';

export const DEFAULT_BOT_NAME_LIST = DEFAULT_BOT_NAMES.split('\n').map(
  (line) => line.split(',')[0]!.trim(),
);

/** Site defaults (Easy/Medium/Hard + table styles) for admin reset. */
export function defaultBotGroups(): BotGroup[] {
  return DEFAULT_BOT_GROUP_DEFS.map((g) => ({
    id: g.id,
    name: g.name,
    labelId: g.labelId,
    description: g.description,
    names: [...g.names],
    isDefault: g.isDefault,
    defaultPersonality: g.defaultPersonality,
    namePersonalities: { ...g.namePersonalities },
  }));
}

export function defaultBotGroupLabels(): BotGroupLabels {
  return DEFAULT_BOT_GROUP_LABEL_DEFS.map((l) => ({ ...l }));
}

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
    labelId: resolveBotGroupLabelId(
      g.id,
      g.name,
      g.labelId,
      (g as BotGroup & { kind?: string }).kind,
    ),
    description: (g.description ?? '').trim().slice(0, MAX_BOT_GROUP_DESCRIPTION_LEN),
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

    if (firstComma === -1) {
      namePart = raw;
    } else {
      namePart = raw.slice(0, firstComma).trim();
      stylePart = raw.slice(firstComma + 1).trim();
    }

    if (!namePart) {
      errors.push(`Line ${lineNo}: missing name`);
      continue;
    }
    if (namePart.length > MAX_BOT_DISPLAY_NAME_LEN) {
      errors.push(`Line ${lineNo}: name longer than ${MAX_BOT_DISPLAY_NAME_LEN} characters`);
      continue;
    }
    const key = namePart.toLowerCase();
    if (seen.has(key)) {
      errors.push(`Line ${lineNo}: duplicate name "${namePart}"`);
      continue;
    }
    if (names.length >= MAX_BOT_NAMES_PER_GROUP) {
      errors.push(`Too many names (max ${MAX_BOT_NAMES_PER_GROUP})`);
      break;
    }
    seen.add(key);
    names.push(namePart);

    if (stylePart) {
      const styleId = resolvePersonalityToken(stylePart);
      if (!styleId) {
        errors.push(
          `Line ${lineNo}: unknown style "${stylePart}" (valid: ${validHint})`,
        );
      } else {
        namePersonalities[namePart] = styleId;
      }
    }
  }

  if (names.length === 0) {
    errors.push('Add at least one bot name');
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, names, namePersonalities };
}

export function groupBulkText(
  group: BotGroup,
  drafts: Record<string, string>,
): string {
  const draft = drafts[group.id];
  if (typeof draft === 'string') return draft;
  return rosterToBulkText(group.names, group.namePersonalities);
}

export function slugBotGroupId(raw: string, fallback: string): string {
  const s = raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return s.length > 0 ? s : fallback;
}

export function slugBotGroupLabelId(raw: string, fallback: string): string {
  const s = raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  return s.length > 0 ? s : fallback;
}

export function emptyBotGroup(labelId = 'groups'): BotGroup {
  const parsed = parseBulkBotRoster(DEFAULT_BOT_NAMES);
  const names = parsed.ok ? parsed.names : DEFAULT_BOT_NAME_LIST;
  const namePersonalities = parsed.ok ? parsed.namePersonalities : {};
  return {
    id: `group-${Date.now().toString(36)}`,
    name: 'New group',
    names,
    isDefault: false,
    labelId,
    description: '',
    defaultPersonality: null,
    namePersonalities,
  };
}

export function emptyBotGroupLabel(existing: BotGroupLabels): BotGroupLabel {
  let n = existing.length + 1;
  let id = `label-${n}`;
  const used = new Set(existing.map((l) => l.id));
  while (used.has(id)) {
    n += 1;
    id = `label-${n}`;
  }
  return { id, name: `Label ${n}` };
}

export const MAX_BOT_GROUP_NAME_LEN = 48;
export const MAX_BOT_DISPLAY_NAME_LEN = 24;
export const MAX_BOT_NAMES_PER_GROUP = 40;

export type BotGroupsImportMode = 'merge' | 'replace';

export type ParseBotGroupsJsonResult =
  | { ok: true; groups: BotGroup[]; labels?: BotGroupLabels }
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

  const labelIdRaw = typeof o.labelId === 'string' ? o.labelId.trim() : '';
  const kindRaw = typeof o.kind === 'string' ? o.kind.trim() : '';
  const labelId = resolveBotGroupLabelId(id, name, labelIdRaw || null, kindRaw || null);

  const description =
    typeof o.description === 'string'
      ? o.description.trim().slice(0, MAX_BOT_GROUP_DESCRIPTION_LEN)
      : '';

  return {
    id,
    name,
    names,
    isDefault: Boolean(o.isDefault),
    labelId,
    description,
    defaultPersonality,
    namePersonalities,
  };
}

function parseImportedLabels(raw: unknown, errors: string[]): BotGroupLabels | undefined {
  if (raw == null) return undefined;

  if (Array.isArray(raw)) {
    if (raw.length === 0) {
      errors.push('labels: array is empty — include at least one label');
      return undefined;
    }
    if (raw.length > MAX_BOT_GROUP_LABELS) {
      errors.push(`labels: too many labels (max ${MAX_BOT_GROUP_LABELS})`);
      return undefined;
    }
    const used = new Set<string>();
    const out: BotGroupLabel[] = [];
    for (let i = 0; i < raw.length; i++) {
      const item = raw[i];
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        errors.push(`labels[${i}]: expected { id, name }`);
        continue;
      }
      const o = item as Record<string, unknown>;
      const fallback = `label-${i + 1}`;
      const idRaw = typeof o.id === 'string' ? o.id.trim() : '';
      const id = slugBotGroupLabelId(idRaw || fallback, fallback);
      if (used.has(id)) {
        errors.push(`labels[${i}]: duplicate id "${id}"`);
        continue;
      }
      used.add(id);
      const nameRaw = typeof o.name === 'string' ? o.name.trim() : '';
      const name = (nameRaw || id).slice(0, 32);
      out.push({ id, name });
    }
    return out.length > 0 ? out : undefined;
  }

  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    if ('level' in o || 'groups' in o || 'movies' in o) {
      const legacy: BotGroupLabel[] = [];
      for (const [id, fallback] of [
        ['level', 'Level'],
        ['groups', 'Groups'],
        ['movies', 'Movies'],
      ] as const) {
        const name =
          typeof o[id] === 'string' && (o[id] as string).trim()
            ? (o[id] as string).trim().slice(0, 32)
            : fallback;
        legacy.push({ id, name });
      }
      return legacy;
    }
  }

  errors.push('labels: must be an array of { id, name } (or legacy { level, groups, movies })');
  return undefined;
}

/**
 * Parse pasted bot-group JSON. Accepts a group array, `{ groups: [...] }`,
 * `{ labels, groups }`, or a single group object.
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
  let labels: BotGroupLabels | undefined;
  const errors: string[] = [];

  if (Array.isArray(parsed)) {
    list = parsed;
  } else if (parsed && typeof parsed === 'object') {
    const o = parsed as Record<string, unknown>;
    if (Array.isArray(o.groups)) {
      list = o.groups;
      if (o.labels != null) {
        labels = parseImportedLabels(o.labels, errors);
      }
    } else if ('names' in o || 'id' in o || 'name' in o) {
      list = [parsed];
    } else {
      return {
        ok: false,
        errors: [
          'JSON must be an array of groups, { "labels", "groups": [...] }, or one group object',
        ],
      };
    }
  } else {
    return {
      ok: false,
      errors: [
        'JSON must be an array of groups, { "labels", "groups": [...] }, or one group object',
      ],
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
  return labels ? { ok: true, groups, labels } : { ok: true, groups };
}

/** Serialize groups (+ optional labels) for clipboard export (pretty-printed). */
export function serializeBotGroupsJson(
  groups: BotGroup[],
  labels?: BotGroupLabels,
): string {
  const payload = {
    labels: (labels ?? DEFAULT_BOT_GROUP_LABELS).map((l) => ({
      id: l.id,
      name: l.name,
    })),
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      labelId: resolveBotGroupLabelId(g.id, g.name, g.labelId),
      description: g.description ?? '',
      isDefault: g.isDefault,
      defaultPersonality: g.defaultPersonality,
      names: g.names,
      namePersonalities: g.namePersonalities,
    })),
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
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
    return { ok: false, errors: ['Import list is empty'] };
  }
  if (mode === 'replace') {
    if (imported.length > MAX_BOT_GROUPS) {
      return {
        ok: false,
        errors: [`Too many groups (max ${MAX_BOT_GROUPS}; got ${imported.length})`],
      };
    }
    return {
      ok: true,
      groups: ensureOneDefault(imported.map(normalizeAdminBotGroup)),
      added: imported.length,
      replaced: existing.length,
    };
  }

  const byId = new Map(existing.map((g) => [g.id, g]));
  let added = 0;
  let replaced = 0;
  for (const raw of imported) {
    const next = normalizeAdminBotGroup(raw);
    if (byId.has(next.id)) {
      const prev = byId.get(next.id)!;
      byId.set(next.id, {
        ...next,
        isDefault: next.isDefault || prev.isDefault,
      });
      replaced += 1;
    } else {
      byId.set(next.id, next);
      added += 1;
    }
  }
  const merged = [...byId.values()];
  if (merged.length > MAX_BOT_GROUPS) {
    return {
      ok: false,
      errors: [
        `Merge would exceed ${MAX_BOT_GROUPS} groups (would be ${merged.length}). Remove some first or use Replace.`,
      ],
    };
  }
  return { ok: true, groups: ensureOneDefault(merged), added, replaced };
}

/** Remap packs off a deleted label onto the first remaining label. */
export function remapGroupsAfterLabelDelete(
  groups: BotGroup[],
  deletedLabelId: string,
  remaining: BotGroupLabels,
): BotGroup[] {
  const fallback = remaining[0]?.id ?? 'groups';
  return groups.map((g) =>
    g.labelId === deletedLabelId ? { ...g, labelId: fallback } : g,
  );
}
