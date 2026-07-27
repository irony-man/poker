/** Shared stake presets for public ring tables and private host options. */
export interface StakePreset {
  id: string;
  label: string;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
}

export const STAKE_PRESETS: StakePreset[] = [
  { id: 'micro', label: 'Micro', smallBlind: 2, bigBlind: 5, minBuyIn: 100, maxBuyIn: 500 },
  { id: 'low', label: 'Low', smallBlind: 5, bigBlind: 10, minBuyIn: 200, maxBuyIn: 1000 },
  { id: 'mid', label: 'Mid', smallBlind: 10, bigBlind: 25, minBuyIn: 500, maxBuyIn: 2500 },
  { id: 'high', label: 'High', smallBlind: 25, bigBlind: 50, minBuyIn: 1000, maxBuyIn: 5000 },
];

export function stakeById(id: string): StakePreset | undefined {
  return STAKE_PRESETS.find((s) => s.id === id);
}

export const DEFAULT_STAKE_ID = 'low';
