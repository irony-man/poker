'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { LudoLegalMove, LudoPlayerView, LudoSeat, LudoToken, LudoTokenPos } from '@poker/protocol';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { assetUrl } from '@/lib/assets';
import {
  LUDO_BOARD_SIZE,
  LUDO_COLOR_HEX,
  LUDO_START_ARROW,
  LUDO_TOKEN_SRC,
  LUDO_YARD_SLOTS,
  cellForLudoToken,
  cellsAlongMove,
  describeLudoPos,
  isLudoStartTrack,
  ludoCellKind,
  ludoColorForSeat,
  ludoHexForSeat,
  sameLudoPos,
  startSeatForTrack,
  yardBoundsForSeat,
  type BoardCell,
} from '@/lib/ludoBoard';
import { LudoDice3D } from './LudoDice3D';

export type LudoSeatSide = {
  label: string;
  userId?: string | null;
  avatarId?: number;
  avatarUrl?: string | null;
  die?: number | null;
  rolling?: boolean;
  canRoll?: boolean;
};

type DisplayPiece = {
  key: string;
  seat: number;
  token: LudoToken;
  cell: { row: number; col: number };
  lift: number;
};

type HopJob = {
  key: string;
  seat: number;
  tokenIndex: number;
  path: BoardCell[];
};

const HOP_MS = 140;

function tokenKey(seat: number, index: number): string {
  return `${seat}:${index}`;
}

