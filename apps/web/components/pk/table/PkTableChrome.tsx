'use client';

import { useEffect, useState, type ReactNode, type RefObject } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { PlayingCard } from '@/components/PlayingCard';
import { QUICK_REACTIONS } from '@/components/MobileQuickReactions';
import { TableLiveAnnouncer } from '@/components/TableLiveAnnouncer';
import { cardLabel } from '@/lib/pk/cards';
import {
  actionBarModel,
  actionNeedsConfirm,
  clampRaise,
  timerRing,
  type LegalActionSet,
} from '@/lib/pk/actionOptions';
import { seatStatusLabel, heroSeatAngles } from '@/lib/pk/seatStatus';
import { formatMoneyAmount } from '@/lib/currency';
import { useIsLandscapePhone, useIsNarrow } from '@/lib/tableLayout';
import { cn } from '@/lib/cn';
import type { PlayHotkeyHandlers } from '@/lib/useTableHotkeys';
import { PkAvatar, PkBadge, PkChipStack } from '../Bits';
import { PkButton } from '../Button';
import { PkSheet, PkDialog } from '../Overlay';
import { dealDelay, pkMotion } from '../motion';

export type PkSeatModel = {
  seat: number;
  userId: string | null;
  name: string | null;
  stack: number;
  bet: number;
  status: string;
  holeCards: [string, string] | null;
  avatarId?: number | null;
  connected?: boolean;
};

export type PkTableModel = {
  maxSeats: number;
  players: PkSeatModel[];
  community: string[];
  pot: number;
  sidePots: { amount: number }[];
  street: string;
  dealerButton: number | null;
  sbSeat: number | null;
  bbSeat: number | null;
  toAct: number | null;
  heroSeat?: number;
  holeCards: [string, string] | null;
  legal: LegalActionSet | null;
  turnEndsAt: number | null;
  turnTotalMs: number;
  connection: 'idle' | 'connecting' | 'open' | 'closed';
  spectating: boolean;
  lobby: boolean;
  guest: boolean;
  bigBlind: number;
  currentBet: number;
  tableColorId: number;
  layout: 'v1' | 'v2';
};

