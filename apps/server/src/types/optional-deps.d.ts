declare module 'pg' {
  export default class Pool {
    constructor(opts: { connectionString: string });
    query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
  }
  export { Pool };
}

declare module 'redis' {
  export function createClient(opts: { url: string }): RedisClient;
  export interface RedisClient {
    duplicate(): RedisClient;
    connect(): Promise<void>;
    get(key: string): Promise<string | null>;
    set(key: string, value: string, opts?: { EX?: number }): Promise<unknown>;
    del(key: string): Promise<unknown>;
    publish(channel: string, message: string): Promise<unknown>;
    subscribe(channel: string, handler: (message: string) => void): Promise<unknown>;
    unsubscribe(channel: string): Promise<unknown>;
  }
}
