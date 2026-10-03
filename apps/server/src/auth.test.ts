import { mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthStore, usernameBaseFromGoogle } from './auth/auth.store.js';
import { AuthError, type GoogleIdentity } from './auth/auth.types.js';

function googleIdentity(overrides: Partial<GoogleIdentity> = {}): GoogleIdentity {
  return {
    sub: 'google-sub-1',
    email: 'alice@example.com',
    emailVerified: true,
    name: 'Alice Smith',
    ...overrides,
  };
}

async function verifiedEmailUser(auth: AuthStore, username: string, email: string) {
  const session = await auth.signup(username, 'secret12');
  await auth.setEmail(session.userId, email);
  const token = await auth.createEmailToken(session.userId, 'verify_email', email);
  await auth.verifyEmail(token);
  return session;
}

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

  describe('Google sign-in', () => {
    it('asks a new Google user for a username, then creates a password-less account', async () => {
      const first = await auth.googleSignIn(googleIdentity());
      expect(first).toEqual({ kind: 'needs_username', suggestedUsername: 'Alice_Smith' });

      const created = await auth.googleSignIn(googleIdentity(), { username: 'Alice_Smith' });
      expect(created.kind).toBe('session');
      if (created.kind !== 'session') return;
      expect(created.created).toBe(true);
      const user = auth.getUser(created.session.userId)!;
      expect(user.passwordHash).toBeNull();
      expect(user.googleSub).toBe('google-sub-1');
      expect(user.email).toBe('alice@example.com');
      expect(user.emailVerified).toBe(true);

      const again = await auth.googleSignIn(googleIdentity());
      expect(again.kind === 'session' && again.session.userId).toBe(created.session.userId);
    });

    it('rejects a taken username when creating a Google account', async () => {
      await auth.signup('Taken', 'secret12');
      await expect(
        auth.googleSignIn(googleIdentity(), { username: 'taken' }),
      ).rejects.toMatchObject({ code: 'username_taken' });
    });

    it('suggests a unique, schema-safe username', async () => {
      await auth.signup('Alice_Smith', 'secret12');
      const res = await auth.googleSignIn(googleIdentity());
      expect(res.kind).toBe('needs_username');
      if (res.kind !== 'needs_username') return;
      expect(res.suggestedUsername).toMatch(/^Alice_Smith\d+$/);
      expect(usernameBaseFromGoogle({ name: 'Bót Ünïcode!', email: null })).toBe('p_Bot_Unicode');
      expect(usernameBaseFromGoogle({ name: null, email: 'x@y.z' })).toBe('playerx');
    });

    it('links Google to an existing account with the same verified email', async () => {
      const existing = await verifiedEmailUser(auth, 'Bob', 'alice@example.com');
      const res = await auth.googleSignIn(googleIdentity({ email: 'ALICE@example.com' }));
      expect(res.kind === 'session' && res.session.userId).toBe(existing.userId);
      expect(auth.getUser(existing.userId)?.googleSub).toBe('google-sub-1');
    });

    it('does not link to an account whose email is unverified', async () => {
      const existing = await auth.signup('Mallory', 'secret12');
      await auth.setEmail(existing.userId, 'alice@example.com');
      const res = await auth.googleSignIn(googleIdentity());
      expect(res.kind).toBe('needs_username');
      expect(auth.getUser(existing.userId)?.googleSub).toBeNull();
    });

    it('does not let a Google-only user log in with a password', async () => {
      await auth.googleSignIn(googleIdentity(), { username: 'GoogleOnly' });
      await expect(auth.login('GoogleOnly', 'anything1')).rejects.toMatchObject({
        code: 'invalid_credentials',
      });
    });

    it('links and unlinks Google from the profile', async () => {
      const a = await auth.signup('Carl', 'secret12');
      const b = await auth.signup('Dina', 'secret12');
      const linked = await auth.linkGoogle(a.userId, googleIdentity());
      expect(linked.googleSub).toBe('google-sub-1');
      expect(linked.email).toBe('alice@example.com');
      expect(linked.emailVerified).toBe(true);
      await expect(auth.linkGoogle(b.userId, googleIdentity())).rejects.toMatchObject({
        code: 'google_taken',
      });
      const unlinked = await auth.unlinkGoogle(a.userId);
      expect(unlinked.googleSub).toBeNull();
    });

    it('refuses to unlink Google from a password-less account', async () => {
      const res = await auth.googleSignIn(googleIdentity(), { username: 'NoPass' });
      if (res.kind !== 'session') throw new Error('expected session');
      await expect(auth.unlinkGoogle(res.session.userId)).rejects.toMatchObject({
        code: 'password_required',
      });
    });

    it('persists Google links and emails across restarts', async () => {
      await auth.googleSignIn(googleIdentity(), { username: 'Persisted' });
      const again = new AuthStore(dir);
      await again.init();
      expect(again.getUserByGoogleSub('google-sub-1')?.username).toBe('Persisted');
      expect(again.getUserByVerifiedEmail('alice@example.com')?.username).toBe('Persisted');
    });
  });

  describe('recovery email and password reset', () => {
    it('verifies an email with a single-use token', async () => {
      const s = await auth.signup('Erin', 'secret12');
      const user = await auth.setEmail(s.userId, ' Erin@Example.com ');
      expect(user.email).toBe('Erin@Example.com');
      expect(user.emailVerified).toBe(false);
      expect(auth.findRecoverableUser('Erin')).toBeUndefined();

      const token = await auth.createEmailToken(s.userId, 'verify_email', user.email!);
      expect((await auth.verifyEmail(token)).emailVerified).toBe(true);
      await expect(auth.verifyEmail(token)).rejects.toMatchObject({ code: 'invalid_token' });
      expect(auth.findRecoverableUser('erin@example.com')?.id).toBe(s.userId);
      expect(auth.findRecoverableUser('erin')?.id).toBe(s.userId);
    });

    it('stores a sign-up email as unverified until confirmed', async () => {
      const s = await auth.signup('Kim', 'secret12', undefined, ' Kim@Example.com ');
      const user = auth.getUser(s.userId)!;
      expect(user.email).toBe('Kim@Example.com');
      expect(user.emailVerified).toBe(false);
      expect(auth.findRecoverableUser('kim@example.com')).toBeUndefined();

      const token = await auth.createEmailToken(s.userId, 'verify_email', user.email!);
      await auth.verifyEmail(token);
      expect(auth.findRecoverableUser('kim@example.com')?.id).toBe(s.userId);
    });

    it('rejects a sign-up email already verified by another account', async () => {
      await verifiedEmailUser(auth, 'Lou', 'lou@example.com');
      await expect(auth.signup('Lou2', 'secret12', undefined, 'LOU@example.com')).rejects.toMatchObject({
        code: 'email_taken',
      });
      expect((await auth.signup('Lou2', 'secret12')).username).toBe('Lou2');
      const plain = await auth.signup('Mo', 'secret12', undefined, '  ');
      expect(auth.getUser(plain.userId)?.email ?? null).toBeNull();
    });

    it('rejects a verify link after the email was changed', async () => {
      const s = await auth.signup('Finn', 'secret12');
      await auth.setEmail(s.userId, 'old@example.com');
      const token = await auth.createEmailToken(s.userId, 'verify_email', 'old@example.com');
      await auth.setEmail(s.userId, 'new@example.com');
      await expect(auth.verifyEmail(token)).rejects.toMatchObject({ code: 'invalid_token' });
    });

    it('blocks using an email already verified by another account', async () => {
      await verifiedEmailUser(auth, 'Gina', 'shared@example.com');
      const other = await auth.signup('Hank', 'secret12');
      await expect(auth.setEmail(other.userId, 'SHARED@example.com')).rejects.toMatchObject({
        code: 'email_taken',
      });
    });

    it('resets the password and revokes existing sessions', async () => {
      const s = await verifiedEmailUser(auth, 'Ivy', 'ivy@example.com');
      const user = auth.findRecoverableUser('ivy@example.com')!;
      const token = await auth.createEmailToken(user.id, 'reset_password', user.email!);

      await expect(auth.resetPassword('not-a-real-token-value', 'newpass1')).rejects.toMatchObject({
        code: 'invalid_token',
      });
      await auth.resetPassword(token, 'newpass12');
      expect(auth.resolveSession(s.sessionToken)).toBeNull();
      await expect(auth.login('Ivy', 'secret12')).rejects.toMatchObject({
        code: 'invalid_credentials',
      });
      expect((await auth.login('Ivy', 'newpass12')).userId).toBe(s.userId);
      await expect(auth.resetPassword(token, 'another1')).rejects.toMatchObject({
        code: 'invalid_token',
      });
    });

    it('does not accept a verify token as a reset token', async () => {
      const s = await verifiedEmailUser(auth, 'Jack', 'jack@example.com');
      const token = await auth.createEmailToken(s.userId, 'verify_email', 'jack@example.com');
      await expect(auth.resetPassword(token, 'newpass12')).rejects.toMatchObject({
        code: 'invalid_token',
      });
    });

    it('checks reset tokens without consuming them', async () => {
      const s = await verifiedEmailUser(auth, 'Lia', 'lia@example.com');
      const token = await auth.createEmailToken(s.userId, 'reset_password', 'lia@example.com');
      const verifyToken = await auth.createEmailToken(s.userId, 'verify_email', 'lia@example.com');
      const expired = await auth.createEmailToken(s.userId, 'reset_password', 'lia@example.com', -1);

      expect(await auth.isResetTokenValid(token)).toBe(true);
      expect(await auth.isResetTokenValid(token)).toBe(true);
      expect(await auth.isResetTokenValid(verifyToken)).toBe(false);
      expect(await auth.isResetTokenValid(expired)).toBe(false);
      expect(await auth.isResetTokenValid('not-a-real-token-value')).toBe(false);

      await auth.resetPassword(token, 'newpass12');
      expect(await auth.isResetTokenValid(token)).toBe(false);
    });

    it('rejects expired reset tokens', async () => {
      const s = await verifiedEmailUser(auth, 'Kim', 'kim@example.com');
      const token = await auth.createEmailToken(s.userId, 'reset_password', 'kim@example.com', -1);
      await expect(auth.resetPassword(token, 'newpass12')).rejects.toMatchObject({
        code: 'invalid_token',
      });
    });

    it('lets a Google-only user set a password through reset', async () => {
      const res = await auth.googleSignIn(googleIdentity(), { username: 'Leo' });
      if (res.kind !== 'session') throw new Error('expected session');
      const token = await auth.createEmailToken(
        res.session.userId,
        'reset_password',
        'alice@example.com',
      );
      await auth.resetPassword(token, 'brandnew1');
      expect((await auth.login('Leo', 'brandnew1')).userId).toBe(res.session.userId);
      expect((await auth.unlinkGoogle(res.session.userId)).googleSub).toBeNull();
    });

    it('frees the verified email and Google link when the account is deleted', async () => {
      const res = await auth.googleSignIn(googleIdentity(), { username: 'Gone' });
      if (res.kind !== 'session') throw new Error('expected session');
      await auth.deleteUser(res.session.userId);
      expect(auth.getUserByGoogleSub('google-sub-1')).toBeUndefined();
      expect(auth.getUserByVerifiedEmail('alice@example.com')).toBeUndefined();
    });
  });
});
