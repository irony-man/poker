'use client';

import { useState } from 'react';
import { MoneyAmount } from '@/components/CurrencyIcon';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { Button } from '@/components/ui/Button';
import { FORM_LABEL_CLASS, TextField } from '@/components/ui/TextField';
import type { AdminUserRow, SiteEconomy } from '@/lib/api';
import { formatMoneyLabel } from '@/lib/currency';
import { EmptyState, Section } from '../ui';

const ROW_GRID =
  'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[minmax(0,1.45fr)_minmax(5.75rem,0.85fr)_minmax(6.5rem,0.9fr)_minmax(7rem,0.8fr)_auto] sm:gap-3';

function formatJoined(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function CurrencyAdjust({
  label,
  balance,
  showChips,
  showWhuffies,
  amount,
  onAmount,
  onAdd,
  onReset,
  addBusy,
  resetBusy,
  addLabel,
  resetLabel,
  amountAriaLabel,
  disabled,
}: {
  label: string;
  balance: number;
  showChips?: boolean;
  showWhuffies?: boolean;
  amount: string;
  onAmount: (value: string) => void;
  onAdd: () => void;
  onReset: () => void;
  addBusy: boolean;
  resetBusy: boolean;
  addLabel: string;
  resetLabel: string;
  amountAriaLabel: string;
  disabled: boolean;
}) {
  return (
    <div className="rounded-xl border border-sidebar/10 bg-cream px-3.5 py-3">
      <p className={FORM_LABEL_CLASS}>{label}</p>
      <div className="mt-1.5">
        <MoneyAmount
          amount={balance}
          showChips={showChips}
          showWhuffies={showWhuffies}
          chipsClassName="!h-[18px] sm:!h-5"
          className="font-display text-lg font-semibold text-ink-strong"
        />
      </div>
      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onAdd();
        }}
      >
        <TextField
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          placeholder="Amount"
          value={amount}
          onChange={(e) => onAmount(e.target.value)}
          className="min-h-9 py-2 tabular-nums"
          aria-label={amountAriaLabel}
        />
        <Button type="submit" variant="primary" size="sm" disabled={disabled} className="shrink-0 px-3.5">
          {addBusy ? 'Adding…' : addLabel}
        </Button>
      </form>
      <button
        type="button"
        disabled={disabled}
        onClick={onReset}
        className="mt-2.5 text-xs font-medium text-ink-strong-muted underline-offset-2 transition hover:text-ink-strong hover:underline disabled:opacity-50"
      >
        {resetBusy ? 'Resetting…' : resetLabel}
      </button>
    </div>
  );
}

