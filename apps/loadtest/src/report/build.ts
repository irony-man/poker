import type { Target } from '../config.js';
import type { Metrics, LatencySummary, TimelinePoint } from '../core/stats.js';
import type { ConcreteScenarioId, RunConfig, RunStatus } from '../core/types.js';
import type { PrepareProgress } from '../core/users.js';

export type RouteReport = {
  label: string;
  count: number;
  errors: number;
  errorRatePct: number;
  rps: number;
  latency: LatencySummary;
  statuses: Record<string, number>;
};

export type ThresholdCheck = {
  name: string;
  value: number;
  limit: number;
  unit: 'ms' | '%';
  passed: boolean;
};

export type RunReport = {
  version: 1;
  id: string;
  status: RunStatus;
  statusReason: string | null;
  target: Target;
  config: RunConfig;
  scenarios: ConcreteScenarioId[];
  allocation: Partial<Record<ConcreteScenarioId, number>>;
  createdAt: string;
  startedAt: string | null;
  endedAt: string;
  durationSec: number;
  prepare: PrepareProgress & { ms: number };
  summary: {
    requests: number;
    httpErrors: number;
    httpErrorRatePct: number;
    rps: number;
    http: LatencySummary;
    wsConnections: number;
    wsPeakOpen: number;
    wsDrops: number;
    wsDropRatePct: number;
    wsMessagesIn: number;
    wsMessagesOut: number;
    totalErrors: number;
  };
  thresholds: { passed: boolean; checks: ThresholdCheck[] };
  routes: RouteReport[];
  ws: Record<string, LatencySummary>;
  scenarioStats: {
    chat?: { sent: number; received: number; expected: number; deliveryPct: number };
    gameplay?: { tables: number; players: number; hands: number; handsPerMin: number; actions: number; topUps: number };
    rooms?: { tables: number; players: number; spectators: number };
    api?: { dropped: number };
  };
  counters: Record<string, number>;
  errors: { key: string; count: number }[];
  timeline: TimelinePoint[];
  log: string[];
};

/** Minimal view of a run needed to build its report (keeps this module free of runner imports). */
export type RunLike = {
  id: string;
  config: RunConfig;
  target: Target;
  scenarioIds: ConcreteScenarioId[];
  allocation: Partial<Record<ConcreteScenarioId, number>>;
  createdAt: number;
  startedAt: number | null;
  endedAt: number | null;
  prepare: PrepareProgress & { ms: number };
  metrics: Metrics | null;
  logs: string[];
};

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 10_000) / 100 : 0;
}

function perSec(n: number, sec: number): number {
  return sec > 0 ? Math.round((n / sec) * 100) / 100 : 0;
}

const EMPTY_LATENCY: LatencySummary = { count: 0, min: 0, max: 0, mean: 0, p50: 0, p90: 0, p95: 0, p99: 0 };

export function evaluateThresholds(
  thresholds: RunConfig['thresholds'],
  summary: RunReport['summary'],
  ws: Record<string, LatencySummary>,
): RunReport['thresholds'] {
  const checks: ThresholdCheck[] = [];
  if (summary.requests > 0) {
    checks.push({ name: 'HTTP p95 latency', value: summary.http.p95, limit: thresholds.p95Ms, unit: 'ms', passed: summary.http.p95 <= thresholds.p95Ms });
    checks.push({
      name: 'HTTP error rate',
      value: summary.httpErrorRatePct,
      limit: thresholds.errorRatePct,
      unit: '%',
      passed: summary.httpErrorRatePct <= thresholds.errorRatePct,
    });
  }
  const ping = ws['ws.ping'];
  if (ping && ping.count > 0) {
    checks.push({ name: 'WS ping p95', value: ping.p95, limit: thresholds.p95Ms, unit: 'ms', passed: ping.p95 <= thresholds.p95Ms });
  }
  for (const [name, label] of [
    ['ws.chat_fanout', 'Chat fan-out p95'],
    ['ws.action_to_state', 'Action → state p95'],
  ] as const) {
    const s = ws[name];
    if (s && s.count > 0) {
      checks.push({ name: label, value: s.p95, limit: thresholds.p95Ms, unit: 'ms', passed: s.p95 <= thresholds.p95Ms });
    }
  }
  if (summary.wsConnections > 0) {
    checks.push({
      name: 'WS drop rate',
      value: summary.wsDropRatePct,
      limit: thresholds.errorRatePct,
      unit: '%',
      passed: summary.wsDropRatePct <= thresholds.errorRatePct,
    });
  }
  return { passed: checks.length > 0 && checks.every((c) => c.passed), checks };
}

