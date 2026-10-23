import { seatAnglesForHero } from '@/lib/tableLayout';

export type SeatStatusInput = {
  status: string;
  userId?: string | null;
  connected?: boolean;
};

/** Spoken seat state. Bot, sitting out, disconnected, and all-in cover the no-frame seats. */
export function seatStatusLabel(player: SeatStatusInput): string {
  if (player.status === 'empty' || !player.userId) return 'Empty seat';
  if (player.connected === false) return 'Disconnected';
  if (player.userId.startsWith('bot:')) {
    if (player.status === 'sittingOut') return 'Bot sitting out';
    if (player.status === 'allin') return 'Bot all-in';
    return 'Bot';
  }
  if (player.status === 'sittingOut') return 'Sitting out';
  if (player.status === 'allin') return 'All-in';
  if (player.status === 'folded') return 'Folded';
  if (player.status === 'active') return 'In hand';
  return 'Seated';
}

/** Hero sits at the bottom (90°). Spectators (no hero) keep seat 0 at the bottom. */
export function heroSeatAngles(maxSeats: number, heroSeat: number | undefined): number[] {
  return seatAnglesForHero(maxSeats, heroSeat);
}

export const HERO_BOTTOM_DEGREES = 90;
