import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import path from 'node:path';
import type { ServiceConfig } from '../config.js';
import type { Run } from '../core/runner.js';
import { RunConfigSchema, SCENARIO_IDS, SOCKET_SCENARIO_IDS, API_ROUTE_KEYS } from '../core/types.js';
import { summarizeReport, type RunReport } from '../report/build.js';
import { DEFAULT_API_WEIGHTS } from '../scenarios/api.js';
import {
  LoginLimiter,
  clearSessionCookie,
  isAuthed,
  issueSession,
  safeEqual,
  sessionCookie,
} from './auth.js';
import { HttpError, RunManager, totalUsers } from './runs.js';
import { ReportStore, isRunId } from './store.js';

const MAX_BODY_BYTES = 64 * 1024;

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy':
    "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
};

const STATIC_FILES: Record<string, { file: string; type: string }> = {
  '/': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/index.html': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/app.js': { file: 'app.js', type: 'text/javascript; charset=utf-8' },
};

function send(res: ServerResponse, status: number, body: string, type: string, extra: Record<string, string> = {}): void {
  res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': type, 'Cache-Control': 'no-store', ...extra });
  res.end(body);
}

function json(res: ServerResponse, status: number, data: unknown, extra: Record<string, string> = {}): void {
  send(res, status, JSON.stringify(data), 'application/json; charset=utf-8', extra);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const type = req.headers['content-type'] ?? '';
  // JSON-only POSTs + SameSite=Strict cookie keep cross-site form posts out.
  if (!type.toLowerCase().startsWith('application/json')) throw new HttpError(415, 'Content-Type must be application/json');
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'Body too large');
    chunks.push(chunk as Buffer);
  }
  if (size === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Invalid JSON');
  }
}

function clientIp(req: IncomingMessage): string {
  return req.socket.remoteAddress ?? 'unknown';
}

/** Defaults the dashboard pre-fills (parsed through the schema so they never drift). */
function dashboardDefaults(config: ServiceConfig) {
  const base = RunConfigSchema.parse({
    target: config.targets[0]!.name,
    scenarios: ['api'],
    vus: Math.min(20, config.maxVus),
  });
  return { ...base, options: { ...base.options, api: { ...base.options.api, weights: DEFAULT_API_WEIGHTS } } };
}

function streamRun(req: IncomingMessage, res: ServerResponse, run: Run): void {
  res.writeHead(200, {
    ...SECURITY_HEADERS,
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const write = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  // Some proxies hold small streamed responses until a size threshold; pad past it.
  res.write(`:${' '.repeat(2048)}\n\n`);
  write('snapshot', run.live());

  const finish = (report: RunReport) => {
    write('snapshot', run.live());
    write('done', summarizeReport(report));
    cleanup();
    res.end();
  };
  if (run.report && !run.isActive) {
    finish(run.report);
    return;
  }
  const onTick = (snap: unknown) => write('snapshot', snap);
  const onLog = (line: string) => write('log', line);
  const onStatus = (status: string) => write('status', status);
  const heartbeat = setInterval(() => res.write(': keep-alive\n\n'), 15_000);
  run.on('tick', onTick);
  run.on('log', onLog);
  run.on('status', onStatus);
  run.once('done', finish);
  function cleanup() {
    clearInterval(heartbeat);
    run.off('tick', onTick);
    run.off('log', onLog);
    run.off('status', onStatus);
    run.off('done', finish);
  }
  req.on('close', cleanup);
}

export type AppDeps = { store: ReportStore; runs: RunManager };

export function createApp(config: ServiceConfig, deps: AppDeps): Server {
  const { store, runs } = deps;
  const limiter = new LoginLimiter();

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const p = url.pathname;
    const method = req.method ?? 'GET';

    if (method === 'GET' && p === '/health') return json(res, 200, { ok: true });

    const asset = method === 'GET' ? STATIC_FILES[p] : undefined;
    if (asset) {
      const body = await readFile(path.join(config.publicDir, asset.file), 'utf8');
      return send(res, 200, body, asset.type);
    }

    if (method === 'POST' && p === '/login') {
      const ip = clientIp(req);
      if (limiter.blocked(ip)) throw new HttpError(429, 'Too many failed attempts — try again later');
      const body = (await readJsonBody(req)) as { token?: unknown };
      if (typeof body.token !== 'string' || !safeEqual(body.token, config.adminToken)) {
        limiter.fail(ip);
        throw new HttpError(401, 'Invalid admin token');
      }
      limiter.reset(ip);
      return json(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(issueSession(config.adminToken), config.cookieSecure) });
    }
    if (method === 'POST' && p === '/logout') {
      return json(res, 200, { ok: true }, { 'Set-Cookie': clearSessionCookie(config.cookieSecure) });
    }

    if (!isAuthed(req, config.adminToken)) throw new HttpError(401, 'Sign in required');

    if (method === 'GET' && p === '/session') {
      return json(res, 200, {
        targets: config.targets,
        maxVus: config.maxVus,
        scenarios: SCENARIO_IDS,
        socketScenarios: SOCKET_SCENARIO_IDS,
        apiRoutes: API_ROUTE_KEYS,
        defaults: dashboardDefaults(config),
        loadtestTokenSet: Boolean(config.loadtestToken),
        activeRunId: runs.activeRun?.id ?? null,
      });
    }

    if (p === '/runs') {
      if (method === 'GET') {
        return json(res, 200, { active: runs.activeRun?.live() ?? null, runs: store.list() });
      }
      if (method === 'POST') {
        const body = await readJsonBody(req);
        const run = runs.start(body);
        return json(res, 201, { id: run.id, users: totalUsers(run.config), scenarios: run.scenarioIds });
      }
    }

    const runMatch = /^\/runs\/([^/]+)(\/events|\/stop)?$/.exec(p);
    if (runMatch) {
      const id = runMatch[1]!;
      if (!isRunId(id)) throw new HttpError(404, 'Run not found');
      const action = runMatch[2];
      const run = runs.get(id);
      if (method === 'GET' && !action) {
        if (run) return json(res, 200, run.live());
        const row = store.get(id);
        if (!row) throw new HttpError(404, 'Run not found');
        return json(res, 200, row);
      }
      if (method === 'GET' && action === '/events') {
        if (!run) throw new HttpError(404, 'Run is not live — open its report instead');
        return streamRun(req, res, run);
      }
      if (method === 'POST' && action === '/stop') {
        if (!run || !run.isActive) throw new HttpError(409, 'Run is not active');
        run.stop();
        return json(res, 202, { ok: true });
      }
    }

    const reportMatch = /^\/reports\/([^/]+)\.(json|html)$/.exec(p);
    if (method === 'GET' && reportMatch) {
      const [, id, ext] = reportMatch as unknown as [string, string, 'json' | 'html'];
      const body = await store.read(id, ext);
      if (body === null) throw new HttpError(404, 'Report not found');
      return send(res, 200, body, ext === 'json' ? 'application/json; charset=utf-8' : 'text/html; charset=utf-8', {
        'Content-Disposition': `inline; filename="loadtest-${id}.${ext}"`,
      });
    }

    throw new HttpError(404, 'Not found');
  }

  return createServer((req, res) => {
    handle(req, res).catch((err: unknown) => {
      const status = err instanceof HttpError ? err.status : 500;
      if (status === 500) console.error('[loadtest]', err);
      if (res.headersSent) {
        res.end();
        return;
      }
      json(res, status, { error: err instanceof HttpError ? err.message : 'Internal error' });
    });
  });
}
