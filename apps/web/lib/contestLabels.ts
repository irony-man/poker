import type { ContestMode } from '@poker/protocol';
import { MONEY_TOKEN } from '@/lib/currency';

/** Short UI label for contest play mode. */
export function contestModeLabel(mode: ContestMode): string {
  return mode === 'rounds' ? 'Rounds' : MONEY_TOKEN;
}
