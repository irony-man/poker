import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import {
  CUSTOM_STAKE_LIMITS,
  STAKE_PRESETS,
  validateContestEntryFee,
  validateStakes,
} from '@poker/protocol';
import type { AuthService } from './auth/auth.service.js';
import type { User } from './auth/auth.types.js';
import { ContestsController } from './contests/contests.controller.js';
import type { ContestsService } from './contests/contests.service.js';
import type { FriendsService } from './friends/friends.service.js';
import type { HistoryService } from './history/history.service.js';
import type { RoomsService } from './rooms/rooms.service.js';
import type { SiteConfigService } from './site-config/site-config.service.js';
import { TablesController } from './tables/tables.controller.js';

describe('validateStakes', () => {
  it('accepts every preset', () => {
    for (const s of STAKE_PRESETS) {
      expect(validateStakes(s.smallBlind, s.bigBlind, s.buyIn)).toBeNull();
    }
  });

  it('accepts the exact boundaries', () => {
    expect(validateStakes(1, 1, 10)).toBeNull();
    expect(validateStakes(1, 1, 500)).toBeNull();
    expect(validateStakes(1_000, 2_000, CUSTOM_STAKE_LIMITS.maxStack)).toBeNull();
  });

  it('rejects non-integers and a zero small blind', () => {
    expect(validateStakes(2.5, 5, 500)).toMatch(/whole numbers/);
    expect(validateStakes(0, 5, 500)).toMatch(/Small blind/);
  });

  it('rejects a big blind below the small blind or above the cap', () => {
    expect(validateStakes(10, 5, 500)).toMatch(/at least the small blind/);
    expect(validateStakes(5_000, 10_001, 200_000)).toMatch(/Big blind can be at most/);
  });

  it('rejects stacks outside 10–500 big blinds or above the absolute cap', () => {
    expect(validateStakes(5, 10, 99)).toMatch(/at least 10 big blinds/);
    expect(validateStakes(5, 10, 5_001)).toMatch(/at most 500 big blinds/);
    expect(validateStakes(5_000, 10_000, 1_000_001)).toMatch(/at most 1,000,000/);
  });
});

describe('validateContestEntryFee', () => {
  it('only allows exactly the starting stack', () => {
    expect(validateContestEntryFee(1000, 1000)).toBeNull();
    expect(validateContestEntryFee(500, 1000)).toMatch(/must equal/);
    expect(validateContestEntryFee(0, 1000)).toMatch(/must equal/);
  });
});

const host = { id: 'host', name: 'Host' } as User;

describe('TablesController stake limits', () => {
  it('rejects stakes outside the limits before creating a room', async () => {
    const create = vi.fn();
    const ctrl = new TablesController(
      { create } as unknown as RoomsService,
      {} as FriendsService,
      {} as HistoryService,
      {} as SiteConfigService,
    );
    await expect(
      ctrl.create(host, { smallBlind: 5, bigBlind: 10, buyIn: 50, isPrivate: true }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });
});

describe('ContestsController stake limits', () => {
  function controller() {
    const create = vi.fn(async (opts: { entryFee?: number }) => ({
      id: 'c1',
      inviteCode: '123456',
      entryFee: opts.entryFee ?? 0,
    }));
    const ctrl = new ContestsController(
      { create, chipBalance: () => 4_000 } as unknown as ContestsService,
      {} as AuthService,
      {} as FriendsService,
      {} as HistoryService,
    );
    return { ctrl, create };
  }
  const body = { mode: 'chips', fieldSize: 4, smallBlind: 5, bigBlind: 10 };

  it('rejects out-of-range stakes and mismatched entry fees', async () => {
    const { ctrl, create } = controller();
    await expect(
      ctrl.create(host, { ...body, startingStack: 6_000, entryFee: 6_000 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      ctrl.create(host, { ...body, startingStack: 1_000, entryFee: 500 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects free contests and requests without an entry fee', async () => {
    const { ctrl, create } = controller();
    await expect(
      ctrl.create(host, { ...body, startingStack: 1_000, entryFee: 0 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(ctrl.create(host, { ...body, startingStack: 1_000 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('accepts a custom paid contest and returns the new balance', async () => {
    const { ctrl, create } = controller();
    const res = await ctrl.create(host, { ...body, startingStack: 750, entryFee: 750 });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ startingStack: 750, smallBlind: 5, bigBlind: 10, entryFee: 750 }),
    );
    expect(res.chipBalance).toBe(4_000);
  });
});
