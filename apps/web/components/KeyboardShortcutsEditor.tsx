'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  DEFAULT_KEYBOARD_SHORTCUTS,
  KEYBOARD_SHORTCUT_ACTION_IDS,
  KEYBOARD_SHORTCUT_LABELS,
  clampKeyboardShortcuts,
  eventShortcutKey,
  formatShortcutKey,
  type KeyboardShortcutActionId,
  type KeyboardShortcuts,
} from '@/lib/keyboardShortcuts';

export function KeyboardShortcutsEditor({
  value,
  disabled,
  onChange,
}: {
  value: KeyboardShortcuts;
  disabled?: boolean;
  onChange: (next: KeyboardShortcuts) => void;
}) {
  const [capturing, setCapturing] = useState<KeyboardShortcutActionId | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!capturing) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') {
        setCapturing(null);
        setError(null);
        return;
      }
      const key = eventShortcutKey(e);
      if (!key) {
        setError('That key cannot be used. Pick a letter or /.');
        return;
      }
      const owner = KEYBOARD_SHORTCUT_ACTION_IDS.find(
        (id) => id !== capturing && value[id] === key,
      );
      if (owner) {
        setError(`Already used by ${KEYBOARD_SHORTCUT_LABELS[owner]}.`);
        return;
      }
      const next = clampKeyboardShortcuts({ ...value, [capturing]: key });
      onChange(next);
      setCapturing(null);
      setError(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [capturing, onChange, value]);

  return (
    <div className="mt-5 space-y-3">
      <ul className="divide-y divide-sidebar/10 overflow-hidden rounded-2xl border border-sidebar/12 bg-page/30">
        {KEYBOARD_SHORTCUT_ACTION_IDS.map((id) => {
          const active = capturing === id;
          return (
            <li
              key={id}
              className="flex items-center justify-between gap-3 px-3 py-2.5 sm:px-4"
            >
              <span className="min-w-0 text-sm font-medium text-sidebar">
                {KEYBOARD_SHORTCUT_LABELS[id]}
              </span>
              <button
                type="button"
                disabled={disabled}
                aria-label={`Change shortcut for ${KEYBOARD_SHORTCUT_LABELS[id]}`}
                onClick={() => {
                  setError(null);
                  setCapturing(id);
                }}
                className={`shrink-0 rounded-lg border px-2.5 py-1.5 font-mono text-xs font-bold tabular-nums transition disabled:opacity-60 ${
                  active
                    ? 'border-sidebar bg-sidebar text-on-chrome'
                    : 'border-sidebar/18 bg-white text-sidebar hover:border-sidebar/35'
                }`}
              >
                {active ? 'Press a key…' : formatShortcutKey(value[id])}
              </button>
            </li>
          );
        })}
      </ul>
      {error ? (
        <p className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      ) : capturing ? (
        <p className="text-xs text-muted" role="status">
          Press a letter or /. Escape cancels.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="soft"
          disabled={disabled}
          className="min-h-9 px-3 text-xs"
          onClick={() => {
            setCapturing(null);
            setError(null);
            onChange({ ...DEFAULT_KEYBOARD_SHORTCUTS });
          }}
        >
          Reset to defaults
        </Button>
      </div>
    </div>
  );
}
