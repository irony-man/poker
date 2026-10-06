'use client';

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import type { WalletCurrency } from '@poker/protocol';
import { ChipsImage, CurrencyIcon, MoneyAmount } from '@/components/CurrencyIcon';
import { formatMoneyAmount } from '@/lib/currency';
import { cn } from '@/lib/cn';
import { walletReasonLabel, type WalletRangeSummary } from '@/lib/walletTrail';

const HEIGHT = 240;
const PAD = { top: 16, bottom: 30 };
const DRAG_THRESHOLD = 4;
const MAX_MARKERS = 80;
const MIN_MARKER_GAP = 6;
const TIP_W = 196;
const PILL_H = 18;

function useElementWidth(fallback: number) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    if (!el) return;
    setWidth(el.clientWidth || fallback);
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width || fallback);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el, fallback]);
  return [setEl, width] as const;
}

function niceTicks(min: number, max: number, count = 3): number[] {
  if (min === max) {
    const pad = Math.max(1, Math.abs(min) * 0.1);
    min -= pad;
    max += pad;
  }
  const rough = (max - min) / count;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? rough;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v));
  return ticks;
}

/**
 * Catmull-Rom spline through every point, with control points clamped to each segment's
 * value range so the curve flows smoothly without bulging past a real balance.
 */
function smoothPath(xs: readonly number[], ys: readonly number[]): string {
  const n = xs.length;
  if (n === 0) return '';
  if (n === 2) return `M${xs[0]},${ys[0]}L${xs[1]},${ys[1]}`;
  let d = `M${xs[0]},${ys[0]}`;
  for (let i = 0; i < n - 1; i++) {
    const x0 = xs[Math.max(0, i - 1)]!;
    const y0 = ys[Math.max(0, i - 1)]!;
    const x1 = xs[i]!;
    const y1 = ys[i]!;
    const x2 = xs[i + 1]!;
    const y2 = ys[i + 1]!;
    const x3 = xs[Math.min(n - 1, i + 2)]!;
    const y3 = ys[Math.min(n - 1, i + 2)]!;
    const lo = Math.min(y1, y2);
    const hi = Math.max(y1, y2);
    const clamp = (v: number) => Math.min(hi, Math.max(lo, v));
    const c1x = x1 + (x2 - x0) / 6;
    const c1y = clamp(y1 + (y2 - y0) / 6);
    const c2x = x2 - (x3 - x1) / 6;
    const c2y = clamp(y2 - (y3 - y1) / 6);
    d += `C${c1x},${c1y} ${c2x},${c2y} ${x2},${y2}`;
  }
  return d;
}

function formatAxisMoney(v: number): string {
  return v < 0 ? `-${formatMoneyAmount(-v)}` : formatMoneyAmount(v);
}

function formatAxisDate(ts: number, spanMs: number): string {
  if (spanMs < 2 * 24 * 60 * 60 * 1000) {
    return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  return new Date(ts).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(spanMs > 300 * 24 * 60 * 60 * 1000 ? { year: 'numeric' } : {}),
  });
}

