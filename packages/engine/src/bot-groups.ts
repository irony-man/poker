import type { BotPersonalityId } from './bot.js';
import { BOT_NAME_PERSONALITIES, DEFAULT_BOT_NAMES } from './bot.js';

/** Picker row label (admin-defined; packs reference it via `labelId`). */
export interface BotGroupLabelDef {
  id: string;
  name: string;
}

export const MAX_BOT_GROUP_LABELS = 12;
export const MAX_BOT_GROUP_LABEL_ID_LEN = 32;
export const MAX_BOT_GROUP_LABEL_NAME_LEN = 32;
export const MAX_BOT_GROUP_DESCRIPTION_LEN = 120;

/** Built-in Level / Groups / Movies rows. */
export const DEFAULT_BOT_GROUP_LABEL_DEFS: readonly BotGroupLabelDef[] = [
  { id: 'level', name: 'Level' },
  { id: 'groups', name: 'Groups' },
  { id: 'movies', name: 'Movies' },
];

const LEVEL_KEYS = new Set(['easy', 'medium', 'hard']);

/**
 * Map legacy `kind` values onto label ids.
 * `style` packs lived under the Groups row.
 */
export function legacyKindToLabelId(kind: string | null | undefined): string | null {
  if (typeof kind !== 'string') return null;
  const k = kind.trim().toLowerCase();
  if (!k) return null;
  if (k === 'style') return 'groups';
  return k.slice(0, MAX_BOT_GROUP_LABEL_ID_LEN);
}

/**
 * Resolve which picker row a pack belongs on.
 * Prefer explicit `labelId`, then legacy `kind`, then Easy/Medium/Hard → level.
 */
export function resolveBotGroupLabelId(
  id: string,
  name: string,
  labelId?: string | null,
  kind?: string | null,
): string {
  const explicit = typeof labelId === 'string' ? labelId.trim() : '';
  if (explicit) return explicit.slice(0, MAX_BOT_GROUP_LABEL_ID_LEN);
  const fromKind = legacyKindToLabelId(kind);
  if (fromKind) return fromKind;
  if (LEVEL_KEYS.has(id.trim().toLowerCase())) return 'level';
  if (LEVEL_KEYS.has(name.trim().toLowerCase())) return 'level';
  return 'groups';
}

/** @deprecated Use `resolveBotGroupLabelId`. Maps to legacy kind names. */
export function resolveBotGroupKind(
  id: string,
  name: string,
  kind?: string | null,
): 'level' | 'style' | 'movies' {
  const labelId = resolveBotGroupLabelId(id, name, null, kind);
  if (labelId === 'level') return 'level';
  if (labelId === 'movies') return 'movies';
  return 'style';
}

export type BotGroupKind = 'level' | 'style' | 'movies';

export const BOT_GROUP_KINDS: readonly BotGroupKind[] = ['level', 'style', 'movies'] as const;

export function isBotGroupKind(value: string | null | undefined): value is BotGroupKind {
  return value === 'level' || value === 'style' || value === 'movies';
}

/** Partition packs into ordered label rows for host / offline pickers. */
export function partitionBotGroupsByLabel<
  T extends { id: string; name: string; labelId?: string | null; kind?: string | null },
>(
  groups: readonly T[],
  labels: readonly BotGroupLabelDef[],
): { label: BotGroupLabelDef; groups: T[] }[] {
  const labelList =
    labels.length > 0
      ? labels.map((l) => ({
          id: l.id.trim().slice(0, MAX_BOT_GROUP_LABEL_ID_LEN),
          name: l.name.trim().slice(0, MAX_BOT_GROUP_LABEL_NAME_LEN) || l.id,
        }))
      : DEFAULT_BOT_GROUP_LABEL_DEFS.map((l) => ({ ...l }));

  const known = new Set(labelList.map((l) => l.id));
  const buckets = new Map<string, T[]>();
  for (const l of labelList) buckets.set(l.id, []);

  const orphans: T[] = [];
  for (const g of groups) {
    const lid = resolveBotGroupLabelId(g.id, g.name, g.labelId, g.kind);
    if (known.has(lid)) {
      buckets.get(lid)!.push(g);
    } else {
      orphans.push(g);
    }
  }
  if (orphans.length > 0 && labelList[0]) {
    buckets.get(labelList[0]!.id)!.push(...orphans);
  }

  return labelList.map((label) => ({
    label,
    groups: buckets.get(label.id) ?? [],
  }));
}

