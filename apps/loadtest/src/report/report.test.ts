import { describe, expect, it } from 'vitest';
import { Metrics } from '../core/stats.js';
import { RunConfigSchema } from '../core/types.js';
import { buildReport, summarizeReport, type RunLike } from './build.js';
import { renderReportHtml } from './html.js';
import { lineChart, niceMax } from './svg.js';

function fakeRun(overrides: Partial<RunLike> = {}): RunLike {
  const metrics = new Metrics();
  for (let i = 0; i < 100; i++) metrics.request('GET /api/tables', 10 + i, i < 98 ? 200 : 500);
  metrics.observe('ws.ping', 12);
  metrics.observe('ws.chat_fanout', 30);
  metrics.wsOpened();
  metrics.count('chat.sent', 10);
  metrics.count('chat.expected', 40);
  metrics.count('chat.received', 39);
  metrics.fail('ws error: <script>alert(1)</script>');
  metrics.tick(metrics.startedAt + 1000);
  metrics.tick(metrics.startedAt + 2000);
  const startedAt = Date.now() - 10_000;
  return {
    id: '20261006-120000-abc123',
    config: RunConfigSchema.parse({
      target: 'local',
      scenarios: ['api', 'socket-rooms'],
      vus: 10,
      thresholds: { p95Ms: 200, errorRatePct: 1 },
    }),
    target: { name: 'local', apiUrl: 'http://127.0.0.1:4000', wsUrl: 'ws://127.0.0.1:4000/ws' },
    scenarioIds: ['api', 'socket-rooms'],
    allocation: { api: 10, 'socket-rooms': 10 },
    createdAt: startedAt - 2000,
    startedAt,
    endedAt: startedAt + 10_000,
    prepare: { done: 20, total: 20, created: 5, reused: 15, failed: 0, ms: 1234 },
    metrics,
    logs: ['12:00:00 started'],
    ...overrides,
  };
}

describe('buildReport', () => {
  it('summarizes routes, websockets, scenario stats and thresholds', () => {
    const r = buildReport(fakeRun(), 'finished', null);
    expect(r.durationSec).toBe(10);
    expect(r.summary.requests).toBe(100);
    expect(r.summary.httpErrors).toBe(2);
    expect(r.summary.httpErrorRatePct).toBe(2);
    expect(r.summary.rps).toBe(10);
    expect(r.routes[0]).toMatchObject({ label: 'GET /api/tables', count: 100, errors: 2, statuses: { '200': 98, '500': 2 } });
    expect(r.ws['ws.ping']?.count).toBe(1);
    expect(r.scenarioStats.chat).toEqual({ sent: 10, received: 39, expected: 40, deliveryPct: 97.5 });
    expect(r.timeline).toHaveLength(2);

    const byName = Object.fromEntries(r.thresholds.checks.map((c) => [c.name, c]));
    expect(byName['HTTP p95 latency']?.passed).toBe(true);
    expect(byName['HTTP error rate']?.passed).toBe(false);
    expect(byName['WS ping p95']?.passed).toBe(true);
    expect(byName['Chat fan-out p95']?.passed).toBe(true);
    expect(r.thresholds.passed).toBe(false);

    expect(summarizeReport(r)).toMatchObject({ id: r.id, requests: 100, passed: false, target: 'local' });
  });

  it('handles a run stopped before load started', () => {
    const r = buildReport(fakeRun({ metrics: null, startedAt: null }), 'stopped', 'stopped by admin');
    expect(r.durationSec).toBe(0);
    expect(r.summary.requests).toBe(0);
    expect(r.thresholds).toEqual({ passed: false, checks: [] });
    expect(renderReportHtml(r)).toContain('No HTTP traffic in this run.');
  });
});

describe('renderReportHtml', () => {
  it('renders a self-contained page with charts and escapes untrusted text', () => {
    const html = renderReportHtml(buildReport(fakeRun(), 'finished', null));
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('FAILED THRESHOLDS');
    expect(html).toContain('<svg');
    expect(html).toContain('GET /api/tables');
    expect(html).toContain('Chat delivery');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toMatch(/<script|<link|src="http/);
  });
});

describe('svg helpers', () => {
  it('picks nice axis maxima', () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(7)).toBe(10);
    expect(niceMax(130)).toBe(200);
    expect(niceMax(2400)).toBe(2500);
  });

  it('breaks lines on missing samples', () => {
    const svg = lineChart({ title: 't', xs: [1, 2, 3, 4], series: [{ name: 's', color: '#fff', values: [1, Number.NaN, 3, 4] }] });
    expect(svg.match(/<polyline/g)).toHaveLength(2);
  });
});
