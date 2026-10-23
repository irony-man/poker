'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export const POKER_V2_AREAS = ['lobby', 'public', 'table', 'offline', 'analysis'] as const;
export type PokerV2Area = (typeof POKER_V2_AREAS)[number];

/** Play areas enabled by `all` and by preview. Analysis stays off unless named. */
export const POKER_V2_PLAY_AREAS: readonly PokerV2Area[] = ['lobby', 'public', 'table', 'offline'];

export const POKER_V2_STORAGE_KEY = 'pokr-pkv2';

export function isPokerV2Area(value: string): value is PokerV2Area {
  return (POKER_V2_AREAS as readonly string[]).includes(value);
}

/** `all` is the four play areas. `analysis` is on only when the list names it. */
export function parsePokerV2List(raw: string | null | undefined): Set<PokerV2Area> {
  const set = new Set<PokerV2Area>();
  if (!raw) return set;
  const parts = raw
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  if (parts.includes('all')) {
    for (const area of POKER_V2_PLAY_AREAS) set.add(area);
  }
  for (const part of parts) {
    if (isPokerV2Area(part)) set.add(part);
  }
  return set;
}

export function pokerV2PreviewDefault(): boolean {
  const vercel = process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV;
  return vercel === 'preview';
}

/**
 * Resolve one area.
 * `?pkv2=1|0` wins, then localStorage `1|0` or a comma list, then the env list.
 * Unset env on preview enables the play areas. Production defaults to off.
 */
export function resolvePokerV2(
  area: PokerV2Area,
  input: {
    query?: string | null;
    stored?: string | null;
    env?: string | null;
    preview?: boolean;
  },
): boolean {
  if (input.query === '1' || input.query === '0') return input.query === '1';
  if (input.stored === '1' || input.stored === '0') return input.stored === '1';
  if (input.stored) return parsePokerV2List(input.stored).has(area);
  if (input.env != null && input.env.trim() !== '') return parsePokerV2List(input.env).has(area);
  if (input.preview) return (POKER_V2_PLAY_AREAS as readonly string[]).includes(area);
  return false;
}

export function pokerV2FromEnv(area: PokerV2Area): boolean {
  return resolvePokerV2(area, {
    env: process.env.NEXT_PUBLIC_POKER_V2 ?? null,
    preview: pokerV2PreviewDefault(),
  });
}

/** Client flag. Query overrides storage; both override the build env. */
export function usePokerV2(area: PokerV2Area): boolean {
  const params = useSearchParams();
  const query = params.get('pkv2');
  const [stored, setStored] = useState<string | null>(null);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    if (query === '1' || query === '0') {
      try {
        window.localStorage.setItem(POKER_V2_STORAGE_KEY, query);
      } catch {
        /* private mode */
      }
      setStored(query);
      setStorageReady(true);
      return;
    }
    try {
      setStored(window.localStorage.getItem(POKER_V2_STORAGE_KEY));
    } catch {
      setStored(null);
    }
    setStorageReady(true);
  }, [query]);

  if (query === '1' || query === '0') return query === '1';
  if (!storageReady) return pokerV2FromEnv(area);
  return resolvePokerV2(area, {
    stored,
    env: process.env.NEXT_PUBLIC_POKER_V2 ?? null,
    preview: pokerV2PreviewDefault(),
  });
}