export function UsersSection({
  userQuery,
  users,
  creditAmounts,
  whuffieCreditAmounts,
  busy,
  busyKey,
  economy,
  selfUserId,
  onUserQuery,
  onCreditAmount,
  onWhuffieCreditAmount,
  onSearch,
  onTopUp,
  onTopUpWhuffies,
  onResetChips,
  onResetWhuffies,
  onDeleteUser,
}: {
  userQuery: string;
  users: AdminUserRow[];
  creditAmounts: Record<string, string>;
  whuffieCreditAmounts: Record<string, string>;
  busy: boolean;
  busyKey: string | null;
  economy: SiteEconomy;
  selfUserId: string | null;
  onUserQuery: (value: string) => void;
  onCreditAmount: (userId: string, value: string) => void;
  onWhuffieCreditAmount: (userId: string, value: string) => void;
  onSearch: (e: React.FormEvent) => void;
  onTopUp: (userId: string) => void;
  onTopUpWhuffies: (userId: string) => void;
  onResetChips: (user: AdminUserRow) => void;
  onResetWhuffies: (user: AdminUserRow) => void;
  onDeleteUser: (user: AdminUserRow) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const searching = userQuery.trim().length > 0;
  const resultLabel = searching
    ? `${users.length} ${users.length === 1 ? 'match' : 'matches'}`
    : `${users.length} ${users.length === 1 ? 'account' : 'accounts'}`;

  return (
    <Section title="Users" description="Find an account, then adjust chips, Whuffies, or remove it.">
      <form onSubmit={onSearch} className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <TextField
          type="search"
          value={userQuery}
          onChange={(e) => onUserQuery(e.target.value)}
          placeholder="Search by username…"
          className="min-w-0 sm:flex-1"
          aria-label="Search users"
        />
        <div className="flex items-center gap-3 sm:shrink-0">
          <Button type="submit" variant="ghost" disabled={busy} className="min-h-11 px-5">
            {busyKey === 'users-search' ? 'Searching…' : 'Search'}
          </Button>
          <p className="hidden text-xs tabular-nums text-ink-strong-muted sm:block">{resultLabel}</p>
        </div>
      </form>
      <p className="text-xs tabular-nums text-ink-strong-muted sm:hidden">{resultLabel}</p>

      <div className="overflow-hidden rounded-xl border border-sidebar/10">
        {users.length > 0 ? (
          <div
            className={`${ROW_GRID} admin-table-head hidden px-3.5 py-2.5 sm:grid`}
          >
            <span>User</span>
            <span>Chips</span>
            <span>Whuffies</span>
            <span>Joined</span>
            <span className="sr-only">Actions</span>
          </div>
        ) : null}

        <ul>
          {users.map((u) => {
            const open = openId === u.id;
            const topping = busyKey === `topup-${u.id}`;
            const resetting = busyKey === `reset-${u.id}`;
            const toppingW = busyKey === `topup-whuffie-${u.id}`;
            const resettingW = busyKey === `reset-whuffie-${u.id}`;
            const deleting = busyKey === `delete-${u.id}`;
            const isSelf = selfUserId === u.id;
            const joined = formatJoined(u.createdAt);
            const panelId = `user-adjust-${u.id}`;

            return (
              <li key={u.id} className="border-b border-sidebar/6 last:border-0">
                <div
                  className={`${ROW_GRID} px-3.5 py-2.5 ${
                    open ? 'bg-mushroom/[0.06]' : 'bg-transparent hover:bg-mushroom/[0.04]'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <PlayerAvatar
                      userId={u.id}
                      avatarId={u.avatarId}
                      size={36}
                      title={u.username}
                    />
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <p className="truncate font-display text-sm font-semibold text-ink-strong">
                          {u.username}
                        </p>
                        {isSelf ? (
                          <span className="shrink-0 rounded-full border border-sidebar/15 bg-sidebar/8 px-1.5 py-px text-[10px] font-display font-semibold uppercase tracking-wider text-sidebar">
                            You
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-ink-strong-muted sm:hidden">
                        {formatMoneyLabel(u.chipBalance)} chips · {formatMoneyLabel(u.whuffieBalance)}{' '}
                        Whuffies · {joined}
                      </p>
                    </div>
                  </div>

                  <div className="hidden sm:block">
                    <MoneyAmount
                      amount={u.chipBalance}
                      showChips
                      chipsClassName="!h-4 sm:!h-4"
                      className="text-sm font-medium text-ink-strong"
                    />
                  </div>
                  <div className="hidden sm:block">
                    <MoneyAmount
                      amount={u.whuffieBalance}
                      showWhuffies
                      className="text-sm font-medium text-ink-strong"
                    />
                  </div>
                  <p className="hidden text-sm tabular-nums text-ink-strong-muted sm:block">{joined}</p>

                  <Button
                    variant="ghost"
                    size="sm"
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() => setOpenId(open ? null : u.id)}
                    className="inline-flex min-w-[5.75rem] items-center justify-center gap-1 justify-self-end px-2.5"
                  >
                    {open ? 'Done' : 'Adjust'}
                    <Chevron open={open} />
                  </Button>
                </div>

                {open ? (
                  <div id={panelId} className="border-t border-sidebar/8 bg-mushroom/[0.04] px-3.5 py-3.5">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <CurrencyAdjust
                        label="Chips"
                        balance={u.chipBalance}
                        showChips
                        amount={creditAmounts[u.id] ?? ''}
                        onAmount={(value) => onCreditAmount(u.id, value)}
                        onAdd={() => onTopUp(u.id)}
                        onReset={() => onResetChips(u)}
                        addBusy={topping}
                        resetBusy={resetting}
                        addLabel="Add"
                        resetLabel={`Reset to ${formatMoneyLabel(economy.startingChipGrant)}`}
                        amountAriaLabel={`Chip amount for ${u.username}`}
                        disabled={busy}
                      />
                      <CurrencyAdjust
                        label="Whuffies"
                        balance={u.whuffieBalance}
                        showWhuffies
                        amount={whuffieCreditAmounts[u.id] ?? ''}
                        onAmount={(value) => onWhuffieCreditAmount(u.id, value)}
                        onAdd={() => onTopUpWhuffies(u.id)}
                        onReset={() => onResetWhuffies(u)}
                        addBusy={toppingW}
                        resetBusy={resettingW}
                        addLabel="Add"
                        resetLabel={`Reset to ${formatMoneyLabel(economy.startingWhuffieGrant)}`}
                        amountAriaLabel={`Whuffies amount for ${u.username}`}
                        disabled={busy}
                      />
                    </div>
                    {!isSelf ? (
                      <div className="mt-3 flex justify-end border-t border-sidebar/8 pt-3">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onDeleteUser(u)}
                          title={`Delete ${u.username}`}
                          className="text-xs font-medium text-danger/70 underline-offset-2 transition hover:text-danger hover:underline disabled:opacity-50"
                        >
                          {deleting ? 'Deleting…' : 'Delete account'}
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
          {users.length === 0 ? (
            <li>
              <EmptyState>No users match your search.</EmptyState>
            </li>
          ) : null}
        </ul>
      </div>
    </Section>
  );
}