function formatWhen(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatShortDay(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function signed(n: number): string {
  return `${n >= 0 ? '+' : '−'}${Math.abs(n).toLocaleString()}`;
}

function changePercent(from: number, to: number): string | null {
  if (from === 0) return null;
  const p = Math.abs(((to - from) / Math.abs(from)) * 100);
  return `${p < 10 ? p.toFixed(1) : Math.round(p).toLocaleString()}%`;
}

/** Rough label width for the SVG value pills (10px tabular digits). */
function pillWidth(text: string): number {
  return text.length * 6.2 + 14;
}

type Span = { a: number; b: number };

/**
 * Balance line for the selected range. Hover or tap to inspect a change, drag across the
 * chart (or Shift+arrows) to compare two moments.
 */
export function WalletTrailChart({
  summary,
  currency,
  rangeLabel,
  className,
}: {
  summary: WalletRangeSummary;
  currency: WalletCurrency;
  rangeLabel: string;
  className?: string;
}) {
  const [wrapRef, width] = useElementWidth(600);
  const [active, setActive] = useState<number | null>(null);
  const [span, setSpan] = useState<Span | null>(null);
  const [focused, setFocused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{
    anchor: number;
    x: number;
    moved: boolean;
    pointerId: number;
  } | null>(null);
  const titleId = useId();
  const svgId = useId().replace(/:/g, '');
  const gradientId = `wallet-area-${svgId}`;
  const clipId = `wallet-span-${svgId}`;

  // The trailing "now" point only repeats the latest balance; drop it so every slot is a change.
  const chart = useMemo(() => {
    const c = summary.chart;
    const last = c[c.length - 1];
    const prev = c[c.length - 2];
    return last && prev && !last.point && last.balance === prev.balance ? c.slice(0, -1) : c;
  }, [summary.chart]);
  const n = chart.length;
  const animKey = `${currency}|${summary.from}|${summary.to}|${n}|${summary.endBalance}`;

  useEffect(() => {
    setActive(null);
    setSpan(null);
  }, [animKey]);

  const geo = useMemo(() => {
    const innerW = Math.max(40, width);
    const innerH = HEIGHT - PAD.top - PAD.bottom;
    const { from, to } = summary;
    const total = Math.max(1, to - from);
    const balances = chart.map((c) => c.balance);
    const ticks = niceTicks(Math.min(...balances), Math.max(...balances));
    const yMin = ticks[0]!;
    const yMax = ticks[ticks.length - 1]!;
    // Changes are evenly spaced (one slot each) so bursts and quiet weeks read as a progression.
    const count = chart.length;
    const x = (i: number) => (count > 1 ? (i / (count - 1)) * innerW : innerW / 2);
    const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin || 1)) * innerH;
    const xs = chart.map((_, i) => x(i));
    const ys = chart.map((c) => y(c.balance));
    const line = smoothPath(xs, ys);
    const bottom = PAD.top + innerH;
    const area = xs.length > 1 ? `${line}L${xs[xs.length - 1]},${bottom}L${xs[0]},${bottom}Z` : '';
    const tickCount = Math.min(innerW < 420 ? 3 : 5, count);
    const tickIdx = [
      ...new Set(
        Array.from({ length: tickCount }, (_, k) =>
          Math.round(((k + 0.5) / tickCount) * (count - 1)),
        ),
      ),
    ];
    const xTicks = tickIdx
      .map((i) => ({ px: x(i), label: formatAxisDate(chart[i]!.t, total) }))
      .filter((tick, k, all) => k === 0 || tick.label !== all[k - 1]!.label);
    const realCount = chart.reduce((k, c) => k + (c.point ? 1 : 0), 0);
    const showMarkers =
      realCount > 0 && realCount <= MAX_MARKERS && innerW / realCount >= MIN_MARKER_GAP;
    return { innerW, bottom, xs, ys, line, area, ticks, y, xTicks, total, showMarkers };
  }, [summary, chart, width]);

  const nearest = (clientX: number, rect: DOMRect): number => {
    const px = clientX - rect.left;
    let best = 0;
    let bestDist = Infinity;
    geo.xs.forEach((x, i) => {
      const d = Math.abs(x - px);
      // Prefer real changes over the synthetic start/now points at equal distance.
      if (d < bestDist || (d === bestDist && chart[i]!.point)) {
        bestDist = d;
        best = i;
      }
    });
    return best;
  };

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const i = nearest(e.clientX, e.currentTarget.getBoundingClientRect());
    drag.current = {
      anchor: i,
      x: e.clientX,
      moved: false,
      pointerId: e.pointerId,
    };
    setActive(i);
  };

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const i = nearest(e.clientX, e.currentTarget.getBoundingClientRect());
    const d = drag.current;
    if (d && d.pointerId === e.pointerId) {
      if (!d.moved && Math.abs(e.clientX - d.x) > DRAG_THRESHOLD) {
        d.moved = true;
        setDragging(true);
        e.currentTarget.setPointerCapture(e.pointerId);
      }
      if (d.moved) setSpan({ a: d.anchor, b: i });
    }
    setActive(i);
  };

  const onPointerUp = (e: PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d || d.pointerId !== e.pointerId) return;
    if (d.moved) {
      setSpan((s) => (s && s.a === s.b ? null : s));
      return;
    }
    if (span) setSpan(null);
  };

  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    if (n === 0) return;
    const pos = active ?? n - 1;
    let next = pos;
    switch (e.key) {
      case 'ArrowLeft':
        next = Math.max(0, pos - 1);
        break;
      case 'ArrowRight':
        next = Math.min(n - 1, pos + 1);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = n - 1;
        break;
      case 'Escape':
        if (!span && active == null) return;
        e.preventDefault();
        setSpan(null);
        setActive(null);
        return;
      default:
        return;
    }
    e.preventDefault();
    if (e.shiftKey) setSpan((s) => ({ a: s?.a ?? pos, b: next }));
    else setSpan(null);
    setActive(next);
  };

  const sel =
    span && span.a !== span.b ? { lo: Math.min(span.a, span.b), hi: Math.max(span.a, span.b) } : null;
  const activeChart = active != null ? chart[active] : undefined;
  const activePoint = activeChart?.point;
  const ax = active != null ? geo.xs[active]! : 0;
  const ay = active != null ? geo.ys[active]! : 0;

  const headline = (() => {
    if (sel) {
      const a = chart[sel.lo]!;
      const b = chart[sel.hi]!;
      return {
        balance: b.balance,
        estimated: Boolean(b.point?.estimated),
        change: b.balance - a.balance,
        pct: changePercent(a.balance, b.balance),
        caption: `${formatShortDay(a.t)} – ${formatShortDay(b.t)}`,
      };
    }
    if (activeChart) {
      return {
        balance: activeChart.balance,
        estimated: Boolean(activePoint?.estimated),
        change: activeChart.balance - summary.startBalance,
        pct: changePercent(summary.startBalance, activeChart.balance),
        caption: `Since start · ${formatWhen(activeChart.t)}`,
      };
    }
    return {
      balance: summary.endBalance,
      estimated: false,
      change: summary.change,
      pct: changePercent(summary.startBalance, summary.endBalance),
      caption: rangeLabel === 'All time' ? 'All time' : `Past ${rangeLabel.toLowerCase()}`,
    };
  })();

  const trendUp = headline.change > 0;
  const trendDown = headline.change < 0;
  const selUp = sel ? chart[sel.hi]!.balance >= chart[sel.lo]!.balance : true;
  const currencyName = currency === 'chips' ? 'Chips' : 'Whuffies';
  const yPill = activeChart ? formatAxisMoney(activeChart.balance) : '';
  const datePill = activeChart ? formatAxisDate(activeChart.t, geo.total) : '';
  const datePillW = pillWidth(datePill);
  const datePillX = Math.min(Math.max(ax - datePillW / 2, 0), Math.max(0, width - datePillW));

  const tipRight = ax + 16 + TIP_W <= width;
  const tipLeft = tipRight ? ax + 16 : Math.max(0, ax - 16 - TIP_W);
  const tipTop = Math.min(Math.max(ay - 44, 0), HEIGHT - 112);

  return (
    <section className={cn('flex flex-col gap-3', className)} aria-label={`${currencyName} balance`}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2.5 font-display text-3xl font-bold tabular-nums tracking-tight text-primary">
            {currency === 'chips' ? (
              <ChipsImage className="!h-7 sm:!h-8" />
            ) : (
              <CurrencyIcon size={26} className="text-brass" />
            )}
            <span>
              {headline.estimated ? '≈ ' : ''}
              {headline.balance.toLocaleString()}
            </span>
          </p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums',
                trendUp
                  ? 'bg-positive/[0.12] text-positive'
                  : trendDown
                    ? 'bg-danger/10 text-danger'
                    : 'bg-sidebar/[0.08] text-muted',
              )}
            >
              <span aria-hidden>{trendUp ? '▲' : trendDown ? '▼' : '•'}</span>
              <span className="sr-only">{trendUp ? 'up' : trendDown ? 'down' : 'no change'}</span>
              {signed(headline.change)}
              {headline.pct ? <span className="font-semibold opacity-80">({headline.pct})</span> : null}
            </span>
            <span className="text-xs text-muted">{headline.caption}</span>
          </p>
        </div>
        {sel ? (
          <button
            type="button"
            onClick={() => setSpan(null)}
            className="rounded-full border border-sidebar/20 px-3 py-1 text-[11px] font-semibold text-primary transition hover:border-sidebar/40 hover:bg-sidebar/[0.06]"
          >
            Clear comparison
          </button>
        ) : (
          <p className="hidden text-[11px] text-muted sm:block">
            Drag across the chart to compare
          </p>
        )}
      </div>

      <div ref={wrapRef} className="relative w-full select-none">
        <svg
          width={width}
          height={HEIGHT}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          className={cn(
            'block touch-pan-y overflow-visible rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-sidebar/30',
            'cursor-crosshair',
          )}
          tabIndex={n > 0 ? 0 : -1}
          role="group"
          aria-labelledby={titleId}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            drag.current = null;
            setDragging(false);
          }}
          onPointerLeave={(e) => {
            if (e.pointerType === 'mouse' && !drag.current) setActive(null);
          }}
          onFocus={() => {
            setFocused(true);
            setActive((a) => a ?? n - 1);
          }}
          onBlur={() => {
            setFocused(false);
            setActive(null);
          }}
          onKeyDown={onKeyDown}
        >
          <title id={titleId}>
            {`${currencyName} balance over ${rangeLabel}: from ${summary.startBalance.toLocaleString()} to ${summary.endBalance.toLocaleString()}. Arrow keys move between changes, Shift+arrows compare two moments.`}
          </title>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: 'rgb(var(--sidebar))' }} stopOpacity={0.18} />
              <stop offset="100%" style={{ stopColor: 'rgb(var(--sidebar))' }} stopOpacity={0} />
            </linearGradient>
            {sel ? (
              <clipPath id={clipId}>
                <rect
                  x={geo.xs[sel.lo]}
                  y={0}
                  width={Math.max(0, geo.xs[sel.hi]! - geo.xs[sel.lo]!)}
                  height={HEIGHT}
                />
              </clipPath>
            ) : null}
          </defs>

          {geo.xTicks.map(({ px }, i) => (
            <line
              key={`vx-${i}`}
              x1={px}
              x2={px}
              y1={PAD.top}
              y2={geo.bottom}
              className="stroke-sidebar/10"
              strokeDasharray="2 4"
            />
          ))}

          {geo.ticks.map((v) => (
            <g key={v}>
              <line
                x1={0}
                x2={width}
                y1={geo.y(v)}
                y2={geo.y(v)}
                className="stroke-sidebar/10"
              />
              <text x={0} y={geo.y(v) - 5} className="fill-muted text-[10px] tabular-nums">
                {formatAxisMoney(v)}
              </text>
            </g>
          ))}

          {sel ? (
            <rect
              x={geo.xs[sel.lo]}
              y={PAD.top}
              width={Math.max(0, geo.xs[sel.hi]! - geo.xs[sel.lo]!)}
              height={geo.bottom - PAD.top}
              className={selUp ? 'fill-positive/10' : 'fill-danger/10'}
            />
          ) : null}

          {geo.area ? (
            <path
              key={`area-${animKey}`}
              d={geo.area}
              fill={`url(#${gradientId})`}
              className="animate-chart-fade motion-reduce:animate-none"
            />
          ) : null}
          <path
            key={`line-${animKey}`}
            d={geo.line}
            fill="none"
            pathLength={1}
            strokeDasharray={1}
            className={cn(
              'animate-chart-draw stroke-sidebar motion-reduce:animate-none',
              sel && 'opacity-35',
            )}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {sel ? (
            <path
              d={geo.line}
              fill="none"
              clipPath={`url(#${clipId})`}
              className={selUp ? 'stroke-positive' : 'stroke-danger'}
              strokeWidth={3}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null}

          {geo.showMarkers ? (
            <g key={`marks-${animKey}`} className="animate-chart-fade motion-reduce:animate-none">
              {chart.map((c, i) =>
                c.point && i !== active ? (
                  <circle
                    key={c.point.entry.id}
                    cx={geo.xs[i]}
                    cy={geo.ys[i]}
                    r={2.75}
                    strokeWidth={1.5}
                    className={cn(
                      'fill-white',
                      c.point.entry.delta >= 0 ? 'stroke-positive' : 'stroke-danger',
                    )}
                  />
                ) : null,
              )}
            </g>
          ) : null}

          {geo.xTicks.map(({ label, px }, i) =>
            activeChart && Math.abs(px - ax) < datePillW / 2 + 28 ? null : (
              <text
                key={`xt-${i}`}
                x={px}
                y={HEIGHT - 10}
                textAnchor="middle"
                className="fill-muted text-[10px]"
              >
                {label}
              </text>
            ),
          )}

          {sel
            ? [sel.lo, sel.hi].map((i) => (
                <g key={`edge-${i}`}>
                  <line
                    x1={geo.xs[i]}
                    x2={geo.xs[i]}
                    y1={PAD.top}
                    y2={geo.bottom}
                    className={selUp ? 'stroke-positive/50' : 'stroke-danger/50'}
                  />
                  <circle
                    cx={geo.xs[i]}
                    cy={geo.ys[i]}
                    r={4.5}
                    strokeWidth={2.5}
                    className={cn('fill-white', selUp ? 'stroke-positive' : 'stroke-danger')}
                  />
                </g>
              ))
            : null}

          {activeChart ? (
            <g className="pointer-events-none">
              <line
                x1={ax}
                x2={ax}
                y1={PAD.top}
                y2={geo.bottom}
                className="stroke-sidebar/35"
                strokeDasharray="3 3"
              />
              <line
                x1={0}
                x2={ax}
                y1={ay}
                y2={ay}
                className="stroke-sidebar/20"
                strokeDasharray="3 3"
              />
              <circle cx={ax} cy={ay} r={9} className="fill-sidebar/15" />
              <circle cx={ax} cy={ay} r={4.5} strokeWidth={2.5} className="fill-white stroke-sidebar" />
              <rect
                x={0}
                y={ay - PILL_H / 2}
                width={pillWidth(yPill)}
                height={PILL_H}
                rx={PILL_H / 2}
                className="fill-sidebar"
              />
              <text
                x={pillWidth(yPill) / 2}
                y={ay + 3.5}
                textAnchor="middle"
                className="fill-on-chrome text-[10px] font-semibold tabular-nums"
              >
                {yPill}
              </text>
              <rect
                x={datePillX}
                y={geo.bottom + 5}
                width={datePillW}
                height={PILL_H}
                rx={PILL_H / 2}
                className="fill-sidebar"
              />
              <text
                x={datePillX + datePillW / 2}
                y={geo.bottom + 5 + PILL_H / 2 + 3.5}
                textAnchor="middle"
                className="fill-on-chrome text-[10px] font-semibold"
              >
                {datePill}
              </text>
            </g>
          ) : null}
        </svg>

        {activePoint && !dragging && !sel ? (
          <div
            className="pointer-events-none absolute z-10 rounded-xl border border-sidebar/[0.12] bg-white px-3 py-2.5 text-xs text-[rgb(22_12_40)] shadow-[0_10px_30px_rgb(29_4_50/0.16)]"
            style={{ left: tipLeft, top: tipTop, width: TIP_W }}
          >
            <p className="truncate font-semibold">
              {walletReasonLabel(activePoint.entry.reason, currency)}
            </p>
            <p className="mt-0.5 text-[11px] text-[rgb(58_40_82)]/80">
              {formatWhen(activePoint.entry.createdAt)}
            </p>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <MoneyAmount
                amount={Math.abs(activePoint.entry.delta)}
                prefix={activePoint.entry.delta >= 0 ? '+' : '−'}
                showWhuffies={currency === 'whuffies'}
                className={cn(
                  'font-semibold',
                  activePoint.entry.delta >= 0 ? 'text-positive' : 'text-danger',
                )}
              />
              <span className="tabular-nums text-[rgb(58_40_82)]/80">
                {activePoint.estimated ? '≈ ' : ''}
                {activePoint.balance.toLocaleString()}
              </span>
            </div>
          </div>
        ) : null}

        {focused ? (
          <p className="sr-only" role="status" aria-live="polite">
            {activePoint
              ? `${walletReasonLabel(activePoint.entry.reason, currency)}, ${signed(activePoint.entry.delta)}, balance ${activePoint.balance.toLocaleString()}, ${formatWhen(activePoint.entry.createdAt)}.`
              : ''}
            {` ${headline.balance.toLocaleString()}, ${signed(headline.change)}, ${headline.caption}.`}
          </p>
        ) : null}
      </div>
    </section>
  );
}
