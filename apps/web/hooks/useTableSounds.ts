'use client';

import { useEffect, useRef } from 'react';
import { configureTableSounds, playSound } from '@/lib/audio';
import {
  DEFAULT_TABLE_SOUND_URLS,
  fetchPublicSite,
  type TableSoundKind,
} from '@/lib/api';
import { useSession, type PublicTable } from '@/lib/store';

function actionToSound(
  action: string | undefined,
  label: string,
): TableSoundKind | null {
  if (
    action === 'fold' ||
    action === 'check' ||
    action === 'call' ||
    action === 'bet' ||
    action === 'raise' ||
    action === 'allin'
  ) {
    return action;
  }
  const t = label.trim().toLowerCase();
  if (t.startsWith('fold')) return 'fold';
  if (t.startsWith('check')) return 'check';
  if (t.startsWith('call')) return 'call';
  if (t.startsWith('bet')) return 'bet';
  if (t.startsWith('raise')) return 'raise';
  if (/^all[-\s]?in\b/.test(t)) return 'allin';
  return null;
}

/** Load site sound URLs and play SFX for seat actions + street / deal / win transitions. */
export function useTableSounds(table: PublicTable | null | undefined): void {
  const actionBurst = useSession((s) => s.actionBurst);
  const prevTable = useRef<{
    street: PublicTable['street'] | null;
    handId: string | null;
    version: number | null;
  }>({ street: null, handId: null, version: null });
  const lastActionAt = useRef<number | null>(null);
  const soundsLoaded = useRef(false);

  useEffect(() => {
    if (soundsLoaded.current) return;
    soundsLoaded.current = true;
    let cancelled = false;
    void fetchPublicSite()
      .then((site) => {
        if (cancelled) return;
        configureTableSounds(
          site.sounds ?? { enabled: true, urls: { ...DEFAULT_TABLE_SOUND_URLS } },
        );
      })
      .catch(() => {
        if (cancelled) return;
        configureTableSounds({ enabled: true, urls: { ...DEFAULT_TABLE_SOUND_URLS } });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!actionBurst) return;
    if (lastActionAt.current === actionBurst.at) return;
    lastActionAt.current = actionBurst.at;
    const kind = actionToSound(actionBurst.action, actionBurst.label);
    if (kind) playSound(kind);
  }, [actionBurst]);

  useEffect(() => {
    if (!table) return;
    const prev = prevTable.current;
    const streetChanged = prev.street != null && prev.street !== table.street;
    const handChanged = prev.handId != null && prev.handId !== table.handId;
    const versionChanged = prev.version != null && prev.version !== table.version;

    if (versionChanged || streetChanged || handChanged) {
      if (table.street === 'payout' && prev.street !== 'payout') {
        playSound('win');
      } else if (streetChanged && table.street === 'flop') {
        playSound('flop');
      } else if (streetChanged && table.street === 'turn') {
        playSound('turn');
      } else if (streetChanged && table.street === 'river') {
        playSound('river');
      } else if (
        (handChanged || (streetChanged && table.street === 'preflop')) &&
        table.street === 'preflop'
      ) {
        playSound('deal');
      }
    }

    prevTable.current = {
      street: table.street,
      handId: table.handId,
      version: table.version,
    };
  }, [table]);
}
