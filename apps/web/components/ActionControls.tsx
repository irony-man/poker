'use client';

import { useEffect, useState } from 'react';
import { MoveTimerStrip } from './TurnTimer';
import { ReadyPlayersRoster, type ReadyRosterPlayer } from './WinHandModal';
import { useSession, type PrivateView, type PublicTable } from '@/lib/store';
import { formatMoneyAmount } from '@/lib/currency';
import { Button } from '@/components/ui/Button';
import { useIsLandscapePhone, useIsNarrow } from '@/lib/tableLayout';

function waitingCopy(opts: {
  spectating: boolean;
  street: string | undefined;
  isTurn: boolean;
  connection?: string;
  isTournament?: boolean;
  contestOver?: boolean;
}): string {
  if (opts.connection && opts.connection !== 'open') {
    return opts.connection === 'connecting' ? 'Reconnecting…' : 'Disconnected — actions paused';
  }
  if (opts.spectating) return 'Spectating — you are not seated';
  if (opts.contestOver) return 'Contest complete';
  if (opts.street === 'waiting') {
    return 'Waiting for players…';
  }
  if (opts.street === 'payout' || opts.street === 'showdown') {
    return 'Hand complete — start next when ready';
  }
  if (!opts.isTurn) return 'Waiting for your turn…';
  return '—';
}

/** Between-hand / utility controls shown inside the Actions dock when not to act. */
export type ActionTableTools = {
  canReady?: boolean;
  readyLabel?: string;
  isReady?: boolean;
  readyCount?: number;
  readyTotal?: number;
  /** Eligible players for next hand — avatar strip in the Actions dock. */
  readyPlayers?: ReadyRosterPlayer[];
  readyHeading?: string;
  onReady?: () => void;
  /** Offline / alternate primary start (e.g. “Next hand”). */
  startLabel?: string;
  onStart?: () => void;
  canSitOut?: boolean;
  canCancelSitOut?: boolean;
  sitOutLabel?: string;
  sitOutTitle?: string;
  onSitOut?: () => void;
  canSitIn?: boolean;
  sitInLabel?: string;
  onSitIn?: () => void;
  canTopUp?: boolean;
  topUpLabel?: string;
  onTopUp?: () => void;
  needChips?: boolean;
  onNeedChips?: () => void;
  canSitAndPlay?: boolean;
  onSitAndPlay?: () => void;
  canAddBot?: boolean;
  onAddBot?: () => void;
  onFillBots?: () => void;
  canRemoveBots?: boolean;
  onRemoveBots?: () => void;
  /** Bot display-name packs from site config. */
  botGroups?: { id: string; name: string }[];
  botGroupId?: string | null;
  onBotGroupChange?: (id: string) => void;
};

function hasTableTools(t: ActionTableTools | undefined): boolean {
  if (!t) return false;
  return Boolean(
    t.canReady ||
      t.onStart ||
      t.canSitOut ||
      t.canCancelSitOut ||
      t.canSitIn ||
      t.canTopUp ||
      t.needChips ||
      t.canSitAndPlay ||
      t.canAddBot ||
      t.canRemoveBots,
  );
}

