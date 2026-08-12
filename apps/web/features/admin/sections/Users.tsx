import { MoneyAmount } from '@/components/CurrencyIcon';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import type { AdminUserRow, SiteEconomy } from '@/lib/api';
import { formatMoneyLabel } from '@/lib/currency';
import { Section } from '../ui';

export function UsersSection({
  userQuery,
  users,
  creditAmounts,
  whuffieCreditAmounts,
  busy,
  busyKey,
  economy,
  onUserQuery,
  onCreditAmount,
  onWhuffieCreditAmount,
  onSearch,
  onTopUp,
  onTopUpWhuffies,
  onResetChips,
  onResetWhuffies,
}: {
  userQuery: string;
  users: AdminUserRow[];
  creditAmounts: Record<string, string>;
  whuffieCreditAmounts: Record<string, string>;
  busy: boolean;
  busyKey: string | null;
  economy: SiteEconomy;
  onUserQuery: (value: string) => void;
  onCreditAmount: (userId: string, value: string) => void;
  onWhuffieCreditAmount: (userId: string, value: string) => void;
  onSearch: (e: React.FormEvent) => void;
  onTopUp: (userId: string) => void;
  onTopUpWhuffies: (userId: string) => void;
  onResetChips: (user: AdminUserRow) => void;
  onResetWhuffies: (user: AdminUserRow) => void;
}) {
  return (
    <Section
      title="Users"
      description="Search accounts, top up chips or Whuffies, or reset to the starting grants."
    >
      <form onSubmit={onSearch} className="flex flex-col gap-2 sm:flex-row">
        <TextField
          value={userQuery}
          onChange={(e) => onUserQuery(e.target.value)}
          placeholder="Search by username…"
          className="sm:flex-1"
          aria-label="Search users"
        />
        <Button type="submit" variant="ghost" disabled={busy} className="min-h-11 px-5">
          {busyKey === 'users-search' ? 'Searching…' : 'Search'}
        </Button>
      </form>

      <ul className="divide-y divide-sidebar/8 rounded-xl border border-sidebar/10 bg-mushroom/[0.03]">
        {users.map((u) => {
          const topping = busyKey === `topup-${u.id}`;
          const resetting = busyKey === `reset-${u.id}`;
          const toppingW = busyKey === `topup-whuffie-${u.id}`;
          const resettingW = busyKey === `reset-whuffie-${u.id}`;
          return (
            <li
              key={u.id}
              className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
            >
              <div className="min-w-0">
                <p className="truncate font-display text-base font-semibold text-ink-strong">
                  {u.username}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-strong-muted">
                  <MoneyAmount amount={u.chipBalance} showChips className="text-sm" />
                  <span className="tabular-nums text-sm">
                    {formatMoneyLabel(u.whuffieBalance)} Whuffies
                  </span>
                  <span className="text-xs tabular-nums opacity-70">
                    joined {new Date(u.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:items-end">
                <div className="flex flex-wrap items-center gap-2">
                  <TextField
                    type="number"
                    min={1}
                    step={1}
                    placeholder="Chips"
                    value={creditAmounts[u.id] ?? ''}
                    onChange={(e) => onCreditAmount(u.id, e.target.value)}
                    className="!w-28 px-2.5 py-2 tabular-nums"
                    aria-label={`Chip top-up for ${u.username}`}
                  />
                  <Button variant="positive" disabled={busy} onClick={() => onTopUp(u.id)}>
                    {topping ? '…' : 'Top up chips'}
                  </Button>
                  <Button
                    variant="dangerQuiet"
                    disabled={busy}
                    onClick={() => onResetChips(u)}
                    title={`Reset to ${formatMoneyLabel(economy.startingChipGrant)}`}
                  >
                    {resetting ? '…' : 'Reset chips'}
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <TextField
                    type="number"
                    min={1}
                    step={1}
                    placeholder="Whuffies"
                    value={whuffieCreditAmounts[u.id] ?? ''}
                    onChange={(e) => onWhuffieCreditAmount(u.id, e.target.value)}
                    className="!w-28 px-2.5 py-2 tabular-nums"
                    aria-label={`Whuffies credit for ${u.username}`}
                  />
                  <Button variant="positive" disabled={busy} onClick={() => onTopUpWhuffies(u.id)}>
                    {toppingW ? '…' : 'Add Whuffies'}
                  </Button>
                  <Button
                    variant="dangerQuiet"
                    disabled={busy}
                    onClick={() => onResetWhuffies(u)}
                    title={`Reset to ${formatMoneyLabel(economy.startingWhuffieGrant)}`}
                  >
                    {resettingW ? '…' : 'Reset Whuffies'}
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
        {users.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-ink-strong-muted">
            No users match your search.
          </li>
        ) : null}
      </ul>
    </Section>
  );
}
