import { createHash } from 'node:crypto';
import {
  analyzeHand,
  handPayouts,
  type HandResultPayload,
  type StreetAction,
} from '@poker/engine';
import type { HandHistoryRow } from '@poker/db';

export const COACH_DAILY_LIMIT = 30;
export const COACH_HAND_CAP = 30;

export interface CoachReviewRow {
  userId: string;
  tableId: string;
  day: string;
  handsKey: string;
  review: string;
}

export function utcCoachDay(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function handsKey(handIds: string[]): string {
  return createHash('sha256').update(handIds.join('\n')).digest('hex').slice(0, 16);
}

export interface CoachQuota {
  limit: number;
  used: number;
  remaining: number;
}

export function coachQuota(rows: CoachReviewRow[], limit = COACH_DAILY_LIMIT): CoachQuota {
  const used = rows.length;
  return { limit, used, remaining: Math.max(0, limit - used) };
}

export type CoachDecision =
  | { kind: 'cached'; review: string }
  | { kind: 'regenerate' }
  | { kind: 'new' }
  | { kind: 'blocked' };

/** A plain-text session essay from before per-hand notes is not reusable. */
export function isStoredHandReview(review: string): boolean {
  const parsed = parseStoredReview(review);
  return parsed !== null;
}

function parseStoredReview(review: string): { hands: Record<string, string>; summary: string } | null {
  try {
    const parsed = JSON.parse(review) as { hands?: unknown; summary?: unknown };
    if (!parsed || typeof parsed !== 'object' || !parsed.hands || typeof parsed.hands !== 'object') {
      return null;
    }
    if (Array.isArray(parsed.hands)) return null;
    const hands: Record<string, string> = {};
    for (const [id, text] of Object.entries(parsed.hands as Record<string, unknown>)) {
      if (typeof text === 'string' && text.trim()) hands[id] = text.trim();
    }
    const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
    return { hands, summary };
  } catch {
    return null;
  }
}

export function reviewsFromStored(review: string | null | undefined): Record<string, string> {
  if (!review) return {};
  return parseStoredReview(review)?.hands ?? {};
}

export function summaryFromStored(review: string | null | undefined): string {
  if (!review) return '';
  return parseStoredReview(review)?.summary ?? '';
}

/** Older per-hand notes had no table summary, so the next coach call fills one in. */
function storedHasSummary(review: string): boolean {
  try {
    const parsed = JSON.parse(review) as { summary?: unknown };
    return !!parsed && typeof parsed === 'object' && typeof parsed.summary === 'string';
  } catch {
    return false;
  }
}

/** Same table on the same day never spends another slot, even when the hands changed. */
export function decideCoach(
  rows: CoachReviewRow[],
  tableId: string,
  key: string,
  limit = COACH_DAILY_LIMIT,
): CoachDecision {
  const mine = rows.find((r) => r.tableId === tableId);
  if (mine) {
    if (mine.handsKey === key && isStoredHandReview(mine.review) && storedHasSummary(mine.review)) {
      return { kind: 'cached', review: mine.review };
    }
    return { kind: 'regenerate' };
  }
  if (rows.length >= limit) return { kind: 'blocked' };
  return { kind: 'new' };
}

const COACH_SYSTEM = `You are a Texas Hold'em coach. The player is always called "You".
Reply with JSON only, no markdown and no text outside the JSON object:
{"summary":"...","hands":[{"n":1,"text":"..."}]}
summary is a few plain sentences about the table as a whole: how You played and the main thing to change.
n is the hand number from the notes. Write one entry for every hand.
Each text is plain sentences about that hand only: what You did, the win chance, and what You could have done differently.
Base every claim on the notes. Never promise a win or a profit.`;

function money(n: number): string {
  return n.toLocaleString('en-US');
}

function actionPhrase(action: StreetAction): string {
  const who = action.isViewer ? 'You' : action.name;
  const stack = action.stackAfter != null ? ` (balance ${money(action.stackAfter)})` : '';
  const say = (you: string, other: string) => `${who} ${action.isViewer ? you : other}${stack}`;
  switch (action.kind) {
    case 'fold':
    case 'check':
      return say(action.kind, `${action.kind}s`);
    case 'small_blind':
    case 'big_blind': {
      const blind = action.kind === 'small_blind' ? 'small' : 'big';
      return say(`post ${blind} blind ${money(action.amount)}`, `posts ${blind} blind ${money(action.amount)}`);
    }
    case 'raise':
      return say(`raise to ${money(action.streetTotal)}`, `raises to ${money(action.streetTotal)}`);
    case 'allin':
      return say(`go all-in ${money(action.amount)}`, `goes all-in ${money(action.amount)}`);
    default:
      return say(`${action.kind} ${money(action.amount)}`, `${action.kind}s ${money(action.amount)}`);
  }
}

function parseResult(raw: string): HandResultPayload {
  try {
    const value = JSON.parse(raw) as unknown;
    return value && typeof value === 'object' ? (value as HandResultPayload) : {};
  } catch {
    return {};
  }
}

function handNotes(row: HandHistoryRow, userId: string, index: number): string {
  const result = parseResult(row.resultJson);
  const analysis = analyzeHand(result, userId, { seed: row.id });
  const viewer = analysis.streets[0]?.players.find((p) => p.isViewer);
  const cards = viewer?.holeCards ? viewer.holeCards.join(' ') : 'unknown';
  const payouts = handPayouts(result);
  const viewerSeat = analysis.viewerSeat;
  const mine = payouts.find((p) => p.seat === viewerSeat);
  const names = new Map(
    (analysis.streets[0]?.players ?? []).map((p) => [p.seat, p.isViewer ? 'You' : p.name]),
  );
  const outcome = mine && mine.won > 0
    ? `You won ${money(mine.won)}${mine.handName ? ` with ${mine.handName}` : ''}`
    : payouts
        .filter((p) => p.won > 0)
        .map((p) => `${names.get(p.seat) ?? 'Seat'} won ${money(p.won)}${p.handName ? ` with ${p.handName}` : ''}`)
        .join('; ') || 'No pot awarded';
  const returned = mine && mine.returned > 0 ? ` ${money(mine.returned)} of your bet was returned uncalled.` : '';
  const streets = analysis.streets.map((street) => {
    const you = street.players.find((p) => p.isViewer);
    const chance = you?.winPct != null ? `${you.winPct}%` : 'n/a';
    const bets = street.actions.map(actionPhrase).join('; ') || 'no betting';
    return `${street.street} [${street.board.join(' ') || 'no board'}] win chance ${chance}: ${bets}`;
  });
  return [
    `Hand ${index} (${row.handId}). Your cards ${cards}. ${outcome}.${returned}`,
    ...streets,
  ].join('\n');
}

/** Oldest first, capped at the newest hands the model is asked to cover. */
export function coachHandOrder(hands: HandHistoryRow[]): HandHistoryRow[] {
  return [...hands.slice(0, COACH_HAND_CAP)].reverse();
}

export function buildCoachPrompt(
  hands: HandHistoryRow[],
  userId: string,
  truncated: boolean,
): { system: string; user: string; key: string; handIds: string[] } {
  const ordered = coachHandOrder(hands);
  const lines = ordered.map((row, i) => handNotes(row, userId, i + 1));
  const note = truncated || hands.length > ordered.length
    ? `This table has more hands than shown. These are the ${ordered.length} newest.\n\n`
    : '';
  return {
    system: COACH_SYSTEM,
    user: `${note}Session notes, in the order they were played:\n\n${lines.join('\n\n')}`,
    key: handsKey(ordered.map((h) => h.handId)),
    handIds: ordered.map((h) => h.handId),
  };
}

/** First `{...}` object, so a model that adds prose around the JSON still parses. */
function firstJsonObject(raw: string): string | null {
  const start = raw.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < raw.length; i += 1) {
    const ch = raw[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }
  return null;
}

/** Maps model hand numbers onto the hand ids sent in that order. */
export function parseHandReviews(
  raw: string,
  handIdsInOrder: string[],
): Record<string, string> | null {
  const slice = firstJsonObject(raw);
  if (!slice) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(slice);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const hands = (parsed as { hands?: unknown }).hands;
  if (!Array.isArray(hands)) return null;
  const out: Record<string, string> = {};
  for (const item of hands) {
    if (!item || typeof item !== 'object') continue;
    const n = (item as { n?: unknown }).n;
    const text = (item as { text?: unknown }).text;
    if (typeof n !== 'number' || !Number.isInteger(n) || typeof text !== 'string' || !text.trim()) {
      continue;
    }
    const id = handIdsInOrder[n - 1];
    if (!id) continue;
    out[id] = text.trim();
  }
  return Object.keys(out).length > 0 ? out : null;
}

function summaryFromRaw(raw: string): string {
  const slice = firstJsonObject(raw);
  if (!slice) return '';
  try {
    const parsed = JSON.parse(slice) as { summary?: unknown };
    return typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
  } catch {
    return '';
  }
}

export interface CoachSuccess {
  ok: true;
  review: string;
  reviews: Record<string, string>;
  summary: string;
  cached: boolean;
  limit: number;
  used: number;
  remaining: number;
}

export interface CoachFailure {
  ok: false;
  code: 'limit' | 'empty' | 'llm' | 'unconfigured';
  message: string;
  limit: number;
  used: number;
  remaining: number;
}

export type CoachOutcome = CoachSuccess | CoachFailure;

export async function runTableCoach(input: {
  userId: string;
  tableId: string;
  day: string;
  hands: HandHistoryRow[];
  truncated: boolean;
  rows: CoachReviewRow[];
  save: (row: CoachReviewRow) => Promise<void>;
  complete: (system: string, user: string) => Promise<{ text: string | null; error: string | null }>;
  configured?: boolean;
  limit?: number;
}): Promise<CoachOutcome> {
  const limit = input.limit ?? COACH_DAILY_LIMIT;
  const quota = () => coachQuota(input.rows, limit);
  if (input.hands.length === 0) {
    const q = quota();
    return { ok: false, code: 'empty', message: 'No hands at this table can be coached.', ...q };
  }
  const prompt = buildCoachPrompt(input.hands, input.userId, input.truncated);
  const decision = decideCoach(input.rows, input.tableId, prompt.key, limit);
  if (decision.kind === 'blocked') {
    const q = quota();
    return {
      ok: false,
      code: 'limit',
      message: `You can coach ${limit} tables a day. Try again tomorrow.`,
      ...q,
    };
  }
  if (decision.kind === 'cached') {
    const q = quota();
    return {
      ok: true,
      review: decision.review,
      reviews: reviewsFromStored(decision.review),
      summary: summaryFromStored(decision.review),
      cached: true,
      ...q,
    };
  }
  if (input.configured === false) {
    const q = quota();
    return { ok: false, code: 'unconfigured', message: 'Coaching is not configured.', ...q };
  }
  const result = await input.complete(prompt.system, prompt.user);
  const text = result.text?.trim() ?? '';
  const reviews = text ? parseHandReviews(text, prompt.handIds) : null;
  if (!reviews) {
    const q = quota();
    return {
      ok: false,
      code: 'llm',
      message: result.error || 'Coaching is unavailable right now.',
      ...q,
    };
  }
  const summary = summaryFromRaw(text);
  const review = JSON.stringify({ key: prompt.key, summary, hands: reviews });
  const used = decision.kind === 'new' ? input.rows.length + 1 : input.rows.length;
  await input.save({
    userId: input.userId,
    tableId: input.tableId,
    day: input.day,
    handsKey: prompt.key,
    review,
  });
  return {
    ok: true,
    review,
    reviews,
    summary,
    cached: false,
    limit,
    used,
    remaining: Math.max(0, limit - used),
  };
}
