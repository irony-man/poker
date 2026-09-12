import type { LudoColor } from '@poker/protocol';
import { ludoColorForSeat, ludoHexForSeat } from '@/lib/ludoBoard';

/** Classic snakes & ladders teleports: from → to (mirrors @poker/snakes-engine). */
export const SNAKES_TELEPORTS: Readonly<Record<number, number>> = {
  // ladders
  4: 14,
  9: 31,
  20: 38,
  28: 84,
  40: 59,
  51: 67,
  63: 81,
  71: 91,
  // snakes
  17: 7,
  54: 34,
  62: 19,
  64: 60,
  87: 24,
  93: 73,
  95: 75,
  99: 78,
};

/** Same seat palette as Ludo (red / green / yellow / blue by seat index). */
export function snakesColorForSeat(seat: number): LudoColor {
  return ludoColorForSeat(seat);
}

export function snakesHexForSeat(seat: number): string {
  return ludoHexForSeat(seat);
}

/** Zigzag board: row 0 (bottom) left→right 1–10, row 1 right→left 11–20, … */
export function snakesCellToRowCol(n: number): { row: number; col: number } {
  if (n < 1 || n > 100) return { row: -1, col: -1 };
  const zero = n - 1;
  const rowFromBottom = Math.floor(zero / 10);
  const row = 9 - rowFromBottom;
  const colInRow = zero % 10;
  const col = rowFromBottom % 2 === 0 ? colInRow : 9 - colInRow;
  return { row, col };
}

export function snakesNumberAt(row: number, col: number): number {
  const rowFromBottom = 9 - row;
  const colInRow = rowFromBottom % 2 === 0 ? col : 9 - col;
  return rowFromBottom * 10 + colInRow + 1;
}
