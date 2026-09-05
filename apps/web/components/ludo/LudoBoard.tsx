'use client';

import type { LudoLegalMove, LudoPlayerView, LudoToken } from '@poker/protocol';
import {
  LUDO_BOARD_SIZE,
  cellForLudoToken,
  cellKey,
  describeLudoPos,
  ludoCellKind,
  ludoColorForSeat,
  ludoHexForSeat,
} from '@/lib/ludoBoard';

type PlacedToken = {
  seat: number;
  token: LudoToken;
  legal: boolean;
  mine: boolean;
};

export function LudoBoard({
  seats,
  legalMoves,
  mySeat,
  disabled,
  onMove,
}: {
  seats: LudoPlayerView[];
  legalMoves: LudoLegalMove[];
  mySeat: number | null;
  disabled?: boolean;
  onMove: (tokenIndex: number) => void;
}) {
  const legalSet = new Set(legalMoves.map((m) => m.tokenIndex));
  const byCell = new Map<string, PlacedToken[]>();

  for (const player of seats) {
    if (!player.userId && !player.isBot && player.tokens.length === 0) continue;
    for (const token of player.tokens) {
      const cell = cellForLudoToken(player.seat, token.pos, token.index);
      const key = cellKey(cell);
      const list = byCell.get(key) ?? [];
      const mine = mySeat === player.seat;
      list.push({
        seat: player.seat,
        token,
        legal: mine && legalSet.has(token.index),
        mine,
      });
      byCell.set(key, list);
    }
  }

  const cells: { row: number; col: number }[] = [];
  for (let row = 0; row < LUDO_BOARD_SIZE; row++) {
    for (let col = 0; col < LUDO_BOARD_SIZE; col++) {
      cells.push({ row, col });
    }
  }

  return (
    <div
      className="mx-auto aspect-square w-full max-w-[min(100%,36rem)] rounded-xl border border-on-chrome/15 bg-ink-raised p-1.5 shadow-[0_16px_40px_rgb(8_3_14_/_0.45)] sm:p-2"
      role="grid"
      aria-label="Ludo board"
    >
      <div
        className="grid h-full w-full gap-px rounded-lg bg-ink/80 p-px"
        style={{
          gridTemplateColumns: `repeat(${LUDO_BOARD_SIZE}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${LUDO_BOARD_SIZE}, minmax(0, 1fr))`,
        }}
      >
        {cells.map(({ row, col }) => {
          const tokens = byCell.get(`${row},${col}`) ?? [];
          return (
            <BoardCell
              key={`${row}-${col}`}
              row={row}
              col={col}
              tokens={tokens}
              disabled={disabled}
              onMove={onMove}
            />
          );
        })}
      </div>
    </div>
  );
}

function BoardCell({
  row,
  col,
  tokens,
  disabled,
  onMove,
}: {
  row: number;
  col: number;
  tokens: PlacedToken[];
  disabled?: boolean;
  onMove: (tokenIndex: number) => void;
}) {
  const kind = ludoCellKind(row, col);
  const bg = cellBackground(kind);
  const showStar = kind?.kind === 'track' && kind.safe;

  return (
    <div
      className="relative min-h-0 min-w-0 overflow-hidden"
      style={{ backgroundColor: bg }}
      role="gridcell"
      aria-label={`Row ${row + 1}, column ${col + 1}`}
    >
      {showStar ? (
        <span
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-[0.55rem] leading-none text-ink/45 sm:text-[0.7rem]"
          aria-hidden
        >
          ★
        </span>
      ) : null}
      {tokens.length > 0 ? (
        <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-px p-px">
          {tokens.map((placed) => {
            const color = ludoColorForSeat(placed.seat);
            const hex = ludoHexForSeat(placed.seat);
            const label = `${color} token ${placed.token.index + 1}, ${describeLudoPos(placed.token.pos)}`;
            const canTap = placed.legal && !disabled;
            return (
              <button
                key={`${placed.seat}-${placed.token.index}`}
                type="button"
                disabled={!canTap}
                onClick={() => {
                  if (canTap) onMove(placed.token.index);
                }}
                aria-label={canTap ? `Move ${label}` : label}
                className={`relative flex h-[78%] max-h-5 w-[78%] max-w-5 items-center justify-center rounded-full border-2 border-white/90 shadow-[0_1px_3px_rgb(0_0_0_/_0.45)] ${
                  canTap
                    ? 'z-10 scale-110 ring-2 ring-brass ring-offset-1 ring-offset-ink animate-pulse cursor-pointer'
                    : 'cursor-default'
                } disabled:opacity-100`}
                style={{ backgroundColor: hex }}
              >
                <span className="sr-only">{label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function cellBackground(kind: ReturnType<typeof ludoCellKind>): string {
  if (!kind) return '#2A1238';
  if (kind.kind === 'hub') return '#1D0432';
  if (kind.kind === 'yard' || kind.kind === 'stretch' || kind.kind === 'home') {
    return mixHex(ludoHexForSeat(kind.seat), kind.kind === 'yard' ? 0.55 : 0.82);
  }
  if (kind.kind === 'track') {
    return kind.safe ? '#F2EAE8' : '#E6D9D7';
  }
  return '#2A1238';
}

function mixHex(hex: string, amount: number): string {
  const n = hex.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  const mix = (c: number) => Math.round(c * amount + 242 * (1 - amount));
  const to = (c: number) => c.toString(16).padStart(2, '0');
  return `#${to(mix(r))}${to(mix(g))}${to(mix(b))}`;
}
