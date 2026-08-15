'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PlayingCard } from '@/components/PlayingCard';
import { Button } from '@/components/ui/Button';
import { fetchMyHands } from '@/lib/api';
import { LevelNode } from './LevelNode';
import { MapPark } from './MapPark';
import { NODE_SIZE, mapHeight, zigzagPositions } from './pathLayout';
import {
  formatHandWhen,
  handsByLevel,
  parsePlayedHand,
  type PlayedHandLevel,
} from './playedHand';
import { badgeForNode, chapterProgress, nodeStatus, nodeWindow } from './progress';

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M4.6 7.4l1.9 1.1M17.5 15.5l1.9 1.1M4.6 16.6l1.9-1.1M17.5 8.5l1.9-1.1" />
      <path d="M19.4 12H17.2M6.8 12H4.6" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <path d="M8 6h12M8 12h12M8 18h12" strokeLinecap="round" />
      <circle cx="4" cy="6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="4" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="4" cy="18" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function HandBadge({ n }: { n: number }) {
  return (
    <span className="inline-flex h-8 min-w-[2rem] items-center justify-center rounded-lg border border-sidebar/15 bg-white px-1.5 font-display text-sm font-extrabold tabular-nums text-sidebar shadow-sm">
      {n}
    </span>
  );
}

function HoleThumb({ cards }: { cards: [string, string] | null }) {
  return (
    <div className="relative h-10 w-11 shrink-0">
      <div className="absolute bottom-0 left-0 origin-bottom" style={{ transform: 'rotate(-10deg)' }}>
        <PlayingCard code={cards?.[0]} faceDown={!cards} size="xs" dealDelay={0} />
      </div>
      <div
        className="absolute bottom-0 left-3 z-[1] origin-bottom"
        style={{ transform: 'rotate(8deg)' }}
      >
        <PlayingCard code={cards?.[1]} faceDown={!cards} size="xs" dealDelay={0} />
      </div>
    </div>
  );
}