export function buildReport(run: RunLike, status: RunStatus, statusReason: string | null): RunReport {
  const m = run.metrics;
  const endedAt = run.endedAt ?? Date.now();
  const durationSec = run.startedAt ? Math.max(1, Math.round((endedAt - run.startedAt) / 1000)) : 0;
  const counters = m ? Object.fromEntries(m.counters) : {};
  const c = (k: string) => counters[k] ?? 0;

  const routes: RouteReport[] = m
    ? [...m.routes.entries()]
        .map(([label, r]) => ({
          label,
          count: r.count,
          errors: r.errors,
          errorRatePct: pct(r.errors, r.count),
          rps: perSec(r.count, durationSec),
          latency: r.hist.summary(),
          statuses: r.statuses,
        }))
        .sort((a, b) => b.count - a.count)
    : [];

  const ws: Record<string, LatencySummary> = {};
  if (m) for (const [name, h] of [...m.latency.entries()].sort()) ws[name] = h.summary();

  const httpErrors = routes.reduce((s, r) => s + r.errors, 0);
  const requests = m?.requests ?? 0;
  const wsConnections = c('ws.connections');
  const summary: RunReport['summary'] = {
    requests,
    httpErrors,
    httpErrorRatePct: pct(httpErrors, requests),
    rps: perSec(requests, durationSec),
    http: m?.http.summary() ?? { ...EMPTY_LATENCY },
    wsConnections,
    wsPeakOpen: m?.wsPeakOpen ?? 0,
    wsDrops: c('ws.drops'),
    wsDropRatePct: pct(c('ws.drops'), wsConnections),
    wsMessagesIn: m?.wsInTotal ?? 0,
    wsMessagesOut: m?.wsOutTotal ?? 0,
    totalErrors: m?.errorCount ?? 0,
  };

  const scenarioStats: RunReport['scenarioStats'] = {};
  if (run.scenarioIds.includes('socket-rooms')) {
    scenarioStats.rooms = { tables: c('rooms.tables'), players: c('rooms.players'), spectators: c('rooms.spectators') };
    scenarioStats.chat = {
      sent: c('chat.sent'),
      received: c('chat.received'),
      expected: c('chat.expected'),
      deliveryPct: Math.min(100, pct(c('chat.received'), c('chat.expected'))),
    };
  }
  if (run.scenarioIds.includes('gameplay')) {
    scenarioStats.gameplay = {
      tables: c('poker.tables'),
      players: c('poker.players'),
      hands: c('poker.hands'),
      handsPerMin: durationSec > 0 ? Math.round((c('poker.hands') / durationSec) * 60 * 10) / 10 : 0,
      actions: c('poker.actions'),
      topUps: c('poker.top_ups'),
    };
  }
  if (run.scenarioIds.includes('api')) scenarioStats.api = { dropped: c('api.dropped') };

  const errors = m
    ? [...m.errors.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count)
    : [];

  return {
    version: 1,
    id: run.id,
    status,
    statusReason,
    target: run.target,
    config: run.config,
    scenarios: run.scenarioIds,
    allocation: run.allocation,
    createdAt: new Date(run.createdAt).toISOString(),
    startedAt: run.startedAt ? new Date(run.startedAt).toISOString() : null,
    endedAt: new Date(endedAt).toISOString(),
    durationSec,
    prepare: run.prepare,
    summary,
    thresholds: evaluateThresholds(run.config.thresholds, summary, ws),
    routes,
    ws,
    scenarioStats,
    counters,
    errors,
    timeline: m?.timeline ?? [],
    log: run.logs.slice(-200),
  };
}

/** Compact listing row for the dashboard's past-runs table. */
export type RunSummaryRow = {
  id: string;
  status: RunStatus;
  target: string;
  scenarios: ConcreteScenarioId[];
  vus: number;
  startedAt: string | null;
  createdAt: string;
  durationSec: number;
  requests: number;
  rps: number;
  httpP95: number;
  errors: number;
  wsPeakOpen: number;
  passed: boolean;
};

export function summarizeReport(r: RunReport): RunSummaryRow {
  return {
    id: r.id,
    status: r.status,
    target: r.target.name,
    scenarios: r.scenarios,
    vus: r.config.vus,
    startedAt: r.startedAt,
    createdAt: r.createdAt,
    durationSec: r.durationSec,
    requests: r.summary.requests,
    rps: r.summary.rps,
    httpP95: r.summary.http.p95,
    errors: r.summary.totalErrors,
    wsPeakOpen: r.summary.wsPeakOpen,
    passed: r.thresholds.passed,
  };
}
