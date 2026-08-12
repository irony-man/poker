'use client';

import {
  DEFAULT_TABLE_SOUND_URLS,
  TABLE_SOUND_KINDS,
  type TableSoundKind,
  type TableSoundsConfig,
} from '@/lib/api';

const MUTE_KEY = 'poker:sfxMuted';

type SoundConfig = {
  enabled: boolean;
  urls: Record<TableSoundKind, string>;
};

let config: SoundConfig = {
  enabled: true,
  urls: { ...DEFAULT_TABLE_SOUND_URLS },
};

const elements = new Map<TableSoundKind, HTMLAudioElement>();

function mergeUrls(
  overrides?: Partial<Record<TableSoundKind, string>>,
): Record<TableSoundKind, string> {
  const urls = { ...DEFAULT_TABLE_SOUND_URLS };
  if (!overrides) return urls;
  for (const kind of TABLE_SOUND_KINDS) {
    if (kind in overrides) {
      const v = overrides[kind];
      urls[kind] = typeof v === 'string' ? v.trim() : urls[kind];
    }
  }
  return urls;
}

function getOrCreateAudio(kind: TableSoundKind, url: string): HTMLAudioElement | null {
  if (typeof window === 'undefined' || !url) return null;
  let el = elements.get(kind);
  if (!el) {
    el = new Audio();
    el.preload = 'auto';
    elements.set(kind, el);
  }
  if (el.src !== new URL(url, window.location.origin).href && el.getAttribute('data-src') !== url) {
    el.setAttribute('data-src', url);
    el.src = url;
    try {
      el.load();
    } catch {
      /* ignore */
    }
  }
  return el;
}

/** Apply site/admin sound config (enable + per-kind URLs). */
export function configureTableSounds(next: TableSoundsConfig | null | undefined): void {
  if (!next) {
    config = { enabled: true, urls: { ...DEFAULT_TABLE_SOUND_URLS } };
    return;
  }
  config = {
    enabled: next.enabled !== false,
    urls: mergeUrls(next.urls),
  };
  if (typeof window === 'undefined') return;
  for (const kind of TABLE_SOUND_KINDS) {
    const url = config.urls[kind];
    if (url) getOrCreateAudio(kind, url);
  }
}

export function isSfxMuted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setSfxMuted(muted: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (muted) window.localStorage.setItem(MUTE_KEY, '1');
    else window.localStorage.removeItem(MUTE_KEY);
  } catch {
    /* ignore */
  }
}

/** Play a table SFX sample. Soft-fails on autoplay / missing files. */
export function playSound(kind: TableSoundKind): void {
  if (typeof window === 'undefined') return;
  if (!config.enabled || isSfxMuted()) return;
  const url = config.urls[kind];
  if (!url) return;
  try {
    const el = getOrCreateAudio(kind, url);
    if (!el) return;
    el.currentTime = 0;
    void el.play().catch(() => {
      /* ignore autoplay restrictions */
    });
  } catch {
    /* ignore */
  }
}

/** @deprecated Prefer playSound with a specific kind. */
export function playTick(kind: 'deal' | 'action' | 'win' | 'error' = 'action'): void {
  if (kind === 'deal') playSound('deal');
  else if (kind === 'win') playSound('win');
  else if (kind === 'error') playSound('fold');
  else playSound('check');
}
