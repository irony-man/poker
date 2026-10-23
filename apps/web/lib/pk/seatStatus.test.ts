import { describe, expect, it } from 'vitest';
import { HERO_BOTTOM_DEGREES, heroSeatAngles, seatStatusLabel } from './seatStatus';

describe('seats', () => {
  it('puts the hero at the bottom and seat 0 there for spectators', () => {
    expect(heroSeatAngles(6, 3)[3]).toBe(HERO_BOTTOM_DEGREES);
    expect(heroSeatAngles(6, undefined)[0]).toBe(HERO_BOTTOM_DEGREES);
  });

  it('maps empty, bot, sitting out, disconnected, and all-in', () => {
    expect(seatStatusLabel({ status: 'empty', userId: null })).toBe('Empty seat');
    expect(seatStatusLabel({ status: 'active', userId: 'bot:ada' })).toBe('Bot');
    expect(seatStatusLabel({ status: 'sittingOut', userId: 'u1' })).toBe('Sitting out');
    expect(seatStatusLabel({ status: 'active', userId: 'u1', connected: false })).toBe('Disconnected');
    expect(seatStatusLabel({ status: 'allin', userId: 'u1' })).toBe('All-in');
  });
});
