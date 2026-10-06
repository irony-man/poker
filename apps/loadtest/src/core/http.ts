import type { Metrics } from './stats.js';

export const LOADTEST_TOKEN_HEADER = 'x-loadtest-token';

export type HttpResult<T> = {
  status: number;
  ok: boolean;
  ms: number;
  data: T | null;
  error?: string;
};

export type RequestOptions = {
  body?: unknown;
  token?: string;
  /** Default true: record into metrics under `label`. */
  record?: boolean;
  timeoutMs?: number;
};

/** `fetch` wrapper that times each call and records it under a stable route label. */
export class TimedHttp {
  constructor(
    private readonly baseUrl: string,
    private readonly metrics: Metrics | null,
    private readonly loadtestToken = '',
    private readonly timeoutMs = 15_000,
  ) {}

  async request<T = unknown>(
    label: string,
    method: string,
    path: string,
    opts: RequestOptions = {},
  ): Promise<HttpResult<T>> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
    if (this.loadtestToken) headers[LOADTEST_TOKEN_HEADER] = this.loadtestToken;

    const started = performance.now();
    let status = 0;
    let data: T | null = null;
    let error: string | undefined;
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        signal: AbortSignal.timeout(opts.timeoutMs ?? this.timeoutMs),
      });
      status = res.status;
      const text = await res.text();
      if (text) {
        try {
          data = JSON.parse(text) as T;
        } catch {
          data = null;
        }
      }
      if (!res.ok) {
        const msg = (data as { error?: unknown; message?: unknown } | null) ?? null;
        error = typeof msg?.error === 'string' ? msg.error : typeof msg?.message === 'string' ? msg.message : res.statusText;
      }
    } catch (err) {
      status = 0;
      error = err instanceof Error ? (err.name === 'TimeoutError' ? 'timeout' : err.message) : String(err);
    }
    const ms = performance.now() - started;
    if (opts.record !== false) this.metrics?.request(label, ms, status);
    return { status, ok: status >= 200 && status < 300, ms, data, error };
  }
}
