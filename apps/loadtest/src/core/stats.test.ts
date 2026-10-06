import { describe, expect, it } from 'vitest';
import { Histogram, Metrics } from './stats.js';

describe('Histogram', () => {
  it('is empty-safe', () => {
    const h = new Histogram();
    expect(h.percentile(95)).toBe(0);
    expect(h.summary()).toMatchObject({ count: 0, p50: 0, p99: 0, max: 0 });
  });

  it('estimates percentiles within ~2% on a uniform 1..1000 ms distribution', () => {
    const h = new Histogram();
    for (let v = 1; v <= 1000; v++) h.record(v);
    const s = h.summary();
    expect(s.count).toBe(1000);
    expect(s.min).toBe(1);
    expect(s.max).toBe(1000);
    expect(s.mean).toBeCloseTo(500.5, 0);
    for (const [p, want] of [
      [50, 500],
      [90, 900],
      [95, 950],
      [99, 990],
    ] as const) {
      const got = h.percentile(p);
      expect(Math.abs(got - want) / want).toBeLessThan(0.025);
    }
  });

  it('clamps percentiles to observed min/max and ignores invalid samples', () => {
    const h = new Histogram();
    h.record(42);
    h.record(Number.NaN);
    h.record(-5);
    expect(h.count).toBe(1);
    expect(h.percentile(1)).toBe(42);
    expect(h.percentile(100)).toBe(42);
  });

  it('merges counts and extremes', () => {
    const a = new Histogram();
    const b = new Histogram();
    for (let v = 1; v <= 100; v++) a.record(v);
    for (let v = 101; v <= 200; v++) b.record(v);
    a.merge(b);
    expect(a.count).toBe(200);
    expect(a.max).toBe(200);
    expect(Math.abs(a.percentile(50) - 100) / 100).toBeLessThan(0.025);
  });
});

describe('Metrics', () => {
  it('tracks routes, error statuses and per-second windows', () => {
    const m = new Metrics();
    m.request('GET /a', 10, 200);
    m.request('GET /a', 20, 503);
    m.request('GET /b', 30, 0);
    m.observe('ws.ping', 5);
    m.wsOpened();
    m.wsOpened();
    m.wsClosed();
    m.wsIn(3);

    const route = m.routes.get('GET /a')!;
    expect(route.count).toBe(2);
    expect(route.errors).toBe(1);
    expect(route.statuses).toEqual({ '200': 1, '503': 1 });
    expect(m.errors.get('GET /a → 503')).toBe(1);
    expect(m.errors.get('GET /b → network')).toBe(1);

    const p1 = m.tick(m.startedAt + 1000);
    expect(p1).toMatchObject({ t: 1, requests: 3, errors: 2, wsOpen: 1, wsIn: 3 });
    expect(p1.wsP95['ws.ping']).toBe(5);

    const p2 = m.tick(m.startedAt + 2000);
    expect(p2).toMatchObject({ t: 2, requests: 0, errors: 0, httpP95: 0, wsOpen: 1 });
    expect(p2.wsP95).toEqual({});

    // A flush within the same second folds into the previous point instead of adding a zero dip.
    m.request('GET /a', 40, 200);
    const p3 = m.tick(m.startedAt + 2200);
    expect(p3).toBe(p2);
    expect(p3.requests).toBe(1);
    expect(m.timeline).toHaveLength(2);

    const snap = m.snapshot();
    expect(snap.totals).toMatchObject({ requests: 4, errors: 2, wsOpen: 1, wsPeakOpen: 2 });
    expect(snap.counters['ws.connections']).toBe(2);
  });
});
