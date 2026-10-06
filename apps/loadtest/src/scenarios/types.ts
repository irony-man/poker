import type { Target } from '../config.js';
import type { TimedHttp } from '../core/http.js';
import type { Metrics } from '../core/stats.js';
import type { ConcreteScenarioId, RunConfig } from '../core/types.js';
import type { VirtualUser } from '../core/users.js';

export type ScenarioContext = {
  runId: string;
  config: RunConfig;
  target: Target;
  metrics: Metrics;
  http: TimedHttp;
  loadtestToken: string;
  /** Aborts when the run duration ends or an admin presses stop. */
  signal: AbortSignal;
  rampUpMs: number;
  users: VirtualUser[];
  log: (msg: string) => void;
};

export type Scenario = {
  id: ConcreteScenarioId;
  label: string;
  /** Accounts this scenario needs for the given config (allocated disjointly per scenario). */
  usersNeeded(config: RunConfig): number;
  /** Generate load until `ctx.signal` aborts, then clean up (leave tables, close sockets). */
  run(ctx: ScenarioContext): Promise<void>;
};
