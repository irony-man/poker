import { createEmptyTable } from '@poker/engine';
import { afterEach, describe, expect, it } from 'vitest';
import {
  OFFLINE_SESSION_KEY,
  clearOfflineSession,
  hasOfflineSession,
  loadOfflineSession,
  parseOfflineSession,
  saveOfflineSession,
  serializeHandState,
} from './offlineSession';

const config = {
  maxSeats: 6,
  smallBlind: 5,
  bigBlind: 10,
  buyIn: 1000,
  turnTimeMs: 30_000,
};

function memoryStorage() {
  const map = new Map<string, string>();
  const store = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: store, configurable: true });
  return store;
}

function validSnapshot() {
  const state = createEmptyTable(config);
  state.players[0] = {
    ...state.players[0],
    userId: 'offline-human',
    name: 'Shivam',
    stack: 980,
    status: 'seated',
  };
  state.actedSinceAggression = new Set([0, 2]);
  return {
    playerName: 'Shivam',
    seats: 6,
    botGroupId: 'default',
    config,
    tableId: 'offline-anon-abc',
    state,
  };
}

afterEach(() => {
  clearOfflineSession();
});

describe('serializeHandState', () => {
  it('turns actedSinceAggression into a number array', () => {
    const state = createEmptyTable(config);
    state.actedSinceAggression = new Set([1, 3]);
    const serialized = serializeHandState(state);
    expect(serialized.actedSinceAggression).toEqual([1, 3]);
    expect(serialized.actedSinceAggression).toBeInstanceOf(Array);
  });
});

describe('parseOfflineSession', () => {
  it('round-trips a valid snapshot including the Set', () => {
    const snap = validSnapshot();
    const parsed = parseOfflineSession({
      version: 1,
      savedAt: 1,
      ...snap,
      state: serializeHandState(snap.state),
    });
    expect(parsed?.state.actedSinceAggression).toEqual(new Set([0, 2]));
    expect(parsed?.state.players[0]?.userId).toBe('offline-human');
    expect(parsed?.seats).toBe(6);
  });

  it('rejects missing human seat, bad version, and bad seats', () => {
    const snap = validSnapshot();
    snap.state.players[0].userId = 'someone-else';
    expect(
      parseOfflineSession({
        version: 1,
        savedAt: 1,
        ...snap,
        state: serializeHandState(snap.state),
      }),
    ).toBeNull();

    const ok = validSnapshot();
    expect(
      parseOfflineSession({
        version: 2,
        savedAt: 1,
        ...ok,
        state: serializeHandState(ok.state),
      }),
    ).toBeNull();

    expect(
      parseOfflineSession({
        version: 1,
        savedAt: 1,
        ...ok,
        seats: 10,
        state: serializeHandState(ok.state),
      }),
    ).toBeNull();
  });
});

describe('localStorage helpers', () => {
  it('saves, loads, and clears; wipes corrupt payloads', () => {
    memoryStorage();
    const snap = validSnapshot();
    saveOfflineSession(snap);
    expect(hasOfflineSession()).toBe(true);
    const loaded = loadOfflineSession();
    expect(loaded?.tableId).toBe('offline-anon-abc');
    expect(loaded?.state.actedSinceAggression).toEqual(new Set([0, 2]));

    localStorage.setItem(OFFLINE_SESSION_KEY, '{not-json');
    expect(loadOfflineSession()).toBeNull();
    expect(localStorage.getItem(OFFLINE_SESSION_KEY)).toBeNull();

    saveOfflineSession(snap);
    clearOfflineSession();
    expect(hasOfflineSession()).toBe(false);
  });
});
