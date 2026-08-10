/**
 * Monte-Carlo sim: bots of every personality play each other.
 *
 * Usage (from repo root, Node 20+):
 *   npx tsx packages/engine/scripts/sim-personalities.ts [hands=1000]
 *
 * Writes JSONL + CSV under data/ and prints a personality summary.
 */
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BOT_PERSONALITY_IDS,
  applyAction,
  chooseBotAction,
  createEmptyTable,
  makeBotUserId,
  personalityIdFromBotUserId,
  sitDown,
  startHand,
  type BotPersonalityId,
  type HandState,
  type TableConfig,
} from '../src/index.js';

const HANDS = Math.max(1, Number(process.argv[2] ?? 1000) || 1000);
const START_STACK = 1000;
const BB = 10;

const config: TableConfig = {
  maxSeats: 6,
  smallBlind: 5,
  bigBlind: BB,
  buyIn: START_STACK,
  turnTimeMs: 15_000,
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const outDir = path.join(root, 'data');

type PlayerPoint = {
  hand: number;
  seat: number;
  personality: BotPersonalityId;
  nPlayers: number;
  lineup: string;
  startStack: number;
  endStack: number;
  net: number;
  netBb: number;
  pot: number;
  won: boolean;
  share: number;
  streetEnd: string;
  uncontested: boolean;
};

function rng(): (n: number) => Buffer {
  return (n) => randomBytes(n);
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function sampleLineup(n: number): BotPersonalityId[] {
  const out: BotPersonalityId[] = [];
  for (let i = 0; i < n; i++) out.push(pick(BOT_PERSONALITY_IDS));
  return out;
}

function runOneHand(handIndex: number, lineup: BotPersonalityId[]): {
  state: HandState;
  startStacks: number[];
  streetEnd: string;
  uncontested: boolean;
} {
  let state = createEmptyTable({ ...config, maxSeats: Math.max(2, lineup.length) });
  const startStacks: number[] = [];

  for (let seat = 0; seat < lineup.length; seat++) {
    const style = lineup[seat]!;
    const userId = makeBotUserId(`h${handIndex}s${seat}`, style);
    const name = `${style}-${seat}`;
    const r = sitDown(state, seat, userId, name, START_STACK);
    if (!r.ok) throw new Error(`sitDown seat ${seat}: ${r.error}`);
    state = r.state;
    startStacks[seat] = START_STACK;
  }

  const started = startHand(state, config, `sim-${handIndex}`, rng());
  if (!started.ok) throw new Error(`startHand: ${started.error}`);
  state = started.state;

  let streetEnd = state.street;
  let uncontested = false;
  let guard = 0;

  while (state.street !== 'payout' && state.toAct !== null && guard++ < 200) {
    streetEnd = state.street;
    const seat = state.toAct;
    const intent = chooseBotAction(state, seat, config);
    if (!intent) throw new Error(`null intent at seat ${seat} hand ${handIndex}`);
    const r = applyAction(state, seat, intent, config);
    if (!r.ok) throw new Error(`apply ${intent.type} seat ${seat}: ${r.error}`);
    state = r.state;
    for (const e of r.events) {
      if (e.type === 'hand_ended' && e.winners.length === 1) {
        // fold-win leaves board often empty / short streets
        const winners = e.winners;
        if (state.community.length === 0 && winners[0]) uncontested = true;
      }
    }
  }

  if (state.street !== 'payout') {
    throw new Error(`hand ${handIndex} stuck on ${state.street} after ${guard} acts`);
  }

  // Final street before payout for contested pots
  if (!uncontested) {
    if (state.community.length >= 5) streetEnd = 'river';
    else if (state.community.length === 4) streetEnd = 'turn';
    else if (state.community.length === 3) streetEnd = 'flop';
    else streetEnd = 'preflop';
  }

  return { state, startStacks, streetEnd, uncontested };
}

function toCsv(rows: Record<string, string | number | boolean>[]): string {
  if (rows.length === 0) return '';
  const keys = Object.keys(rows[0]!);
  const esc = (v: string | number | boolean) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [keys.join(','), ...rows.map((r) => keys.map((k) => esc(r[k]!)).join(','))].join('\n');
}

function main() {
  const playerPoints: PlayerPoint[] = [];
  const handRows: Record<string, string | number | boolean>[] = [];

  const byStyle: Record<
    string,
    { hands: number; wins: number; net: number; netBb: number; potsWon: number }
  > = {};
  for (const id of BOT_PERSONALITY_IDS) {
    byStyle[id] = { hands: 0, wins: 0, net: 0, netBb: 0, potsWon: 0 };
  }

  const t0 = Date.now();
  for (let h = 1; h <= HANDS; h++) {
    // Mix heads-up through 6-max for variety
    const n = 2 + (h % 5); // cycles 2..6
    const lineup = sampleLineup(n);
    const { state, startStacks, streetEnd, uncontested } = runOneHand(h, lineup);

    const pot = Math.max(
      0,
      lineup.reduce((sum, _, seat) => sum + (startStacks[seat]! - state.players[seat]!.stack), 0) +
        state.players.reduce((s, p, i) => (i < n ? s : s), 0),
    );
    // True pot at showdown is sum of chips leaving stacks that returned via winners
    const truePot = lineup.reduce(
      (sum, _, seat) => sum + Math.max(0, startStacks[seat]! - state.players[seat]!.stack),
      0,
    );
    // After awards, end stack - start = net; won chips = pot distributed
    const winnerShares = new Map<number, number>();
    for (const w of state.winners) {
      winnerShares.set(w.seat, (winnerShares.get(w.seat) ?? 0) + w.amount);
    }
    const potFromWinners = [...winnerShares.values()].reduce((a, b) => a + b, 0);

    handRows.push({
      hand: h,
      nPlayers: n,
      lineup: lineup.join('|'),
      pot: potFromWinners || truePot,
      winners: [...winnerShares.keys()]
        .map((seat) => lineup[seat] ?? `s${seat}`)
        .join('|'),
      streetEnd,
      uncontested: uncontested ? 1 : 0,
    });

    for (let seat = 0; seat < n; seat++) {
      const style =
        personalityIdFromBotUserId(state.players[seat]!.userId) ?? lineup[seat]!;
      const endStack = state.players[seat]!.stack;
      const net = endStack - startStacks[seat]!;
      const share = winnerShares.get(seat) ?? 0;
      const won = share > 0;
      const point: PlayerPoint = {
        hand: h,
        seat,
        personality: style,
        nPlayers: n,
        lineup: lineup.join('|'),
        startStack: startStacks[seat]!,
        endStack,
        net,
        netBb: net / BB,
        pot: potFromWinners || truePot,
        won,
        share,
        streetEnd,
        uncontested,
      };
      playerPoints.push(point);

      const agg = byStyle[style]!;
      agg.hands += 1;
      agg.net += net;
      agg.netBb += net / BB;
      if (won) {
        agg.wins += 1;
        agg.potsWon += 1;
      }
    }

    if (h % 200 === 0 || h === HANDS) {
      process.stderr.write(`  sim ${h}/${HANDS}\n`);
    }
  }

  mkdirSync(outDir, { recursive: true });
  const stamp = createHash('sha1').update(String(Date.now())).digest('hex').slice(0, 8);
  const base = `bot-personality-sim-${HANDS}-${stamp}`;

  const jsonlPath = path.join(outDir, `${base}-players.jsonl`);
  const handCsvPath = path.join(outDir, `${base}-hands.csv`);
  const playerCsvPath = path.join(outDir, `${base}-players.csv`);
  const summaryPath = path.join(outDir, `${base}-summary.json`);

  writeFileSync(jsonlPath, playerPoints.map((p) => JSON.stringify(p)).join('\n') + '\n');
  writeFileSync(
    handCsvPath,
    toCsv(handRows) + '\n',
  );
  writeFileSync(
    playerCsvPath,
    toCsv(
      playerPoints.map((p) => ({
        hand: p.hand,
        seat: p.seat,
        personality: p.personality,
        nPlayers: p.nPlayers,
        lineup: p.lineup,
        startStack: p.startStack,
        endStack: p.endStack,
        net: p.net,
        netBb: Number(p.netBb.toFixed(3)),
        pot: p.pot,
        won: p.won ? 1 : 0,
        share: p.share,
        streetEnd: p.streetEnd,
        uncontested: p.uncontested ? 1 : 0,
      })),
    ) + '\n',
  );

  const summary = {
    hands: HANDS,
    playerObservations: playerPoints.length,
    elapsedMs: Date.now() - t0,
    blinds: { sb: config.smallBlind, bb: config.bigBlind },
    startStack: START_STACK,
    personalities: BOT_PERSONALITY_IDS.map((id) => {
      const a = byStyle[id]!;
      return {
        id,
        observations: a.hands,
        wins: a.wins,
        winRate: a.hands ? a.wins / a.hands : 0,
        totalNet: a.net,
        avgNetBb: a.hands ? a.netBb / a.hands : 0,
        totalNetBb: a.netBb,
      };
    }).sort((a, b) => b.avgNetBb - a.avgNetBb),
    files: {
      playersJsonl: jsonlPath,
      playersCsv: playerCsvPath,
      handsCsv: handCsvPath,
    },
  };
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + '\n');

  console.log(JSON.stringify(summary, null, 2));
  console.log(`\nWrote:\n  ${playerCsvPath}\n  ${handCsvPath}\n  ${jsonlPath}\n  ${summaryPath}`);
}

main();
