import { describe, expect, it } from 'vitest';
import { RealtimeService } from './realtime/realtime.service.js';

describe('RealtimeService', () => {
  it('registers sockets and broadcasts to all', () => {
    const rt = new RealtimeService();
    const a: unknown[] = [];
    const b: unknown[] = [];
    const sendA = (m: unknown) => a.push(m);
    const sendB = (m: unknown) => b.push(m);
    rt.registerSocket(sendA);
    rt.registerSocket(sendB);
    rt.setPublicTables([{ tableId: 't1' }]);
    rt.sendPublicLobby(sendA);
    expect(a).toEqual([
      { type: 'public_tables_sync', tables: [{ tableId: 't1' }] },
      { type: 'public_contests_sync', contests: [] },
    ]);
    rt.broadcastAll({ type: 'public_tables_sync', tables: [{ tableId: 't2' }] });
    expect(b).toEqual([{ type: 'public_tables_sync', tables: [{ tableId: 't2' }] }]);
  });

  it('tracks per-user connection set and last-socket disconnect', () => {
    const rt = new RealtimeService();
    const send = () => {};
    rt.registerSocket(send);
    expect(rt.registerUser('u1', send)).toBe(true);
    expect(rt.registerUser('u1', send)).toBe(false);
    expect(rt.isUserConnected('u1')).toBe(true);
    const last = rt.unregisterSocket(send, 'u1');
    expect(last).toBe(true);
    expect(rt.isUserConnected('u1')).toBe(false);
  });

  it('sendToUser fans only that user', async () => {
    const rt = new RealtimeService();
    const got: unknown[] = [];
    const send = (m: unknown) => got.push(m);
    rt.registerSocket(send);
    rt.registerUser('u1', send);
    rt.setSocialLoader(async (userId) => ({
      type: 'social_sync',
      friends: [{ userId: 'f1', name: 'F' }],
      incoming: [],
      pendingChallenges: [],
      groups: [],
      for: userId,
    }));
    await rt.pushSocial('u1');
    expect(got).toHaveLength(1);
    expect((got[0] as { type: string }).type).toBe('social_sync');
  });
});
