import type { LatencySummary } from '../core/stats.js';
import type { RunReport } from './build.js';
import { PALETTE, escapeHtml as e, lineChart } from './svg.js';

const WS_LABELS: Record<string, string> = {
  'ws.connect': 'Connect (TCP + upgrade)',
  'ws.auth': 'Auth → auth_ok',
  'ws.lobby_sync': 'Connect → lobby sync',
  'ws.ping': 'Ping → pong',
  'ws.join_table': 'join_table → state_sync',
  'ws.chat_fanout': 'Chat fan-out',
  'ws.action_to_state': 'Action → next state_sync',
};

function num(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function latencyCells(l: LatencySummary): string {
  return [l.p50, l.p90, l.p95, l.p99, l.max, l.mean].map((v) => `<td class="n">${num(v)}</td>`).join('');
}

function tile(label: string, value: string, sub = ''): string {
  return `<div class="tile"><div class="tl">${e(label)}</div><div class="tv">${e(value)}</div>${sub ? `<div class="ts">${e(sub)}</div>` : ''}</div>`;
}

const STYLE = `
:root{color-scheme:dark}
body{margin:0;background:#0f131a;color:#dde3ee;font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:1100px;margin:0 auto;padding:28px 20px 60px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:32px 0 10px;color:#fff}
.muted{color:#8a94a6}.badge{display:inline-block;padding:2px 10px;border-radius:999px;font-weight:600;font-size:12px;margin-left:8px}
.pass{background:#16351f;color:#4ade80}.fail{background:#3a1717;color:#f87171}.warn{background:#3a2e12;color:#fbbf24}
.tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-top:16px}
.tile{background:#161b24;border:1px solid #232a36;border-radius:10px;padding:12px}
.tl{color:#8a94a6;font-size:12px}.tv{font-size:20px;font-weight:600;margin-top:2px}.ts{color:#8a94a6;font-size:11px}
.tw{overflow-x:auto;border:1px solid #232a36;border-radius:10px}
table{width:100%;border-collapse:collapse;background:#161b24}
th,td{padding:7px 10px;border-bottom:1px solid #232a36;text-align:left;font-size:13px}th{color:#8a94a6;font-weight:500;background:#131821}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}tr:last-child td{border-bottom:0}
.chart{margin:0 0 14px;background:#161b24;border:1px solid #232a36;border-radius:10px;padding:10px}
.chart figcaption{font-size:13px;color:#c9d1e0;margin:0 0 4px 4px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}.grid2>*{min-width:0}@media(max-width:800px){.grid2{grid-template-columns:1fr}}
pre{background:#0b0e13;border:1px solid #232a36;border-radius:10px;padding:12px;overflow:auto;font-size:12px;max-height:360px}
details summary{cursor:pointer;color:#8a94a6;margin:6px 0}
`;

export function renderReportHtml(r: RunReport): string {
  const s = r.summary;
  const xs = r.timeline.map((p) => p.t);
  const statusBadge =
    r.status === 'finished'
      ? `<span class="badge ${r.thresholds.passed ? 'pass' : 'fail'}">${r.thresholds.passed ? 'PASSED' : 'FAILED THRESHOLDS'}</span>`
      : `<span class="badge ${r.status === 'failed' ? 'fail' : 'warn'}">${e(r.status.toUpperCase())}</span>`;

  const tiles = [
    tile('Duration', `${r.durationSec}s`, `ramp-up ${r.config.rampUpSec}s`),
    tile('VUs / scenario', num(r.config.vus), r.scenarios.join(', ')),
    tile('HTTP requests', num(s.requests), `${num(s.rps)} req/s`),
    tile('HTTP p95', `${num(s.http.p95)} ms`, `p50 ${num(s.http.p50)} · p99 ${num(s.http.p99)}`),
    tile('HTTP errors', `${num(s.httpErrorRatePct)}%`, `${num(s.httpErrors)} failed`),
    tile('WS peak open', num(s.wsPeakOpen), `${num(s.wsConnections)} connections`),
    tile('WS drops', num(s.wsDrops), `${num(s.wsDropRatePct)}%`),
    tile('WS messages', num(s.wsMessagesIn), `in · ${num(s.wsMessagesOut)} out`),
  ];
  const ss = r.scenarioStats;
  if (ss.chat) tiles.push(tile('Chat delivery', `${num(ss.chat.deliveryPct)}%`, `${num(ss.chat.received)}/${num(ss.chat.expected)} receipts`));
  if (ss.gameplay) tiles.push(tile('Hands played', num(ss.gameplay.hands), `${num(ss.gameplay.handsPerMin)}/min · ${num(ss.gameplay.actions)} actions`));
  if (ss.rooms) tiles.push(tile('Rooms', num(ss.rooms.tables), `${num(ss.rooms.players)} seated · ${num(ss.rooms.spectators)} watching`));
  if (ss.api && ss.api.dropped > 0) tiles.push(tile('Dropped arrivals', num(ss.api.dropped), 'generator saturated'));

  const checks = r.thresholds.checks.length
    ? `<div class="tw"><table><thead><tr><th>Check</th><th class="n">Value</th><th class="n">Limit</th><th>Result</th></tr></thead><tbody>${r.thresholds.checks
        .map(
          (c) =>
            `<tr><td>${e(c.name)}</td><td class="n">${num(c.value)} ${c.unit}</td><td class="n">≤ ${num(c.limit)} ${c.unit}</td><td><span class="badge ${c.passed ? 'pass' : 'fail'}">${c.passed ? 'pass' : 'fail'}</span></td></tr>`,
        )
        .join('')}</tbody></table></div>`
    : '<p class="muted">No measurements to check.</p>';

  const wsNames = Object.keys(r.ws);
  const wsPeakSeries = ['ws.ping', 'ws.chat_fanout', 'ws.action_to_state'].filter((n) => wsNames.includes(n));
  const charts: string[] = [];
  if (s.requests > 0) {
    charts.push(
      lineChart({
        title: 'Throughput',
        xs,
        unit: 'per second',
        series: [
          { name: 'requests', values: r.timeline.map((p) => p.requests), color: PALETTE[0]! },
          { name: 'errors', values: r.timeline.map((p) => p.errors), color: PALETTE[1]! },
        ],
      }),
      lineChart({
        title: 'HTTP latency',
        xs,
        unit: 'ms',
        series: [
          { name: 'p50', values: r.timeline.map((p) => p.httpP50), color: PALETTE[2]! },
          { name: 'p95', values: r.timeline.map((p) => p.httpP95), color: PALETTE[3]! },
        ],
      }),
    );
  }
  if (s.wsConnections > 0) {
    charts.push(
      lineChart({
        title: 'Open WebSockets',
        xs,
        series: [{ name: 'open', values: r.timeline.map((p) => p.wsOpen), color: PALETTE[4]! }],
      }),
      lineChart({
        title: 'WebSocket messages',
        xs,
        unit: 'per second',
        series: [
          { name: 'in', values: r.timeline.map((p) => p.wsIn), color: PALETTE[0]! },
          { name: 'out', values: r.timeline.map((p) => p.wsOut), color: PALETTE[5]! },
          ...(s.requests === 0 ? [{ name: 'errors', values: r.timeline.map((p) => p.errors), color: PALETTE[1]! }] : []),
        ],
      }),
    );
    if (wsPeakSeries.length) {
      charts.push(
        lineChart({
          title: 'WebSocket latency p95',
          xs,
          unit: 'ms',
          series: wsPeakSeries.map((n, i) => ({
            name: WS_LABELS[n] ?? n,
            values: r.timeline.map((p) => p.wsP95[n] ?? Number.NaN),
            color: PALETTE[(i + 2) % PALETTE.length]!,
          })),
        }),
      );
    }
  }

  const routes = r.routes.length
    ? `<div class="tw"><table><thead><tr><th>Route</th><th class="n">Requests</th><th class="n">req/s</th><th class="n">Errors</th><th class="n">p50</th><th class="n">p90</th><th class="n">p95</th><th class="n">p99</th><th class="n">max</th><th class="n">mean</th><th>Statuses</th></tr></thead><tbody>${r.routes
        .map(
          (rt) =>
            `<tr><td>${e(rt.label)}</td><td class="n">${num(rt.count)}</td><td class="n">${num(rt.rps)}</td><td class="n">${num(rt.errors)} (${num(rt.errorRatePct)}%)</td>${latencyCells(rt.latency)}<td>${e(
              Object.entries(rt.statuses)
                .map(([k, v]) => `${k}×${v}`)
                .join(' '),
            )}</td></tr>`,
        )
        .join('')}</tbody></table></div>`
    : '<p class="muted">No HTTP traffic in this run.</p>';

  const ws = wsNames.length
    ? `<div class="tw"><table><thead><tr><th>Metric</th><th class="n">Samples</th><th class="n">p50</th><th class="n">p90</th><th class="n">p95</th><th class="n">p99</th><th class="n">max</th><th class="n">mean</th></tr></thead><tbody>${wsNames
        .map((n) => `<tr><td>${e(WS_LABELS[n] ?? n)}</td><td class="n">${num(r.ws[n]!.count)}</td>${latencyCells(r.ws[n]!)}</tr>`)
        .join('')}</tbody></table></div>`
    : '<p class="muted">No WebSocket traffic in this run.</p>';

  const errors = r.errors.length
    ? `<div class="tw"><table><thead><tr><th>Error</th><th class="n">Count</th></tr></thead><tbody>${r.errors
        .slice(0, 50)
        .map((x) => `<tr><td>${e(x.key)}</td><td class="n">${num(x.count)}</td></tr>`)
        .join('')}</tbody></table></div>`
    : '<p class="muted">No errors recorded.</p>';

  const p = r.prepare;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Load test ${e(r.id)} · ${e(r.target.name)}</title><style>${STYLE}</style></head>
<body><main>
<h1>Load test report ${statusBadge}</h1>
<div class="muted">Run <b>${e(r.id)}</b> against <b>${e(r.target.name)}</b> (${e(r.target.apiUrl)} · ${e(r.target.wsUrl)})<br>
Started ${e(r.startedAt ?? r.createdAt)} · ended ${e(r.endedAt)}${r.statusReason ? ` · ${e(r.statusReason)}` : ''}</div>
<div class="tiles">${tiles.join('')}</div>
<h2>Thresholds</h2>${checks}
${charts.length ? `<h2>Timeline</h2><div class="grid2">${charts.join('')}</div>` : ''}
<h2>HTTP routes (ms)</h2>${routes}
<h2>WebSocket metrics (ms)</h2>${ws}
<h2>Errors</h2>${errors}
<h2>Setup</h2>
<p class="muted">Accounts: ${num(p.total)} needed · ${num(p.created)} created · ${num(p.reused)} reused · ${num(p.failed)} failed · ${num(p.ms)} ms.
Allocation: ${e(Object.entries(r.allocation).map(([k, v]) => `${k} ${v}`).join(', ') || 'none')}.</p>
<details><summary>Run configuration</summary><pre>${e(JSON.stringify(r.config, null, 2))}</pre></details>
<details><summary>Counters</summary><pre>${e(JSON.stringify(r.counters, null, 2))}</pre></details>
<details><summary>Run log</summary><pre>${e(r.log.join('\n'))}</pre></details>
</main></body></html>`;
}
