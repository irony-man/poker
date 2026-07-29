'use client';

import type { ReactNode } from 'react';

/** Segmented choice chips — matches Android `FeltChoiceChip` / `ChoiceRow`. */
export function ChoiceRow<T extends string | number>({
  label,
  name,
  selected,
  options,
  onSelect,
  format,
}: {
  label: string;
  /** Shared `name` for the radio group. */
  name: string;
  selected: T;
  options: readonly T[];
  onSelect: (value: T) => void;
  format?: (value: T) => ReactNode;
}) {
  return (
    <fieldset className="block min-w-0">
      <legend className="hud-label mb-2">{label}</legend>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isSelected = option === selected;
          const id = `${name}-${String(option)}`;
          return (
            <label
              key={String(option)}
              htmlFor={id}
              className={`choice-chip ${isSelected ? 'choice-chip-selected' : ''}`}
            >
              <input
                id={id}
                type="radio"
                name={name}
                value={String(option)}
                checked={isSelected}
                onChange={() => onSelect(option)}
                className="sr-only"
              />
              {format ? format(option) : String(option)}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
