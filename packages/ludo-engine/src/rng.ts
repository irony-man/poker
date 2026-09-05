import { randomBytes } from 'node:crypto';
import type { RollDie } from './types.js';

/**
 * Unbiased 1d6 via rejection sampling on CSPRNG bytes.
 * Values 252–255 are discarded so each face is equally likely.
 */
export function rollDie(randomBytesFn: (n: number) => Uint8Array = randomBytes): number {
  for (;;) {
    const b = randomBytesFn(1)[0]!;
    if (b < 252) return (b % 6) + 1;
  }
}

export const defaultRollDie: RollDie = () => rollDie();
