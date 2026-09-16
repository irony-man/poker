'use client';

import { useEffect, useState } from 'react';
import {
  clampKeyboardShortcuts,
  DEFAULT_KEYBOARD_SHORTCUTS,
  KEYBOARD_SHORTCUT_ACTION_IDS,
  normalizeShortcutKey,
  type KeyboardShortcutActionId,
  type KeyboardShortcuts,
} from '@poker/protocol';

export {
  clampKeyboardShortcuts,
  DEFAULT_KEYBOARD_SHORTCUTS,
  KEYBOARD_SHORTCUT_ACTION_IDS,
  normalizeShortcutKey,
  type KeyboardShortcutActionId,
  type KeyboardShortcuts,
};

export const KEYBOARD_SHORTCUTS_STORAGE_KEY = 'pokr-keyboard-shortcuts';
export const KEYBOARD_SHORTCUTS_EVENT = 'pokr-keyboard-shortcuts';

export const KEYBOARD_SHORTCUT_LABELS: Record<KeyboardShortcutActionId, string> = {
  fold: 'Fold',
  call: 'Call',
  check: 'Check',
  betRaise: 'Bet / raise',
  allIn: 'All-in',
  voiceToggle: 'Join / leave voice',
  micMute: 'Mute mic',
  chat: 'Open chat',
  sfxMute: 'Mute table sounds',
  help: 'How to play',
  ready: 'Ready for next hand',
  sitOut: 'Sit out next',
  sitIn: 'Sit in',
};

export function formatShortcutKey(key: string): string {
  return key === ' ' ? 'Space' : key;
}

/** Map a KeyboardEvent.key to the stored shortcut form. */
export function eventShortcutKey(e: KeyboardEvent): string | null {
  return normalizeShortcutKey(e.key);
}

export function actionIdForShortcutKey(
  bindings: KeyboardShortcuts,
  key: string,
): KeyboardShortcutActionId | null {
  const normalized = normalizeShortcutKey(key);
  if (!normalized) return null;
  for (const id of KEYBOARD_SHORTCUT_ACTION_IDS) {
    if (bindings[id] === normalized) return id;
  }
  return null;
}

export function loadSavedKeyboardShortcuts(): KeyboardShortcuts {
  if (typeof window === 'undefined') return { ...DEFAULT_KEYBOARD_SHORTCUTS };
  try {
    const raw = window.localStorage.getItem(KEYBOARD_SHORTCUTS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_KEYBOARD_SHORTCUTS };
    return clampKeyboardShortcuts(JSON.parse(raw) as unknown);
  } catch {
    return { ...DEFAULT_KEYBOARD_SHORTCUTS };
  }
}

export function saveKeyboardShortcuts(next: KeyboardShortcuts | unknown): KeyboardShortcuts {
  const clamped = clampKeyboardShortcuts(next);
  try {
    window.localStorage.setItem(KEYBOARD_SHORTCUTS_STORAGE_KEY, JSON.stringify(clamped));
  } catch {
    /* quota / private mode */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(KEYBOARD_SHORTCUTS_EVENT, { detail: clamped }));
  }
  return clamped;
}

export function subscribeKeyboardShortcuts(
  listener: (shortcuts: KeyboardShortcuts) => void,
): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const onCustom = (event: Event) => {
    listener(clampKeyboardShortcuts((event as CustomEvent).detail));
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEYBOARD_SHORTCUTS_STORAGE_KEY) return;
    try {
      listener(clampKeyboardShortcuts(event.newValue ? JSON.parse(event.newValue) : {}));
    } catch {
      listener({ ...DEFAULT_KEYBOARD_SHORTCUTS });
    }
  };
  window.addEventListener(KEYBOARD_SHORTCUTS_EVENT, onCustom);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(KEYBOARD_SHORTCUTS_EVENT, onCustom);
    window.removeEventListener('storage', onStorage);
  };
}

/** Live remappable bindings (Profile Theme + localStorage). */
export function useKeyboardShortcuts(): KeyboardShortcuts {
  const [shortcuts, setShortcuts] = useState(loadSavedKeyboardShortcuts);
  useEffect(() => {
    setShortcuts(loadSavedKeyboardShortcuts());
    return subscribeKeyboardShortcuts(setShortcuts);
  }, []);
  return shortcuts;
}

/** True when focus is in a field where letter shortcuts must not fire. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest('[contenteditable="true"]'));
}