function TableToolsPanel({
  tools,
  bare,
  copy,
}: {
  tools: ActionTableTools;
  bare: boolean;
  copy: string;
}) {
  const shell = bare
    ? 'flex w-full min-h-0 flex-1 flex-col gap-2 px-3 py-2.5'
    : 'hud-panel flex min-h-[180px] flex-col gap-2 px-3 py-3';

  const primaryLabel = tools.canReady
    ? (tools.readyLabel ?? 'Play Next Hand')
    : tools.onStart
      ? (tools.startLabel ?? 'Next hand')
      : tools.canSitIn
        ? (tools.sitInLabel ?? 'Sit in')
        : tools.canSitAndPlay
          ? 'Sit and play'
          : tools.canTopUp
            ? (tools.topUpLabel ?? 'Top up')
            : tools.needChips
              ? 'Need chips'
              : null;

  const primaryOnClick = tools.canReady
    ? tools.onReady
    : tools.onStart
      ? tools.onStart
      : tools.canSitIn
        ? tools.onSitIn
        : tools.canSitAndPlay
          ? tools.onSitAndPlay
          : tools.canTopUp
            ? tools.onTopUp
            : tools.needChips
              ? tools.onNeedChips
              : undefined;

  const primaryIsReady = tools.canReady && tools.isReady;
  const showReadyCount =
    tools.canReady &&
    tools.readyCount != null &&
    tools.readyTotal != null &&
    tools.readyTotal > 0 &&
    !(tools.readyPlayers && tools.readyPlayers.length > 0);

  const primaryIsTopUp = !tools.canReady && !tools.onStart && !tools.canSitIn && !tools.canSitAndPlay && tools.canTopUp;
  const primaryIsNeedChips =
    !tools.canReady &&
    !tools.onStart &&
    !tools.canSitIn &&
    !tools.canSitAndPlay &&
    !tools.canTopUp &&
    tools.needChips;

  const showSecondaryTopUp = tools.canTopUp && tools.onTopUp && !primaryIsTopUp;
  const showSecondaryNeedChips =
    tools.needChips && tools.onNeedChips && !tools.canTopUp && !primaryIsNeedChips;

  const hostRow =
    tools.canAddBot || tools.canRemoveBots || showSecondaryTopUp || showSecondaryNeedChips;

  return (
    <div className={shell} role="status" aria-live="polite">
      <p className="px-1 text-center text-[10px] font-medium leading-snug text-sidebar/75">
        {copy}
      </p>
      {tools.readyPlayers && tools.readyPlayers.length > 0 ? (
        <ReadyPlayersRoster
          players={tools.readyPlayers}
          readyCount={tools.readyCount}
          readyTotal={tools.readyTotal}
          heading={tools.readyHeading ?? 'Ready'}
          compact
        />
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {primaryLabel && primaryOnClick ? (
          <Button
            type="button"
            onClick={primaryOnClick}
            variant={primaryIsReady ? 'ghost' : 'primary'}
            className="min-h-9 px-4 text-[11px] font-display font-bold uppercase tracking-wide"
          >
            {primaryLabel}
            {showReadyCount ? (
              <span className="ml-1.5 font-mono font-semibold tabular-nums opacity-80">
                {tools.readyCount}/{tools.readyTotal}
              </span>
            ) : null}
          </Button>
        ) : null}
        {(tools.canSitOut || tools.canCancelSitOut) && tools.onSitOut ? (
          <Button
            type="button"
            variant="soft"
            onClick={tools.onSitOut}
            title={tools.sitOutTitle}
            className={
              tools.canCancelSitOut
                ? 'min-h-10 px-3 text-[11px]'
                : 'min-h-10 border-amber-600/30 px-3 text-[11px] text-amber-900 hover:bg-amber-500/10'
            }
          >
            {tools.sitOutLabel ?? 'Sit out'}
          </Button>
        ) : null}
        {/* Sit in as secondary when primary is ready/start */}
        {tools.canSitIn && tools.onSitIn && (tools.canReady || tools.onStart) ? (
          <Button
            type="button"
            variant="soft"
            onClick={tools.onSitIn}
            className="min-h-10 px-3 text-[11px]"
          >
            {tools.sitInLabel ?? 'Sit in'}
          </Button>
        ) : null}
      </div>
      {hostRow ? (
        <div className="flex flex-col items-center gap-1.5">
          {tools.canAddBot && tools.botGroups && tools.botGroups.length > 0 && tools.onBotGroupChange ? (
            <label className="flex items-center gap-1.5 text-[10px] font-display font-semibold uppercase tracking-wide text-ink-strong-muted">
              <span className="sr-only sm:not-sr-only">Bots</span>
              <select
                value={tools.botGroupId ?? tools.botGroups[0]!.id}
                onChange={(e) => tools.onBotGroupChange?.(e.target.value)}
                className="max-w-[10rem] rounded border border-sidebar/20 bg-white px-1.5 py-1 text-[10px] font-semibold normal-case tracking-normal text-ink-strong outline-none focus:border-sidebar/40"
                aria-label="Bot name pack"
              >
                {tools.botGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="flex flex-wrap items-center justify-center gap-1">
          {tools.canAddBot && tools.onAddBot ? (
            <Button type="button" variant="soft" onClick={tools.onAddBot} className="px-2.5 py-1 text-[10px]">
              + Bot
            </Button>
          ) : null}
          {tools.canAddBot && tools.onFillBots ? (
            <Button
              type="button"
              variant="soft"
              onClick={tools.onFillBots}
              className="px-2 py-1 text-[10px] text-ink-strong-muted"
            >
              Fill
            </Button>
          ) : null}
          {tools.canRemoveBots && tools.onRemoveBots ? (
            <Button
              type="button"
              variant="ghost"
              onClick={tools.onRemoveBots}
              className="rounded px-2 py-1 text-[10px] font-display font-semibold uppercase tracking-wide text-ink-strong-muted hover:text-danger"
            >
              − Bots
            </Button>
          ) : null}
          {showSecondaryTopUp ? (
            <Button
              type="button"
              variant="soft"
              onClick={tools.onTopUp}
              className="px-2.5 py-1 text-[10px]"
            >
              {tools.topUpLabel ?? 'Top up'}
            </Button>
          ) : null}
          {showSecondaryNeedChips ? (
            <Button
              type="button"
              variant="dangerQuiet"
              onClick={tools.onNeedChips}
              className="px-2.5 py-1 text-[10px] font-display font-semibold uppercase tracking-wide"
            >
              Need chips
            </Button>
          ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ActionControls({
  onAction,
  spectating = false,
  bare = false,
  connection = 'open',
  table: tableProp,
  private: privateProp,
  userId: userIdProp,
  onViewContest,
  tableTools,
}: {
  onAction: (action: string, amount?: number) => void;
  spectating?: boolean;
  /** Skip outer hud-panel chrome (when nested in FloatingActionDock). */
  bare?: boolean;
  /** Socket connection state — blocks commits unless `open`. */
  connection?: 'idle' | 'connecting' | 'open' | 'closed';
  /** Optional overrides (offline / tests); defaults to zustand session. */
  table?: PublicTable | null;
  private?: PrivateView | null;
  userId?: string | null;
  /** Contest finished — open results page. */
  onViewContest?: () => void;
  /** Between-hand / sit / host controls for the Actions dock idle state. */
  tableTools?: ActionTableTools;
}) {
  const tableFromStore = useSession((s) => s.table);
  const privFromStore = useSession((s) => s.private);
  const userIdFromStore = useSession((s) => s.userId);
  const table = tableProp !== undefined ? tableProp : tableFromStore;
  const priv = privateProp !== undefined ? privateProp : privFromStore;
  const userId = userIdProp !== undefined ? userIdProp : userIdFromStore;
  const narrow = useIsNarrow();
  const landscape = useIsLandscapePhone();

  const connectionOpen = connection === 'open';
  const mySeat = table?.players.find((p) => p.userId === userId)?.seat;
  const myStack = table?.players.find((p) => p.userId === userId)?.stack ?? 0;
  const isTournament = Boolean(table?.tournament);
  const contestOver = Boolean(table?.tournament?.frozen);
  const isTurn = connectionOpen && table?.toAct === mySeat && !!priv && !contestOver;
  const turnEndsAt = isTurn ? table?.turnEndsAt : null;
  const turnTotalMs = table?.config.turnTimeMs ?? 20_000;

  const legal = priv?.legal;
  const min = legal?.minRaiseTo ?? 0;
  const max = legal?.maxRaiseTo ?? 0;
  const callAmount = legal?.callAmount ?? 0;
  const bb = table?.config.bigBlind ?? 10;
  const pot = table?.pot ?? 0;

  const [betAmount, setBetAmount] = useState(min);
  const [confirm, setConfirm] = useState<null | { action: string; amount?: number; label: string }>(
    null,
  );

  useEffect(() => {
    setBetAmount(min);
    setConfirm(null);
  }, [min, table?.actionSeq]);

  const shell = bare
    ? 'flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden text-ink-strong'
    : 'hud-panel mx-auto w-full max-w-xl overflow-hidden p-0';

  if (contestOver) {
    return (
      <div
        className={
          bare
            ? 'flex h-full min-h-0 flex-1 flex-col items-center justify-center gap-2.5 px-3 py-2 text-center'
            : 'hud-panel flex min-h-[180px] flex-col items-center justify-center gap-2.5 px-3 py-3 text-center'
        }
        role="status"
        aria-live="polite"
      >
        <p className="font-display text-xs font-bold uppercase tracking-[0.16em] text-sidebar">
          Contest complete
        </p>
        <p className="max-w-[16rem] text-[11px] leading-snug text-ink-strong-muted sm:text-xs">
          Results and placements are on the contest page.
        </p>
        {onViewContest ? (
          <Button
            type="button"
            onClick={onViewContest}
            className="min-h-10 w-full max-w-[16rem] px-4 text-xs font-display font-bold uppercase tracking-wide"
          >
            View contest results
          </Button>
        ) : null}
      </div>
    );
  }

  if (!isTurn || !legal || legal.types.length === 0) {
    const copy = waitingCopy({
      spectating,
      street: table?.street,
      isTurn: false,
      connection,
      isTournament,
      contestOver,
    });
    // Between-hand / sit tools beat the spinner when connection is live and tools exist.
    if (connectionOpen && hasTableTools(tableTools) && tableTools) {
      return <TableToolsPanel tools={tableTools} bare={bare} copy={copy} />;
    }
    return (
      <div
        className={
          bare
            ? 'flex h-full min-h-0 flex-1 flex-col items-center justify-center gap-1.5 px-3 py-2 text-center'
            : 'hud-panel flex min-h-[180px] flex-col items-center justify-center gap-1.5 px-3 py-3 text-center'
        }
        role="status"
        aria-live="polite"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- public animated SVG loader */}
        <img
          src="/poker-chip-shuffle.svg"
          alt=""
          width={64}
          height={64}
          className="h-10 w-10 shrink-0 object-contain sm:h-11 sm:w-11"
          aria-hidden
          decoding="async"
        />
        <p className="max-w-[16rem] text-xs font-medium leading-snug tracking-wide text-ink-strong-muted sm:text-sm">
          {copy}
        </p>
      </div>
    );
  }

  const snap = (v: number) => Math.round(v / bb) * bb;

  const clampBet = (raw: number) => {
    if (max <= min) return min;
    return snap(Math.min(max, Math.max(min, raw)));
  };

  const setBet = (raw: number) => setBetAmount(clampBet(raw));

  const halfPot = snap(Math.min(max, Math.max(min, Math.floor(pot / 2) + (table?.currentBet ?? 0))));
  const potBet = snap(Math.min(max, Math.max(min, pot + (table?.currentBet ?? 0))));

  const canBet = legal.types.includes('bet') || legal.types.includes('raise');
  const betLabel = legal.types.includes('bet') ? 'Bet' : 'Raise';
  const betAction = legal.types.includes('bet') ? 'bet' : 'raise';
  const amount = clampBet(betAmount);
  const sliderMax = Math.max(min, max);

  /** Large commitments need an extra confirm tap. */
  const needsConfirm = (action: string, amt?: number) => {
    if (action === 'allin') return true;
    if (action === 'fold' && callAmount > 0 && callAmount >= myStack * 0.4) return true;
    if ((action === 'bet' || action === 'raise') && amt != null && myStack > 0 && amt >= myStack * 0.5) {
      return true;
    }
    return false;
  };

  const commit = (action: string, amt?: number, label?: string) => {
    if (!connectionOpen) return;
    if (needsConfirm(action, amt)) {
      setConfirm({
        action,
        amount: amt,
        label: label ?? action,
      });
      return;
    }
    onAction(action, amt);
  };

  const submitBet = (raw: number) => {
    const v = clampBet(raw);
    commit(betAction, v, `${betLabel} ${formatMoneyAmount(v)}`);
  };

  if (confirm) {
    return (
      <div className={shell}>
        <div className="flex h-full min-h-0 flex-1 flex-col justify-center space-y-3 p-3 sm:p-4">
          <p className="text-center text-sm font-medium text-ink-strong">
            Confirm <span className="font-bold text-sidebar">{confirm.label}</span>?
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="ghost" className="min-h-11" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="min-h-11"
              onClick={() => {
                onAction(confirm.action, confirm.amount);
                setConfirm(null);
              }}
            >
              Confirm
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const landLayout = 'min-h-[2.75rem] flex-1 px-2 text-[13px]';

  const timer = (
    <MoveTimerStrip endsAt={turnEndsAt} totalMs={turnTotalMs} compact={!!(narrow && landscape)} />
  );

  const presets = (
    <>
      {(
        [
          ['Min', min],
          ['½', halfPot],
          ['Pot', potBet],
          ['Max', max],
        ] as const
      ).map(([label, val]) => (
        <Button
          key={label}
          type="button"
          variant="soft"
          onClick={() => setBet(val)}
          className="min-h-8 px-1.5 text-[10px]"
        >
          {label}
        </Button>
      ))}
    </>
  );

  /* —— Landscape: sized strip + three wide actions —— */
  if (narrow && landscape) {
    const midLabel = legal.types.includes('check')
      ? 'Check'
      : legal.types.includes('call')
        ? `Call ${formatMoneyAmount(callAmount)}`
        : null;
    const thirdIsBet = canBet;
    const thirdIsAllin = !canBet && legal.types.includes('allin');

    return (
      <div className="flex h-full min-h-0 flex-col text-ink-strong">
        {timer}
        {canBet && (
          <div className="flex shrink-0 items-center gap-1 border-b border-sidebar/12 px-1.5 py-0.5">
            <span className="shrink-0 font-display text-sm font-semibold tabular-nums text-sidebar">
              {formatMoneyAmount(amount)}
            </span>
            <input
              type="range"
              min={min}
              max={sliderMax}
              step={bb}
              value={amount}
              disabled={sliderMax <= min}
              onChange={(e) => setBet(Number(e.target.value))}
              className="bet-slider min-w-0 flex-1"
              aria-label={`${betLabel} amount`}
            />
            <div className="flex shrink-0 gap-0.5">
              {(
                [
                  ['Min', min],
                  ['½', halfPot],
                  ['Pot', potBet],
                  ['Max', max],
                ] as const
              ).map(([label, val]) => (
                <Button
                  key={label}
                  type="button"
                  variant="soft"
                  onClick={() => setBet(val)}
                  className="px-1.5 py-0.5 text-[9px]"
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        )}
        <div className="flex min-h-0 flex-1 items-stretch gap-1.5 px-1.5 py-1">
          {legal.types.includes('fold') ? (
            <Button
              type="button"
              variant="danger"
              onClick={() => commit('fold', undefined, 'Fold')}
              className={landLayout}
            >
              Fold
            </Button>
          ) : (
            <div className="flex-1" />
          )}
          {midLabel ? (
            <Button
              type="button"
              variant="soft"
              onClick={() =>
                legal.types.includes('check') ? commit('check') : commit('call')
              }
              className={landLayout}
            >
              {midLabel}
            </Button>
          ) : (
            <div className="flex-1" />
          )}
          {thirdIsBet ? (
            <Button type="button" onClick={() => submitBet(amount)} className={landLayout}>
              {betLabel}
            </Button>
          ) : thirdIsAllin || legal.types.includes('allin') ? (
            <Button
              type="button"
              onClick={() => commit('allin', undefined, 'All-in')}
              className={landLayout}
            >
              All-in
            </Button>
          ) : (
            <div className="flex-1" />
          )}
        </div>
      </div>
    );
  }

  /* —— Portrait mobile: compact text —— */
  if (narrow) {
    return (
      <div className={shell}>
        {timer}
        <div className="flex min-h-0 flex-1 flex-col justify-between space-y-1 p-1.5">
          {canBet && (
            <div className="space-y-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-strong-muted">
                  {betLabel} to
                </span>
                <span className="font-mono text-sm font-bold tabular-nums text-sidebar">
                  {formatMoneyAmount(amount)}
                  <span className="ml-1.5 text-[10px] font-medium text-ink-strong-muted">
                    {formatMoneyAmount(min)}–{formatMoneyAmount(max)}
                  </span>
                </span>
              </div>
              <input
                type="range"
                min={min}
                max={sliderMax}
                step={bb}
                value={amount}
                disabled={sliderMax <= min}
                onChange={(e) => setBet(Number(e.target.value))}
                className="bet-slider w-full"
                aria-label={`${betLabel} amount`}
              />
              <div className="grid grid-cols-4 gap-1">{presets}</div>
            </div>
          )}

          <div className={`grid gap-1 ${canBet ? 'grid-cols-4' : 'grid-cols-3'}`}>
            {legal.types.includes('fold') && (
              <Button
                type="button"
                variant="danger"
                onClick={() => commit('fold', undefined, 'Fold')}
                className="min-h-11 px-2 text-[11px]"
              >
                Fold
              </Button>
            )}
            {legal.types.includes('check') && (
              <Button type="button" variant="soft" onClick={() => commit('check')} className="min-h-11">
                Check
              </Button>
            )}
            {legal.types.includes('call') && (
              <Button type="button" variant="soft" onClick={() => commit('call')} className="min-h-11">
                Call {formatMoneyAmount(callAmount)}
              </Button>
            )}
            {canBet && (
              <Button type="button" onClick={() => submitBet(amount)} className="min-h-11 px-2 text-[11px]">
                {betLabel} {formatMoneyAmount(amount)}
              </Button>
            )}
            {legal.types.includes('allin') && (
              <Button
                type="button"
                onClick={() => commit('allin', undefined, 'All-in')}
                className="min-h-11 px-2 text-[11px]"
              >
                All-in
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* —— Desktop: fill fixed 160px dock —— */
  return (
    <div className={shell}>
      <MoveTimerStrip endsAt={turnEndsAt} totalMs={turnTotalMs} compact />
      <div className="flex min-h-0 flex-1 flex-col justify-between gap-1.5 px-3 pb-2 pt-1">
        {canBet && (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-strong-muted">
                {betLabel} to
              </span>
              <span className="font-mono text-sm font-bold tabular-nums text-sidebar">
                {formatMoneyAmount(amount)}
                <span className="ml-1.5 text-[10px] font-medium text-ink-strong-muted">
                  {formatMoneyAmount(min)}–{formatMoneyAmount(max)}
                </span>
              </span>
            </div>
            <input
              type="range"
              min={min}
              max={sliderMax}
              step={bb}
              value={amount}
              disabled={sliderMax <= min}
              onChange={(e) => setBet(Number(e.target.value))}
              className="bet-slider w-full"
              aria-label={`${betLabel} amount`}
            />
            <div className="grid grid-cols-[minmax(4.5rem,1fr)_repeat(4,minmax(0,1fr))] gap-1">
              <label className="min-w-0">
                <span className="sr-only">{betLabel} amount</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={min}
                  max={max}
                  step={bb}
                  value={amount}
                  onChange={(e) => setBet(Number(e.target.value) || min)}
                  onBlur={() => setBet(amount)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setBet(amount);
                      submitBet(amount);
                    }
                  }}
                  className="w-full rounded-md border border-sidebar/18 bg-white px-2 py-1.5 font-mono text-sm font-bold tabular-nums text-ink-strong outline-none focus:border-sidebar/45 focus:shadow-[0_0_0_2px_rgb(29_4_50/0.08)]"
                />
              </label>
              {(
                [
                  ['Min', min],
                  ['½', halfPot],
                  ['Pot', potBet],
                  ['Max', max],
                ] as const
              ).map(([label, val]) => (
                <Button
                  key={label}
                  type="button"
                  variant="soft"
                  onClick={() => setBet(val)}
                  className="px-1 py-1.5 text-[10px]"
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className={`grid gap-1.5 ${canBet ? 'grid-cols-4' : 'grid-cols-3'}`}>
          {legal.types.includes('fold') && (
            <Button
              type="button"
              variant="danger"
              size="compact"
              onClick={() => commit('fold', undefined, 'Fold')}
            >
              Fold
            </Button>
          )}
          {legal.types.includes('check') && (
            <Button
              type="button"
              variant="soft"
              size="compact"
              onClick={() => commit('check')}
              className="min-h-9"
            >
              Check
            </Button>
          )}
          {legal.types.includes('call') && (
            <Button
              type="button"
              variant="soft"
              size="compact"
              onClick={() => commit('call')}
              className="min-h-9"
            >
              Call {formatMoneyAmount(callAmount)}
            </Button>
          )}
          {canBet && (
            <Button type="button" size="compact" onClick={() => submitBet(amount)}>
              {betLabel} {formatMoneyAmount(amount)}
            </Button>
          )}
          {legal.types.includes('allin') && (
            <Button
              type="button"
              size="compact"
              onClick={() => commit('allin', undefined, 'All-in')}
            >
              All-in
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
