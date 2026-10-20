import { createDeck } from '@poker/engine';
import { ClientMessageSchema, STAKE_PRESETS } from '@poker/protocol';

export interface SharedPackageSmoke {
  deckCount: number;
  stakeIds: readonly string[];
  pingValid: boolean;
}

/** Proves the app is linked to the shared engine and protocol builds, not copies. */
export function sharedPackageSmoke(): SharedPackageSmoke {
  const ping = ClientMessageSchema.safeParse({ type: 'ping' });
  return {
    deckCount: createDeck().length,
    stakeIds: STAKE_PRESETS.map((stake) => stake.id),
    pingValid: ping.success,
  };
}
