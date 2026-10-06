import type { ApiRouteKey, RunConfig } from '../core/types.js';
import type { VirtualUser } from '../core/users.js';
import { jitter, rampDelay, sleep } from '../core/util.js';
import type { Scenario, ScenarioContext } from './types.js';

type RouteDef = {
  label: string;
  method: 'GET' | 'POST';
  path: (u: VirtualUser) => string;
  auth: boolean;
  body?: unknown;
};

export const API_ROUTES: Record<ApiRouteKey, RouteDef> = {
  health: { label: 'GET /health', method: 'GET', path: () => '/health', auth: false },
  site: { label: 'GET /api/site', method: 'GET', path: () => '/api/site', auth: false },
  tables: { label: 'GET /api/tables', method: 'GET', path: () => '/api/tables', auth: true },
  contests: { label: 'GET /api/contests', method: 'GET', path: () => '/api/contests', auth: true },
  me: { label: 'GET /api/me', method: 'GET', path: () => '/api/me', auth: true },
  user: {
    label: 'GET /api/users/:username',
    method: 'GET',
    path: (u) => `/api/users/${encodeURIComponent(u.username)}`,
    auth: true,
  },
  ticket: { label: 'POST /api/ticket', method: 'POST', path: () => '/api/ticket', auth: true, body: {} },
};

export const DEFAULT_API_WEIGHTS: Record<ApiRouteKey, number> = {
  health: 1,
  site: 2,
  tables: 4,
  contests: 2,
  me: 3,
  user: 2,
  ticket: 1,
};

/** Weighted picker over routes with weight > 0. */
export function makeRoutePicker(weights: Partial<Record<ApiRouteKey, number>> | undefined): () => ApiRouteKey {
  const merged = { ...DEFAULT_API_WEIGHTS, ...(weights ?? {}) };
  const entries = (Object.entries(merged) as [ApiRouteKey, number][]).filter(([, w]) => w > 0);
  if (entries.length === 0) throw new Error('All API route weights are zero');
  const total = entries.reduce((s, [, w]) => s + w, 0);
  return () => {
    let r = Math.random() * total;
    for (const [key, w] of entries) {
      r -= w;
      if (r < 0) return key;
    }
    return entries[entries.length - 1]![0];
  };
}

/** API calls share a smaller account pool — many workers per account is realistic for reads. */
function apiUsersNeeded(config: RunConfig): number {
  return Math.min(config.vus, 50);
}

async function hit(ctx: ScenarioContext, key: ApiRouteKey, user: VirtualUser): Promise<void> {
  const r = API_ROUTES[key];
  await ctx.http.request(r.label, r.method, r.path(user), {
    token: r.auth ? user.sessionToken : undefined,
    body: r.body,
  });
}

/** Closed model: each VU loops request → think time. */
async function closedLoop(ctx: ScenarioContext, pick: () => ApiRouteKey): Promise<void> {
  const { vus, options } = ctx.config;
  const workers = Array.from({ length: vus }, async (_, i) => {
    if (!(await sleep(rampDelay(i, vus, ctx.rampUpMs), ctx.signal))) return;
    const user = ctx.users[i % ctx.users.length]!;
    while (!ctx.signal.aborted) {
      await hit(ctx, pick(), user);
      if (options.api.thinkMs > 0 && !(await sleep(jitter(options.api.thinkMs), ctx.signal))) return;
    }
  });
  await Promise.all(workers);
}

/**
 * Open model: fire at `rps` (scaled up linearly during ramp-up) regardless of response time.
 * `vus` caps in-flight requests; arrivals beyond the cap are counted as `api.dropped`.
 */
async function openLoop(ctx: ScenarioContext, pick: () => ApiRouteKey, rps: number): Promise<void> {
  const maxInFlight = ctx.config.vus;
  const started = Date.now();
  const pending = new Set<Promise<void>>();
  let issued = 0;
  let userIdx = 0;
  while (!ctx.signal.aborted) {
    // Integral of the ramped rate: ramp phase contributes a triangle, then a rectangle.
    const rampSec = ctx.rampUpMs / 1000;
    const tSec = (Date.now() - started) / 1000;
    const due =
      rampSec > 0 && tSec < rampSec
        ? (rps * tSec * tSec) / (2 * rampSec)
        : rps * (tSec - rampSec / 2);
    while (issued < Math.floor(due)) {
      issued += 1;
      if (pending.size >= maxInFlight) {
        ctx.metrics.count('api.dropped');
        continue;
      }
      const user = ctx.users[userIdx++ % ctx.users.length]!;
      const p = hit(ctx, pick(), user).finally(() => pending.delete(p));
      pending.add(p);
    }
    if (!(await sleep(5, ctx.signal))) break;
  }
  await Promise.allSettled([...pending]);
}

export const apiScenario: Scenario = {
  id: 'api',
  label: 'REST API mix',
  usersNeeded: apiUsersNeeded,
  async run(ctx) {
    if (ctx.users.length === 0) throw new Error('no users');
    const pick = makeRoutePicker(ctx.config.options.api.weights);
    if (ctx.config.rps) {
      ctx.log(`open model at ${ctx.config.rps} req/s (max ${ctx.config.vus} in flight)`);
      await openLoop(ctx, pick, ctx.config.rps);
    } else {
      ctx.log(`closed model with ${ctx.config.vus} VUs, think ${ctx.config.options.api.thinkMs} ms`);
      await closedLoop(ctx, pick);
    }
  },
};
