'use strict';

const $ = (id) => document.getElementById(id);
const COLORS = ['#4f8cff', '#ff6b6b', '#2ecc71', '#f5a623', '#a66cff', '#14b8a6'];
const SCENARIO_LABELS = {
  api: 'REST API mix',
  'socket-basic': 'Sockets: connect + auth + ping',
  'socket-rooms': 'Sockets: rooms + chat',
  gameplay: 'Sockets: poker gameplay',
  mixed: 'Mixed (API + socket)',
};
const WS_LAT = [
  ['ws.ping', 'ping'],
  ['ws.chat_fanout', 'chat fan-out'],
  ['ws.action_to_state', 'action → state'],
];

let session = null;
let source = null;
let pollTimer = null;
let timeline = [];
const ACTIVE = new Set(['preparing', 'running', 'stopping']);

async function api(path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method ?? 'GET',
    credentials: 'same-origin',
    headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || res.statusText);
    err.status = res.status;
    throw err;
  }
  return data;
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'text') node.textContent = v;
    else if (k === 'className') node.className = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) node.append(c);
  return node;
}

function fmt(n, digits = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return '–';
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: digits });
}

function show(id, visible) {
  $(id).classList.toggle('hidden', !visible);
}

// ── Auth ─────────────────────────────────────────────────────
async function boot() {
  try {
    session = await api('/session');
  } catch (err) {
    if (err.status === 401) {
      show('login', true);
      show('app', false);
      show('logout', false);
      $('login-token').focus();
      return;
    }
    throw err;
  }
  show('login', false);
  show('app', true);
  show('logout', true);
  show('token-warning', !session.loadtestTokenSet);
  renderForm();
  await refreshRuns();
  if (session.activeRunId) attach(session.activeRunId);
}

$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('login-error').textContent = '';
  try {
    await api('/login', { method: 'POST', body: { token: $('login-token').value } });
    $('login-token').value = '';
    await boot();
  } catch (err) {
    $('login-error').textContent = err.message;
  }
});

$('logout').addEventListener('click', async () => {
  await api('/logout', { method: 'POST', body: {} }).catch(() => undefined);
  detach();
  location.reload();
});

// ── Run form ─────────────────────────────────────────────────
function renderForm() {
  const d = session.defaults;
  const target = $('f-target');
  target.replaceChildren(...session.targets.map((t) => el('option', { value: t.name, text: `${t.name} — ${t.apiUrl}` })));
  $('f-vus').value = d.vus;
  $('f-vus').max = session.maxVus;
  $('f-ramp').value = d.rampUpSec;
  $('f-duration').value = d.durationSec;
  $('f-p95').value = d.thresholds.p95Ms;
  $('f-errpct').value = d.thresholds.errorRatePct;

  $('f-scenarios').replaceChildren(
    ...session.scenarios.map((id) => {
      const input = el('input', { type: 'checkbox', value: id });
      if (d.scenarios.includes(id)) input.checked = true;
      input.addEventListener('change', updateVuSummary);
      return el('label', { className: 'check' }, [input, SCENARIO_LABELS[id] || id]);
    }),
  );
  $('f-mixed').replaceChildren(...session.socketScenarios.map((id) => el('option', { value: id, text: SCENARIO_LABELS[id] || id })));
  $('f-mixed').value = d.options.mixedSocket;

  const o = d.options;
  $('o-think').value = o.api.thinkMs;
  $('o-weights').replaceChildren(
    ...session.apiRoutes.map((key) =>
      el('label', {}, [`Weight: ${key}`, el('input', { type: 'number', min: '0', id: `w-${key}`, value: String(o.api.weights?.[key] ?? 0) })]),
    ),
  );
  $('o-ping').value = o.socket.pingIntervalMs;
  $('o-r-seats').value = o.rooms.seatsPerTable;
  $('o-r-spec').value = o.rooms.spectatorsPerTable;
  $('o-r-chat').value = o.rooms.chatIntervalMs;
  $('o-g-seats').value = o.gameplay.seatsPerTable;
  $('o-g-delay').value = o.gameplay.turnDelayMs;
  $('o-g-raise').value = o.gameplay.raisePct;
  $('o-g-bb').value = o.gameplay.bigBlind;
  $('o-g-buyin').value = o.gameplay.buyIn;
  $('f-vus').addEventListener('input', updateVuSummary);
  $('f-mixed').addEventListener('change', updateVuSummary);
  updateVuSummary();
}

