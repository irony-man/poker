import { coerceMoney } from '@/lib/currency';

/**
 * Net chips taken from opponents: pot share minus the winner's own contribution.
 * Falls back to the full award when committed is unknown (older payloads).
 */
export function chipsFromOthers(potAwarded: number, committed: unknown): number {
  return Math.max(0, potAwarded - coerceMoney(committed));
}
