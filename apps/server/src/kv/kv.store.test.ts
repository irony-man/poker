import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createKv, MemoryKv } from './kv.store.js';

describe('MemoryKv', () => {
  let kv: MemoryKv;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    kv = new MemoryKv();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const advance = (seconds: number) => vi.setSystemTime(Date.now() + seconds * 1000);

  it('expires string keys after their TTL', async () => {
    await kv.set('a', '1', 10);
    await kv.set('b', '2');
    expect(await kv.ttl('a')).toBe(10);
    expect(await kv.ttl('b')).toBe(-1);
    expect(await kv.ttl('missing')).toBe(-2);

    advance(9);
    expect(await kv.get('a')).toBe('1');
    expect(await kv.ttl('a')).toBe(1);

    advance(1);
    expect(await kv.get('a')).toBeNull();
    expect(await kv.ttl('a')).toBe(-2);
    expect(await kv.get('b')).toBe('2');
  });

  it('getDel returns the value once', async () => {
    await kv.set('once', 'x', 60);
    expect(await kv.getDel('once')).toBe('x');
    expect(await kv.getDel('once')).toBeNull();

    await kv.set('stale', 'y', 1);
    advance(1);
    expect(await kv.getDel('stale')).toBeNull();
  });

  it('expire updates or removes the TTL', async () => {
    expect(await kv.expire('missing', 10)).toBe(false);
    await kv.set('k', 'v');
    expect(await kv.expire('k', 5)).toBe(true);
    expect(await kv.ttl('k')).toBe(5);
    advance(5);
    expect(await kv.get('k')).toBeNull();
  });

  it('incr sets the TTL only on creation', async () => {
    expect(await kv.incr('hits', 60)).toBe(1);
    advance(30);
    expect(await kv.incr('hits', 60)).toBe(2);
    expect(await kv.ttl('hits')).toBe(30);
    advance(30);
    expect(await kv.get('hits')).toBeNull();
    expect(await kv.incr('hits')).toBe(1);
    expect(await kv.ttl('hits')).toBe(-1);
  });

  it('supports sets with TTL', async () => {
    await kv.sAdd('s', 'a', 10);
    await kv.sAdd('s', 'b');
    expect((await kv.sMembers('s')).sort()).toEqual(['a', 'b']);
    expect(await kv.ttl('s')).toBe(10);

    await kv.sRem('s', 'a');
    expect(await kv.sMembers('s')).toEqual(['b']);

    advance(10);
    expect(await kv.sMembers('s')).toEqual([]);
  });

  it('deletes several keys at once', async () => {
    await kv.set('x', '1');
    await kv.sAdd('y', 'm');
    await kv.del('x', 'y', 'missing');
    expect(await kv.get('x')).toBeNull();
    expect(await kv.sMembers('y')).toEqual([]);
  });
});

describe('createKv', () => {
  it('falls back to memory when REDIS_URL is unset', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const kv = await createKv('');
    expect(kv.kind).toBe('memory');
    log.mockRestore();
  });
});
