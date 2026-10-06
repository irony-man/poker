import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { TimedHttp } from './http.js';

export type VirtualUser = {
  username: string;
  userId: string;
  name: string;
  sessionToken: string;
  ticket: string;
};

type PoolFile = {
  version: 1;
  /** Short random tag so usernames don't collide across pools: `lt_<tag>_<n>`. */
  tag: string;
  password: string;
  users: VirtualUser[];
};

type AuthResponse = {
  userId?: string;
  name?: string;
  username?: string;
  sessionToken?: string;
  ticket?: string;
};

export type PrepareProgress = { done: number; total: number; created: number; reused: number; failed: number };

export type PrepareResult = PrepareProgress & { users: VirtualUser[]; ms: number };

export function poolFileName(apiUrl: string): string {
  const host = new URL(apiUrl).host.replace(/[^a-zA-Z0-9.-]+/g, '_');
  return `users-${host}.json`;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!, i);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * Virtual users backed by real accounts on the target. Accounts are cached per target so
 * repeated runs reuse them (tickets are refreshed each run; expired sessions re-login).
 */
export class UserPool {
  private data: PoolFile | null = null;

  constructor(
    private readonly file: string,
    private readonly http: TimedHttp,
    private readonly log: (msg: string) => void = () => undefined,
  ) {}

  private async load(): Promise<PoolFile> {
    if (this.data) return this.data;
    try {
      const parsed = JSON.parse(await readFile(this.file, 'utf8')) as PoolFile;
      if (parsed?.version === 1 && parsed.tag && parsed.password && Array.isArray(parsed.users)) {
        this.data = parsed;
        return parsed;
      }
    } catch {
      // Missing or corrupt cache → start a fresh pool.
    }
    this.data = {
      version: 1,
      tag: randomBytes(4).toString('hex').slice(0, 5),
      password: randomBytes(12).toString('hex'),
      users: [],
    };
    return this.data;
  }

  private async save(): Promise<void> {
    if (!this.data) return;
    await mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(this.data, null, 2), { mode: 0o600 });
    await rename(tmp, this.file);
  }

  /** Make sure `count` usable users exist, each with a fresh WS ticket. */
  async ensure(
    count: number,
    signal: AbortSignal,
    onProgress: (p: PrepareProgress) => void = () => undefined,
  ): Promise<PrepareResult> {
    const started = Date.now();
    const pool = await this.load();
    const progress: PrepareProgress = { done: 0, total: count, created: 0, reused: 0, failed: 0 };
    const indexes = Array.from({ length: count }, (_, i) => i);
    let lastSave = Date.now();

    const results = await mapLimit(indexes, 8, async (i) => {
      if (signal.aborted) return null;
      const cached = pool.users[i];
      let user: VirtualUser | null = null;
      if (cached) {
        user = await this.refresh(cached, pool.password);
        if (user) progress.reused += 1;
      }
      if (!user) {
        user = await this.create(i, pool);
        if (user) progress.created += 1;
      }
      if (user) pool.users[i] = user;
      else progress.failed += 1;
      progress.done += 1;
      onProgress({ ...progress });
      if (Date.now() - lastSave > 5000) {
        lastSave = Date.now();
        await this.save().catch(() => undefined);
      }
      return user;
    });

    await this.save();
    const users = results.filter((u): u is VirtualUser => u !== null);
    return { ...progress, users, ms: Date.now() - started };
  }

  private async refresh(user: VirtualUser, password: string): Promise<VirtualUser | null> {
    const t = await this.http.request<AuthResponse>('prep POST /api/ticket', 'POST', '/api/ticket', {
      body: {},
      token: user.sessionToken,
      record: false,
    });
    if (t.ok && t.data?.ticket) return { ...user, ticket: t.data.ticket };
    if (t.status !== 401 && t.status !== 403) {
      this.log(`ticket refresh failed for ${user.username}: ${t.status} ${t.error ?? ''}`);
      return null;
    }
    const login = await this.http.request<AuthResponse>('prep POST /api/login', 'POST', '/api/login', {
      body: { username: user.username, password },
      record: false,
    });
    return toUser(login.data, user.username);
  }

  private async create(index: number, pool: PoolFile): Promise<VirtualUser | null> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const suffix = attempt === 0 ? '' : `x${randomBytes(2).toString('hex')}`;
      const username = `lt_${pool.tag}_${index}${suffix}`;
      const res = await this.http.request<AuthResponse>('prep POST /api/signup', 'POST', '/api/signup', {
        body: { username, password: pool.password },
        record: false,
      });
      const user = toUser(res.data, username);
      if (res.ok && user) return user;
      if (res.status === 409) {
        // Username exists (e.g. cache lost) — try logging in with our password first.
        const login = await this.http.request<AuthResponse>('prep POST /api/login', 'POST', '/api/login', {
          body: { username, password: pool.password },
          record: false,
        });
        const existing = toUser(login.data, username);
        if (login.ok && existing) return existing;
        continue;
      }
      this.log(`signup failed for ${username}: ${res.status} ${res.error ?? ''}`);
      if (res.status === 429) {
        this.log('signup is rate limited — set LOADTEST_TOKEN on both the target server and this service');
      }
      return null;
    }
    return null;
  }
}

function toUser(data: AuthResponse | null, username: string): VirtualUser | null {
  if (!data?.userId || !data.sessionToken || !data.ticket) return null;
  return {
    username: data.username ?? username,
    userId: data.userId,
    name: data.name ?? username,
    sessionToken: data.sessionToken,
    ticket: data.ticket,
  };
}