/** @deprecated Prefer `partitionBotGroupsByLabel`. */
export function partitionBotGroupsByKind<
  T extends { id: string; name: string; kind?: BotGroupKind | null; labelId?: string | null },
>(groups: readonly T[]): { levels: T[]; styles: T[]; movies: T[] } {
  const rows = partitionBotGroupsByLabel(groups, DEFAULT_BOT_GROUP_LABEL_DEFS);
  return {
    levels: rows.find((r) => r.label.id === 'level')?.groups ?? [],
    styles: rows.find((r) => r.label.id === 'groups')?.groups ?? [],
    movies: rows.find((r) => r.label.id === 'movies')?.groups ?? [],
  };
}

/** Shared default pack shape (server + admin map into their BotGroup types). */
export interface DefaultBotGroupDef {
  id: string;
  name: string;
  labelId: string;
  description: string;
  isDefault: boolean;
  defaultPersonality: BotPersonalityId | null;
  names: string[];
  namePersonalities: Record<string, BotPersonalityId>;
}

function pack(
  partial: Omit<DefaultBotGroupDef, 'namePersonalities' | 'description'> & {
    description?: string;
    namePersonalities?: Record<string, BotPersonalityId>;
  },
): DefaultBotGroupDef {
  return {
    ...partial,
    description: partial.description ?? '',
    namePersonalities: { ...(partial.namePersonalities ?? {}) },
  };
}

const MEDIUM_NAMES = [...DEFAULT_BOT_NAMES];
const MEDIUM_PERSONALITIES: Record<string, BotPersonalityId> = {
  ...BOT_NAME_PERSONALITIES,
};

