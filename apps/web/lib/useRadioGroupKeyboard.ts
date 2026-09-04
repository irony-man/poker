'use client';

import { useCallback, type KeyboardEvent, type RefObject } from 'react';

/** WAI-ARIA radiogroup: arrows/Home/End move selection; only the checked item is tabbable. */
export function useRadioGroupKeyboard<T extends string | number | boolean>({
  options,
  selected,
  onSelect,
  groupRef,
  disabled,
}: {
  options: readonly T[];
  selected: T;
  onSelect: (value: T) => void;
  groupRef: RefObject<HTMLElement | null>;
  disabled?: boolean;
}) {
  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      if (disabled || options.length === 0) return;
      const i = options.indexOf(selected);
      const from = i < 0 ? 0 : i;
      let next = from;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        next = (from + 1) % options.length;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        next = (from - 1 + options.length) % options.length;
      } else if (e.key === 'Home') {
        next = 0;
      } else if (e.key === 'End') {
        next = options.length - 1;
      } else {
        return;
      }
      e.preventDefault();
      const value = options[next]!;
      onSelect(value);
      queueMicrotask(() => {
        const el = groupRef.current?.querySelector<HTMLElement>(
          `[data-radio-value="${CSS.escape(String(value))}"]`,
        );
        el?.focus();
      });
    },
    [disabled, groupRef, onSelect, options, selected],
  );

  const tabIndexFor = useCallback(
    (value: T) => (value === selected ? 0 : -1),
    [selected],
  );

  return { onKeyDown, tabIndexFor };
}
