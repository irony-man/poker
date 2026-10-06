import { EventEmitter } from 'node:events';
import path from 'node:path';
import type { Target } from '../config.js';
import { buildReport, type RunReport } from '../report/build.js';
import { SCENARIOS } from '../scenarios/index.js';
import type { ScenarioContext } from '../scenarios/types.js';
import { TimedHttp } from './http.js';
import { Metrics, type MetricsSnapshot } from './stats.js';
import { resolveScenarios, type ConcreteScenarioId, type RunConfig, type RunStatus } from './types.js';
import { UserPool, poolFileName, type PrepareProgress, type VirtualUser } from './users.js';
import { errorMessage, sleep } from './util.js';

const TEARDOWN_TIMEOUT_MS = 20_000;
const LOG_LIMIT = 500;

export type LiveSnapshot = {
  id: string;
  status: RunStatus;
  target: string;
  scenarios: ConcreteScenarioId[];
  createdAt: number;
  startedAt: number | null;
  durationSec: number;
  prepare: PrepareProgress & { ms: number };
  metrics: MetricsSnapshot | null;
  logTail: string[];
};

export type RunDeps = {
  loadtestToken: string;
  reportsDir: string;
};

/**
 * One load-test run: prepares accounts, runs the selected scenarios concurrently for the
 * configured duration, emits a live snapshot every second, and builds the final report.
 *
 * Events: `tick` (LiveSnapshot), `log` (string), `status` (RunStatus), `done` (RunReport).
 */
export class Run extends EventEmitter {
  status: RunStatus = 'preparing';
  readonly createdAt = Date.now();
  startedAt: number | null = null;
  endedAt: number | null = null;
  metrics: Metrics | null = null;
  report: RunReport | null = null;
  readonly scenarioIds: ConcreteScenarioId[];
  readonly logs: string[] = [];
  prepare: PrepareProgress & { ms: number } = { done: 0, total: 0, created: 0, reused: 0, failed: 0, ms: 0 };
  readonly allocation: Partial<Record<ConcreteScenarioId, number>> = {};

  private readonly stopCtrl = new AbortController();
  private readonly scenarioCtrl = new AbortController();
  private stopReason: string | null = null;

  constructor(
    readonly id: string,
    readonly config: RunConfig,
    readonly target: Target,
    private readonly deps: RunDeps,
  ) {
    super();
    this.scenarioIds = resolveScenarios(config);
  }

  log(msg: string): void {
    const line = `${new Date().toISOString().slice(11, 19)} ${msg}`;
    this.logs.push(line);
    if (this.logs.length > LOG_LIMIT) this.logs.splice(0, this.logs.length - LOG_LIMIT);
    this.emit('log', line);
  }

  private setStatus(status: RunStatus): void {
    this.status = status;
    this.emit('status', status);
  }

  get isActive(): boolean {
    return this.status === 'preparing' || this.status === 'running' || this.status === 'stopping';
  }

  stop(reason = 'stopped by admin'): void {
    if (!this.isActive || this.stopCtrl.signal.aborted) return;
    this.stopReason = reason;
    this.log(`Stop requested: ${reason}`);
    this.stopCtrl.abort();
    this.scenarioCtrl.abort();
  }

  live(): LiveSnapshot {
    return {
      id: this.id,
      status: this.status,
      target: this.target.name,
      scenarios: this.scenarioIds,
      createdAt: this.createdAt,
      startedAt: this.startedAt,
      durationSec: this.config.durationSec,
      prepare: this.prepare,
      metrics: this.metrics?.snapshot() ?? null,
      logTail: this.logs.slice(-20),
    };
  }

  async execute(): Promise<RunReport> {
    let failure: string | null = null;
    try {
      await this.runPhases();
    } catch (err) {
      failure = errorMessage(err);
      this.log(`Run failed: ${failure}`);
    }
    this.endedAt = Date.now();
    const finalStatus: RunStatus = failure ? 'failed' : this.stopReason ? 'stopped' : 'finished';
    this.report = buildReport(this, finalStatus, failure ?? this.stopReason);
    this.setStatus(finalStatus);
    this.log(`Run ${finalStatus}`);
    this.emit('done', this.report);
    return this.report;
  }

