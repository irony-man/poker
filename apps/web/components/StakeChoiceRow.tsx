'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { STAKE_PRESETS, stakeById, validateStakes } from '@poker/protocol';
import { ChoiceRow } from '@/components/ChoiceRow';
import { MoneyAmount } from '@/components/CurrencyIcon';
import { TextField } from '@/components/ui/TextField';

export const CUSTOM_STAKE_ID = 'custom';

/** Blinds and starting stack picked by the host, with a validation error when invalid. */
export interface StakeSelection {
  smallBlind: number;
  bigBlind: number;
  stack: number;
  error: string | null;
}

type CustomText = { smallBlind: string; bigBlind: string; stack: string };

/** Selection for a preset id (falls back to the first preset for unknown ids). */
export function presetStakeSelection(id: string): StakeSelection {
  const s = stakeById(id) ?? STAKE_PRESETS[0]!;
  return { smallBlind: s.smallBlind, bigBlind: s.bigBlind, stack: s.buyIn, error: null };
}

function customSelection(text: CustomText): StakeSelection {
  const smallBlind = Number(text.smallBlind);
  const bigBlind = Number(text.bigBlind);
  const stack = Number(text.stack);
  const missing = !text.smallBlind || !text.bigBlind || !text.stack;
  return {
    smallBlind,
    bigBlind,
    stack,
    error: missing
      ? 'Enter blinds and a starting stack'
      : validateStakes(smallBlind, bigBlind, stack),
  };
}

function presetText(id: string): CustomText {
  const s = presetStakeSelection(id);
  return { smallBlind: String(s.smallBlind), bigBlind: String(s.bigBlind), stack: String(s.stack) };
}

/**
 * Stake preset picker (label, buy-in, blinds) shared by hosted tables, contests and matchmaking.
 * With `allowCustom`, a Custom option reveals blind and stack inputs seeded from the last preset.
 */
export function StakeChoiceRow({
  name,
  selected,
  onSelect,
  onStakesChange,
  disabled,
  label = 'Stakes',
  allowCustom,
  stackLabel = 'Buy-in',
}: {
  name: string;
  selected: string;
  onSelect: (stakeId: string) => void;
  /** Resolved blinds and stack whenever the preset or custom values change. */
  onStakesChange?: (stakes: StakeSelection) => void;
  disabled?: boolean;
  label?: string;
  allowCustom?: boolean;
  stackLabel?: string;
}) {
  const isCustom = allowCustom && selected === CUSTOM_STAKE_ID;
  const [custom, setCustom] = useState<CustomText>(() =>
    presetText(isCustom ? STAKE_PRESETS[0]!.id : selected),
  );
  const lastPreset = useRef(isCustom ? STAKE_PRESETS[0]!.id : selected);

  const stakes = useMemo(
    () => (isCustom ? customSelection(custom) : presetStakeSelection(selected)),
    [isCustom, custom, selected],
  );

  const onStakesChangeRef = useRef(onStakesChange);
  onStakesChangeRef.current = onStakesChange;
  useEffect(() => {
    onStakesChangeRef.current?.(stakes);
  }, [stakes]);

  const options = allowCustom
    ? [...STAKE_PRESETS.map((s) => s.id), CUSTOM_STAKE_ID]
    : STAKE_PRESETS.map((s) => s.id);

  function select(id: string) {
    if (id === CUSTOM_STAKE_ID) {
      if (selected !== CUSTOM_STAKE_ID) setCustom(presetText(lastPreset.current));
    } else {
      lastPreset.current = id;
    }
    onSelect(id);
  }

  function field(key: keyof CustomText, fieldLabel: string) {
    return (
      <TextField
        variant="hud"
        label={fieldLabel}
        value={custom[key]}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 7);
          setCustom((c) => ({ ...c, [key]: digits }));
        }}
        className="tabular-nums"
        inputMode="numeric"
        autoComplete="off"
        disabled={disabled}
      />
    );
  }

  const row = (
    <ChoiceRow
      label={label}
      name={name}
      selected={selected}
      options={options}
      onSelect={select}
      disabled={disabled}
      trackClassName="gap-2.5"
      optionClassName="min-h-14 min-w-[5.5rem] px-3.5 py-2.5"
      format={(id) => {
        if (id === CUSTOM_STAKE_ID) {
          return (
            <div className="inline-flex flex-col items-start gap-0.5 leading-tight">
              <div className="text-sm font-bold">Custom</div>
              <div className="text-[11px] font-semibold opacity-80 sm:text-xs">Your own</div>
            </div>
          );
        }
        const s = stakeById(id)!;
        return (
          <div className="inline-flex flex-col items-start gap-0.5 leading-tight">
            <div className="text-sm font-bold">{s.label}</div>
            <div className="flex items-center gap-1 text-[11px] font-semibold tabular-nums opacity-80 sm:text-xs">
              <MoneyAmount amount={s.buyIn} showChips chipsClassName="!h-3.5 sm:!h-3.5" />
              <div>
                {s.smallBlind}/{s.bigBlind}
              </div>
            </div>
          </div>
        );
      }}
    />
  );
  if (!allowCustom) return row;

  return (
    <div className="min-w-0">
      {row}
      {isCustom ? (
        <div className="mt-3">
          <div className="grid grid-cols-3 gap-2.5">
            {field('smallBlind', 'Small blind')}
            {field('bigBlind', 'Big blind')}
            {field('stack', stackLabel)}
          </div>
          <p
            className={
              stakes.error ? 'mt-2 text-xs font-medium leading-snug text-danger' : 'field-help mt-2'
            }
            role={stakes.error ? 'alert' : undefined}
          >
            {stakes.error ?? `${Math.round(stakes.stack / stakes.bigBlind)} big blinds deep`}
          </p>
        </div>
      ) : null}
    </div>
  );
}
