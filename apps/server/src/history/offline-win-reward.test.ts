import { describe, expect, it } from 'vitest';
import {
  humanWonOfflineGame,
  isOfflineSoloVsBots,
  userWonOfflineHand,
} from './offline-win-reward.js';

const winResult = {
  winners: [{ seat: 0, amount: 500 }],
  players: [
    { seat: 0, userId: 'alice', stack: 1500 },
    { seat: 1, userId: 'bot:balanced:off-1', stack: 0 },
  ],
};

describe('userWonOfflineHand', () => {
  it('returns true when user seat won', () => {
    expect(userWonOfflineHand(winResult, 'alice')).toBe(true);
  });

  it('returns false when another seat won', () => {
    expect(
      userWonOfflineHand(
        {
          winners: [{ seat: 1, amount: 500 }],
          players: winResult.players,
        },
        'alice',
      ),
    ).toBe(false);
  });
});

describe('humanWonOfflineGame', () => {
  it('returns true when human has chips and all bots are busted', () => {
    expect(humanWonOfflineGame(winResult, 'alice')).toBe(true);
  });

  it('returns false when a bot still has chips', () => {
    expect(
      humanWonOfflineGame(
        {
          players: [
            { seat: 0, userId: 'alice', stack: 1500 },
            { seat: 1, userId: 'bot:balanced:off-1', stack: 400 },
          ],
        },
        'alice',
      ),
    ).toBe(false);
  });

  it('returns false when human is busted', () => {
    expect(
      humanWonOfflineGame(
        {
          players: [
            { seat: 0, userId: 'alice', stack: 0 },
            { seat: 1, userId: 'bot:balanced:off-1', stack: 0 },
          ],
        },
        'alice',
      ),
    ).toBe(false);
  });
});

describe('isOfflineSoloVsBots', () => {
  it('returns true for one human and bots', () => {
    expect(isOfflineSoloVsBots(winResult, 'alice')).toBe(true);
  });

  it('returns false when another human is seated', () => {
    expect(
      isOfflineSoloVsBots(
        {
          players: [
            { seat: 0, userId: 'alice' },
            { seat: 1, userId: 'bob' },
          ],
        },
        'alice',
      ),
    ).toBe(false);
  });
});
