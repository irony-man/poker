'use client';

import { useEffect, useState } from 'react';
import {
  DEFAULT_LOBBY_NAV,
  isLobbyNavVisible,
  normalizeLobbyNavConfig,
  type LobbyNavConfig,
  type LobbyNavId,
} from '@poker/protocol';
import { fetchPublicSite } from '@/lib/api';

let lastLoaded: LobbyNavConfig | null = null;

/** Sidebar order + visibility from /api/site (Admin → Sidebar); defaults until it loads. */
export function useLobbyNav(): LobbyNavConfig {
  const [config, setConfig] = useState<LobbyNavConfig>(() => lastLoaded ?? DEFAULT_LOBBY_NAV);

  useEffect(() => {
    let cancelled = false;
    void fetchPublicSite()
      .then((data) => {
        const next = normalizeLobbyNavConfig(data.lobbyNav);
        lastLoaded = next;
        if (!cancelled) setConfig(next);
      })
      .catch(() => {
        /* keep defaults */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return config;
}

export function useLobbyNavVisible(id: LobbyNavId): boolean {
  return isLobbyNavVisible(useLobbyNav(), id);
}
