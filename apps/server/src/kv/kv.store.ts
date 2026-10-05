/**
 * Key-value store with optional Redis. Falls back to in-memory Map when
 * REDIS_URL is unset — suitable for local MVP and tests.
 *
 * TTLs are in seconds. `MemoryKv` mirrors Redis expiry semantics (lazy, on access).
 */
export interface KvStore {
  readonly kind: 'redis' | 'memory';
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  /** Atomically read and delete (Redis GETDEL). */
  getDel(key: string): Promise<string | null>;
  del(...keys: string[]): Promise<void>;
  /** Remaining TTL in seconds; -1 when the key has no expiry, -2 when it does not exist. */
  ttl(key: string): Promise<number>;
  /** Returns false when the key does not exist. */
  expire(key: string, ttlSeconds: number): Promise<boolean>;
  /** Increments; `ttlSeconds` is applied only when the key is created. */
  incr(key: string, ttlSeconds?: number): Promise<number>;
  sAdd(key: string, member: string, ttlSeconds?: number): Promise<void>;
  sMembers(key: string): Promise<string[]>;
  sRem(key: string, member: string): Promise<void>;
  publish(channel: string, message: string): Promise<void>;
  subscribe(channel: string, handler: (message: string) => void): Promise<() => void>;
  close(): Promise<void>;
}

type MemoryEntry =
  | { type: 'string'; value: string; expiresAt?: number }
  | { type: 'set'; value: Set<string>; expiresAt?: number };

export class MemoryKv implements KvStore {
  readonly kind = 'memory' as const;
  private data = new Map<string, MemoryEntry>();
  private subs = new Map<string, Set<(message: string) => void>>();

  private entry(key: string): MemoryEntry | undefined {
    const e = this.data.get(key);
    if (!e) return undefined;
    if (e.expiresAt !== undefined && Date.now() >= e.expiresAt) {
      this.data.delete(key);
      return undefined;
    }
    return e;
  }

  private static expiry(ttlSeconds?: number): number | undefined {
    return ttlSeconds && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : undefined;
  }

  async get(key: string): Promise<string | null> {
    const e = this.entry(key);
    return e?.type === 'string' ? e.value : null;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    this.data.set(key, { type: 'string', value, expiresAt: MemoryKv.expiry(ttlSeconds) });
  }

  async getDel(key: string): Promise<string | null> {
    const e = this.entry(key);
    if (e?.type !== 'string') return null;
    this.data.delete(key);
    return e.value;
  }

  async del(...keys: string[]): Promise<void> {
    for (const key of keys) this.data.delete(key);
  }

  async ttl(key: string): Promise<number> {
    const e = this.entry(key);
    if (!e) return -2;
    if (e.expiresAt === undefined) return -1;
    return Math.max(0, Math.ceil((e.expiresAt - Date.now()) / 1000));
  }

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    const e = this.entry(key);
    if (!e) return false;
    if (ttlSeconds <= 0) {
      this.data.delete(key);
      return true;
    }
    e.expiresAt = Date.now() + ttlSeconds * 1000;
    return true;
  }

  async incr(key: string, ttlSeconds?: number): Promise<number> {
    const e = this.entry(key);
    if (!e) {
      this.data.set(key, { type: 'string', value: '1', expiresAt: MemoryKv.expiry(ttlSeconds) });
      return 1;
    }
    if (e.type !== 'string' || !/^-?\d+$/.test(e.value)) {
      throw new Error('ERR value is not an integer or out of range');
    }
    const next = Number(e.value) + 1;
    e.value = String(next);
    return next;
  }

  async sAdd(key: string, member: string, ttlSeconds?: number): Promise<void> {
    const e = this.entry(key);
    if (e && e.type !== 'set') throw new Error('WRONGTYPE Operation against a key holding the wrong kind of value');
    if (e) {
      e.value.add(member);
      if (ttlSeconds) e.expiresAt = MemoryKv.expiry(ttlSeconds);
      return;
    }
    this.data.set(key, {
      type: 'set',
      value: new Set([member]),
      expiresAt: MemoryKv.expiry(ttlSeconds),
    });
  }

  async sMembers(key: string): Promise<string[]> {
    const e = this.entry(key);
    return e?.type === 'set' ? [...e.value] : [];
  }

  async sRem(key: string, member: string): Promise<void> {
    const e = this.entry(key);
    if (e?.type !== 'set') return;
    e.value.delete(member);
    if (e.value.size === 0) this.data.delete(key);
  }

  async publish(channel: string, message: string): Promise<void> {
    const set = this.subs.get(channel);
    if (!set) return;
    for (const h of set) h(message);
  }

  async subscribe(channel: string, handler: (message: string) => void): Promise<() => void> {
    let set = this.subs.get(channel);
    if (!set) {
      set = new Set();
      this.subs.set(channel, set);
    }
    set.add(handler);
    return () => {
      set!.delete(handler);
    };
  }

  async close(): Promise<void> {
    this.data.clear();
    this.subs.clear();
  }
}

