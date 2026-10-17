'use client';

import { STAKE_PRESETS } from '@poker/protocol';
import { BotGroupPicker } from '@/components/BotGroupPicker';
import { CopyRoomLink } from '@/components/CopyRoomLink';
import { MoneyAmount } from '@/components/CurrencyIcon';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import {
  MAX_TABLE_SEATS,
  PendingTableInvites,
  TableInviteFriends,
} from '@/components/TableInviteFriends';
import { Button } from '@/components/ui/Button';
import { StatusChip } from '@/components/ui/StatusChip';
import type { PublicBotGroup } from '@/lib/api';
import type { PublicPlayer, PublicTable } from '@/lib/store';

const MIN_TABLE_SEATS = 2;

function isBot(p: PublicPlayer): boolean {
  return Boolean(p.userId?.startsWith('bot:'));
}

function stakeLabel(config: PublicTable['config']): string {
  const preset = STAKE_PRESETS.find(
    (s) =>
      s.smallBlind === config.smallBlind &&
      s.bigBlind === config.bigBlind &&
      s.buyIn === config.buyIn,
  );
  return preset?.label ?? 'Custom';
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold text-primary tabular-nums">{children}</dd>
    </div>
  );
}

/** Pre-game lobby for hosted tables: details, seats, bots, invites, Start game. */
export function TableLobby({
  table,
  userId,
  inviteCode,
  botGroups,
  botGroupId,
  onBotGroupChange,
  onAddBot,
  onFillBots,
  onRemoveBot,
  onSetSeats,
  onStart,
  onLeave,
}: {
  table: PublicTable;
  userId: string | null;
  inviteCode: string | null;
  botGroups: PublicBotGroup[];
  botGroupId: string | null;
  onBotGroupChange: (id: string) => void;
  onAddBot: (seat: number) => void;
  onFillBots: () => void;
  onRemoveBot: (seat: number) => void;
  onSetSeats: (maxSeats: number) => void;
  onStart: () => void;
  onLeave: () => void;
}) {
  const isHost = !!userId && table.hostUserId === userId;
  const seated = table.players.filter((p) => p.userId);
  const seatedCount = seated.length;
  const emptyCount = table.players.length - seatedCount;
  const humanIds = seated.filter((p) => !isBot(p)).map((p) => p.userId!);
  const host = seated.find((p) => p.userId === table.hostUserId);
  const maxSeats = table.config.maxSeats;
  const minSeats = Math.max(MIN_TABLE_SEATS, seatedCount);
  const canStart = seatedCount >= 2;
  const turnSeconds = Math.round(table.config.turnTimeMs / 1000);

  return (
    <div className="lobby-paper flex min-h-0 flex-1 flex-col overflow-y-auto px-1 pb-4 sm:px-2">
      <div className="mx-auto grid w-full max-w-4xl gap-3 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-4">
        <section
          aria-labelledby="lobby-details-title"
          className="surface-card space-y-3 lg:sticky lg:top-0 lg:self-start"
        >
          <div>
            <p className="hud-label">Waiting lobby</p>
            <h2
              id="lobby-details-title"
              className="mt-0.5 truncate font-display text-xl font-bold text-sidebar"
            >
              {table.name || 'Private table'}
            </h2>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <StatusChip tone="brass">{stakeLabel(table.config)} stakes</StatusChip>
              {table.playMoney ? <StatusChip tone="neutral">Practice chips</StatusChip> : null}
            </div>
          </div>
          <dl className="divide-y divide-sidebar/10">
            <DetailRow label="Blinds">
              <MoneyAmount amount={table.config.smallBlind} compact /> /{' '}
              <MoneyAmount amount={table.config.bigBlind} compact />
            </DetailRow>
            <DetailRow label="Buy-in">
              <MoneyAmount amount={table.config.buyIn} />
            </DetailRow>
            <DetailRow label="Turn timer">{turnSeconds}s</DetailRow>
            <DetailRow label="Seats">
              {isHost ? (
                <span className="inline-flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="soft"
                    size="icon"
                    aria-label="Remove a seat"
                    disabled={maxSeats <= minSeats}
                    onClick={() => onSetSeats(maxSeats - 1)}
                  >
                    −
                  </Button>
                  <span className="w-6 text-center">{maxSeats}</span>
                  <Button
                    type="button"
                    variant="soft"
                    size="icon"
                    aria-label="Add a seat"
                    disabled={maxSeats >= MAX_TABLE_SEATS}
                    onClick={() => onSetSeats(maxSeats + 1)}
                  >
                    +
                  </Button>
                </span>
              ) : (
                maxSeats
              )}
            </DetailRow>
          </dl>
          {isHost && maxSeats <= seatedCount && maxSeats > MIN_TABLE_SEATS ? (
            <p className="field-help">Remove a bot to free a seat before shrinking the table.</p>
          ) : null}
          {inviteCode ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted">Room code</span>
              <CopyRoomLink tableId={table.tableId} inviteCode={inviteCode} />
            </div>
          ) : null}
        </section>

        <div className="space-y-3">
          <section aria-labelledby="lobby-players-title" className="surface-card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 id="lobby-players-title" className="font-display text-base font-bold text-sidebar">
                Players{' '}
                <span className="tabular-nums text-muted">
                  {seatedCount}/{maxSeats}
                </span>
              </h3>
              {isHost && emptyCount > 0 ? (
                <Button type="button" variant="ghost" size="sm" onClick={onFillBots}>
                  Fill with bots
                </Button>
              ) : null}
            </div>
            {isHost && emptyCount > 0 && botGroups.length > 0 ? (
              <BotGroupPicker
                groups={botGroups}
                selectedId={botGroupId ?? ''}
                onSelect={onBotGroupChange}
                name="lobby-bot-group"
              />
            ) : null}
            <ul className="divide-y divide-sidebar/10">
              {table.players.map((p) => {
                const bot = isBot(p);
                return (
                  <li key={p.seat} className="flex min-h-12 items-center gap-3 py-2">
                    <span className="w-5 shrink-0 text-center text-xs tabular-nums text-muted">
                      {p.seat + 1}
                    </span>
                    {p.userId ? (
                      <>
                        <PlayerAvatar
                          userId={p.userId}
                          avatarId={p.avatarId}
                          avatarUrl={p.avatarUrl}
                          size={32}
                        />
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-primary">
                          {p.name ?? 'Player'}
                        </span>
                        {p.userId === table.hostUserId ? (
                          <StatusChip tone="brass">Host</StatusChip>
                        ) : null}
                        {p.userId === userId ? <StatusChip tone="positive">You</StatusChip> : null}
                        {bot ? <StatusChip tone="neutral">Bot</StatusChip> : null}
                        {bot && isHost ? (
                          <Button
                            type="button"
                            variant="dangerQuiet"
                            size="sm"
                            onClick={() => onRemoveBot(p.seat)}
                          >
                            Remove
                          </Button>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <span
                          aria-hidden
                          className="h-8 w-8 shrink-0 rounded-full border border-dashed border-sidebar/25"
                        />
                        <span className="flex-1 text-sm text-muted">Open seat</span>
                        {isHost ? (
                          <Button
                            type="button"
                            variant="soft"
                            size="sm"
                            onClick={() => onAddBot(p.seat)}
                          >
                            Add bot
                          </Button>
                        ) : null}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
            {isHost && emptyCount === 0 && maxSeats < MAX_TABLE_SEATS ? (
              <p className="field-help">All seats are taken — add a seat to bring in more players.</p>
            ) : null}
          </section>

          {isHost ? (
            <section aria-label="Invite friends" className="surface-card space-y-3">
              <PendingTableInvites tableId={table.tableId} />
              <TableInviteFriends
                tableId={table.tableId}
                seatedUserIds={humanIds}
                seatedCount={seatedCount}
              />
            </section>
          ) : null}
        </div>
      </div>

      <div className="mx-auto mt-3 flex w-full max-w-4xl flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="ghost" onClick={onLeave}>
          Leave
        </Button>
        {isHost ? (
          <div className="flex flex-col items-stretch gap-1 sm:items-end">
            <Button type="button" disabled={!canStart} onClick={onStart} className="sm:min-w-40">
              Start game
            </Button>
            {!canStart ? (
              <p className="text-center text-xs text-muted sm:text-right">
                Need at least 2 players
              </p>
            ) : null}
          </div>
        ) : (
          <p role="status" className="text-center text-sm text-muted sm:text-right">
            Waiting for {host?.name ?? 'the host'} to start…
          </p>
        )}
      </div>
    </div>
  );
}
