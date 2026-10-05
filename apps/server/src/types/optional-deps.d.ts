declare module 'pg' {
  export default class Pool {
    constructor(opts: { connectionString: string });
    query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
  }
  export { Pool };
}
