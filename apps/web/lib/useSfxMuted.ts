'use client';

import { useCallback, useEffect, useState } from 'react';
import { updateMe } from '@/lib/api';
import { isSfxMuted, setSfxMuted, subscribeSfxMuted } from '@/lib/audio';
import { readStoredSession } from '@/lib/session';
import { useSession } from '@/lib/store';

/** Live table-sound mute. Updates when Profile or the table chrome toggle saves. */
export function useSfxMuted(): {
  muted: boolean;
  setMuted: (muted: boolean) => void;
} {
  const sessionToken = useSession((s) => s.sessionToken);
  const [muted, setMutedState] = useState(isSfxMuted);

  useEffect(() => {
    setMutedState(isSfxMuted());
    return subscribeSfxMuted(setMutedState);
  }, []);

  const setMuted = useCallback(
    (next: boolean) => {
      setSfxMuted(next);
      const token = sessionToken ?? readStoredSession()?.sessionToken ?? null;
      if (!token) return;
      void updateMe(token, { sfxMuted: next }).catch(() => {
        /* keep local mute even if the account save fails */
      });
    },
    [sessionToken],
  );

  return { muted, setMuted };
}
