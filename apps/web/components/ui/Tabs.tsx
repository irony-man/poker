'use client';

import type { ReactNode } from 'react';
import {
  type ChoiceStyle,
  choiceOptionClass,
  choiceTrackClass,
} from './choiceStyles';

export type TabOption<T extends string> = {
  id: T;
  label: ReactNode;
  panelId?: string;
  badge?: ReactNode;
};

export function Tabs<T extends string>({
  label,
  variant = 'segmented',
  selected,
  options,
  onSelect,
  disabled,
  idPrefix,
  className = '',
}: {
  label: string;
  variant?: Extract<ChoiceStyle, 'segmented' | 'underline' | 'pill'>;
  selected: T;
  options: readonly TabOption<T>[];
  onSelect: (id: T) => void;
  disabled?: boolean;
  idPrefix: string;
  className?: string;
}) {
  const trackExtra =
    variant === 'pill'
      ? '-mx-1 overflow-x-auto px-1 pb-1'
      : variant === 'underline'
        ? undefined
        : undefined;

  return (
    <div
      role="tablist"
      aria-label={label}
      className={choiceTrackClass(variant, [trackExtra, className].filter(Boolean).join(' '))}
    >
      {options.map((tab) => {
        const isSelected = tab.id === selected;
        const tabId = `${idPrefix}-${tab.id}`;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={tabId}
            aria-selected={isSelected}
            aria-controls={tab.panelId}
            disabled={disabled}
            onClick={() => onSelect(tab.id)}
            className={choiceOptionClass(
              variant,
              isSelected,
              variant === 'pill' ? 'shrink-0' : undefined,
            )}
          >
            {tab.label}
            {tab.badge}
            {variant === 'underline' && isSelected ? (
              <span
                className="absolute inset-x-0 bottom-0 h-[3px] rounded-t-sm bg-sidebar"
                aria-hidden
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
