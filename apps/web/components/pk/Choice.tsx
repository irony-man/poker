'use client';

import { STAKE_PRESETS, type StakePreset } from '@poker/protocol';
import { cn } from '@/lib/cn';

export function PkSegmented({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-pk-2">
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={selected}
            disabled={disabled}
            onClick={() => onChange(option.id)}
            className={cn(
              'min-h-11 rounded-pk-full px-pk-4 text-pk-label',
              selected ? 'bg-chrome text-on-chrome' : 'bg-raised text-primary border border-subtle/30',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function PkStakeCards({
  selected,
  onSelect,
  disabled,
}: {
  selected: string;
  onSelect: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-pk-3 sm:grid-cols-2" role="radiogroup" aria-label="Stakes">
      {STAKE_PRESETS.map((stake) => (
        <StakeCard
          key={stake.id}
          stake={stake}
          selected={stake.id === selected}
          disabled={disabled}
          onSelect={() => onSelect(stake.id)}
        />
      ))}
    </div>
  );
}

function StakeCard({
  stake,
  selected,
  disabled,
  onSelect,
}: {
  stake: StakePreset;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'min-h-11 rounded-pk-lg border p-pk-4 text-left shadow-pk-sm',
        selected ? 'border-chrome bg-raised' : 'border-subtle/30 bg-panel',
      )}
    >
      <span className="block font-pk-display text-pk-h4">{stake.label}</span>
      <span className="mt-1 block text-pk-caption tabular-nums text-muted">
        {stake.smallBlind}/{stake.bigBlind} · buy-in {stake.buyIn.toLocaleString('en-US')}
      </span>
    </button>
  );
}

export function PkSelect({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-pk-2 text-pk-label">
      {label}
      <select
        className="min-h-11 rounded-pk-md border border-subtle/40 bg-raised px-pk-3 text-pk-body-md"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