export function PkTableChrome({
  model,
  title,
  onAction,
  onLeave,
  playHotkeysRef,
  tools,
  chat,
  onChat,
  onEmoji,
  helpOpen,
  onHelp,
  muted,
  onToggleMute,
  voice,
}: {
  model: PkTableModel;
  title: string;
  onAction: (action: string, amount?: number) => void;
  onLeave: () => void;
  playHotkeysRef?: RefObject<PlayHotkeyHandlers | null>;
  tools?: ReactNode;
  chat: { name: string; text: string }[];
  onChat: (text: string) => void;
  onEmoji: (emoji: string) => void;
  helpOpen: boolean;
  onHelp: (open: boolean) => void;
  muted: boolean;
  onToggleMute: () => void;
  voice?: ReactNode;
}) {
  const narrow = useIsNarrow();
  const landscape = useIsLandscapePhone();
  const reduced = useReducedMotion();
  const [chatOpen, setChatOpen] = useState(false);
  const [raiseOpen, setRaiseOpen] = useState(false);
  const angles = heroSeatAngles(model.maxSeats, model.spectating ? undefined : model.heroSeat);
  const reconnecting = model.connection !== 'open';
  const bar = actionBarModel(model.legal, model.pot, model.currentBet, model.bigBlind);
  const myTurn = !reconnecting && model.heroSeat != null && model.toAct === model.heroSeat && bar.types.length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-table-layout={model.layout}>
      <TableLiveAnnouncer />
      <header className="flex items-center justify-between gap-pk-2 px-pk-3 py-pk-2">
        <h1 className="truncate font-pk-display text-pk-h4">{title}</h1>
        <div className="flex items-center gap-pk-2">
          {model.spectating ? <PkBadge>Spectator</PkBadge> : null}
          <PkButton variant="icon" aria-label={muted ? 'Unmute sounds' : 'Mute sounds'} onClick={onToggleMute}>
            {muted ? 'Muted' : 'Sound'}
          </PkButton>
          <PkButton variant="ghost" onClick={() => onHelp(true)}>
            How to play
          </PkButton>
          <PkButton variant="ghost" onClick={() => setChatOpen(true)}>
            Chat
          </PkButton>
          {voice}
          <PkButton variant="danger" onClick={onLeave}>
            Leave
          </PkButton>
        </div>
      </header>
      {reconnecting ? (
        <p role="status" className="mx-pk-3 rounded-pk-md bg-raised px-pk-3 py-pk-2 text-pk-caption">
          Reconnecting… actions are paused until the next sync.
        </p>
      ) : null}
      {model.guest ? (
        <p className="mx-pk-3 mt-pk-2 rounded-pk-md bg-raised px-pk-3 py-pk-2 text-pk-caption">
          You’re watching as a guest. Sign in to sit.
        </p>
      ) : null}
      {model.spectating && !model.guest ? (
        <p className="mx-pk-3 mt-pk-2 text-pk-caption text-muted">Spectating — you are not seated.</p>
      ) : null}
      <div className={cn('relative min-h-0 flex-1', model.layout === 'v1' ? 'pk-classic' : 'pk-stacked')}>
        <div
          className="felt-surface relative mx-auto mt-pk-4 aspect-[16/10] w-full max-w-5xl rounded-[50%] shadow-pk-lg"
          data-table-color={model.tableColorId}
          style={{ background: 'var(--pk-g-felt)' }}
        >
          <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-pk-2">
            <PkChipStack amount={model.pot} label={`Pot ${model.pot}`} />
            {model.sidePots.map((pot, index) => (
              <span key={index} className="text-pk-caption text-on-chrome">
                Side pot {formatMoneyAmount(pot.amount)}
              </span>
            ))}
            <div className="flex gap-pk-1">
              {model.community.map((code, index) => (
                <motion.span
                  key={`${code}-${index}`}
                  initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: reduced ? 0 : dealDelay(index) / 1000, duration: pkMotion.cardFlipMs / 1000 }}
                  aria-label={cardLabel(code)}
                >
                  <PlayingCard code={code} size="board" dealDelay={reduced ? 0 : dealDelay(index) / 1000} />
                </motion.span>
              ))}
            </div>
          </div>
          {model.players.map((player) => (
            <PkSeat
              key={player.seat}
              player={player}
              angle={angles[player.seat] ?? 90}
              dealer={model.dealerButton === player.seat}
              blind={model.sbSeat === player.seat ? 'SB' : model.bbSeat === player.seat ? 'BB' : null}
              acting={model.toAct === player.seat}
            />
          ))}
        </div>
        {model.holeCards ? (
          <div className="mt-pk-3 flex justify-center gap-pk-2" aria-label="Your hole cards">
            {model.holeCards.map((code) => (
              <span key={code} aria-label={cardLabel(code)}>
                <PlayingCard code={code} size="hand" />
              </span>
            ))}
          </div>
        ) : null}
      </div>
      {model.lobby ? (
        <div className="border-t border-subtle/20 p-pk-4">{tools}</div>
      ) : (
        <PkActionBar
          model={model}
          bar={bar}
          enabled={myTurn}
          onAction={onAction}
          raiseOpen={raiseOpen}
          onRaiseOpen={setRaiseOpen}
          narrow={narrow}
          landscape={landscape}
          playHotkeysRef={playHotkeysRef}
          tools={tools}
        />
      )}
      <PkHelp open={helpOpen} onClose={() => onHelp(false)} sheet={narrow || landscape} side={landscape} />
      <PkChat
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        messages={chat}
        onSend={onChat}
        onEmoji={onEmoji}
        sheet={narrow}
      />
    </div>
  );
}

