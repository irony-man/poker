/** Shared stake presets for public ring tables and private host options. */
export interface StakePreset {
  id: string;
  label: string;
  smallBlind: number;
  bigBlind: number;
  /** Fixed buy-in for the stake level. */
  buyIn: number;
}

export const STAKE_PRESETS: StakePreset[] = [
  { id: 'micro', label: 'Micro', smallBlind: 2, bigBlind: 5, buyIn: 500 },
  { id: 'low', label: 'Low', smallBlind: 5, bigBlind: 10, buyIn: 1000 },
  { id: 'mid', label: 'Mid', smallBlind: 10, bigBlind: 25, buyIn: 2500 },
  { id: 'high', label: 'High', smallBlind: 25, bigBlind: 50, buyIn: 5000 },
];

export function stakeById(id: string): StakePreset | undefined {
  return STAKE_PRESETS.find((s) => s.id === id);
}

export const DEFAULT_STAKE_ID = 'low';

/** Bounds for host-chosen blinds and starting stack (hosted tables and contests). */
export const CUSTOM_STAKE_LIMITS = {
  minSmallBlind: 1,
  maxBigBlind: 10_000,
  minStackBigBlinds: 10,
  maxStackBigBlinds: 500,
  maxStack: 1_000_000,
} as const;

/** Returns a user-facing error, or null when blinds and stack are within `CUSTOM_STAKE_LIMITS`. */
export function validateStakes(smallBlind: number, bigBlind: number, stack: number): string | null {
  const L = CUSTOM_STAKE_LIMITS;
  if (![smallBlind, bigBlind, stack].every(Number.isInteger)) {
    return 'Blinds and starting stack must be whole numbers';
  }
  if (smallBlind < L.minSmallBlind) return `Small blind must be at least ${L.minSmallBlind}`;
  if (bigBlind < smallBlind) return 'Big blind must be at least the small blind';
  if (bigBlind > L.maxBigBlind) {
    return `Big blind can be at most ${L.maxBigBlind.toLocaleString('en-US')}`;
  }
  if (stack < bigBlind * L.minStackBigBlinds) {
    return `Starting stack must be at least ${L.minStackBigBlinds} big blinds`;
  }
  if (stack > bigBlind * L.maxStackBigBlinds) {
    return `Starting stack can be at most ${L.maxStackBigBlinds} big blinds`;
  }
  if (stack > L.maxStack) {
    return `Starting stack can be at most ${L.maxStack.toLocaleString('en-US')}`;
  }
  return null;
}