  private async runPhases(): Promise<void> {
    const scenarios = this.scenarioIds.map((id) => SCENARIOS[id]);
    const needs = scenarios.map((s) => s.usersNeeded(this.config));
    const total = needs.reduce((a, b) => a + b, 0);
    this.log(
      `Preparing ${total} accounts for ${scenarios.map((s, i) => `${s.id}(${needs[i]})`).join(', ')} on ${this.target.name}`,
    );
    if (!this.deps.loadtestToken) {
      this.log('LOADTEST_TOKEN is not set — the target will rate-limit signups and requests');
    }

    const prepHttp = new TimedHttp(this.target.apiUrl, null, this.deps.loadtestToken);
    const pool = new UserPool(
      path.join(this.deps.reportsDir, poolFileName(this.target.apiUrl)),
      prepHttp,
      (m) => this.log(m),
    );
    let lastEmit = 0;
    const prep = await pool.ensure(total, this.stopCtrl.signal, (p) => {
      this.prepare = { ...p, ms: 0 };
      if (Date.now() - lastEmit > 500) {
        lastEmit = Date.now();
        this.emit('tick', this.live());
      }
    });
    this.prepare = { done: prep.done, total: prep.total, created: prep.created, reused: prep.reused, failed: prep.failed, ms: prep.ms };
    this.log(`Accounts ready: ${prep.users.length}/${total} (created ${prep.created}, reused ${prep.reused}, failed ${prep.failed}) in ${prep.ms} ms`);
    if (this.stopCtrl.signal.aborted) return;
    if (prep.users.length === 0) throw new Error('No virtual users could be prepared');

    const metrics = new Metrics();
    this.metrics = metrics;
    this.startedAt = Date.now();
    this.setStatus('running');

    const tickTimer = setInterval(() => {
      metrics.tick();
      this.emit('tick', this.live());
    }, 1000);

    const durationMs = this.config.durationSec * 1000;
    const durationTimer = setTimeout(() => {
      this.log('Duration reached — winding down');
      this.scenarioCtrl.abort();
    }, durationMs);

    let offset = 0;
    const runs = scenarios.map((scenario, i) => {
      const slice: VirtualUser[] = prep.users.slice(offset, offset + needs[i]!);
      offset += needs[i]!;
      this.allocation[scenario.id] = slice.length;
      if (slice.length < needs[i]!) {
        this.log(`${scenario.id}: only ${slice.length}/${needs[i]} accounts available`);
      }
      const ctx: ScenarioContext = {
        runId: this.id,
        config: this.config,
        target: this.target,
        metrics,
        http: new TimedHttp(this.target.apiUrl, metrics, this.deps.loadtestToken),
        loadtestToken: this.deps.loadtestToken,
        signal: this.scenarioCtrl.signal,
        rampUpMs: this.config.rampUpSec * 1000,
        users: slice,
        log: (m) => this.log(`[${scenario.id}] ${m}`),
      };
      this.log(`Starting ${scenario.label} with ${slice.length} users`);
      return scenario.run(ctx).catch((err) => {
        metrics.fail(`${scenario.id} crashed: ${errorMessage(err)}`);
        this.log(`${scenario.id} crashed: ${errorMessage(err)}`);
      });
    });

    await new Promise<void>((resolve) => {
      if (this.scenarioCtrl.signal.aborted) resolve();
      else this.scenarioCtrl.signal.addEventListener('abort', () => resolve(), { once: true });
    });
    clearTimeout(durationTimer);
    this.setStatus('stopping');

    const settled = await Promise.race([
      Promise.all(runs).then(() => true),
      sleep(TEARDOWN_TIMEOUT_MS).then(() => false),
    ]);
    if (!settled) this.log(`Teardown exceeded ${TEARDOWN_TIMEOUT_MS / 1000}s — finalizing anyway`);
    clearInterval(tickTimer);
    metrics.tick();
  }
}
