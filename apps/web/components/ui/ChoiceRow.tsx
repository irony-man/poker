'use client';

import { useId, type ReactNode } from 'react';
import {
  type ChoiceStyle,
  choiceOptionClass,
  choiceTrackClass,
} from './choiceStyles';

/** Segmented choice chips — matches Android `FeltChoiceChip` / `ChoiceRow`. */
export function ChoiceRow<T extends string | number>({
  label,
  name,
  selected,
  options,
  onSelect,
  format,
  variant = 'chip',
  disabled,
}: {
  label?: string;
  /** Shared `name` for the radio group. */
  name: string;
  selected: T;
  options: readonly T[];
  onSelect: (value: T) => void;
  format?: (value: T) => ReactNode;
  variant?: ChoiceStyle;
  disabled?: boolean;
}) {
  const autoName = useId();
  const groupName = name || autoName;
  return (
    <fieldset className="block min-w-0">
      {label ? <legend className="hud-label mb-2">{label}</legend> : null}
      <div
        role="radiogroup"
        aria-label={label}
        className={choiceTrackClass(variant)}
      >
        {options.map((option) => {
          const isSelected = option === selected;
          const id = `${groupName}-${String(option)}`;
          return (
            <label
              key={String(option)}
              htmlFor={id}
              className={choiceOptionClass(variant, isSelected)}
            >
              <input
                id={id}
                type="radio"
                name={groupName}
                value={String(option)}
                checked={isSelected}
                disabled={disabled}
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