function selectedScenarios() {
  return [...$('f-scenarios').querySelectorAll('input:checked')].map((i) => i.value);
}

function resolvedScenarioCount() {
  const set = new Set();
  for (const id of selectedScenarios()) {
    if (id === 'mixed') {
      set.add('api');
      set.add($('f-mixed').value);
    } else set.add(id);
  }
  return set.size;
}

function updateVuSummary() {
  const vus = Number($('f-vus').value) || 0;
  const n = resolvedScenarioCount();
  const total = vus * n;
  const over = total > session.maxVus;
  $('vu-summary').textContent = `${vus} VUs × ${n} scenario${n === 1 ? '' : 's'} = ${total} total (max ${session.maxVus})`;
  $('vu-summary').style.color = over ? 'var(--bad)' : '';
}

function num(id) {
  return Number($(id).value);
}

function collectConfig() {
  const weights = {};
  for (const key of session.apiRoutes) weights[key] = Number($(`w-${key}`).value) || 0;
  const rps = $('f-rps').value.trim();
  return {
    target: $('f-target').value,
    scenarios: selectedScenarios(),
    vus: num('f-vus'),
    rampUpSec: num('f-ramp'),
    durationSec: num('f-duration'),
    ...(rps ? { rps: Number(rps) } : {}),
    thresholds: { p95Ms: num('f-p95'), errorRatePct: num('f-errpct') },
    options: {
      api: { thinkMs: num('o-think'), weights },
      socket: { pingIntervalMs: num('o-ping') },
      rooms: { seatsPerTable: num('o-r-seats'), spectatorsPerTable: num('o-r-spec'), chatIntervalMs: num('o-r-chat') },
      gameplay: {
        seatsPerTable: num('o-g-seats'),
        turnDelayMs: num('o-g-delay'),
        raisePct: num('o-g-raise'),
        bigBlind: num('o-g-bb'),
        buyIn: num('o-g-buyin'),
      },
      mixedSocket: $('f-mixed').value,
    },
  };
}

$('run-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('run-error').textContent = '';
  const config = collectConfig();
  if (config.scenarios.length === 0) {
    $('run-error').textContent = 'Pick at least one scenario.';
    return;
  }
  $('start').disabled = true;
  try {
    const { id } = await api('/runs', { method: 'POST', body: config });
    attach(id);
  } catch (err) {
    $('run-error').textContent = err.message;
    $('start').disabled = false;
  }
});

$('stop').addEventListener('click', async () => {
  const id = $('live-id').textContent;
  if (!id) return;
  $('stop').disabled = true;
  await api(`/runs/${id}/stop`, { method: 'POST', body: {} }).catch((err) => {
    $('run-error').textContent = err.message;
  });
});

$('refresh').addEventListener('click', () => void refreshRuns());

