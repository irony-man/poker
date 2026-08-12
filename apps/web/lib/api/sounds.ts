import { assetUrl } from '@/lib/assets';

export type TableSoundKind =
  | 'fold'
  | 'check'
  | 'call'
  | 'bet'
  | 'raise'
  | 'allin'
  | 'deal'
  | 'flop'
  | 'turn'
  | 'river'
  | 'win';

export const TABLE_SOUND_KINDS: readonly TableSoundKind[] = [
  'fold',
  'check',
  'call',
  'bet',
  'raise',
  'allin',
  'deal',
  'flop',
  'turn',
  'river',
  'win',
] as const;

export const DEFAULT_TABLE_SOUND_URLS: Record<TableSoundKind, string> = {
  fold: assetUrl('/sounds/fold.mp3'),
  check: assetUrl('/sounds/check.mp3'),
  call: assetUrl('/sounds/call.mp3'),
  bet: assetUrl('/sounds/bet.mp3'),
  raise: assetUrl('/sounds/raise.mp3'),
  allin: assetUrl('/sounds/allin.mp3'),
  deal: assetUrl('/sounds/deal.mp3'),
  flop: assetUrl('/sounds/flop.mp3'),
  turn: assetUrl('/sounds/turn.mp3'),
  river: assetUrl('/sounds/river.mp3'),
  win: assetUrl('/sounds/win.mp3'),
};

export const TABLE_SOUND_LABELS: Record<TableSoundKind, string> = {
  fold: 'Fold',
  check: 'Check',
  call: 'Call',
  bet: 'Bet',
  raise: 'Raise',
  allin: 'All-in',
  deal: 'Deal (hole cards)',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
  win: 'Win / payout',
};

export interface TableSoundsConfig {
  enabled: boolean;
  urls: Partial<Record<TableSoundKind, string>>;
}

export function defaultTableSoundsConfig(): TableSoundsConfig {
  return {
    enabled: true,
    urls: { ...DEFAULT_TABLE_SOUND_URLS },
  };
}
