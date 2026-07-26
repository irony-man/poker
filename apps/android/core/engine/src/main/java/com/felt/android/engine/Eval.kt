package com.felt.android.engine

/** Hand categories, higher is better. */
enum class HandCategory {
    HighCard,
    OnePair,
    TwoPair,
    ThreeOfAKind,
    Straight,
    Flush,
    FullHouse,
    FourOfAKind,
    StraightFlush,
}

val HAND_CATEGORY_NAMES: Map<HandCategory, String> = mapOf(
    HandCategory.HighCard to "High Card",
    HandCategory.OnePair to "One Pair",
    HandCategory.TwoPair to "Two Pair",
    HandCategory.ThreeOfAKind to "Three of a Kind",
    HandCategory.Straight to "Straight",
    HandCategory.Flush to "Flush",
    HandCategory.FullHouse to "Full House",
    HandCategory.FourOfAKind to "Four of a Kind",
    HandCategory.StraightFlush to "Straight Flush",
)

/**
 * Compact comparable rank:
 * bits 20-23: category (0-8)
 * bits 0-19: kickers packed as 4-bit nibbles (high first)
 */
typealias HandRank = Int

fun compareHandRanks(a: HandRank, b: HandRank): Int = a - b

private fun pack(category: HandCategory, kickers: List<Int>): HandRank {
    var value = category.ordinal shl 20
    val padded = kickers.take(5).toMutableList()
    while (padded.size < 5) padded.add(0)
    for (i in 0 until 5) {
        value = value or ((padded[i] and 0xF) shl (16 - i * 4))
    }
    return value
}

private fun straightHigh(ranksDescUnique: List<Int>): Int? {
    // Wheel: A-5-4-3-2
    if (14 in ranksDescUnique && 5 in ranksDescUnique && 4 in ranksDescUnique &&
        3 in ranksDescUnique && 2 in ranksDescUnique
    ) {
        return 5
    }
    for (i in 0..ranksDescUnique.size - 5) {
        val hi = ranksDescUnique[i]
        if (ranksDescUnique[i + 1] == hi - 1 &&
            ranksDescUnique[i + 2] == hi - 2 &&
            ranksDescUnique[i + 3] == hi - 3 &&
            ranksDescUnique[i + 4] == hi - 4
        ) {
            return hi
        }
    }
    return null
}

/** Evaluate exactly 5 cards. */
fun evaluate5(cards: List<Card>): HandRank {
    require(cards.size == 5) { "evaluate5 requires 5 cards" }

    val ranks = cards.map { it.rank }.sortedDescending()
    val suits = cards.map { it.suit }
    val isFlush = suits.all { it == suits[0] }

    val counts = mutableMapOf<Rank, Int>()
    for (r in ranks) counts[r] = (counts[r] ?: 0) + 1

    val byCount = counts.entries.sortedWith(
        compareByDescending<Map.Entry<Rank, Int>> { it.value }.thenByDescending { it.key },
    )

    val uniqueDesc = ranks.distinct().sortedDescending()
    val sHigh = straightHigh(uniqueDesc)

    if (isFlush && sHigh != null) return pack(HandCategory.StraightFlush, listOf(sHigh))
    if (byCount[0].value == 4) {
        return pack(HandCategory.FourOfAKind, listOf(byCount[0].key, byCount[1].key))
    }
    if (byCount[0].value == 3 && byCount[1].value == 2) {
        return pack(HandCategory.FullHouse, listOf(byCount[0].key, byCount[1].key))
    }
    if (isFlush) return pack(HandCategory.Flush, ranks)
    if (sHigh != null) return pack(HandCategory.Straight, listOf(sHigh))
    if (byCount[0].value == 3) {
        val kickers = byCount.drop(1).map { it.key }
        return pack(HandCategory.ThreeOfAKind, listOf(byCount[0].key) + kickers)
    }
    if (byCount[0].value == 2 && byCount[1].value == 2) {
        val highPair = maxOf(byCount[0].key, byCount[1].key)
        val lowPair = minOf(byCount[0].key, byCount[1].key)
        val kicker = byCount[2].key
        return pack(HandCategory.TwoPair, listOf(highPair, lowPair, kicker))
    }
    if (byCount[0].value == 2) {
        val kickers = byCount.drop(1).map { it.key }
        return pack(HandCategory.OnePair, listOf(byCount[0].key) + kickers)
    }
    return pack(HandCategory.HighCard, ranks)
}

/** Best 5-card hand from 5–7 cards, including which cards form it. */
data class BestHand(val rank: HandRank, val cards: List<Card>)

fun evaluateBestHand(cards: List<Card>): BestHand {
    require(cards.size in 5..7) { "evaluateBestHand requires 5–7 cards" }
    if (cards.size == 5) return BestHand(evaluate5(cards), cards.map { it.copy() })

    var best = 0
    var bestCards: List<Card> = emptyList()
    val n = cards.size
    val idx = IntArray(5) { it }

    fun score(): HandRank = evaluate5(idx.map { cards[it] })

    fun comb(start: Int, depth: Int) {
        if (depth == 5) {
            val r = score()
            if (r > best) {
                best = r
                bestCards = idx.map { cards[it].copy() }
            }
            return
        }
        for (i in start..n - (5 - depth)) {
            idx[depth] = i
            comb(i + 1, depth + 1)
        }
    }
    comb(0, 0)
    return BestHand(best, bestCards)
}

/** Best 5-card hand rank from 5–7 cards. */
fun evaluateBest(cards: List<Card>): HandRank = evaluateBestHand(cards).rank

fun categoryOf(rank: HandRank): HandCategory = HandCategory.entries[rank shr 20]
