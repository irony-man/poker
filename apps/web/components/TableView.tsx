'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ActionControls } from './ActionControls';
import { CommunityBoard } from './CommunityBoard';
import { DealerPotZone } from './DealerPotZone';
import { HowToPlayHelp } from './HowToPlayHelp';
import { TableSoundMuteButton } from './TableSoundMuteButton';
import { LoadingScreen } from './LoadingScreen';
import { SeatView } from './SeatView';
import { CopyRoomLink } from './CopyRoomLink';
import { TableOverflowMenu, type OverflowItem } from './TableOverflowMenu';
import { TableLiveAnnouncer } from './TableLiveAnnouncer';
import { TableShell } from './TableShell';
import { VoiceCallBar } from './VoiceCallBar';
import { WinHandModal } from './WinHandModal';
import { buildTableJoinShareText } from '@/lib/tableLink';
import { coerceMoney, formatMoneyAmount } from '@/lib/currency';
import { usePokerSocket } from '@/lib/ws';
import { useSession } from '@/lib/store';
import { useVoiceCall } from '@/hooks/useVoiceCall';
import { useHandPresentation } from '@/hooks/useHandPresentation';
import { useTableSounds } from '@/hooks/useTableSounds';
import { seatAnglesForHero, useIsLandscapePhone, useIsNarrow } from '@/lib/tableLayout';
import { loadSavedTableColorId } from '@/lib/tableColors';
import { useTableLayout } from '@/lib/useTableLayout';
import { StackedTableLayout } from '@/components/table-v2/StackedTableLayout';
import { useConfirm } from './ConfirmPopover';
import { Button, buttonClass } from '@/components/ui/Button';
import { StatusChip } from '@/components/ui/StatusChip';
import { fetchPublicBotGroups, type PublicBotGroup } from '@/lib/api';