// ── Live run ─────────────────────────────────────────────────
function detach() {
  if (source) source.close();
  source = null;
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

function attach(id) {
  detach();
  timeline = [];
  show('live', true);
  $('live-id').textContent = id;
  $('live-log').textContent = '';
  $('live-links').replaceChildren();
  $('stop').disabled = false;
  $('start').disabled = true;

  let finished = false;
  let lastStreamAt = Date.now();
  const finish = () => {
    if (finished) return;
    finished = true;
    detach();
    $('stop').disabled = true;
    $('start').disabled = false;
    $('live-links').replaceChildren(
      el('a', { href: `/reports/${id}.html`, target: '_blank', rel: 'noopener', text: 'HTML report' }),
      ' · ',
      el('a', { href: `/reports/${id}.json`, target: '_blank', rel: 'noopener', text: 'JSON' }),
    );
    // The report is written just after the run ends.
    setTimeout(() => void refreshRuns(), 800);
  };

  source = new EventSource(`/runs/${id}/events`);
  source.addEventListener('snapshot', (e) => {
    lastStreamAt = Date.now();
    renderSnapshot(JSON.parse(e.data));
  });
  source.addEventListener('log', (e) => {
    lastStreamAt = Date.now();
    appendLog(JSON.parse(e.data));
  });
  source.addEventListener('done', finish);

  // Fallback for proxies that buffer event streams: poll while the stream is quiet.
  pollTimer = setInterval(async () => {
    if (finished || Date.now() - lastStreamAt < 3000) return;
    try {
      const snap = await api(`/runs/${id}`);
      if (!snap.prepare) return finish();
      renderSnapshot(snap);
      if (!ACTIVE.has(snap.status)) finish();
    } catch (err) {
      if (err.status === 404) finish();
    }
  }, 1000);
}

function appendLog(line) {
  const log = $('live-log');
  const atBottom = log.scrollTop + log.clientHeight >= log.scrollHeight - 8;
  log.textContent += `${line}\n`;
  if (atBottom) log.scrollTop = log.scrollHeight;
}

function renderSnapshot(s) {
  const status = $('live-status');
  status.textContent = s.status;
  status.className = `pill ${s.status}`;
  if (!$('live-log').textContent && s.logTail?.length) $('live-log').textContent = `${s.logTail.join('\n')}\n`;

  const m = s.metrics;
  const elapsed = m ? m.elapsedSec : 0;
  $('live-meta').textContent =
    s.status === 'preparing'
      ? `Preparing accounts ${s.prepare.done}/${s.prepare.total} (created ${s.prepare.created}, reused ${s.prepare.reused}, failed ${s.prepare.failed}) · ${s.target} · ${s.scenarios.join(', ')}`
      : `${s.target} · ${s.scenarios.join(', ')} · ${elapsed}s / ${s.durationSec}s`;
  const pct = s.status === 'preparing' ? (s.prepare.total ? s.prepare.done / s.prepare.total : 0) : Math.min(1, elapsed / s.durationSec);
  $('live-progress').style.width = `${Math.round(pct * 100)}%`;

  if (!m) return;
  if (m.last && (timeline.length === 0 || timeline[timeline.length - 1].t !== m.last.t)) timeline.push(m.last);
  const last = m.last || { requests: 0, errors: 0, wsIn: 0, wsP95: {} };
  const c = m.counters || {};
  const tiles = [
    ['req/s', fmt(last.requests, 0)],
    ['HTTP p95 (run)', `${fmt(m.http.p95)} ms`],
    ['HTTP requests', fmt(m.totals.requests, 0)],
    ['Errors', fmt(m.totals.errors, 0)],
    ['WS open', `${fmt(m.totals.wsOpen, 0)} / peak ${fmt(m.totals.wsPeakOpen, 0)}`],
    ['WS drops', fmt(c['ws.drops'] || 0, 0)],
    ['WS msgs in/s', fmt(last.wsIn, 0)],
  ];
  if (c['chat.sent']) tiles.push(['Chats sent', fmt(c['chat.sent'], 0)]);
  if (c['poker.tables']) tiles.push(['Hands played', fmt(c['poker.hands'] || 0, 0)]);
  $('live-tiles').replaceChildren(
    ...tiles.map(([l, v]) => el('div', { className: 'tile' }, [el('div', { className: 'l', text: l }), el('div', { className: 'v', text: v })])),
  );

  const xs = timeline.map((p) => p.t);
  drawChart($('c-throughput'), xs, [
    { name: 'requests', values: timeline.map((p) => p.requests) },
    { name: 'errors', values: timeline.map((p) => p.errors) },
  ]);
  drawChart($('c-http'), xs, [
    { name: 'p50', values: timeline.map((p) => p.httpP50) },
    { name: 'p95', values: timeline.map((p) => p.httpP95) },
  ], 2);
  drawChart($('c-ws'), xs, [{ name: 'open', values: timeline.map((p) => p.wsOpen) }], 4);
  drawChart(
    $('c-wslat'),
    xs,
    WS_LAT.map(([key, name]) => ({ name, values: timeline.map((p) => (p.wsP95 && key in p.wsP95 ? p.wsP95[key] : NaN)) })),
    2,
  );
}

// ── Charts ───────────────────────────────────────────────────
const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

function niceMax(v) {
  if (!(v > 0)) return 1;
  const exp = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (v <= m * exp) return m * exp;
  return 10 * exp;
}

function drawChart(svg, xs, series, colorOffset = 0) {
  const W = 560;
  const H = 180;
  const pad = { l: 44, r: 10, t: 24, b: 22 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const xMin = xs[0] ?? 0;
  const xMax = Math.max(xMin + 1, xs[xs.length - 1] ?? 1);
  const all = series.flatMap((s) => s.values.filter((v) => Number.isFinite(v)));
  const yMax = niceMax(Math.max(0, ...all));
  const x = (t) => pad.l + ((t - xMin) / (xMax - xMin)) * iw;
  const y = (v) => pad.t + ih - (Math.max(0, v) / yMax) * ih;
  const nodes = [];
  for (let i = 0; i <= 4; i++) {
    const v = (yMax / 4) * i;
    nodes.push(svgEl('line', { x1: pad.l, x2: W - pad.r, y1: y(v), y2: y(v), stroke: '#232a36' }));
    const label = svgEl('text', { x: pad.l - 5, y: y(v), fill: '#8a94a6', 'font-size': 10, 'text-anchor': 'end', 'dominant-baseline': 'middle' });
    label.textContent = fmt(v, v < 10 ? 1 : 0);
    nodes.push(label);
  }
  for (const t of [xMin, (xMin + xMax) / 2, xMax]) {
    const label = svgEl('text', { x: x(t), y: H - 6, fill: '#8a94a6', 'font-size': 10, 'text-anchor': 'middle' });
    label.textContent = `${Math.round(t)}s`;
    nodes.push(label);
  }
  series.forEach((s, i) => {
    const color = COLORS[(i + colorOffset) % COLORS.length];
    let pts = [];
    const flush = () => {
      if (pts.length) nodes.push(svgEl('polyline', { points: pts.join(' '), fill: 'none', stroke: color, 'stroke-width': 1.8, 'stroke-linejoin': 'round' }));
      pts = [];
    };
    s.values.forEach((v, j) => {
      if (Number.isFinite(v)) pts.push(`${x(xs[j]).toFixed(1)},${y(v).toFixed(1)}`);
      else flush();
    });
    flush();
    const lx = pad.l + i * 120;
    nodes.push(svgEl('rect', { x: lx, y: 6, width: 10, height: 10, rx: 2, fill: color }));
    const label = svgEl('text', { x: lx + 14, y: 15, fill: '#c9d1e0', 'font-size': 11 });
    label.textContent = s.name;
    nodes.push(label);
  });
  svg.replaceChildren(...nodes);
}

// ── Past runs ────────────────────────────────────────────────
async function refreshRuns() {
  let data;
  try {
    data = await api('/runs');
  } catch (err) {
    if (err.status === 401) return boot();
    return;
  }
  const rows = data.runs.map((r) => {
    const result =
      r.status === 'finished'
        ? el('span', { className: `pill ${r.passed ? 'pass' : 'fail'}`, text: r.passed ? 'passed' : 'failed' })
        : el('span', { className: `pill ${r.status}`, text: r.status });
    return el('tr', {}, [
      el('td', { text: new Date(r.startedAt || r.createdAt).toLocaleString() }),
      el('td', { text: r.target }),
      el('td', { text: r.scenarios.join(', ') }),
      el('td', { className: 'n', text: fmt(r.vus, 0) }),
      el('td', { className: 'n', text: `${r.durationSec}s` }),
      el('td', { className: 'n', text: fmt(r.requests, 0) }),
      el('td', { className: 'n', text: fmt(r.rps) }),
      el('td', { className: 'n', text: `${fmt(r.httpP95)} ms` }),
      el('td', { className: 'n', text: fmt(r.errors, 0) }),
      el('td', { className: 'n', text: fmt(r.wsPeakOpen, 0) }),
      el('td', {}, [result]),
      el('td', {}, [
        el('a', { href: `/reports/${r.id}.html`, target: '_blank', rel: 'noopener', text: 'HTML' }),
        ' · ',
        el('a', { href: `/reports/${r.id}.json`, target: '_blank', rel: 'noopener', text: 'JSON' }),
      ]),
    ]);
  });
  $('runs').replaceChildren(...rows);
  show('runs-empty', rows.length === 0);
  if (!data.active && !source) $('start').disabled = false;
}

boot().catch((err) => {
  document.body.prepend(el('div', { className: 'err', text: `Failed to load: ${err.message}` }));
});
