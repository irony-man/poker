import type { LudoColor, LudoSeat, LudoTokenPos } from '@poker/protocol';
import { LUDO_SEAT_COLORS } from '@poker/protocol';

/** 15×15 Ludo board. (0,0) is top-left. Seats clockwise: 0 red, 1 green, 2 yellow, 3 blue. */
export const LUDO_BOARD_SIZE = 15;

export const LUDO_START_SQUARES = [0, 13, 26, 39] as const;
export const LUDO_SAFE_SQUARES = [0, 8, 13, 21, 26, 34, 39, 47] as const;
export const LUDO_SAFE_SQUARE_SET: ReadonlySet<number> = new Set(LUDO_SAFE_SQUARES);

/** Classic piece colors — saturated primary board palette. */
export const LUDO_COLOR_HEX: Record<LudoColor, string> = {
  red: '#E31C23',
  green: '#2E9B3E',
  yellow: '#F5C518',
  blue: '#1A6FDB',
};

/** Start-square arrow direction (points along the track). */
export const LUDO_START_ARROW: Record<LudoSeat, 'right' | 'down' | 'left' | 'up'> = {
  0: 'right',
  1: 'down',
  2: 'left',
  3: 'up',
};

export const LUDO_TOKEN_SRC: Record<LudoColor, string> = {
  red: '/ludo/token-red.svg',
  green: '/ludo/token-green.svg',
  yellow: '/ludo/token-yellow.svg',
  blue: '/ludo/token-blue.svg',
};

export type BoardCell = { row: number; col: number };

export type LudoCellKind =
  | { kind: 'yard'; seat: LudoSeat }
  | { kind: 'track'; index: number; safe: boolean }
  | { kind: 'stretch'; seat: LudoSeat; index: number }
  | { kind: 'home'; seat: LudoSeat }
  | { kind: 'hub' };

/** Main-track cells, index 0–51, clockwise from red’s start. */
export const LUDO_TRACK_CELLS: readonly BoardCell[] = [
  { row: 6, col: 1 },
  { row: 6, col: 2 },
  { row: 6, col: 3 },
  { row: 6, col: 4 },
  { row: 6, col: 5 },
  { row: 5, col: 6 },
  { row: 4, col: 6 },
  { row: 3, col: 6 },
  { row: 2, col: 6 },
  { row: 1, col: 6 },
  { row: 0, col: 6 },
  { row: 0, col: 7 },
  { row: 0, col: 8 },
  { row: 1, col: 8 },
  { row: 2, col: 8 },
  { row: 3, col: 8 },
  { row: 4, col: 8 },
  { row: 5, col: 8 },
  { row: 6, col: 9 },
  { row: 6, col: 10 },
  { row: 6, col: 11 },
  { row: 6, col: 12 },
  { row: 6, col: 13 },
  { row: 6, col: 14 },
  { row: 7, col: 14 },
  { row: 8, col: 14 },
  { row: 8, col: 13 },
  { row: 8, col: 12 },
  { row: 8, col: 11 },
  { row: 8, col: 10 },
  { row: 8, col: 9 },
  { row: 9, col: 8 },
  { row: 10, col: 8 },
  { row: 11, col: 8 },
  { row: 12, col: 8 },
  { row: 13, col: 8 },
  { row: 14, col: 8 },
  { row: 14, col: 7 },
  { row: 14, col: 6 },
  { row: 13, col: 6 },
  { row: 12, col: 6 },
  { row: 11, col: 6 },
  { row: 10, col: 6 },
  { row: 9, col: 6 },
  { row: 8, col: 5 },
  { row: 8, col: 4 },
  { row: 8, col: 3 },
  { row: 8, col: 2 },
  { row: 8, col: 1 },
  { row: 8, col: 0 },
  { row: 7, col: 0 },
  { row: 6, col: 0 },
];

/** Home-column cells toward the center, stretch index 0–4. */
export const LUDO_STRETCH_CELLS: readonly (readonly BoardCell[])[] = [
  [
    { row: 7, col: 1 },
    { row: 7, col: 2 },
    { row: 7, col: 3 },
    { row: 7, col: 4 },
    { row: 7, col: 5 },
  ],
  [
    { row: 1, col: 7 },
    { row: 2, col: 7 },
    { row: 3, col: 7 },
    { row: 4, col: 7 },
    { row: 5, col: 7 },
  ],
  [
    { row: 7, col: 13 },
    { row: 7, col: 12 },
    { row: 7, col: 11 },
    { row: 7, col: 10 },
    { row: 7, col: 9 },
  ],
  [
    { row: 13, col: 7 },
    { row: 12, col: 7 },
    { row: 11, col: 7 },
    { row: 10, col: 7 },
    { row: 9, col: 7 },
  ],
];