export function TableView({
  tableId,
  inviteCode,
  initialSpectate = false,
  contestId: contestIdProp = null,
}: {
  tableId: string;
  inviteCode?: string | null;
  initialSpectate?: boolean;
  /** Prefer table.tournament.contestId; URL ?contest= as fallback. */
  contestId?: string | null;
}) {
  const table = useSession((s) => s.table);
  const confirm = useConfirm();
  const priv = useSession((s) => s.private);
  const userId = useSession((s) => s.userId);
  const connection = useSession((s) => s.connection);
  const lastError = useSession((s) => s.lastError);
  const lastErrorCode = useSession((s) => s.lastErrorCode);
  const boundTableId = useSession((s) => s.boundTableId);
  const setError = useSession((s) => s.setError);
  const clearTable = useSession((s) => s.clearTable);
  const { send, leaveTable } = usePokerSocket(tableId, { spectate: initialSpectate });
  const voice = useVoiceCall(tableId, userId, send);
  const router = useRouter();
  const narrow = useIsNarrow();
  const landscape = useIsLandscapePhone();
  const tableLayout = useTableLayout();
  const stacked = tableLayout === 'v2' && narrow && !landscape;
  const botAddCount = 3;
  const [spectating, setSpectating] = useState(initialSpectate);
  const [tableColorId, setTableColorId] = useState(0);
  const [botGroups, setBotGroups] = useState<PublicBotGroup[]>([]);
  const [botGroupId, setBotGroupId] = useState<string | null>(null);

  useEffect(() => {
    setTableColorId(loadSavedTableColorId());
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchPublicBotGroups().then((groups) => {
      if (cancelled) return;
      setBotGroups(groups);
      setBotGroupId((cur) => {
        if (cur && groups.some((g) => g.id === cur)) return cur;
        return groups.find((g) => g.isDefault)?.id ?? groups[0]?.id ?? null;
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function sendAddBot(opts: { seat?: number; count?: number }) {
    if (!table) return;
    send({
      type: 'add_bot',
      tableId,
      buyIn: table.config.buyIn,
      ...(opts.seat !== undefined ? { seat: opts.seat } : {}),
      ...(opts.count !== undefined ? { count: opts.count } : {}),
      ...(botGroupId ? { botGroupId } : {}),
    });
  }
  const [dismissedWinHandId, setDismissedWinHandId] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const autoSitSent = useRef(false);

  useTableSounds(table);

  useEffect(() => {
    if (
      lastErrorCode !== 'not_found' &&
      lastErrorCode !== 'kicked' &&
      lastErrorCode !== 'account_deleted'
    ) {
      return;
    }
    // Only leave if the error is for *this* table (guards against stale socket races).
    if (boundTableId && boundTableId !== tableId) return;
    voice.leaveVoice();
    leaveTable();
    clearTable();
    setError(null);
    const contestFallback = contestIdProp || null;
    router.replace(contestFallback ? `/contest/${contestFallback}` : '/');
  }, [
    lastErrorCode,
    boundTableId,
    tableId,
    contestIdProp,
    voice.leaveVoice,
    leaveTable,
    clearTable,
    setError,
    router,
  ]);

  const mySeat = table?.players.find((p) => p.userId === userId)?.seat;
  const myPlayer = mySeat !== undefined ? table?.players[mySeat] : undefined;
  const isSpectating = spectating && mySeat === undefined;
  const chipBalance = useSession((s) => s.chipBalance);
  const walletChips = coerceMoney(chipBalance);
  const isTournament = Boolean(table?.tournament);
  const contestOver = Boolean(table?.tournament?.frozen);
  /** Cash rooms: free rebuy to full buy-in. Contests: bankroll-funded (partial OK). */
  const topUpAmount =
    table == null
      ? 0
      : !isTournament
        ? table.config.buyIn
        : walletChips > 0
          ? Math.min(table.config.buyIn, walletChips)
          : 0;
  const sitAtFirstOpenSeat = () => {
    if (!table || isSpectating) return false;
    const empty = table.players.find((p) => p.status === 'empty');
    if (!empty) return false;
    send({
      type: 'sit',
      tableId,
      seat: empty.seat,
      buyIn: table.config.buyIn,
    });
    return true;
  };

  useEffect(() => {
    autoSitSent.current = false;
  }, [tableId]);

  // Reset so a reconnect / manual sit can retry if the first attempt was dropped.
  useEffect(() => {
    if (connection !== 'open') autoSitSent.current = false;
  }, [connection]);

  // Server auto-sits on join_table; client only sits via explicit Sit controls.
  // (A parallel client auto-sit raced the server and produced "Seat taken" toasts.)

  const angles = useMemo(
    () => seatAnglesForHero(table?.config.maxSeats ?? 6, mySeat),
    [table?.config.maxSeats, mySeat],
  );

  useEffect(() => {
    if (mySeat !== undefined && spectating) setSpectating(false);
  }, [mySeat, spectating]);

  const {
    winBySeat,
    handNameBySeat,
    winningCards,
    highlightMode,
    showWinModal,
    youWon,
  } = useHandPresentation(table, userId, dismissedWinHandId);
  const betweenHands = table?.street === 'waiting' || table?.street === 'payout';
  const myStack = coerceMoney(myPlayer?.stack);
  const brokeAtTable =
    !table?.tournament?.noTopUp &&
    mySeat !== undefined &&
    !!myPlayer &&
    myStack === 0 &&
    betweenHands;
  const canTopUp = brokeAtTable && topUpAmount > 0;
  const brokeNoWallet = isTournament && brokeAtTable && topUpAmount <= 0 && chipBalance !== null;
  const needChips = isTournament && brokeAtTable && topUpAmount <= 0;

  /** Cash: free table rebuy. Contest: funded from global bankroll (partial OK). */
  const doTopUp = () => {
    if (!table || mySeat === undefined || !canTopUp || topUpAmount <= 0) return;
    send({
      type: 'top_up',
      tableId,
      seat: mySeat,
      amount: topUpAmount,
    });
  };

  const canSitOut =
    !isTournament &&
    mySeat !== undefined &&
    !!myPlayer &&
    myPlayer.status !== 'empty' &&
    myPlayer.status !== 'sittingOut' &&
    !myPlayer.pendingSitOut &&
    (betweenHands ||
      myPlayer.status === 'folded' ||
      myPlayer.status === 'seated' ||
      myPlayer.status === 'active' ||
      myPlayer.status === 'allin');
  const canCancelSitOutNext =
    !isTournament &&
    mySeat !== undefined &&
    !!myPlayer?.pendingSitOut &&
    myPlayer.status !== 'sittingOut';
  /** Seat stays; you’ll be dealt starting next hand (works mid-hand while sitting out). */
  const canSitIn =
    !isTournament &&
    mySeat !== undefined &&
    myPlayer?.status === 'sittingOut' &&
    myStack > 0;
  const sitOutNextHand =
    canSitOut &&
    !betweenHands &&
    (myPlayer?.status === 'active' || myPlayer?.status === 'allin');
  const sitOutLabel = sitOutNextHand
    ? 'Sit out next hand'
    : canCancelSitOutNext
      ? 'Stay in (cancel sit-out)'
      : 'Sit out';
  const sitInLabel = betweenHands ? 'Sit in' : 'Sit in — next hand';

  const emptySeats = table?.players.filter((p) => p.status === 'empty').length ?? 0;
  const botSeats = table?.players.filter((p) => p.userId?.startsWith('bot:')).length ?? 0;
  const isHost = !!userId && table?.hostUserId === userId;
  /** Public stake tables are humans-only; bots are private host practice. */
  const botsAllowed = table?.isPrivate === true && !isTournament;
  /** Humans + bots eligible for next cash hand. */
  const eligiblePlayers =
    table?.players.filter(
      (p) => p.userId && coerceMoney(p.stack) > 0 && p.status !== 'sittingOut' && p.status !== 'empty',
    ) ?? [];
  const readyCount = eligiblePlayers.filter((p) => p.ready).length;
  const myReady = !!myPlayer?.ready;
  /**
   * Seated with chips between hands → can mark ready (“Play Next Hand”).
   * Contests and cash both require Ready consensus (except frozen contests).
   */
  const canReady =
    !contestOver &&
    betweenHands &&
    mySeat !== undefined &&
    !!myPlayer &&
    myPlayer.status !== 'sittingOut' &&
    myPlayer.status !== 'empty' &&
    myStack > 0;
  const readyLabel = myReady ? 'Not ready' : 'Play Next Hand';
  /** Seated humans + eligible bots for the Actions dock ready strip. */
  const readyRosterPlayers =
    eligiblePlayers.map((p) => ({
      seat: p.seat,
      name: p.name ?? `Seat ${p.seat}`,
      userId: p.userId,
      avatarId: p.avatarId,
      avatarUrl: p.avatarUrl,
      ready: !!p.ready,
      isSelf: p.userId === userId,
      sittingOut: p.status === 'sittingOut',
    }));
  const showDockReadyRoster = !contestOver && betweenHands && readyRosterPlayers.length > 0;
  const dockReadyHeading =
    table?.street === 'waiting' && readyCount === 0
      ? 'Players'
      : table?.street === 'waiting'
        ? 'Ready to start'
        : 'Ready for next hand';

  const onAction = (action: string, amount?: number) => {
    if (!table) return;
    if (connection !== 'open') {
      setError('Disconnected — wait for reconnect, then try again');
      return;
    }
    const ok = send({
      type: 'action',
      tableId,
      handId: table.handId,
      seq: table.actionSeq,
      action,
      amount,
    });
    if (!ok) {
      setError('Could not send action — connection lost');
    }
  };

  const leaveRoom = async (to: string = '/') => {
    const softLeave = to.startsWith('/contest/');
    if (!softLeave) {
      const ok = await confirm({
        title: 'Leave this table?',
        description:
          'Your remaining stack returns to your bankroll when you leave between hands.',
        confirmLabel: 'Leave',
        cancelLabel: 'Stay',
        tone: 'danger',
      });
      if (!ok) return false;
    }
    voice.leaveVoice();
    leaveTable();
    clearTable();
    router.push(to);
    return true;
  };

  const contestId = table?.tournament?.contestId || contestIdProp || null;
  const goToContest = () => {
    if (contestId) {
      void leaveRoom(`/contest/${contestId}`);
      return;
    }
    voice.leaveVoice();
    leaveTable();
    clearTable();
    router.push('/contests');
  };

  const isMyTurn = table?.toAct === mySeat && !!priv?.legal?.types.length && !contestOver;
  const potTotal =
    (table?.pot ?? 0) ||
    (table?.sidePots?.reduce((s, p) => s + p.amount, 0) ?? 0);
  const dealerPlayer =
    table?.dealerButton != null ? table.players[table.dealerButton] : undefined;
  const showDealerZone = table?.street !== 'waiting' && table?.dealerButton != null;

  if (!table && lastErrorCode === 'not_found') {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-ink-strong-muted">
          {contestIdProp
            ? 'Table closed — opening contest results…'
            : 'Table not found — returning home…'}
        </p>
      </div>
    );
  }

  if (!table && lastErrorCode === 'bad_auth') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-ink-strong">Session expired</p>
        <p className="max-w-sm text-sm text-ink-strong-muted">
          {lastError ?? 'Sign in again, then reopen the table.'}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" onClick={() => window.location.reload()}>
            Retry
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.push('/')}>
            Back to lobby
          </Button>
        </div>
      </div>
    );
  }

  if (!table && (connection === 'connecting' || connection === 'open')) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <LoadingScreen
          compact
          label={connection === 'connecting' ? 'Connecting…' : 'Loading table…'}
        />
      </div>
    );
  }

  if (!table && connection === 'closed') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-ink-strong">Can&apos;t reach the table</p>
        <p className="max-w-sm text-sm text-ink-strong-muted">
          The connection closed before table data arrived. Check that the server is running, then
          try again.
        </p>
        <Button type="button" onClick={() => router.push('/')}>
          Back to lobby
        </Button>
      </div>
    );
  }

  if (!table) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-ink-strong-muted">Syncing table…</p>
      </div>
    );
  }

  const mobileOverflowItems: OverflowItem[] = [];
  if (narrow) {
    if (inviteCode) {
      mobileOverflowItems.push({
        id: 'copy-link',
        label: `Copy link · ${inviteCode}`,
        onClick: () => {
          void (async () => {
            const text = buildTableJoinShareText(tableId, inviteCode);
            try {
              await navigator.clipboard.writeText(text);
            } catch {
              /* ignore */
            }
          })();
        },
        tone: 'accent',
      });
    }
    mobileOverflowItems.push({
      id: 'chat',
      label: 'Chat',
      onClick: () => setChatOpen(true),
      tone: 'accent',
    });
    if (contestOver) {
      mobileOverflowItems.push({
        id: 'contest-results',
        label: 'Contest results',
        onClick: goToContest,
        tone: 'accent',
      });
    }
    if (!isSpectating && botsAllowed && emptySeats > 0) {
      mobileOverflowItems.push(
        {
          id: 'add-bot',
          label: '+ Bot',
          onClick: () =>
            sendAddBot({
              count: Math.min(Math.max(1, botAddCount), emptySeats),
            }),
        },
        {
          id: 'fill',
          label: 'Fill empty seats',
          onClick: () => sendAddBot({ count: emptySeats }),
        },
      );
    }
    if (!isSpectating && botsAllowed && botSeats > 0) {
      mobileOverflowItems.push({
        id: 'remove-bots',
        label: 'Remove bots',
        onClick: () => send({ type: 'remove_all_bots', tableId }),
        tone: 'danger',
      });
    }
    if (canSitOut || canCancelSitOutNext) {
      mobileOverflowItems.push({
        id: 'sit-out',
        label: sitOutLabel,
        onClick: () => send({ type: 'sit_out', tableId, seat: mySeat! }),
      });
    }
    if (canSitIn) {
      mobileOverflowItems.push({
        id: 'sit-in',
        label: sitInLabel,
        onClick: () => send({ type: 'sit_in', tableId, seat: mySeat! }),
        tone: 'accent',
      });
    }
    if (canTopUp) {
      mobileOverflowItems.push({
        id: 'top-up',
        label: topUpAmount < (table?.config.buyIn ?? 0) ? `Top up ${formatMoneyAmount(topUpAmount)}` : 'Top up',
        onClick: doTopUp,
        tone: 'gold',
      });
    } else if (brokeNoWallet) {
      mobileOverflowItems.push({
        id: 'need-wuffies',
        label: 'Need chips — Profile',
        onClick: () => {
          void leaveRoom('/profile');
        },
        tone: 'gold',
      });
    }
    mobileOverflowItems.push({
      id: 'leave',
      label: 'Leave table',
      onClick: () => {
        void leaveRoom();
      },
      tone: 'danger',
    });
  }

  const actionControls = (
        <ActionControls
          onAction={onAction}
          spectating={isSpectating}
          bare
          connection={connection}
          onViewContest={contestOver ? goToContest : undefined}
          tableTools={{
            canReady,
            readyLabel,
            isReady: myReady,
            readyCount,
            readyTotal: eligiblePlayers.length,
            readyPlayers: showDockReadyRoster ? readyRosterPlayers : undefined,
            readyHeading: dockReadyHeading,
            onReady: () => send({ type: 'set_ready', tableId, ready: !myReady }),
            canSitOut,
            canCancelSitOut: canCancelSitOutNext,
            sitOutLabel,
            sitOutTitle: sitOutNextHand
              ? 'Finish this hand, then skip until you sit back in'
              : canCancelSitOutNext
                ? 'You will keep playing after this hand'
                : 'Skip the next hand(s) — sit back in when ready',
            onSitOut: () => send({ type: 'sit_out', tableId, seat: mySeat! }),
            canSitIn,
            sitInLabel,
            onSitIn: () => send({ type: 'sit_in', tableId, seat: mySeat! }),
            canTopUp,
            topUpLabel:
              table && topUpAmount < table.config.buyIn
                ? `Top up ${formatMoneyAmount(topUpAmount)}`
                : 'Top up',
            onTopUp: doTopUp,
            needChips: brokeNoWallet,
            onNeedChips: () => {
              void leaveRoom('/profile');
            },
            canSitAndPlay: isSpectating,
            onSitAndPlay: () => {
              setSpectating(false);
              if (!sitAtFirstOpenSeat()) autoSitSent.current = false;
              else autoSitSent.current = true;
            },
            canAddBot: !isSpectating && botsAllowed && emptySeats > 0,
            onAddBot: () =>
              sendAddBot({
                count: Math.min(Math.max(1, botAddCount), emptySeats),
              }),
            onFillBots: () => sendAddBot({ count: emptySeats }),
            canRemoveBots: !isSpectating && botsAllowed && botSeats > 0,
            onRemoveBots: () => send({ type: 'remove_all_bots', tableId }),
            botGroups: botsAllowed
              ? botGroups.map((g) => ({ id: g.id, name: g.name }))
              : undefined,
            botGroupId,
            onBotGroupChange: botsAllowed ? setBotGroupId : undefined,
          }}
        />
  );

  return (
    <TableShell
      tableColorId={tableColorId}
      onSend={(text) => send({ type: 'chat', tableId, text })}
      onEmoji={(emoji) => send({ type: 'emoji', tableId, emoji })}
      chatOpen={chatOpen}
      onChatOpenChange={setChatOpen}
      actionsExpanded={
        !!isMyTurn ||
        contestOver ||
        canReady ||
        canSitIn ||
        isSpectating ||
        showDockReadyRoster
      }
      actions={actionControls}
      voice={
        <VoiceCallBar
          compact
          inVoice={voice.inVoice}
          state={voice.state}
          muted={voice.muted}
          peers={voice.peers}
          error={voice.error}
          onJoinVoice={voice.joinVoice}
          onLeave={voice.leaveVoice}
          onToggleMute={voice.toggleMute}
        />
      }
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <TableLiveAnnouncer />
        {/* Cohesive play chrome: brand + room tools */}
        <header className="play-chrome-bar">
          <div className="play-table-logo-row">
            <Image
              src="/purple-logo.png"
              alt="POKR"
              width={140}
              height={40}
              className="play-table-logo"
              priority
            />
            {isSpectating && (
              <span className={buttonClass('chrome', 'md', 'cursor-default border-brass/35 bg-brass/15 text-[10px] uppercase tracking-wider text-sidebar hover:border-brass/35 hover:bg-brass/15')}>
                Spec
              </span>
            )}
          </div>

          {narrow ? (
            <div className="play-chrome-rail">
              {inviteCode ? (
                <CopyRoomLink tableId={tableId} inviteCode={inviteCode} compact />
              ) : null}
              <TableSoundMuteButton />
              <HowToPlayHelp />
              <TableOverflowMenu items={mobileOverflowItems} />
            </div>
          ) : (
            <div className="play-chrome-rail">
              {inviteCode ? <CopyRoomLink tableId={tableId} inviteCode={inviteCode} /> : null}
              <span className="play-chrome-divider" aria-hidden />
              <VoiceCallBar
                inVoice={voice.inVoice}
                state={voice.state}
                muted={voice.muted}
                peers={voice.peers}
                error={voice.error}
                onJoinVoice={voice.joinVoice}
                onLeave={voice.leaveVoice}
                onToggleMute={voice.toggleMute}
              />
              <TableSoundMuteButton />
              <HowToPlayHelp />
              <Button type="button" variant="chromeLeave" onClick={() => void leaveRoom()}>
                Leave
              </Button>
            </div>
          )}
        </header>

        {table?.tournament && (
          <div className="mb-2 flex flex-wrap items-center gap-2 px-0.5">
            <StatusChip tone="neutral">
              {table.tournament.mode === 'rounds' ? 'Rounds' : 'Knockout'}
              {table.tournament.frozen ? ' · Completed' : ''}
            </StatusChip>
            {table.tournament.mode === 'rounds' &&
            typeof table.tournament.handLimit === 'number' &&
            table.tournament.handLimit > 0 ? (
              <StatusChip tone="brass" className="tabular-nums">
                {(() => {
                  const limit = table.tournament.handLimit!;
                  const done = Math.max(0, table.tournament.handsPlayed ?? 0);
                  const street = table.street;
                  // Payout already counted this hand; live streets / idle = next or current index.
                  const current =
                    street === 'payout' || street === 'showdown' || table.tournament.frozen
                      ? Math.min(Math.max(done, 1), limit)
                      : Math.min(done + 1, limit);
                  return `Hand ${current}/${limit}`;
                })()}
              </StatusChip>
            ) : null}
            <span className="text-xs text-ink-strong-muted">
              Blinds {table.config.smallBlind}/{table.config.bigBlind}
              {table.tournament.noTopUp ? ' · no rebuy' : ' · top-ups on'}
            </span>
            {contestOver ? (
              <Button
                type="button"
                variant="chromeActive"
                onClick={goToContest}
                className="rounded-full px-3 py-1 text-[10px] font-display font-bold uppercase tracking-wider"
              >
                Contest results
              </Button>
            ) : null}
          </div>
        )}

        {contestOver ? (
          <div className="relative z-40 mx-auto mb-2 w-full max-w-md shrink-0 px-2">
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-sidebar/15 bg-white/95 px-4 py-3 text-center shadow-[0_12px_32px_rgb(29_4_50/0.12)] sm:flex-row sm:justify-between sm:text-left">
              <div className="min-w-0">
                <p className="font-display text-sm font-bold uppercase tracking-wider text-sidebar">
                  Contest complete
                </p>
                <p className="mt-0.5 text-xs text-ink-strong-muted">
                  See placements and prizes on the contest page.
                </p>
              </div>
              <Button
                type="button"
                onClick={goToContest}
                className="min-h-10 shrink-0 px-5 text-xs font-display font-bold uppercase tracking-wide"
              >
                View results
              </Button>
            </div>
          </div>
        ) : null}

        <div className="play-table-stage">
          {!narrow && (
            <StatusChip
              tone={
                contestOver
                  ? 'neutral'
                  : connection === 'open'
                    ? 'positive'
                    : connection === 'connecting'
                      ? 'amber'
                      : 'danger'
              }
              className="pointer-events-none absolute bottom-2 left-2 z-30"
              title={contestOver ? 'Contest completed' : connection}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  contestOver
                    ? 'bg-sidebar/50'
                    : connection === 'open'
                      ? 'bg-felt-neon animate-live-blink'
                      : connection === 'connecting'
                        ? 'bg-amber-300 animate-live-blink'
                        : 'bg-red-400'
                }`}
              />
              <span>
                {contestOver
                  ? 'Completed'
                  : connection === 'open'
                    ? 'Live'
                    : connection === 'connecting'
                      ? 'Reconnecting'
                      : 'Offline'}
              </span>
            </StatusChip>
          )}
          <div className="relative min-h-0 min-w-0 flex-1">
          <div
            className={
              narrow
                ? 'absolute inset-0 overflow-hidden felt-surface'
                : 'absolute inset-0 overflow-hidden felt-surface table-rim shadow-felt rounded-[42%] border-[12px]'
            }
          >
          {stacked && table ? (
            <StackedTableLayout
              table={table}
              priv={priv}
              userId={userId}
              spectating={isSpectating}
              potTotal={potTotal}
              highlightMode={highlightMode}
              winningCards={winningCards}
              canSit={!isSpectating && !isTournament}
              onSit={(seat) => {
                send({
                  type: 'sit',
                  tableId,
                  seat,
                  buyIn: table.config.buyIn,
                });
              }}
            />
          ) : (
            <>
          {!narrow ? (
            <div className="play-table-oval-ring" />
          ) : null}

          <div
            className={`absolute left-1/2 z-20 -translate-x-1/2 -translate-y-1/2 ${
              landscape ? 'top-[14%]' : narrow ? 'top-[7%] scale-90' : 'top-[10%]'
            }`}
          >
            <DealerPotZone
              amount={Math.max(potTotal, table?.pot ?? 0)}
              sidePotCount={table?.sidePots?.length ?? 0}
              dealerName={narrow || landscape ? undefined : dealerPlayer?.name}
              showDealer={showDealerZone}
              landscape={landscape}
            />
          </div>

          <div
            className={`absolute left-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center ${
              landscape ? 'top-[40%]' : narrow ? 'top-[38%]' : 'top-[42%]'
            }`}
          >
            <CommunityBoard
              cards={table?.community ?? []}
              handId={table?.handId}
              cardSize={narrow ? 'sm' : 'md'}
              compact={narrow}
              landscape={landscape}
              highlightMode={highlightMode}
              winningCards={winningCards}
              street={table?.street}
            />
          </div>

          {table?.players.map((p) => {
            const win = winBySeat.get(p.seat);
            return (
              <SeatView
                key={p.seat}
                player={p}
                angle={angles[p.seat] ?? 90}
                isToAct={table.toAct === p.seat}
                isSelf={p.userId === userId}
                isWinner={table.street === 'payout' && !!win}
                winAmount={win?.amount}
                handName={
                  table.street === 'payout' || table.street === 'showdown'
                    ? handNameBySeat.get(p.seat) ?? null
                    : null
                }
                handId={table.handId}
                myCards={p.seat === mySeat ? priv?.holeCards ?? null : null}
                winningCards={highlightMode ? winningCards : null}
                turnEndsAt={table.toAct === p.seat ? table.turnEndsAt : null}
                turnTotalMs={table.config.turnTimeMs}
                canManageBots={!isSpectating && !isTournament}
                spectating={isSpectating}
                compact={narrow}
                landscape={landscape}
                isDealer={table.dealerButton === p.seat}
                showReady={betweenHands && !contestOver && !!p.ready}
                canKick={
                  isHost &&
                  betweenHands &&
                  !isTournament &&
                  !!p.userId &&
                  p.userId !== userId &&
                  p.status !== 'empty' &&
                  !p.ready
                }
                onSit={
                  isTournament
                    ? undefined
                    : () => {
                        if (!table || isSpectating) return;
                        send({
                          type: 'sit',
                          tableId,
                          seat: p.seat,
                          buyIn: table.config.buyIn,
                        });
                      }
                }
                onAddBot={
                  botsAllowed
                    ? () => sendAddBot({ seat: p.seat })
                    : undefined
                }
                onRemoveBot={
                  botsAllowed
                    ? () => send({ type: 'remove_bot', tableId, seat: p.seat })
                    : undefined
                }
                onKick={() => send({ type: 'kick_player', tableId, seat: p.seat })}
              />
            );
          })}
            </>
          )}
          </div>
          </div>

        </div>

      </div>

          {showWinModal && table && (
            <WinHandModal
              youWon={youWon}
              canStartNext={canReady}
              readyCount={readyCount}
              readyTotal={eligiblePlayers.length}
              isReady={myReady}
              readyPlayers={readyRosterPlayers}
              canTopUp={canTopUp}
              canSitOut={canSitOut}
              canSitIn={canSitIn}
              isTournament={isTournament}
              needChips={needChips}
              winners={(() => {
                const bySeat = new Map<
                  number,
                  {
                    seat: number;
                    name: string;
                    amount: number;
                    handName?: string;
                    cards?: string[];
                    isSelf?: boolean;
                  }
                >();
                for (const w of table.winners) {
                  const prev = bySeat.get(w.seat);
                  const cards =
                    table.showdownHands?.find((h) => h.seat === w.seat)?.cards ?? prev?.cards;
                  bySeat.set(w.seat, {
                    seat: w.seat,
                    name: table.players[w.seat]?.name ?? `Seat ${w.seat}`,
                    amount: (prev?.amount ?? 0) + w.amount,
                    handName: w.handName ?? prev?.handName,
                    cards,
                    isSelf: table.players[w.seat]?.userId === userId,
                  });
                }
                return [...bySeat.values()];
              })()}
              onNextHand={() => {
                send({ type: 'set_ready', tableId, ready: !myReady });
              }}
              onTopUp={doTopUp}
              onSitOut={() => {
                if (mySeat === undefined) return;
                send({ type: 'sit_out', tableId, seat: mySeat });
              }}
              onSitIn={() => {
                if (mySeat === undefined) return;
                send({ type: 'sit_in', tableId, seat: mySeat });
              }}
              onNeedChips={() => {
                void leaveRoom('/profile');
              }}
              onDismiss={() => setDismissedWinHandId(table.handId)}
            />
          )}
    </TableShell>
  );
}
