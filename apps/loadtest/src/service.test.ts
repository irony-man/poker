import { describe, expect, it } from 'vitest';
import { loadConfig, parseTargets } from './config.js';
import { RunConfigSchema, resolveScenarios } from './core/types.js';
import { makeRoutePicker } from './scenarios/api.js';
import { chooseAction, gameplayScenario } from './scenarios/gameplay.js';
import { chatPayload, parseChatPayload } from './scenarios/socketRooms.js';
import { LoginLimiter, issueSession, parseCookies, verifySession } from './server/auth.js';
import { newRunId, totalUsers } from './server/runs.js';
import { isRunId } from './server/store.js';

describe('config', () => {
  it('parses named targets with optional ws URLs', () => {
    expect(parseTargets('local=http://server:4000|ws://server:4000/ws, prod=https://pokr.site/')).toEqual([
      { name: 'local', apiUrl: 'http://server:4000', wsUrl: 'ws://server:4000/ws' },
      { name: 'prod', apiUrl: 'https://pokr.site', wsUrl: 'wss://pokr.site/ws' },
    ]);
    expect(parseTargets('http://127.0.0.1:4000')).toEqual([
      { name: '127.0.0.1:4000', apiUrl: 'http://127.0.0.1:4000', wsUrl: 'ws://127.0.0.1:4000/ws' },
    ]);
    expect(() => parseTargets('a=ftp://x')).toThrow();
    expect(() => parseTargets('a=http://x,a=http://y')).toThrow(/Duplicate/);
  });

  it('refuses to start without a strong admin token', () => {
    expect(() => loadConfig({})).toThrow(/LOADTEST_ADMIN_TOKEN/);
    expect(() => loadConfig({ LOADTEST_ADMIN_TOKEN: 'short' })).toThrow();
    const c = loadConfig({ LOADTEST_ADMIN_TOKEN: 'a-long-enough-token', LOADTEST_MAX_VUS: '999999' });
    expect(c.maxVus).toBe(100_000);
    expect(c.port).toBe(4100);
  });
});

describe('run config', () => {
  it('applies defaults and expands mixed', () => {
    const c = RunConfigSchema.parse({ target: 'local', scenarios: ['mixed', 'api'], vus: 12 });
    expect(c.durationSec).toBe(60);
    expect(c.options.mixedSocket).toBe('socket-basic');
    expect(resolveScenarios(c)).toEqual(['api', 'socket-basic']);
  });

  it('rejects ramp-up longer than the run', () => {
    expect(RunConfigSchema.safeParse({ target: 'x', scenarios: ['api'], vus: 1, rampUpSec: 60, durationSec: 30 }).success).toBe(false);
  });

  it('counts accounts per scenario', () => {
    const base = { target: 'x', vus: 10 };
    // api shares a pool capped at 50.
    expect(totalUsers(RunConfigSchema.parse({ ...base, scenarios: ['api'], vus: 200 }))).toBe(50);
    expect(totalUsers(RunConfigSchema.parse({ ...base, scenarios: ['socket-basic', 'socket-rooms'] }))).toBe(20);
    // gameplay rounds down to full tables of 4.
    expect(gameplayScenario.usersNeeded(RunConfigSchema.parse({ ...base, scenarios: ['gameplay'] }))).toBe(8);
    expect(gameplayScenario.usersNeeded(RunConfigSchema.parse({ ...base, vus: 3, scenarios: ['gameplay'] }))).toBe(3);
  });
});

describe('scenario helpers', () => {
  it('round-trips chat timestamps and ignores other chat', () => {
    expect(parseChatPayload(chatPayload(1234.5))).toBe(1234.5);
    expect(parseChatPayload('hello')).toBeNull();
    expect(parseChatPayload(undefined)).toBeNull();
  });

  it('chooses passive poker actions with an occasional min raise', () => {
    const legal = { types: ['fold', 'call', 'raise', 'allin'] as const, callAmount: 10, minRaiseTo: 40, maxRaiseTo: 1000 };
    const l = { ...legal, types: [...legal.types] };
    expect(chooseAction(l, 0)).toEqual({ action: 'call' });
    expect(chooseAction(l, 100, () => 0)).toEqual({ action: 'raise', amount: 40 });
    expect(chooseAction({ ...l, types: ['fold', 'check', 'bet', 'allin'] }, 0)).toEqual({ action: 'check' });
    expect(chooseAction({ ...l, types: ['fold', 'allin'] }, 0)).toEqual({ action: 'allin' });
    expect(chooseAction({ ...l, types: [] }, 0)).toBeNull();
  });

  it('only picks routes with positive weight', () => {
    const pick = makeRoutePicker({ health: 0, site: 0, tables: 0, contests: 0, me: 1, user: 0, ticket: 0 });
    for (let i = 0; i < 50; i++) expect(pick()).toBe('me');
    expect(() => makeRoutePicker({ health: 0, site: 0, tables: 0, contests: 0, me: 0, user: 0, ticket: 0 })).toThrow();
  });
});

describe('dashboard auth', () => {
  it('issues sessions bound to the admin token and expiry', () => {
    const now = Date.now();
    const s = issueSession('token-aaaaaaaaaaaa', now);
    expect(verifySession('token-aaaaaaaaaaaa', s, now)).toBe(true);
    expect(verifySession('token-bbbbbbbbbbbb', s, now)).toBe(false);
    expect(verifySession('token-aaaaaaaaaaaa', s, now + 13 * 3600_000)).toBe(false);
    expect(verifySession('token-aaaaaaaaaaaa', `${s}x`, now)).toBe(false);
    expect(verifySession('token-aaaaaaaaaaaa', undefined, now)).toBe(false);
  });

  it('parses cookies and limits failed logins', () => {
    expect(parseCookies('a=1; lt_session=x%2Ey; b')).toEqual({ a: '1', lt_session: 'x.y' });
    const lim = new LoginLimiter(2, 1000);
    lim.fail('ip', 0);
    expect(lim.blocked('ip', 0)).toBe(false);
    lim.fail('ip', 0);
    expect(lim.blocked('ip', 0)).toBe(true);
    expect(lim.blocked('ip', 2000)).toBe(false);
  });

  it('generates run ids accepted by the store', () => {
    const id = newRunId(new Date('2026-10-06T03:46:00Z'));
    expect(id).toMatch(/^20261006-034600-[0-9a-f]{6}$/);
    expect(isRunId(id)).toBe(true);
    expect(isRunId('../etc/passwd')).toBe(false);
  });
});
