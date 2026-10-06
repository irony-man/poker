import { randomBytes } from 'node:crypto';
import type { ServiceConfig } from '../config.js';
import { Run } from '../core/runner.js';
import { RunConfigSchema, resolveScenarios, type RunConfig } from '../core/types.js';
import { SCENARIOS } from '../scenarios/index.js';
import type { ReportStore } from './store.js';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function newRunId(now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15).toLowerCase();
  return `${stamp}-${randomBytes(3).toString('hex')}`;
}

/** Accounts the run will need across all resolved scenarios. */
export function totalUsers(config: RunConfig): number {
  return resolveScenarios(config).reduce((sum, id) => sum + SCENARIOS[id].usersNeeded(config), 0);
}

/** One run at a time; finished runs stay in memory until their report is persisted. */
export class RunManager {
  private active: Run | null = null;
  private finishing: Promise<void> | null = null;
  private readonly recent = new Map<string, Run>();

  constructor(
    private readonly config: ServiceConfig,
    private readonly store: ReportStore,
  ) {}

  get activeRun(): Run | null {
    return this.active;
  }

  get(id: string): Run | undefined {
    if (this.active?.id === id) return this.active;
    return this.recent.get(id);
  }

  start(input: unknown): Run {
    if (this.active) throw new HttpError(409, `Run ${this.active.id} is still ${this.active.status}`);
    const parsed = RunConfigSchema.safeParse(input);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; '));
    }
    const config = parsed.data;
    const target = this.config.targets.find((t) => t.name === config.target);
    if (!target) throw new HttpError(400, `Unknown target "${config.target}" (not in LOADTEST_TARGETS)`);

    const scenarios = resolveScenarios(config);
    const totalVus = config.vus * scenarios.length;
    if (totalVus > this.config.maxVus) {
      throw new HttpError(
        400,
        `${config.vus} VUs × ${scenarios.length} scenarios = ${totalVus} exceeds LOADTEST_MAX_VUS (${this.config.maxVus})`,
      );
    }

    const run = new Run(newRunId(), config, target, {
      loadtestToken: this.config.loadtestToken,
      reportsDir: this.config.reportsDir,
    });
    this.active = run;
    this.recent.set(run.id, run);
    this.finishing = run
      .execute()
      .then((report) => this.store.save(report))
      .catch((err) => run.log(`Failed to save report: ${err instanceof Error ? err.message : String(err)}`))
      .finally(() => {
        if (this.active === run) this.active = null;
        // Keep a short tail so late SSE subscribers still get the final snapshot.
        setTimeout(() => this.recent.delete(run.id), 10 * 60_000).unref();
      });
    return run;
  }

  /** Stop the active run (if any) and wait for its report to be written. */
  async shutdown(): Promise<void> {
    this.active?.stop('service shutting down');
    await this.finishing;
  }
}
