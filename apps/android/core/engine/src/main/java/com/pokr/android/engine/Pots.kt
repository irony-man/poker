package com.pokr.android.engine

data class PotLayer(
    /** Chips in this pot layer. */
    val amount: Int,
    /** Seat indices eligible to win this pot (did not fold and contributed to this layer). */
    val eligible: List<Int>,
)

data class Contribution(
    val seat: Int,
    /** Total chips put into the pot this hand (committed). */
    val amount: Int,
    val folded: Boolean,
)

/**
 * Build main + side pots from per-seat contributions.
 * Folded players still contribute chips but are not eligible to win.
 */
fun buildSidePots(contributions: List<Contribution>): List<PotLayer> {
    val positive = contributions.filter { it.amount > 0 }
    if (positive.isEmpty()) return emptyList()

    val levels = positive.map { it.amount }.distinct().sorted()
    val pots = mutableListOf<PotLayer>()
    var prev = 0

    for (level in levels) {
        val contributors = positive.filter { it.amount >= level }
        val eligible = contributors.filter { !it.folded }.map { it.seat }
        val amount = (level - prev) * contributors.size
        if (amount > 0) {
            pots.add(PotLayer(amount, eligible))
        }
        prev = level
    }

    // Merge adjacent pots with identical eligibility for cleaner display
    val merged = mutableListOf<PotLayer>()
    for (pot in pots) {
        val last = merged.lastOrNull()
        if (last != null &&
            last.eligible.size == pot.eligible.size &&
            last.eligible == pot.eligible
        ) {
            merged[merged.lastIndex] = last.copy(amount = last.amount + pot.amount)
        } else {
            merged.add(pot.copy(eligible = pot.eligible.toList()))
        }
    }
    return merged
}

data class PotAward(
    val seat: Int,
    val amount: Int,
    /** Best-hand category name at showdown. Omitted when the pot is won uncontested. */
    val handName: String? = null,
)

/**
 * Award pots given a comparable hand rank per seat (higher wins).
 * Odd chips go to the earliest eligible seat clockwise from dealerButton+1.
 */
fun awardPots(
    pots: List<PotLayer>,
    ranks: Map<Int, HandRank>,
    dealerButton: Int,
    seatCount: Int,
): List<PotAward> {
    val totals = mutableMapOf<Int, Int>()

    for (pot in pots) {
        if (pot.amount <= 0 || pot.eligible.isEmpty()) continue

        var best = -1
        val winners = mutableListOf<Int>()
        for (seat in pot.eligible) {
            val r = ranks[seat] ?: -1
            if (r > best) {
                best = r
                winners.clear()
                winners.add(seat)
            } else if (r == best) {
                winners.add(seat)
            }
        }
        if (winners.isEmpty()) continue

        val share = pot.amount / winners.size
        var remainder = pot.amount - share * winners.size

        // Order winners clockwise from left of dealer for odd chips
        val ordered = winners.sortedBy { seat ->
            (seat - dealerButton - 1 + seatCount * 2) % seatCount
        }

        for (seat in ordered) {
            var amt = share
            if (remainder > 0) {
                amt += 1
                remainder -= 1
            }
            totals[seat] = (totals[seat] ?: 0) + amt
        }
    }

    return totals.entries.map { (seat, amount) -> PotAward(seat, amount) }
}
