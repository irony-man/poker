/**
 * Key-value store with optional Redis. Falls back to in-memory Map when
 * REDIS_URL is unset — suitable for local MVP and tests.
 */
export interface KvStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  publish(channel: string, message: string): Promise<void>;
  subscribe(channel: string, handler: (message: string) => void): Promise<() => void>;
}

export class MemoryKv implements KvStore {
  private data = new Map<string, { value: string; expiresAt?: number }>();
  private subs = new Map<string, Set<(message: string) => void>>();

  async get(key: string): Promise<string | null> {
    const e = this.data.get(key);
    if (!e) return null;
    if (e.expiresAt && Date.now() > e.expiresAt) {
      this.data.delete(key);
      return null;
    }
    return e.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    this.data.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
    });
  }

  async del(key: string): Promise<void> {
    this.data.delete(key);
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
}

export async function createKv(): Promise<KvStore> {
  const url = process.env.REDIS_URL;
  if (!url) return new MemoryKv();

  try {
    // Dynamic import so redis is optional at runtime
    const { createClient } = await import('redis');
    const client = createClient({ url });
    const sub = client.duplicate();
    await client.connect();
    await sub.connect();

    return {
      async get(key) {
        return (await client.get(key)) as string | null;
      },
      async set(key, value, ttlSeconds) {
        if (ttlSeconds) await client.set(key, value, { EX: ttlSeconds });
        else await client.set(key, value);
      },
      async del(key) {
        await client.del(key);
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
    };
  } catch {
    console.warn('[kv] Redis unavailable, using in-memory store');
    return new MemoryKv();
  }
}