/** Finished-token rest cell for each seat (colored wedge of the center). */
export const LUDO_HOME_CELLS: readonly BoardCell[] = [
  { row: 7, col: 6 },
  { row: 6, col: 7 },
  { row: 7, col: 8 },
  { row: 8, col: 7 },
];

export const LUDO_HUB_CELL: BoardCell = { row: 7, col: 7 };

/** 2×2 yard parking slots, token index 0–3. */
export const LUDO_YARD_SLOTS: readonly (readonly BoardCell[])[] = [
  [
    { row: 1, col: 1 },
    { row: 1, col: 4 },
    { row: 4, col: 1 },
    { row: 4, col: 4 },
  ],
  [
    { row: 1, col: 10 },
    { row: 1, col: 13 },
    { row: 4, col: 10 },
    { row: 4, col: 13 },
  ],
  [
    { row: 10, col: 10 },
    { row: 10, col: 13 },
    { row: 13, col: 10 },
    { row: 13, col: 13 },
  ],
  [
    { row: 10, col: 1 },
    { row: 10, col: 4 },
    { row: 13, col: 1 },
    { row: 13, col: 4 },
  ],
];

const YARD_BOUNDS: readonly { row0: number; row1: number; col0: number; col1: number }[] = [
  { row0: 0, row1: 5, col0: 0, col1: 5 },
  { row0: 0, row1: 5, col0: 9, col1: 14 },
  { row0: 9, row1: 14, col0: 9, col1: 14 },
  { row0: 9, row1: 14, col0: 0, col1: 5 },
];

const TRACK_INDEX_BY_KEY = new Map<string, number>();
for (let i = 0; i < LUDO_TRACK_CELLS.length; i++) {
  const c = LUDO_TRACK_CELLS[i]!;
  TRACK_INDEX_BY_KEY.set(`${c.row},${c.col}`, i);
}

const STRETCH_BY_KEY = new Map<string, { seat: LudoSeat; index: number }>();
for (let seat = 0; seat < LUDO_STRETCH_CELLS.length; seat++) {
  const cells = LUDO_STRETCH_CELLS[seat]!;
  for (let index = 0; index < cells.length; index++) {
    const c = cells[index]!;
    STRETCH_BY_KEY.set(`${c.row},${c.col}`, { seat: seat as LudoSeat, index });
  }
}

export function ludoColorForSeat(seat: number): LudoColor {
  return LUDO_SEAT_COLORS[seat] ?? 'red';
}

export function ludoHexForSeat(seat: number): string {
  return LUDO_COLOR_HEX[ludoColorForSeat(seat)];
}

export function isLudoSafeTrack(index: number): boolean {
  return LUDO_SAFE_SQUARE_SET.has(index);
}

export function isLudoStartTrack(index: number): boolean {
  return (LUDO_START_SQUARES as readonly number[]).includes(index);
}

export function startSeatForTrack(index: number): LudoSeat | null {
  const seat = (LUDO_START_SQUARES as readonly number[]).indexOf(index);
  return seat >= 0 ? (seat as LudoSeat) : null;
}

/** Outer frame of a 6×6 yard (colored border in the classic board UI). */
export function isLudoYardBorder(row: number, col: number, seat: LudoSeat): boolean {
  const b = YARD_BOUNDS[seat];
  if (!b) return false;
  if (row < b.row0 || row > b.row1 || col < b.col0 || col > b.col1) return false;
  return row === b.row0 || row === b.row1 || col === b.col0 || col === b.col1;
}

export function yardBoundsForSeat(seat: LudoSeat) {
  return YARD_BOUNDS[seat]!;
}

export function cellKey(cell: BoardCell): string {
  return `${cell.row},${cell.col}`;
}

export function cellForLudoToken(
  seat: number,
  pos: LudoTokenPos,
  tokenIndex = 0,
): BoardCell {
  if (pos.kind === 'yard') {
    const slots = LUDO_YARD_SLOTS[seat] ?? LUDO_YARD_SLOTS[0]!;
    return slots[tokenIndex] ?? slots[0]!;
  }
  if (pos.kind === 'track') {
    return LUDO_TRACK_CELLS[pos.index] ?? LUDO_TRACK_CELLS[0]!;
  }
  if (pos.kind === 'stretch') {
    const stretch = LUDO_STRETCH_CELLS[seat] ?? LUDO_STRETCH_CELLS[0]!;
    return stretch[pos.index] ?? stretch[0]!;
  }
  return LUDO_HOME_CELLS[seat] ?? LUDO_HUB_CELL;
}

