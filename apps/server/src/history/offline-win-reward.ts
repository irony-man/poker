import { isBotUserId } from '../bot.js';

type OfflineHandPlayer = { seat?: unknown; userId?: unknown };
type OfflineHandWinner = { seat?: unknown };

function seatUserIdMap(players: OfflineHandPlayer[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const p of players) {
    if (!p || typeof p !== 'object') continue;
    const seat = p.seat;
    const userId = p.userId;
    if (typeof seat !== 'number' || !Number.isFinite(seat)) continue;
    if (typeof userId !== 'string' || !userId) continue;
    map.set(seat, userId);
  }
  return map;
}

/** True when the user won at least one pot award in an offline hand result. */
export function userWonOfflineHand(result: unknown, userId: string): boolean {
  if (!result || typeof result !== 'object') return false;
  const rec = result as { winners?: unknown; players?: unknown };
  const winners = Array.isArray(rec.winners) ? (rec.winners as OfflineHandWinner[]) : [];
  const players = Array.isArray(rec.players) ? (rec.players as OfflineHandPlayer[]) : [];
  if (winners.length === 0 || players.length === 0) return false;
  const bySeat = seatUserIdMap(players);
  return winners.some((w) => {
    if (!w || typeof w !== 'object') return false;
    const seat = w.seat;
    if (typeof seat !== 'number' || !Number.isFinite(seat)) return false;
    return bySeat.get(seat) === userId;
  });
}

/** True when every seated opponent is a bot (solo offline vs bots). */
export function isOfflineSoloVsBots(result: unknown, userId: string): boolean {
  if (!result || typeof result !== 'object') return false;
  const players = (result as { players?: unknown }).players;
  if (!Array.isArray(players) || players.length === 0) return false;
  let hasHuman = false;
  for (const p of players as OfflineHandPlayer[]) {
    if (!p || typeof p !== 'object') continue;
    const id = p.userId;
    if (typeof id !== 'string' || !id) continue;
    if (isBotUserId(id)) continue;
    if (id === userId) {
      hasHuman = true;
      continue;
    }
    return false;
  }
  return hasHuman;
}
