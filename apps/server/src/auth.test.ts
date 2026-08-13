import { mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthStore } from './auth/auth.store.js';
import { AuthError } from './auth/auth.types.js';

describe('AuthStore', () => {
  let dir: string;
  let auth: AuthStore;

  beforeEach(async () => {
    dir = path.join(os.tmpdir(), `felt-auth-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(dir, { recursive: true });
    auth = new AuthStore(dir);
    await auth.init();
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('signs up and logs in with unique username', async () => {
    const session = await auth.signup('Alice_1', 'password1', 2);
    expect(session.username).toBe('Alice_1');
    expect(session.name).toBe('Alice_1');
    expect(session.sessionToken).toHaveLength(64);
    expect(session.ticket).toBeTruthy();
    expect(auth.consumeTicket(session.ticket)?.name).toBe('Alice_1');

    await expect(auth.signup('alice_1', 'otherpass')).rejects.toBeInstanceOf(AuthError);

    const again = await auth.login('Alice_1', 'password1');
    expect(again.userId).toBe(session.userId);
    expect(auth.resolveSession(again.sessionToken)?.username).toBe('Alice_1');
  });

  it('rejects wrong password', async () => {
    await auth.signup('Bob', 'secret12');
    await expect(auth.login('Bob', 'wrong-pass')).rejects.toMatchObject({
      code: 'invalid_credentials',
    });
  });

  it('revokes sessions', async () => {
    const session = await auth.signup('Carol', 'secret12');
    expect(auth.resolveSession(session.sessionToken)).toBeTruthy();
    await auth.revokeSession(session.sessionToken);
    expect(auth.resolveSession(session.sessionToken)).toBeNull();
  });

  it('deletes an account, revokes sessions, and frees the username', async () => {
    const session = await auth.signup('DelUser', 'secret12');
    expect(auth.resolveSession(session.sessionToken)?.id).toBe(session.userId);
    expect(auth.consumeTicket(session.ticket)?.id).toBe(session.userId);

    const deleted = await auth.deleteUser(session.userId);
    expect(deleted?.username).toBe('DelUser');
    expect(auth.getUser(session.userId)).toBeUndefined();
    expect(auth.resolveSession(session.sessionToken)).toBeNull();
    expect(auth.listUsers().some((u) => u.id === session.userId)).toBe(false);

    await expect(auth.login('DelUser', 'secret12')).rejects.toBeInstanceOf(AuthError);
    const again = await auth.signup('DelUser', 'secret12');
    expect(again.userId).not.toBe(session.userId);
    expect(again.username).toBe('DelUser');
  });

  it('deleteUser is a no-op for unknown ids', async () => {
    expect(await auth.deleteUser('missing')).toBeNull();
  });

  it('issues tickets after authenticated session', async () => {
    const session = await auth.signup('Dave', 'secret12');
    const user = auth.resolveSession(session.sessionToken)!;
    const ticket = auth.issueTicket(user.id);
    expect(auth.consumeTicket(ticket)?.id).toBe(user.id);
    expect(auth.consumeTicket('nope')).toBeNull();
  });

  it('persists users across restarts', async () => {
    await auth.signup('Eve', 'secret12', 1);
    const again = new AuthStore(dir);
    await again.init();
    const login = await again.login('Eve', 'secret12');
    expect(login.username).toBe('Eve');
    expect(login.avatarId).toBe(1);
  });

  it('increments handsPlayed and persists across restarts', async () => {
    const session = await auth.signup('Frank', 'secret12');
    expect(auth.getUser(session.userId)?.handsPlayed).toBe(0);
    await auth.incrementHandsPlayed(session.userId);
    await auth.incrementHandsPlayed(session.userId);
    expect(auth.getUser(session.userId)?.handsPlayed).toBe(2);

    const again = new AuthStore(dir);
    await again.init();
    expect(again.getUser(session.userId)?.handsPlayed).toBe(2);
  });
});
