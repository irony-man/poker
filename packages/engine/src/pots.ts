export interface PotLayer {
  /** Chips in this pot layer. */
  amount: number;
  /** Seat indices eligible to win this pot (did not fold and contributed to this layer). */
  eligible: number[];
}

export interface Contribution {
  seat: number;
  /** Total chips put into the pot this hand (committed). */
  amount: number;
  folded: boolean;
}

/**
 * Build main + side pots from per-seat contributions.
 * Folded players still contribute chips but are not eligible to win.
 */
export function buildSidePots(contributions: Contribution[]): PotLayer[] {
  const positive = contributions.filter((c) => c.amount > 0);
  if (positive.length === 0) return [];

  const levels = [...new Set(positive.map((c) => c.amount))].sort((a, b) => a - b);
  const pots: PotLayer[] = [];
  let prev = 0;

  for (const level of levels) {
    const contributors = positive.filter((c) => c.amount >= level);
    const eligible = contributors.filter((c) => !c.folded).map((c) => c.seat);
    const amount = (level - prev) * contributors.length;
    if (amount > 0) {
      pots.push({ amount, eligible });
    }
    prev = level;
  }

  // Merge adjacent pots with identical eligibility for cleaner display
  const merged: PotLayer[] = [];
  for (const pot of pots) {
    const last = merged[merged.length - 1];
    if (
      last &&
      last.eligible.length === pot.eligible.length &&
      last.eligible.every((s, i) => s === pot.eligible[i])
    ) {
      last.amount += pot.amount;
    } else {
      merged.push({ amount: pot.amount, eligible: [...pot.eligible] });
    }
  }
  return merged;
}

export interface PotAward {
  seat: number;
  amount: number;
  /** Best-hand category name at showdown, or "Uncontested" when everyone else folded. */
  handName?: string;
}

/**
 * Award pots given a comparable hand rank per seat (higher wins).
 * Odd chips go to the earliest eligible seat clockwise from dealerButton+1.
 */
export function awardPots(
  pots: PotLayer[],
  ranks: Map<number, number>,
  dealerButton: number,
  seatCount: number,
): PotAward[] {
  const totals = new Map<number, number>();

  for (const pot of pots) {
    if (pot.amount <= 0 || pot.eligible.length === 0) continue;

    let best = -1;
    const winners: number[] = [];
    for (const seat of pot.eligible) {
      const r = ranks.get(seat) ?? -1;
      if (r > best) {
        best = r;
        winners.length = 0;
        winners.push(seat);
      } else if (r === best) {
        winners.push(seat);
      }
    }
    if (winners.length === 0) continue;

    const share = Math.floor(pot.amount / winners.length);
    let remainder = pot.amount - share * winners.length;

    // Order winners clockwise from left of dealer for odd chips
    const ordered = [...winners].sort((a, b) => {
      const da = (a - dealerButton - 1 + seatCount * 2) % seatCount;
      const db = (b - dealerButton - 1 + seatCount * 2) % seatCount;
      return da - db;
    });

    for (const seat of ordered) {
      let amt = share;
      if (remainder > 0) {
        amt += 1;
        remainder -= 1;
      }
      totals.set(seat, (totals.get(seat) ?? 0) + amt);
    }
  }

  return [...totals.entries()].map(([seat, amount]) => ({ seat, amount }));
}
