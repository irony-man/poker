'use client';

import { useEffect, useRef, type MutableRefObject, type RefObject } from 'react';
import {
  actionIdForShortcutKey,
  eventShortcutKey,
  isTypingTarget,
  useKeyboardShortcuts,
  type KeyboardShortcutActionId,
} from '@/lib/keyboardShortcuts';

export type PlayHotkeyHandlers = {
  fold: () => void;
  call: () => void;
  check: () => void;
  betRaise: () => void;
  allIn: () => void;
  /** When true, letter play hotkeys are ignored (confirm dialog owns Enter). */
  confirmOpen: boolean;
};

export type TableHotkeyHandlers = {
  voiceToggle?: () => void;
  micMute?: () => void;
  chat?: () => void;
  sfxMute?: () => void;
  help?: () => void;
  ready?: () => void;
  sitOut?: () => void;
  sitIn?: () => void;
};

/**
 * Table-wide remappable hotkeys. Play actions go through {@link playRef};
 * chrome actions use the provided callbacks.
 */
export function useTableHotkeys({
  enabled = true,
  playRef,
  chrome,
}: {
  enabled?: boolean;
  playRef?: RefObject<PlayHotkeyHandlers | null> | MutableRefObject<PlayHotkeyHandlers | null>;
  chrome?: TableHotkeyHandlers;
}) {
  const shortcuts = useKeyboardShortcuts();
  const chromeRef = useRef(chrome);
  chromeRef.current = chrome;

  useEffect(() => {
    if (!enabled) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.repeat) return;
      if (isTypingTarget(e.target)) return;

      const key = eventShortcutKey(e);
      if (!key) return;

      const play = playRef?.current;
      if (play?.confirmOpen) return;

      const action = actionIdForShortcutKey(shortcuts, key);
      if (!action) return;

      const runChrome = (id: KeyboardShortcutActionId, fn?: () => void) => {
        if (!fn) return false;
        e.preventDefault();
        fn();
        return true;
      };

      switch (action) {
        case 'fold':
          if (!play) return;
          e.preventDefault();
          play.fold();
          return;
        case 'call':
          if (!play) return;
          e.preventDefault();
          play.call();
          return;
        case 'check':
          if (!play) return;
          e.preventDefault();
          play.check();
          return;
        case 'betRaise':
          if (!play) return;
          e.preventDefault();
          play.betRaise();
          return;
        case 'allIn':
          if (!play) return;
          e.preventDefault();
          play.allIn();
          return;
        case 'voiceToggle':
          runChrome(action, chromeRef.current?.voiceToggle);
          return;
        case 'micMute':
          runChrome(action, chromeRef.current?.micMute);
          return;
        case 'chat':
          runChrome(action, chromeRef.current?.chat);
          return;
        case 'sfxMute':
          runChrome(action, chromeRef.current?.sfxMute);
          return;
        case 'help':
          runChrome(action, chromeRef.current?.help);
          return;
        case 'ready':
          runChrome(action, chromeRef.current?.ready);
          return;
        case 'sitOut':
          runChrome(action, chromeRef.current?.sitOut);
          return;
        case 'sitIn':
          runChrome(action, chromeRef.current?.sitIn);
          return;
        default:
          return;
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, playRef, shortcuts]);
}