export function ludoCellKind(row: number, col: number): LudoCellKind | null {
  if (row < 0 || row >= LUDO_BOARD_SIZE || col < 0 || col >= LUDO_BOARD_SIZE) return null;
  const key = `${row},${col}`;
  if (row === LUDO_HUB_CELL.row && col === LUDO_HUB_CELL.col) return { kind: 'hub' };
  for (let seat = 0; seat < LUDO_HOME_CELLS.length; seat++) {
    const home = LUDO_HOME_CELLS[seat]!;
    if (home.row === row && home.col === col) {
      return { kind: 'home', seat: seat as LudoSeat };
    }
  }
  const stretch = STRETCH_BY_KEY.get(key);
  if (stretch) return { kind: 'stretch', seat: stretch.seat, index: stretch.index };
  const trackIndex = TRACK_INDEX_BY_KEY.get(key);
  if (trackIndex !== undefined) {
    return { kind: 'track', index: trackIndex, safe: isLudoSafeTrack(trackIndex) };
  }
  for (let seat = 0; seat < YARD_BOUNDS.length; seat++) {
    const b = YARD_BOUNDS[seat]!;
    if (row >= b.row0 && row <= b.row1 && col >= b.col0 && col <= b.col1) {
      return { kind: 'yard', seat: seat as LudoSeat };
    }
  }
  return null;
}

export function describeLudoPos(pos: LudoTokenPos): string {
  if (pos.kind === 'yard') return 'yard';
  if (pos.kind === 'track') return `track ${pos.index}`;
  if (pos.kind === 'stretch') return `home column ${pos.index + 1}`;
  return 'home';
}

export function sameLudoPos(a: LudoTokenPos, b: LudoTokenPos): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'track' && b.kind === 'track') return a.index === b.index;
  if (a.kind === 'stretch' && b.kind === 'stretch') return a.index === b.index;
  return true;
}

const TRACK_LEN = 52;
const MAIN_MAX_PROGRESS = 51;
const HOME_STRETCH_LEN = 5;
const HOME_PROGRESS = MAIN_MAX_PROGRESS + 1 + HOME_STRETCH_LEN;

export function ludoTokenProgress(seat: number, pos: LudoTokenPos): number {
  switch (pos.kind) {
    case 'yard':
      return -1;
    case 'track':
      return (pos.index - LUDO_START_SQUARES[seat]! + TRACK_LEN) % TRACK_LEN;
    case 'stretch':
      return MAIN_MAX_PROGRESS + 1 + pos.index;
    case 'home':
      return HOME_PROGRESS;
  }
}

export function ludoPosFromProgress(seat: number, progress: number): LudoTokenPos {
  if (progress < 0) return { kind: 'yard' };
  if (progress <= MAIN_MAX_PROGRESS) {
    return { kind: 'track', index: (LUDO_START_SQUARES[seat]! + progress) % TRACK_LEN };
  }
  const stretch = progress - (MAIN_MAX_PROGRESS + 1);
  if (stretch < HOME_STRETCH_LEN) return { kind: 'stretch', index: stretch };
  return { kind: 'home' };
}

/** Cells a token visits from `from` to `to`, including the destination (not the start). */
export function cellsAlongMove(
  seat: number,
  from: LudoTokenPos,
  to: LudoTokenPos,
  tokenIndex = 0,
): BoardCell[] {
  if (sameLudoPos(from, to)) return [];

  if (to.kind === 'yard' && from.kind !== 'yard') {
    return [cellForLudoToken(seat, to, tokenIndex)];
  }

  const start = ludoTokenProgress(seat, from);
  const end = ludoTokenProgress(seat, to);
  const cells: BoardCell[] = [];

  if (start < 0 && end >= 0) {
    cells.push(cellForLudoToken(seat, ludoPosFromProgress(seat, 0), tokenIndex));
    for (let p = 1; p <= end; p++) {
      cells.push(cellForLudoToken(seat, ludoPosFromProgress(seat, p), tokenIndex));
    }
    return cells;
  }

  if (end > start) {
    for (let p = start + 1; p <= end; p++) {
      cells.push(cellForLudoToken(seat, ludoPosFromProgress(seat, p), tokenIndex));
    }
  }
  return cells;
}
