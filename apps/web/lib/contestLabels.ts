import type { ContestMode } from '@poker/protocol';

/** Short UI label for contest play mode. */
export function contestModeLabel(mode: ContestMode): string {
  return mode === 'rounds' ? 'Rounds' : 'Knockout';
}
