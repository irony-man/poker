package com.felt.android.engine

/** Rank: 2 = deuce … 14 = Ace. Suit: c d h s */
typealias Rank = Int

enum class Suit(val char: Char) {
    CLUBS('c'),
    DIAMONDS('d'),
    HEARTS('h'),
    SPADES('s');

    companion object {
        fun fromChar(c: Char): Suit? = entries.find { it.char == c.lowercaseChar() }
    }
}

data class Card(
    val rank: Rank,
    val suit: Suit,
)

val SUITS: List<Suit> = Suit.entries
val RANKS: List<Rank> = (2..14).toList()

private val RANK_CHARS: Map<Char, Rank> = mapOf(
    '2' to 2, '3' to 3, '4' to 4, '5' to 5, '6' to 6, '7' to 7, '8' to 8, '9' to 9,
    'T' to 10, 'J' to 11, 'Q' to 12, 'K' to 13, 'A' to 14,
)

private val RANK_TO_CHAR: Map<Rank, Char> = RANK_CHARS.entries.associate { (k, v) -> v to k }

fun cardToString(card: Card): String = "${RANK_TO_CHAR[card.rank]}${card.suit.char}"

fun parseCard(s: String): Card {
    require(s.length == 2) { "Invalid card: $s" }
    val rank = RANK_CHARS[s[0].uppercaseChar()]
    val suit = Suit.fromChar(s[1])
    require(rank != null && suit != null) { "Invalid card: $s" }
    return Card(rank, suit)
}

fun parseCards(s: String): List<Card> =
    s.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }.map(::parseCard)

fun createDeck(): List<Card> = buildList {
    for (suit in SUITS) {
        for (rank in RANKS) {
            add(Card(rank, suit))
        }
    }
}

/** Fisher–Yates shuffle using the supplied CSPRNG byte provider. */
fun <T> shuffle(items: List<T>, randomBytes: (Int) -> ByteArray): List<T> {
    val arr = items.toMutableList()
    for (i in arr.lastIndex downTo 1) {
        val buf = randomBytes(4)
        require(buf.size >= 4) { "randomBytes must return at least 4 bytes" }
        val rand = ((buf[0].toInt() and 0xFF) shl 24) or
            ((buf[1].toInt() and 0xFF) shl 16) or
            ((buf[2].toInt() and 0xFF) shl 8) or
            (buf[3].toInt() and 0xFF)
        val j = (rand.toUInt() % (i + 1).toUInt()).toInt()
        val tmp = arr[i]
        arr[i] = arr[j]
        arr[j] = tmp
    }
    return arr
}
