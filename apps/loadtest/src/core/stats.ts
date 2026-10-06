/**
 * Log-bucketed latency histogram: ~2% relative precision from 0.1 ms up to ~10 minutes,
 * constant memory regardless of sample count.
 */
const BASE_MS = 0.1;
const GROWTH = 1.02;
const LOG_GROWTH = Math.log(GROWTH);
const BUCKETS = 1000;

export type LatencySummary = {
  count: number;
  min: number;
  max: number;
  mean: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
};

const EMPTY_SUMMARY: LatencySummary = { count: 0, min: 0, max: 0, mean: 0, p50: 0, p90: 0, p95: 0, p99: 0 };

function bucketOf(ms: number): number {
  if (!(ms > BASE_MS)) return 0;
  return Math.min(BUCKETS - 1, Math.ceil(Math.log(ms / BASE_MS) / LOG_GROWTH));
}

function bucketUpper(idx: number): number {
  return BASE_MS * GROWTH ** idx;
}

function round(n: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

export class Histogram {
  private readonly counts = new Uint32Array(BUCKETS);
  count = 0;
  sum = 0;
  min = Number.POSITIVE_INFINITY;
  max = 0;

  record(ms: number): void {
    if (!Number.isFinite(ms) || ms < 0) return;
    this.counts[bucketOf(ms)]! += 1;
    this.count += 1;
    this.sum += ms;
    if (ms < this.min) this.min = ms;
    if (ms > this.max) this.max = ms;
  }

  merge(other: Histogram): void {
    for (let i = 0; i < BUCKETS; i++) this.counts[i]! += other.counts[i]!;
    this.count += other.count;
    this.sum += other.sum;
    if (other.min < this.min) this.min = other.min;
    if (other.max > this.max) this.max = other.max;
  }

  /** Upper bound of the bucket holding the p-th percentile, clamped to observed min/max. */
  percentile(p: number): number {
    if (this.count === 0) return 0;
    const rank = Math.max(1, Math.ceil((p / 100) * this.count));
    let seen = 0;
    for (let i = 0; i < BUCKETS; i++) {
      seen += this.counts[i]!;
      if (seen >= rank) return Math.min(this.max, Math.max(this.min, bucketUpper(i)));
    }
    return this.max;
  }

  summary(): LatencySummary {
    if (this.count === 0) return { ...EMPTY_SUMMARY };
    return {
      count: this.count,
      min: round(this.min),
      max: round(this.max),
      mean: round(this.sum / this.count),
      p50: round(this.percentile(50)),
      p90: round(this.percentile(90)),
      p95: round(this.percentile(95)),
      p99: round(this.percentile(99)),
    };
  }
}

export type RouteStats = {
  hist: Histogram;
  count: number;
  errors: number;
  statuses: Record<string, number>;
};

export type TimelinePoint = {
  /** Seconds since metrics start. */
  t: number;
  requests: number;
  errors: number;
  httpP50: number;
  httpP95: number;
  wsOpen: number;
  wsIn: number;
  wsOut: number;
  /** Per-second p95 for each WS latency metric seen in that second. */
  wsP95: Record<string, number>;
};

export type MetricsSnapshot = {
  elapsedSec: number;
  totals: {
    requests: number;
    errors: number;
    wsOpen: number;
    wsPeakOpen: number;
    wsIn: number;
    wsOut: number;
  };
  http: LatencySummary;
  last: TimelinePoint | null;
  counters: Record<string, number>;
};

/** HTTP status → error. 0 = network / timeout. */
export function isErrorStatus(status: number): boolean {
  return status === 0 || status >= 400;
}

export class Metrics {
  readonly startedAt = Date.now();
  readonly routes = new Map<string, RouteStats>();
  readonly latency = new Map<string, Histogram>();
  readonly counters = new Map<string, number>();
  readonly errors = new Map<string, number>();
  readonly timeline: TimelinePoint[] = [];
  readonly http = new Histogram();

  wsOpen = 0;
  wsPeakOpen = 0;
  private totalRequests = 0;
  private totalErrors = 0;
  private totalWsIn = 0;
  private totalWsOut = 0;

  private win = this.freshWindow();

  private freshWindow() {
    return {
      requests: 0,
      errors: 0,
      wsIn: 0,
      wsOut: 0,
      http: new Histogram(),
      ws: new Map<string, Histogram>(),
    };
  }

  /** One HTTP request. `status` 0 means network error / timeout. */
  request(label: string, ms: number, status: number): void {
    let r = this.routes.get(label);
    if (!r) {
      r = { hist: new Histogram(), count: 0, errors: 0, statuses: {} };
      this.routes.set(label, r);
    }
    const key = status === 0 ? 'network' : String(status);
    r.count += 1;
    r.statuses[key] = (r.statuses[key] ?? 0) + 1;
    r.hist.record(ms);
    this.http.record(ms);
    this.win.http.record(ms);
    this.totalRequests += 1;
    this.win.requests += 1;
    if (isErrorStatus(status)) {
      r.errors += 1;
      this.fail(`${label} → ${key}`);
    }
  }

  /** Named non-HTTP latency (e.g. `ws.connect`, `ws.ping`, `ws.chat_fanout`). */
  observe(name: string, ms: number): void {
    let h = this.latency.get(name);
    if (!h) {
      h = new Histogram();
      this.latency.set(name, h);
    }
    h.record(ms);
    let w = this.win.ws.get(name);
    if (!w) {
      w = new Histogram();
      this.win.ws.set(name, w);
    }
    w.record(ms);
  }

  count(name: string, n = 1): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + n);
  }

  counter(name: string): number {
    return this.counters.get(name) ?? 0;
  }

  fail(key: string): void {
    this.errors.set(key, (this.errors.get(key) ?? 0) + 1);
    this.totalErrors += 1;
    this.win.errors += 1;
  }

  wsOpened(): void {
    this.wsOpen += 1;
    if (this.wsOpen > this.wsPeakOpen) this.wsPeakOpen = this.wsOpen;
    this.count('ws.connections');
  }

  wsClosed(): void {
    this.wsOpen = Math.max(0, this.wsOpen - 1);
  }

  wsIn(n = 1): void {
    this.totalWsIn += n;
    this.win.wsIn += n;
  }

  wsOut(n = 1): void {
    this.totalWsOut += n;
    this.win.wsOut += n;
  }

  /** Close the current one-second window and append it to the timeline. */
  tick(now = Date.now()): TimelinePoint {
    const w = this.win;
    this.win = this.freshWindow();
    const wsP95: Record<string, number> = {};
    for (const [name, h] of w.ws) wsP95[name] = round(h.percentile(95));
    const point: TimelinePoint = {
      t: Math.round((now - this.startedAt) / 1000),
      requests: w.requests,
      errors: w.errors,
      httpP50: round(w.http.percentile(50)),
      httpP95: round(w.http.percentile(95)),
      wsOpen: this.wsOpen,
      wsIn: w.wsIn,
      wsOut: w.wsOut,
      wsP95,
    };
    const last = this.timeline.at(-1);
    if (last && last.t === point.t) {
      // Same second (e.g. the final flush right after an interval tick): fold into one point.
      last.requests += point.requests;
      last.errors += point.errors;
      last.wsIn += point.wsIn;
      last.wsOut += point.wsOut;
      last.wsOpen = point.wsOpen;
      last.httpP50 = Math.max(last.httpP50, point.httpP50);
      last.httpP95 = Math.max(last.httpP95, point.httpP95);
      for (const [name, v] of Object.entries(point.wsP95)) last.wsP95[name] = Math.max(last.wsP95[name] ?? 0, v);
      return last;
    }
    this.timeline.push(point);
    return point;
  }

  snapshot(now = Date.now()): MetricsSnapshot {
    return {
      elapsedSec: Math.round((now - this.startedAt) / 1000),
      totals: {
        requests: this.totalRequests,
        errors: this.totalErrors,
        wsOpen: this.wsOpen,
        wsPeakOpen: this.wsPeakOpen,
        wsIn: this.totalWsIn,
        wsOut: this.totalWsOut,
      },
      http: this.http.summary(),
      last: this.timeline.at(-1) ?? null,
      counters: Object.fromEntries(this.counters),
    };
  }

  get requests(): number {
    return this.totalRequests;
  }

  get errorCount(): number {
    return this.totalErrors;
  }

  get wsInTotal(): number {
    return this.totalWsIn;
  }

  get wsOutTotal(): number {
    return this.totalWsOut;
  }
}
