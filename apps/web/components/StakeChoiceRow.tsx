'use client';

import { STAKE_PRESETS, stakeById } from '@poker/protocol';
import { ChoiceRow } from '@/components/ChoiceRow';
import { MoneyAmount } from '@/components/CurrencyIcon';

/** Stake preset picker (label, buy-in, blinds) shared by hosted tables and matchmaking. */
export function StakeChoiceRow({
  name,
  selected,
  onSelect,
  disabled,
  label = 'Stakes',
}: {
  name: string;
  selected: string;
  onSelect: (stakeId: string) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <ChoiceRow
      label={label}
      name={name}
      selected={selected}
      options={STAKE_PRESETS.map((s) => s.id)}
      onSelect={onSelect}
      disabled={disabled}
      trackClassName="gap-2.5"
      optionClassName="min-h-14 min-w-[5.5rem] px-3.5 py-2.5"
      format={(id) => {
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
}
