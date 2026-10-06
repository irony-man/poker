export type Series = { name: string; values: number[]; color: string };

export const PALETTE = ['#4f8cff', '#ff6b6b', '#2ecc71', '#f5a623', '#a66cff', '#14b8a6'];

export function escapeHtml(s: unknown): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Round up to a "nice" axis maximum (1, 2, 2.5, 5 × 10^n). */
export function niceMax(v: number): number {
  if (!(v > 0)) return 1;
  const exp = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (v <= m * exp) return m * exp;
  }
  return 10 * exp;
}

function fmt(v: number): string {
  if (v >= 1000) return `${Math.round(v / 100) / 10}k`;
  if (v >= 10) return String(Math.round(v));
  return String(Math.round(v * 10) / 10);
}

/** Static multi-series line chart. `xs` are seconds since start. */
export function lineChart(opts: {
  title: string;
  xs: number[];
  series: Series[];
  unit?: string;
  width?: number;
  height?: number;
}): string {
  const width = opts.width ?? 720;
  const height = opts.height ?? 220;
  const pad = { l: 48, r: 12, t: 28, b: 28 };
  const iw = width - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const xs = opts.xs;
  const xMax = Math.max(1, xs.at(-1) ?? 1);
  const yMax = niceMax(Math.max(0, ...opts.series.flatMap((s) => s.values.filter(Number.isFinite))));
  const x = (t: number) => pad.l + (t / xMax) * iw;
  const y = (v: number) => pad.t + ih - (Math.max(0, v) / yMax) * ih;

  const grid: string[] = [];
  for (let i = 0; i <= 4; i++) {
    const v = (yMax / 4) * i;
    const yy = y(v).toFixed(1);
    grid.push(`<line x1="${pad.l}" x2="${width - pad.r}" y1="${yy}" y2="${yy}" stroke="#2a3140" stroke-width="1"/>`);
    grid.push(`<text x="${pad.l - 6}" y="${yy}" fill="#8a94a6" font-size="10" text-anchor="end" dominant-baseline="middle">${fmt(v)}</text>`);
  }
  for (let i = 0; i <= 4; i++) {
    const t = (xMax / 4) * i;
    grid.push(`<text x="${x(t).toFixed(1)}" y="${height - 8}" fill="#8a94a6" font-size="10" text-anchor="middle">${Math.round(t)}s</text>`);
  }

  const lines = opts.series
    .map((s) => {
      // Non-finite values (no samples that second) break the line instead of plotting zero.
      const segments: string[][] = [[]];
      s.values.forEach((v, i) => {
        if (Number.isFinite(v)) segments.at(-1)!.push(`${x(xs[i] ?? i).toFixed(1)},${y(v).toFixed(1)}`);
        else if (segments.at(-1)!.length) segments.push([]);
      });
      return segments
        .filter((pts) => pts.length > 0)
        .map(
          (pts) =>
            `<polyline fill="none" stroke="${s.color}" stroke-width="1.8" stroke-linejoin="round" points="${pts.join(' ')}"/>`,
        )
        .join('');
    })
    .join('');

  const legend = opts.series
    .map((s, i) => {
      const lx = pad.l + i * 150;
      return `<rect x="${lx}" y="8" width="10" height="10" rx="2" fill="${s.color}"/><text x="${lx + 14}" y="17" fill="#c9d1e0" font-size="11">${escapeHtml(s.name)}</text>`;
    })
    .join('');

  const unit = opts.unit ? `<text x="${width - pad.r}" y="17" fill="#8a94a6" font-size="10" text-anchor="end">${escapeHtml(opts.unit)}</text>` : '';
  return `<figure class="chart"><figcaption>${escapeHtml(opts.title)}</figcaption><svg viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="${escapeHtml(opts.title)}">${grid.join('')}${lines}${legend}${unit}</svg></figure>`;
}