function PkSeat({
  player,
  angle,
  dealer,
  blind,
  acting,
}: {
  player: PkSeatModel;
  angle: number;
  dealer: boolean;
  blind: 'SB' | 'BB' | null;
  acting: boolean;
}) {
  const rad = (angle * Math.PI) / 180;
  const x = 50 + Math.cos(rad) * 42;
  const y = 50 + Math.sin(rad) * 38;
  const status = seatStatusLabel(player);
  const empty = player.status === 'empty' || !player.userId;
  return (
    <div
      className={cn(
        'absolute w-28 -translate-x-1/2 -translate-y-1/2 rounded-pk-lg bg-panel/95 p-pk-2 text-center shadow-pk-sm',
        acting && 'ring-2 ring-ds-chip',
      )}
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      <p className="sr-only">{status}</p>
      {empty ? (
        <p className="text-pk-caption text-muted">Empty</p>
      ) : (
        <>
          <div className="mx-auto flex justify-center">
            <PkAvatar avatarId={player.avatarId} name={player.name ?? 'Player'} size={36} />
          </div>
          <p className="truncate text-pk-caption font-semibold">{player.name}</p>
          <p className="text-pk-caption tabular-nums">{formatMoneyAmount(player.stack)}</p>
          <p className="text-[11px] uppercase tracking-wide text-muted">{status}</p>
        </>
      )}
      <div className="mt-1 flex justify-center gap-1">
        {dealer ? <PkBadge>D</PkBadge> : null}
        {blind ? <PkBadge>{blind}</PkBadge> : null}
      </div>
      {player.bet > 0 ? <PkChipStack amount={player.bet} /> : null}
      {player.holeCards ? (
        <div className="mt-1 flex justify-center gap-0.5">
          {player.holeCards.map((code) => (
            <span key={code} aria-label={cardLabel(code)}>
              <PlayingCard code={code} size="xs" />
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PkActionBar({
  model,
  bar,
  enabled,
  onAction,
  raiseOpen,
  onRaiseOpen,
  narrow,
  landscape,
  playHotkeysRef,
  tools,
}: {
  model: PkTableModel;
  bar: ReturnType<typeof actionBarModel>;
  enabled: boolean;
  onAction: (action: string, amount?: number) => void;
  raiseOpen: boolean;
  onRaiseOpen: (open: boolean) => void;
  narrow: boolean;
  landscape: boolean;
  playHotkeysRef?: RefObject<PlayHotkeyHandlers | null>;
  tools?: ReactNode;
}) {
  const [amount, setAmount] = useState(bar.min);
  const [confirm, setConfirm] = useState<{ action: string; amount?: number; label: string } | null>(null);
  useEffect(() => setAmount(bar.min), [bar.min, model.street]);

  const commit = (action: string, amt?: number, label?: string) => {
    if (!enabled) return;
    if (actionNeedsConfirm(action, amt, bar.callAmount, stackOf(model))) {
      setConfirm({ action, amount: amt, label: label ?? action });
      return;
    }
    onAction(action, amt);
  };

  useEffect(() => {
    if (!playHotkeysRef) return;
    const noop = () => undefined;
    playHotkeysRef.current = {
      confirmOpen: confirm != null,
      fold: enabled && bar.types.includes('fold') ? () => commit('fold', undefined, 'Fold') : noop,
      call: enabled && bar.types.includes('call') ? () => commit('call') : noop,
      check: enabled && bar.types.includes('check') ? () => commit('check') : noop,
      betRaise: enabled && bar.canBet ? () => commit(bar.betAction, clampRaise(amount, bar.min, bar.max, model.bigBlind)) : noop,
      allIn: enabled && bar.types.includes('allin') ? () => commit('allin', undefined, 'All-in') : noop,
    };
  });

  const slider = (
    <RaiseSlider
      min={bar.min}
      max={bar.max}
      bigBlind={model.bigBlind}
      value={amount}
      onChange={setAmount}
      disabled={!enabled}
    />
  );

  return (
    <div className="border-t border-subtle/20 bg-panel p-pk-3">
      <TimerRing endsAt={enabled ? model.turnEndsAt : null} totalMs={model.turnTotalMs} />
      <div className="mt-pk-2 flex flex-wrap items-center justify-center gap-pk-2">
        {bar.types.includes('fold') ? (
          <PkButton variant="danger" disabled={!enabled} onClick={() => commit('fold', undefined, 'Fold')}>
            Fold
          </PkButton>
        ) : null}
        {bar.types.includes('check') ? (
          <PkButton variant="secondary" disabled={!enabled} onClick={() => commit('check')}>
            Check
          </PkButton>
        ) : null}
        {bar.types.includes('call') ? (
          <PkButton disabled={!enabled} onClick={() => commit('call')}>
            Call {formatMoneyAmount(bar.callAmount)}
          </PkButton>
        ) : null}
        {bar.canBet ? (
          narrow && !landscape ? (
            <PkButton disabled={!enabled} onClick={() => onRaiseOpen(true)}>
              {bar.betLabel}
            </PkButton>
          ) : (
            <PkButton
              disabled={!enabled}
              onClick={() => commit(bar.betAction, clampRaise(amount, bar.min, bar.max, model.bigBlind), bar.betLabel)}
            >
              {bar.betLabel} {formatMoneyAmount(clampRaise(amount, bar.min, bar.max, model.bigBlind))}
            </PkButton>
          )
        ) : null}
        {bar.types.includes('allin') ? (
          <PkButton variant="secondary" disabled={!enabled} onClick={() => commit('allin', undefined, 'All-in')}>
            All-in
          </PkButton>
        ) : null}
      </div>
      {bar.canBet && !(narrow && !landscape) ? <div className="mx-auto mt-pk-3 max-w-md">{slider}</div> : null}
      {tools ? <div className="mt-pk-3">{tools}</div> : null}
      <PkSheet open={raiseOpen} title={bar.betLabel} onClose={() => onRaiseOpen(false)} side={landscape}>
        {slider}
        <div className="mt-pk-3 flex gap-pk-2">
          <PkButton variant="ghost" onClick={() => setAmount(bar.halfPot)}>
            Half pot
          </PkButton>
          <PkButton variant="ghost" onClick={() => setAmount(bar.potBet)}>
            Pot
          </PkButton>
          <PkButton
            onClick={() => {
              commit(bar.betAction, clampRaise(amount, bar.min, bar.max, model.bigBlind));
              onRaiseOpen(false);
            }}
          >
            {bar.betLabel}
          </PkButton>
        </div>
      </PkSheet>
      <PkDialog open={confirm != null} title="Confirm" onClose={() => setConfirm(null)}>
        <p className="text-pk-body-md">{confirm?.label}</p>
        <div className="mt-pk-4 flex justify-end gap-pk-2">
          <PkButton variant="ghost" onClick={() => setConfirm(null)}>
            Cancel
          </PkButton>
          <PkButton
            onClick={() => {
              if (confirm) onAction(confirm.action, confirm.amount);
              setConfirm(null);
            }}
          >
            Confirm
          </PkButton>
        </div>
      </PkDialog>
    </div>
  );
}

function stackOf(model: PkTableModel): number {
  if (model.heroSeat == null) return 0;
  return model.players.find((player) => player.seat === model.heroSeat)?.stack ?? 0;
}

function RaiseSlider({
  min,
  max,
  bigBlind,
  value,
  onChange,
  disabled,
}: {
  min: number;
  max: number;
  bigBlind: number;
  value: number;
  onChange: (next: number) => void;
  disabled?: boolean;
}) {
  const shown = clampRaise(value, min, max, bigBlind);
  return (
    <label className="flex flex-col gap-pk-2 text-pk-caption">
      <span className="tabular-nums">{formatMoneyAmount(shown)}</span>
      <input
        type="range"
        min={min}
        max={Math.max(min, max)}
        step={Math.max(1, bigBlind)}
        value={shown}
        disabled={disabled}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={shown}
        onChange={(event) => onChange(clampRaise(Number(event.target.value), min, max, bigBlind))}
        onKeyDown={(event) => {
          const page = bigBlind * 5;
          const step = event.key === 'PageUp' || event.key === 'PageDown' ? page : bigBlind;
          if (event.key === 'ArrowUp' || event.key === 'ArrowRight' || event.key === 'PageUp') {
            event.preventDefault();
            onChange(clampRaise(shown + step, min, max, bigBlind));
          }
          if (event.key === 'ArrowDown' || event.key === 'ArrowLeft' || event.key === 'PageDown') {
            event.preventDefault();
            onChange(clampRaise(shown - step, min, max, bigBlind));
          }
        }}
      />
    </label>
  );
}

function TimerRing({ endsAt, totalMs }: { endsAt: number | null; totalMs: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [endsAt]);
  const ring = timerRing(now, endsAt, totalMs);
  if (!endsAt || ring.remainingMs <= 0) return null;
  const r = 16;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex items-center justify-center gap-pk-2" aria-label={`Time left ${Math.ceil(ring.remainingMs / 1000)} seconds`}>
      <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden>
        <circle cx="20" cy="20" r={r} fill="none" stroke="rgb(var(--border-subtle))" strokeWidth="3" />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke={ring.warning ? 'rgb(var(--danger))' : 'rgb(var(--positive))'}
          strokeWidth="3"
          strokeDasharray={`${c * ring.fraction} ${c}`}
          transform="rotate(-90 20 20)"
        />
      </svg>
      <span className={cn('tabular-nums text-pk-label', ring.warning && 'text-danger')}>
        {Math.ceil(ring.remainingMs / 1000)}s
      </span>
    </div>
  );
}

const HELP = [
  { title: 'Goal', body: 'Best five-card hand using your two hole cards and the board wins the pot.' },
  { title: 'Streets', body: 'Blinds, then preflop, flop, turn, and river.' },
  { title: 'Actions', body: 'Fold, check, call, bet, raise, or all-in. The slider snaps to the big blind.' },
];

function PkHelp({
  open,
  onClose,
  sheet,
  side,
}: {
  open: boolean;
  onClose: () => void;
  sheet: boolean;
  side: boolean;
}) {
  const body = (
    <ul className="flex flex-col gap-pk-3">
      {HELP.map((tip) => (
        <li key={tip.title}>
          <h3 className="font-pk-display text-pk-h4">{tip.title}</h3>
          <p className="text-pk-body-md text-muted">{tip.body}</p>
        </li>
      ))}
    </ul>
  );
  if (sheet) return <PkSheet open={open} title="How to play" onClose={onClose} side={side}>{body}</PkSheet>;
  return <PkDialog open={open} title="How to play" onClose={onClose}>{body}</PkDialog>;
}

function PkChat({
  open,
  onClose,
  messages,
  onSend,
  onEmoji,
  sheet,
}: {
  open: boolean;
  onClose: () => void;
  messages: { name: string; text: string }[];
  onSend: (text: string) => void;
  onEmoji: (emoji: string) => void;
  sheet: boolean;
}) {
  const [text, setText] = useState('');
  const body = (
    <div className="flex flex-col gap-pk-3">
      <ul className="max-h-48 space-y-pk-2 overflow-auto" aria-live="polite">
        {messages.slice(-12).map((message, index) => (
          <li key={index} className="text-pk-caption">
            <span className="font-semibold">{message.name}: </span>
            {message.text}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-1">
        {QUICK_REACTIONS.slice(0, 8).map((emoji) => (
          <PkButton key={emoji} variant="icon" aria-label={`React ${emoji}`} onClick={() => onEmoji(emoji)}>
            {emoji}
          </PkButton>
        ))}
      </div>
      <form
        className="flex gap-pk-2"
        onSubmit={(event) => {
          event.preventDefault();
          const next = text.trim();
          if (!next) return;
          onSend(next);
          setText('');
        }}
      >
        <input
          className="min-h-11 flex-1 rounded-pk-md border border-subtle/30 bg-raised px-pk-3"
          value={text}
          onChange={(event) => setText(event.target.value)}
          aria-label="Message the table"
          placeholder="Message the table…"
        />
        <PkButton type="submit">Send</PkButton>
      </form>
    </div>
  );
  if (sheet) return <PkSheet open={open} title="Chat" onClose={onClose}>{body}</PkSheet>;
  return <PkDialog open={open} title="Chat" onClose={onClose}>{body}</PkDialog>;
}