function PathLine({
  positions,
}: {
  positions: Array<{ x: number; y: number }>;
}) {
  if (positions.length < 2) return null;
  const d = positions
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y + 62}`)
    .join(' ');
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
      <path
        d={d}
        fill="none"
        stroke="rgb(var(--mushroom) / 0.38)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="7 12"
      />
    </svg>
  );
}

function HandPeek({
  level,
  hand,
  onClose,
}: {
  level: number;
  hand: PlayedHandLevel;
  onClose: () => void;
}) {
  const when = formatHandWhen(hand.startedAt);
  return (
    <div className="rounded-2xl border border-mushroom/20 bg-sidebar/92 p-3 text-mushroom shadow-[0_12px_32px_rgb(0_0_0_/_0.4)] backdrop-blur-md">
      <div className="flex items-start gap-3">
        <HoleThumb cards={hand.holeCards} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-bold text-mushroom">Hand {level}</p>
          <p className="text-xs text-mushroom/70">
            {hand.won ? 'Won' : 'Played'}
            {hand.handName && hand.handName !== 'Uncontested' ? ` · ${hand.handName}` : ''}
            {when ? ` · ${when}` : ''}
            {hand.source === 'offline' ? ' · Solo' : ''}
          </p>
          {hand.community.length > 0 ? (
            <div className="mt-2 flex gap-0.5">
              {hand.community.map((code, i) => (
                <PlayingCard key={`${code}-${i}`} code={code} size="xs" dealDelay={0} />
              ))}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-mushroom/60 hover:bg-white/10 hover:text-mushroom"
          aria-label="Close hand"
        >
          ×
        </button>
      </div>
    </div>
  );
}

export function HandsMap({
  handsPlayed,
  onSettings,
  sessionToken,
  userId,
  tableColorId = 0,
}: {
  handsPlayed: number;
  onSettings: () => void;
  sessionToken: string;
  userId: string;
  tableColorId?: number;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLButtonElement>(null);
  const [width, setWidth] = useState(360);
  const [listOpen, setListOpen] = useState(false);
  const [hands, setHands] = useState<PlayedHandLevel[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);

  const { level, nextMilestone, fill } = chapterProgress(handsPlayed);
  const { start, end } = nodeWindow(level);
  const height = mapHeight(end - start + 1);
  const positions = useMemo(
    () => zigzagPositions(start, end, width),
    [start, end, width],
  );
  const byLevel = useMemo(() => handsByLevel(hands, handsPlayed), [hands, handsPlayed]);
  const selectedHand = selectedLevel != null ? byLevel.get(selectedLevel) ?? null : null;

  useEffect(() => {
    let cancelled = false;
    void fetchMyHands(sessionToken, 50)
      .then((res) => {
        if (cancelled) return;
        setHands(res.hands.map((row) => parsePlayedHand(row, userId)));
      })
      .catch(() => {
        if (!cancelled) setHands([]);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionToken, userId]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const scrollToCurrent = useCallback(() => {
    setListOpen(false);
    currentRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (listOpen) return;
    const id = window.setTimeout(() => {
      currentRef.current?.scrollIntoView({ block: 'center', behavior: 'auto' });
    }, 40);
    return () => window.clearTimeout(id);
  }, [level, height, listOpen]);

  const listLevels = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  return (
    <div className="relative flex h-[min(70vh,640px)] w-full flex-col overflow-hidden bg-sidebar">
      <header className="relative z-20 flex shrink-0 items-center justify-center border-b border-sidebar/10 bg-white px-3 py-3">
        <button
          type="button"
          onClick={onSettings}
          className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg border border-sidebar/12 bg-mushroom/50 text-ink-strong-muted transition hover:border-sidebar/25 hover:text-sidebar"
          aria-label="Theme settings"
        >
          <GearIcon />
        </button>
        <div className="flex items-center gap-2">
          <HandBadge n={level} />
          <span className="font-heading-section">Hands</span>
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <div ref={scrollerRef} className="h-full overflow-y-auto overflow-x-hidden">
          {listOpen ? (
            <div className="flex h-full flex-col bg-white">
              <div className="flex shrink-0 items-center justify-between border-b border-sidebar/10 px-4 py-3">
                <h3 className="font-display text-sm font-bold text-sidebar">Played hands</h3>
                <button
                  type="button"
                  className="text-xs font-semibold text-ink-strong-muted hover:text-sidebar"
                  onClick={() => setListOpen(false)}
                >
                  Back to map
                </button>
              </div>
              <ul className="min-h-0 flex-1 overflow-y-auto pb-4">
                {listLevels.map((n) => {
                  const status = nodeStatus(n, handsPlayed);
                  const hand = byLevel.get(n) ?? null;
                  const when = hand ? formatHandWhen(hand.startedAt) : '';
                  return (
                    <li
                      key={n}
                      className="flex items-center gap-3 border-b border-sidebar/8 px-4 py-2.5 text-sm last:border-b-0 even:bg-mushroom/35"
                    >
                      <HoleThumb cards={status === 'locked' ? null : hand?.holeCards ?? null} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-ink-strong">Hand {n}</p>
                        {hand && status !== 'locked' ? (
                          <p className="truncate text-xs text-ink-strong-muted">
                            {hand.won ? 'Won' : 'Played'}
                            {hand.handName && hand.handName !== 'Uncontested'
                              ? ` · ${hand.handName}`
                              : ''}
                            {when ? ` · ${when}` : ''}
                          </p>
                        ) : null}
                      </div>
                      <span
                        className={`text-xs font-semibold uppercase tracking-wide ${
                          status === 'completed'
                            ? 'text-positive'
                            : status === 'current'
                              ? 'text-sidebar'
                              : 'text-ink-strong-muted'
                        }`}
                      >
                        {status === 'completed'
                          ? hand?.won
                            ? 'Won'
                            : 'Done'
                          : status === 'current'
                            ? 'Current'
                            : 'Locked'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <div ref={canvasRef} className="relative w-full" style={{ height }}>
              <MapPark width={width} height={height} tableColorId={tableColorId} />
              <PathLine positions={positions} />
              {positions.map((pos) => {
                const status = nodeStatus(pos.level, handsPlayed);
                const isCurrent = status === 'current';
                const hand = byLevel.get(pos.level) ?? null;
                return (
                  <button
                    key={pos.level}
                    ref={isCurrent ? currentRef : undefined}
                    type="button"
                    onClick={() => {
                      if (hand) setSelectedLevel(pos.level);
                      else if (isCurrent) scrollToCurrent();
                    }}
                    className="absolute -translate-x-1/2"
                    style={{
                      left: pos.x,
                      top: pos.y,
                      zIndex: isCurrent ? 10 : 1,
                      width: NODE_SIZE,
                    }}
                    aria-label={
                      status === 'locked'
                        ? `Hand ${pos.level}, locked`
                        : status === 'current'
                          ? `Hand ${pos.level}, current`
                          : `Hand ${pos.level}, completed`
                    }
                  >
                    <LevelNode
                      status={status}
                      badge={badgeForNode(pos.level, handsPlayed, status)}
                      current={isCurrent}
                      checked={status === 'completed' || (status === 'current' && handsPlayed > 0)}
                      hand={hand}
                      level={pos.level}
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {!listOpen && selectedHand && selectedLevel != null ? (
          <div className="absolute inset-x-3 bottom-3 z-20">
            <HandPeek
              level={selectedLevel}
              hand={selectedHand}
              onClose={() => setSelectedLevel(null)}
            />
          </div>
        ) : null}
      </div>

      {!listOpen ? (
        <button
          type="button"
          onClick={scrollToCurrent}
          className="absolute bottom-[8.5rem] right-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-mushroom/25 bg-sidebar/80 text-mushroom shadow-[0_8px_20px_rgb(0_0_0_/_0.28)] backdrop-blur-sm transition hover:border-mushroom/50"
          aria-label="Jump to current hand"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
            <path d="m6 14 6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : null}

      <footer className="relative z-20 shrink-0 border-t border-sidebar/10 bg-white px-4 py-3">
        <div className="mb-3 flex items-center gap-3">
          <p className="font-display text-lg font-bold tabular-nums tracking-tight text-sidebar">
            {handsPlayed.toLocaleString()}
          </p>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-sidebar/10">
              <div
                className="h-full rounded-full bg-sidebar transition-[width] duration-500"
                style={{ width: `${fill}%` }}
              />
            </div>
            <HandBadge n={nextMilestone} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="soft"
            size="icon"
            className="!h-11 !w-11 shrink-0 !rounded-xl"
            onClick={() => setListOpen((open) => !open)}
            aria-label={listOpen ? 'Show map' : 'Hand list'}
            aria-pressed={listOpen}
          >
            <ListIcon />
          </Button>
          <Button href="/public" variant="primary" className="min-h-11 flex-1 !rounded-xl">
            Play Hands
          </Button>
        </div>
      </footer>
    </div>
  );
}
