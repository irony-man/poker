import { clampKeyboardShortcuts, type KeyboardShortcuts } from '@poker/protocol';

/** Persist / return a full remappable shortcut map (defaults filled in). */
export function clampUserKeyboardShortcuts(value: unknown): KeyboardShortcuts {
  return clampKeyboardShortcuts(value ?? {});
}