const RECONNECT_MAX_DELAY_MS = 5_000;
/** Before the first successful connect, give up after this many retries so boot can't hang. */
const BOOT_CONNECT_RETRIES = 5;

export async function createKv(url = process.env.REDIS_URL): Promise<KvStore> {
  if (!url) {
    console.log('[kv] REDIS_URL unset, using in-memory store');
    return new MemoryKv();
  }

  const { createClient } = await import('redis');
  let connectedOnce = false;
  const client = createClient({
    url,
    socket: {
      reconnectStrategy: (retries: number) =>
        !connectedOnce && retries >= BOOT_CONNECT_RETRIES
          ? new Error(`gave up after ${retries} connection attempts`)
          : Math.min(retries * 200, RECONNECT_MAX_DELAY_MS),
    },
  });
  const sub = client.duplicate();
  let lastError = '';
  const logError = (label: string) => (err: Error) => {
    const msg = err?.message ?? String(err);
    if (msg === lastError) return;
    lastError = msg;
    console.warn(`[kv] Redis ${label} error: ${msg}`);
  };
  client.on('error', logError('client'));
  sub.on('error', logError('subscriber'));
  client.on('ready', () => {
    lastError = '';
  });

  try {
    await client.connect();
    await sub.connect();
    connectedOnce = true;
  } catch (err) {
    console.warn(
      `[kv] Redis unavailable at boot (${(err as Error)?.message ?? err}); FALLING BACK TO IN-MEMORY STORE. ` +
        'Sessions and table snapshots will not survive a restart or be shared across instances.',
    );
    await Promise.allSettled([client.disconnect(), sub.disconnect()]);
    return new MemoryKv();
  }
  console.log('[kv] Connected to Redis');

  return {
    kind: 'redis',
    async get(key) {
      return client.get(key);
    },
    async set(key, value, ttlSeconds) {
      if (ttlSeconds && ttlSeconds > 0) await client.set(key, value, { EX: Math.ceil(ttlSeconds) });
      else await client.set(key, value);
    },
    async getDel(key) {
      return client.getDel(key);
    },
    async del(...keys) {
      if (keys.length > 0) await client.del(keys);
    },
    async ttl(key) {
      return client.ttl(key);
    },
    async expire(key, ttlSeconds) {
      return client.expire(key, Math.ceil(ttlSeconds));
    },
    async incr(key, ttlSeconds) {
      const n = await client.incr(key);
      if (n === 1 && ttlSeconds && ttlSeconds > 0) await client.expire(key, Math.ceil(ttlSeconds));
      return n;
    },
    async sAdd(key, member, ttlSeconds) {
      const multi = client.multi().sAdd(key, member);
      if (ttlSeconds && ttlSeconds > 0) multi.expire(key, Math.ceil(ttlSeconds));
      await multi.exec();
    },
    async sMembers(key) {
      return client.sMembers(key);
    },
    async sRem(key, member) {
      await client.sRem(key, member);
    },
    async publish(channel, message) {
      await client.publish(channel, message);
    },
    async subscribe(channel, handler) {
      await sub.subscribe(channel, (message: string) => handler(message));
      return async () => {
        await sub.unsubscribe(channel);
      };
    },
    async close() {
      await Promise.allSettled([client.quit(), sub.quit()]);
    },
  };
}