/** Curated Easy / Medium / Hard + table-style packs shipped as site defaults. */
export const DEFAULT_BOT_GROUP_DEFS: readonly DefaultBotGroupDef[] = [
  pack({
    id: 'easy',
    name: 'Easy',
    labelId: 'level',
    description: 'Soft callers and passive tables',
    isDefault: false,
    defaultPersonality: 'caller',
    names: [
      'SoftCall',
      'CheckPlease',
      'Limper',
      'CallStation',
      'PassivePete',
      'FoldFirst',
      'EasyMoney',
      'WeakTight',
      'SplashySue',
      'NiceNit',
    ],
    namePersonalities: {
      SoftCall: 'caller',
      CheckPlease: 'passive',
      Limper: 'loose',
      CallStation: 'caller',
      PassivePete: 'passive',
      FoldFirst: 'nit',
      EasyMoney: 'loose',
      WeakTight: 'nit',
      SplashySue: 'caller',
      NiceNit: 'passive',
    },
  }),
  pack({
    id: 'medium',
    name: 'Medium',
    labelId: 'level',
    description: 'Balanced mix of styles',
    isDefault: true,
    defaultPersonality: null,
    names: MEDIUM_NAMES,
    namePersonalities: MEDIUM_PERSONALITIES,
  }),
  pack({
    id: 'hard',
    name: 'Hard',
    labelId: 'level',
    description: 'Tough regs — pressure and thin value',
    isDefault: false,
    defaultPersonality: 'aggro',
    names: [
      'SolidRock',
      'ValueTown',
      'TripleBarrel',
      'Polarizer',
      'PressureBot',
      'ThinValue',
      'BlockerBluff',
      'RangeMerger',
      'IceVeins',
      'Solverish',
    ],
    namePersonalities: {
      SolidRock: 'tight',
      ValueTown: 'aggro',
      TripleBarrel: 'lag',
      Polarizer: 'aggro',
      PressureBot: 'lag',
      ThinValue: 'humanoid',
      BlockerBluff: 'humanoid',
      RangeMerger: 'balanced',
      IceVeins: 'tight',
      Solverish: 'humanoid',
    },
  }),
  pack({
    id: 'tight-table',
    name: 'Tight Table',
    labelId: 'groups',
    description: 'Nits and ABC regs — wait for the nuts',
    isDefault: false,
    defaultPersonality: 'nit',
    names: [
      'StoneWall',
      'LockBox',
      'FoldBot',
      'NutsNova',
      'IceVeins',
      'NitPick',
      'TankTime',
      'ABCReg',
    ],
    namePersonalities: {
      StoneWall: 'nit',
      LockBox: 'nit',
      FoldBot: 'nit',
      NutsNova: 'tight',
      IceVeins: 'tight',
      NitPick: 'nit',
      TankTime: 'tight',
      ABCReg: 'tight',
    },
  }),
  pack({
    id: 'aggression-alley',
    name: 'Aggression Alley',
    labelId: 'groups',
    description: 'Raises and barrels — apply pressure',
    isDefault: false,
    defaultPersonality: 'aggro',
    names: [
      'RaiseRex',
      'AceBot',
      'ChipShark',
      'TripleBarrel',
      'PressureBot',
      'BluffByte',
      'LagLord',
      'BarrelBot',
    ],
    namePersonalities: {
      RaiseRex: 'aggro',
      AceBot: 'aggro',
      ChipShark: 'aggro',
      TripleBarrel: 'lag',
      PressureBot: 'lag',
      BluffByte: 'lag',
      LagLord: 'lag',
      BarrelBot: 'aggro',
    },
  }),
  pack({
    id: 'splash-zone',
    name: 'Splash Zone',
    labelId: 'groups',
    description: 'Loose and splashy — lots of action',
    isDefault: false,
    defaultPersonality: 'loose',
    names: [
      'Limper',
      'CallStation',
      'SplashySue',
      'AllInAnnie',
      'RiverRat',
      'CallCart',
      'LooseLucy',
      'FishFry',
    ],
    namePersonalities: {
      Limper: 'loose',
      CallStation: 'caller',
      SplashySue: 'loose',
      AllInAnnie: 'maniac',
      RiverRat: 'caller',
      CallCart: 'caller',
      LooseLucy: 'loose',
      FishFry: 'maniac',
    },
  }),
  pack({
    id: 'chaos-crew',
    name: 'Chaos Crew',
    labelId: 'groups',
    description: 'Maniacs and tilters — buckle up',
    isDefault: false,
    defaultPersonality: 'maniac',
    names: [
      'AllInAnnie',
      'ChaosCarl',
      'YoloYuri',
      'BluffByte',
      'LagLord',
      'TiltTok',
      'ShoveShow',
      'WildWire',
    ],
    namePersonalities: {
      AllInAnnie: 'maniac',
      ChaosCarl: 'maniac',
      YoloYuri: 'maniac',
      BluffByte: 'lag',
      LagLord: 'lag',
      TiltTok: 'maniac',
      ShoveShow: 'maniac',
      WildWire: 'lag',
    },
  }),
  pack({
    id: 'human-mimics',
    name: 'Human Mimics',
    labelId: 'groups',
    description: 'Humanoid lines — tricky and adaptive',
    isDefault: false,
    defaultPersonality: 'humanoid',
    names: [
      'Humanoid',
      'ThinValue',
      'BlockerBluff',
      'Solverish',
      'RangeMerger',
      'LiveRead',
      'Metagamer',
      'TableTalk',
    ],
    namePersonalities: {
      Humanoid: 'humanoid',
      ThinValue: 'humanoid',
      BlockerBluff: 'humanoid',
      Solverish: 'humanoid',
      RangeMerger: 'balanced',
      LiveRead: 'humanoid',
      Metagamer: 'humanoid',
      TableTalk: 'humanoid',
    },
  }),
  pack({
    id: 'mixed-field',
    name: 'Mixed Field',
    labelId: 'groups',
    description: 'Classic mixed roster',
    isDefault: false,
    defaultPersonality: null,
    names: [
      'AceBot',
      'RiverRat',
      'BluffByte',
      'PotOdds',
      'ChipShark',
      'FoldBot',
      'AllInAnnie',
      'NutsNova',
      'CallCart',
      'RaiseRex',
      'Humanoid',
    ],
    namePersonalities: { ...BOT_NAME_PERSONALITIES },
  }),
];