function cellCenterPct(cell: BoardCell): { left: number; top: number } {
  return {
    left: ((cell.col + 0.5) / LUDO_BOARD_SIZE) * 100,
    top: ((cell.row + 0.5) / LUDO_BOARD_SIZE) * 100,
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function snapshotTokens(seats: LudoPlayerView[]): Map<string, LudoTokenPos> {
  const map = new Map<string, LudoTokenPos>();
  for (const player of seats) {
    for (const token of player.tokens) {
      map.set(tokenKey(player.seat, token.index), token.pos);
    }
  }
  return map;
}

export function LudoBoard({
  seats,
  legalMoves,
  mySeat,
  disabled,
  onMove,
  seatSides,
  toActSeat = null,
  onRoll,
}: {
  seats: LudoPlayerView[];
  legalMoves: LudoLegalMove[];
  mySeat: number | null;
  disabled?: boolean;
  onMove: (tokenIndex: number) => void;
  seatSides?: Partial<Record<number, LudoSeatSide>>;
  toActSeat?: number | null;
  onRoll?: () => void;
}) {
  const legalSet = new Set(legalMoves.map((m) => m.tokenIndex));
  const prevPos = useRef<Map<string, LudoTokenPos>>(new Map());
  const displayPos = useRef<Map<string, LudoTokenPos>>(snapshotTokens(seats));
  const [hopping, setHopping] = useState(false);
  const [pieces, setPieces] = useState<DisplayPiece[]>(() => piecesFromSeats(seats, legalSet, mySeat));
  const boardSig = useMemo(
    () =>
      seats
        .map((s) => {
          const tokens = s.tokens
            .map((t) =>
              t.pos.kind === 'track' || t.pos.kind === 'stretch'
                ? `${t.index}:${t.pos.kind}:${t.pos.index}`
                : `${t.index}:${t.pos.kind}`,
            )
            .join(',');
          return `${s.seat}:${s.userId ?? ''}:${s.isBot ? 1 : 0}:${tokens}`;
        })
        .join('|'),
    [seats],
  );

  useEffect(() => {
    const next = snapshotTokens(seats);
    const prev = prevPos.current.size ? prevPos.current : displayPos.current;
    const movers: HopJob[] = [];
    const captures: HopJob[] = [];

    for (const [key, to] of next) {
      const from = prev.get(key);
      if (!from || sameLudoPos(from, to)) continue;
      const [seatStr, idxStr] = key.split(':');
      const seat = Number(seatStr);
      const tokenIndex = Number(idxStr);
      const path = cellsAlongMove(seat, from, to, tokenIndex);
      if (path.length === 0) continue;
      const job = { key, seat, tokenIndex, path };
      if (to.kind === 'yard' && from.kind !== 'yard') captures.push(job);
      else movers.push(job);
    }

    prevPos.current = next;

    const jobs = [...movers, ...captures];
    if (jobs.length === 0 || prefersReducedMotion()) {
      displayPos.current = next;
      setPieces(piecesFromSeats(seats, legalSet, mySeat));
      setHopping(false);
      return;
    }

    let cancelled = false;
    setHopping(true);
    setPieces(piecesFromDisplay(seats, displayPos.current, {}, legalSet, mySeat));

    const run = async () => {
      const working = new Map(displayPos.current);
      for (const job of jobs) {
        if (cancelled) return;
        const fromPos = working.get(job.key);
        const startCell = fromPos
          ? cellForLudoToken(job.seat, fromPos, job.tokenIndex)
          : job.path[0]!;
        const fullPath = [startCell, ...job.path];
        for (let i = 1; i < fullPath.length; i++) {
          if (cancelled) return;
          await hopStep(fullPath[i - 1]!, fullPath[i]!, job, (cell, lift) => {
            setPieces((curr) =>
              curr.map((p) => (p.key === job.key ? { ...p, cell, lift } : p)),
            );
          }, () => cancelled);
        }
        working.set(job.key, next.get(job.key)!);
        displayPos.current = new Map(working);
        setPieces(piecesFromDisplay(seats, working, {}, legalSet, mySeat));
      }
      if (cancelled) return;
      displayPos.current = next;
      setPieces(piecesFromSeats(seats, legalSet, mySeat));
      setHopping(false);
    };

    void run();
    return () => {
      cancelled = true;
    };
    // legalSet is a new Set each render; hops only depend on token positions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardSig]);

  const overlayTokens = useMemo(() => {
    const groups = new Map<string, DisplayPiece[]>();
    for (const piece of pieces) {
      const key = `${Math.round(piece.cell.row)},${Math.round(piece.cell.col)}`;
      const list = groups.get(key) ?? [];
      list.push(piece);
      groups.set(key, list);
    }
    const list: Array<DisplayPiece & { stackIndex: number; stackN: number; legal: boolean }> = [];
    for (const group of groups.values()) {
      group.forEach((piece, stackIndex) => {
        const mine = mySeat === piece.seat;
        list.push({
          ...piece,
          stackIndex,
          stackN: group.length,
          legal: mine && legalSet.has(piece.token.index),
        });
      });
    }
    return list;
  }, [pieces, legalSet, mySeat]);

  const cells: { row: number; col: number }[] = [];
  for (let row = 0; row < LUDO_BOARD_SIZE; row++) {
    for (let col = 0; col < LUDO_BOARD_SIZE; col++) {
      cells.push({ row, col });
    }
  }

  const busy = hopping || disabled;

  return (
    <div className="relative mx-auto w-full max-w-[min(100%,36rem)] px-1 pt-14 pb-14 sm:pt-16 sm:pb-16">
      <div
        className="absolute inset-0 -z-10 overflow-hidden rounded-xl"
        aria-hidden
        style={{
          backgroundColor: '#0a1630',
          backgroundImage: `repeating-linear-gradient(45deg, rgb(26 80 180 / 0.18) 0 18px, transparent 18px 36px),
            repeating-linear-gradient(-45deg, rgb(20 50 120 / 0.16) 0 22px, transparent 22px 44px)`,
        }}
      />
      <div
        className="relative aspect-square w-full overflow-hidden rounded-md border-[3px] border-neutral-900 bg-white shadow-[0_12px_32px_rgb(0_0_0_/_0.28)]"
        role="grid"
        aria-label="Ludo board"
      >
        {([0, 1, 2, 3] as LudoSeat[]).map((seat) => (
          <YardBase key={`yard-${seat}`} seat={seat} toAct={toActSeat === seat} />
        ))}

        <div
          className="relative z-[1] grid h-full w-full"
          style={{
            gridTemplateColumns: `repeat(${LUDO_BOARD_SIZE}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${LUDO_BOARD_SIZE}, minmax(0, 1fr))`,
          }}
        >
          <svg
            className="pointer-events-none z-0 h-full w-full"
            style={{ gridColumn: '7 / 10', gridRow: '7 / 10' }}
            viewBox="0 0 3 3"
            preserveAspectRatio="none"
            aria-hidden
          >
            <polygon points="0,0 1.5,1.5 0,3" fill={LUDO_COLOR_HEX.red} />
            <polygon points="0,0 3,0 1.5,1.5" fill={LUDO_COLOR_HEX.green} />
            <polygon points="3,0 3,3 1.5,1.5" fill={LUDO_COLOR_HEX.yellow} />
            <polygon points="0,3 1.5,1.5 3,3" fill={LUDO_COLOR_HEX.blue} />
            <line x1="0" y1="0" x2="3" y2="3" stroke="#111" strokeWidth="0.04" />
            <line x1="3" y1="0" x2="0" y2="3" stroke="#111" strokeWidth="0.04" />
            <rect x="0" y="0" width="3" height="3" fill="none" stroke="#111" strokeWidth="0.08" />
          </svg>
          {cells.map(({ row, col }) => (
            <BoardCell key={`${row}-${col}`} row={row} col={col} />
          ))}
        </div>

        <div className="pointer-events-none absolute inset-0 z-10">
          {overlayTokens.map((placed) => (
            <TokenPin
              key={`${placed.seat}-${placed.token.index}`}
              placed={placed}
              disabled={busy}
              onMove={onMove}
            />
          ))}
        </div>
      </div>

      {([0, 1, 2, 3] as LudoSeat[]).map((seat) => {
        const side = seatSides?.[seat];
        if (!side) return null;
        return (
          <SeatTray
            key={`tray-${seat}`}
            seat={seat}
            side={side}
            toAct={toActSeat === seat}
            onRoll={onRoll}
          />
        );
      })}
    </div>
  );
}

function piecesFromSeats(
  seats: LudoPlayerView[],
  legalSet: Set<number>,
  mySeat: number | null,
): DisplayPiece[] {
  const map = snapshotTokens(seats);
  return piecesFromDisplay(seats, map, {}, legalSet, mySeat);
}

function piecesFromDisplay(
  seats: LudoPlayerView[],
  posByKey: Map<string, LudoTokenPos>,
  lifts: Record<string, number>,
  _legalSet: Set<number>,
  _mySeat: number | null,
): DisplayPiece[] {
  const out: DisplayPiece[] = [];
  for (const player of seats) {
    if (!player.userId && !player.isBot && player.tokens.length === 0) continue;
    for (const token of player.tokens) {
      const key = tokenKey(player.seat, token.index);
      const pos = posByKey.get(key) ?? token.pos;
      out.push({
        key,
        seat: player.seat,
        token: { ...token, pos },
        cell: cellForLudoToken(player.seat, pos, token.index),
        lift: lifts[key] ?? 0,
      });
    }
  }
  return out;
}

function hopStep(
  fromCell: BoardCell,
  toCell: BoardCell,
  _job: HopJob,
  onFrame: (cell: { row: number; col: number }, lift: number) => void,
  isCancelled: () => boolean,
): Promise<void> {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const tick = (now: number) => {
      if (isCancelled()) {
        resolve();
        return;
      }
      const t = Math.min(1, (now - t0) / HOP_MS);
      const ease = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      onFrame(
        { row: lerp(fromCell.row, toCell.row, ease), col: lerp(fromCell.col, toCell.col, ease) },
        Math.sin(t * Math.PI),
      );
      if (t < 1) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
}

function TokenPin({
  placed,
  disabled,
  onMove,
}: {
  placed: DisplayPiece & { stackIndex: number; stackN: number; legal: boolean };
  disabled?: boolean;
  onMove: (tokenIndex: number) => void;
}) {
  const color = ludoColorForSeat(placed.seat);
  const src = assetUrl(LUDO_TOKEN_SRC[color]);
  const label = `${color} token ${placed.token.index + 1}, ${describeLudoPos(placed.token.pos)}`;
  const canTap = placed.legal && !disabled;
  const inYard = placed.token.pos.kind === 'yard';
  const { left, top } = cellCenterPct(placed.cell);
  const angle = placed.stackN > 1 ? (placed.stackIndex * 2 * Math.PI) / placed.stackN : 0;
  const ox = placed.stackN > 1 ? Math.cos(angle) * 1.1 : 0;
  const oy = placed.stackN > 1 ? Math.sin(angle) * 1.1 : 0;
  const liftPx = placed.lift * 14;

  return (
    <button
      type="button"
      disabled={!canTap}
      onClick={() => {
        if (canTap) onMove(placed.token.index);
      }}
      aria-label={canTap ? `Move ${label}` : label}
      className={`pointer-events-auto absolute flex items-center justify-center ${
        canTap ? 'z-20 cursor-pointer' : 'cursor-default'
      } disabled:opacity-100`}
      style={{
        left: `calc(${left}% + ${ox}%)`,
        top: `calc(${top}% + ${oy}%)`,
        width: inYard ? '7.2%' : '6.6%',
        height: inYard ? '7.2%' : '6.6%',
        transform: `translate(-50%, calc(-58% - ${liftPx}px))${canTap ? ' scale(1.08)' : ''}`,
      }}
    >
      <span
        className="pointer-events-none absolute bottom-[8%] left-1/2 h-[22%] w-[55%] -translate-x-1/2 rounded-full bg-black/35 blur-[2px]"
        aria-hidden
      />
      {canTap ? (
        <span
          className="pointer-events-none absolute inset-[-18%] animate-pulse rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.55)_0%,rgba(160,210,255,0.35)_45%,transparent_70%)]"
          aria-hidden
        />
      ) : null}
      <Image
        src={src}
        alt=""
        width={40}
        height={40}
        unoptimized
        className="relative h-full w-full object-contain"
        aria-hidden
      />
      <span className="sr-only">{label}</span>
    </button>
  );
}

const TRAY_CORNER: Record<LudoSeat, string> = {
  0: 'left-1 top-1',
  1: 'right-1 top-1',
  2: 'right-1 bottom-1',
  3: 'left-1 bottom-1',
};

function SeatTray({
  seat,
  side,
  toAct,
  onRoll,
}: {
  seat: LudoSeat;
  side: LudoSeatSide;
  toAct: boolean;
  onRoll?: () => void;
}) {
  const top = seat <= 1;

  return (
    <div className={`absolute z-30 flex flex-col items-center gap-0.5 ${TRAY_CORNER[seat]}`}>
      {top ? (
        <span className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-white drop-shadow-[0_1px_2px_rgb(0_0_0_/_0.75)] sm:text-xs">
          {side.label}
        </span>
      ) : null}
      <div
        className={`flex items-center gap-0.5 rounded-md border-[2.5px] bg-[#f7e4df] p-0.5 ${
          toAct ? 'animate-live-blink border-[#F1C40F] shadow-[0_0_12px_#F1C40F]' : 'border-[#e6c36a]'
        }`}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-white/80 sm:h-12 sm:w-12">
          <PlayerAvatar
            userId={side.userId}
            avatarId={side.avatarId}
            avatarUrl={side.avatarUrl}
            size={36}
            title={side.label}
          />
        </span>
        <LudoDice3D
          compact
          value={side.rolling ? null : (side.die ?? null)}
          rolling={Boolean(side.rolling)}
          interactive={Boolean(side.canRoll && onRoll)}
          onRoll={side.canRoll ? onRoll : undefined}
        />
      </div>
      {!top ? (
        <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-900 sm:text-xs">
          {side.label}
        </span>
      ) : null}
    </div>
  );
}

function YardBase({ seat, toAct }: { seat: LudoSeat; toAct: boolean }) {
  const b = yardBoundsForSeat(seat);
  const hex = ludoHexForSeat(seat);
  const slots = LUDO_YARD_SLOTS[seat] ?? LUDO_YARD_SLOTS[0]!;
  const span = b.col1 - b.col0 + 1;

  return (
    <div
      className={`pointer-events-none absolute z-0 ${toAct ? 'animate-pulse' : ''}`}
      style={{
        top: `${(b.row0 / LUDO_BOARD_SIZE) * 100}%`,
        left: `${(b.col0 / LUDO_BOARD_SIZE) * 100}%`,
        width: `${(span / LUDO_BOARD_SIZE) * 100}%`,
        height: `${((b.row1 - b.row0 + 1) / LUDO_BOARD_SIZE) * 100}%`,
        backgroundColor: hex,
        boxShadow: toAct ? `inset 0 0 0 3px #fff, 0 0 0 2px ${hex}` : undefined,
      }}
      aria-hidden
    >
      <div className="absolute inset-[10%] rounded-[14%] bg-white shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)]" />
      {slots.map((slot, i) => {
        const left = ((slot.col - b.col0 + 0.5) / span) * 100;
        const top = ((slot.row - b.row0 + 0.5) / span) * 100;
        const size = (1.2 / span) * 100;
        return (
          <span
            key={i}
            className="absolute rounded-full border-[2.5px] bg-white sm:border-[3px]"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: `${size}%`,
              height: `${size}%`,
              borderColor: hex,
              transform: 'translate(-50%, -50%)',
            }}
          />
        );
      })}
    </div>
  );
}

function BoardCell({ row, col }: { row: number; col: number }) {
  const kind = ludoCellKind(row, col);
  const style = cellStyle(kind, row, col);
  const startSeat = kind?.kind === 'track' ? startSeatForTrack(kind.index) : null;
  const showStar = kind?.kind === 'track' && kind.safe && !isLudoStartTrack(kind.index);

  return (
    <div
      className="relative z-[1] min-h-0 min-w-0 overflow-visible"
      style={{
        ...style,
        gridColumn: col + 1,
        gridRow: row + 1,
      }}
      role="gridcell"
      aria-label={`Row ${row + 1}, column ${col + 1}`}
    >
      {startSeat != null ? <StartArrow seat={startSeat} /> : null}
      {showStar ? (
        <span
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-[0.65rem] leading-none text-neutral-900 sm:text-[0.85rem]"
          aria-hidden
        >
          ★
        </span>
      ) : null}
    </div>
  );
}

function StartArrow({ seat }: { seat: LudoSeat }) {
  const dir = LUDO_START_ARROW[seat];
  const rotate =
    dir === 'right' ? '0deg' : dir === 'down' ? '90deg' : dir === 'left' ? '180deg' : '270deg';
  return (
    <span
      className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center"
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        className="h-[70%] w-[70%]"
        style={{ transform: `rotate(${rotate})` }}
      >
        <path
          d="M5 11h9.5V7.5L19 12l-4.5 4.5V13H5z"
          fill="#fff"
          stroke="#111"
          strokeWidth="1.25"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function cellStyle(
  kind: ReturnType<typeof ludoCellKind>,
  row: number,
  col: number,
): CSSProperties {
  if (!kind) {
    if (row >= 6 && row <= 8 && col >= 6 && col <= 8) {
      return { backgroundColor: 'transparent' };
    }
    return { backgroundColor: '#f5f5f5' };
  }
  if (kind.kind === 'hub' || kind.kind === 'home') return { backgroundColor: 'transparent' };
  if (kind.kind === 'yard') return { backgroundColor: 'transparent' };
  if (kind.kind === 'stretch') {
    return { backgroundColor: ludoHexForSeat(kind.seat), boxShadow: 'inset 0 0 0 1px #111' };
  }
  if (kind.kind === 'track') {
    const start = startSeatForTrack(kind.index);
    return {
      backgroundColor: start != null ? ludoHexForSeat(start) : '#ffffff',
      boxShadow: 'inset 0 0 0 1px #111',
    };
  }
  return { backgroundColor: '#ffffff' };
}
