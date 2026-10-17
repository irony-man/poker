import { describe, expect, it } from 'vitest';
import { normalizeInviteEmails, splitInviteTargets } from './friends/email-invites.js';

describe('normalizeInviteEmails', () => {
  it('lowercases, trims, dedupes, and drops the sender email', () => {
    expect(
      normalizeInviteEmails(
        [' Bob@Example.com', 'bob@example.com', 'ME@x.com', '', 'carol@x.com'],
        'me@X.com',
      ),
    ).toEqual(['bob@example.com', 'carol@x.com']);
  });

  it('keeps everything when the sender has no email', () => {
    expect(normalizeInviteEmails(['a@x.com'], null)).toEqual(['a@x.com']);
  });
});

describe('splitInviteTargets', () => {
  it('separates existing accounts from unknown addresses, keeping order', () => {
    const accounts: Record<string, string> = { 'bob@x.com': 'user-bob' };
    expect(
      splitInviteTargets(['new@x.com', 'bob@x.com', 'other@x.com'], (e) => accounts[e]),
    ).toEqual({
      users: [{ email: 'bob@x.com', userId: 'user-bob' }],
      unknown: ['new@x.com', 'other@x.com'],
    });
  });
});
