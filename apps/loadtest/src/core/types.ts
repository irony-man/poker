import { z } from 'zod';

export const SCENARIO_IDS = ['api', 'socket-basic', 'socket-rooms', 'gameplay', 'mixed'] as const;
export type ScenarioId = (typeof SCENARIO_IDS)[number];
/** Scenarios that actually execute (`mixed` expands to `api` + one socket scenario). */
export type ConcreteScenarioId = Exclude<ScenarioId, 'mixed'>;
export const SOCKET_SCENARIO_IDS = ['socket-basic', 'socket-rooms', 'gameplay'] as const;

export const API_ROUTE_KEYS = ['health', 'site', 'tables', 'contests', 'me', 'user', 'ticket'] as const;
export type ApiRouteKey = (typeof API_ROUTE_KEYS)[number];

export const RunConfigSchema = z
  .object({
    target: z.string().min(1),
    scenarios: z.array(z.enum(SCENARIO_IDS)).min(1),
    /** Virtual users per selected scenario. */
    vus: z.number().int().min(1).max(100_000),
    rampUpSec: z.number().int().min(0).max(3600).default(10),
    /** Total run length including ramp-up. */
    durationSec: z.number().int().min(5).max(7200).default(60),
    /** `api` only: open-model target request rate (VUs cap in-flight requests). */
    rps: z.number().int().min(1).max(100_000).optional(),
    thresholds: z
      .object({
        p95Ms: z.number().positive().max(600_000).default(500),
        errorRatePct: z.number().min(0).max(100).default(1),
      })
      .default({}),
    options: z
      .object({
        api: z
          .object({
            thinkMs: z.number().int().min(0).max(60_000).default(200),
            weights: z.record(z.enum(API_ROUTE_KEYS), z.number().min(0).max(1000)).optional(),
          })
          .default({}),
        socket: z
          .object({
            pingIntervalMs: z.number().int().min(250).max(60_000).default(5000),
          })
          .default({}),
        rooms: z
          .object({
            seatsPerTable: z.number().int().min(2).max(9).default(6),
            spectatorsPerTable: z.number().int().min(0).max(100).default(2),
            /** Server allows 10 chats / 5s per user; keep comfortably below. */
            chatIntervalMs: z.number().int().min(600).max(120_000).default(3000),
          })
          .default({}),
        gameplay: z
          .object({
            seatsPerTable: z.number().int().min(2).max(9).default(4),
            /** Think time before acting on your turn. */
            turnDelayMs: z.number().int().min(0).max(20_000).default(300),
            /** Chance (0–100) to bet/raise the minimum instead of check/call. */
            raisePct: z.number().min(0).max(100).default(10),
            bigBlind: z.number().int().min(2).max(10_000).default(10),
            buyIn: z.number().int().min(20).max(1_000_000).default(1000),
          })
          .default({}),
        mixedSocket: z.enum(SOCKET_SCENARIO_IDS).default('socket-basic'),
      })
      .default({}),
  })
  .refine((c) => c.rampUpSec < c.durationSec, {
    message: 'rampUpSec must be shorter than durationSec',
    path: ['rampUpSec'],
  });

export type RunConfig = z.infer<typeof RunConfigSchema>;
export type RunConfigInput = z.input<typeof RunConfigSchema>;

/** `mixed` → `api` + configured socket scenario; duplicates removed, order stable. */
export function resolveScenarios(config: Pick<RunConfig, 'scenarios' | 'options'>): ConcreteScenarioId[] {
  const out: ConcreteScenarioId[] = [];
  const add = (id: ConcreteScenarioId) => {
    if (!out.includes(id)) out.push(id);
  };
  for (const id of config.scenarios) {
    if (id === 'mixed') {
      add('api');
      add(config.options.mixedSocket);
    } else {
      add(id);
    }
  }
  return out;
}

export type RunStatus = 'preparing' | 'running' | 'stopping' | 'finished' | 'stopped' | 'failed';
