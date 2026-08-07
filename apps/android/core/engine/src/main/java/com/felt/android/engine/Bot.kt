package com.felt.android.engine

import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.round
import kotlin.random.Random

private const val BOT_PREFIX = "bot:"

fun isBotUserId(userId: String?): Boolean =
    userId != null && userId.startsWith(BOT_PREFIX)

fun makeBotUserId(id: String): String = "$BOT_PREFIX$id"

private val BOT_NAMES = listOf(
    "AceBot",
    "RiverRat",
    "BluffByte",
    "PotOdds",
    "ChipShark",
    "FoldBot",
    "AllInAnnie",
    "NutsNova",
    "CallCart",
    "RaiseRex",
)

fun pickBotName(taken: Set<String>): String {
    for (n in BOT_NAMES) {
        if (n !in taken) return n
    }
    return "Bot${Random.nextInt(100, 1000)}"
}

private fun snapToBb(amount: Int, bb: Int, min: Int, max: Int): Int {
    if (max < min) return min
    val step = max(1, bb)
    val snapped = (round(amount.toDouble() / step) * step).toInt()
    return snapped.coerceIn(min, max)
}

private fun cardKey(c: Card): String = "${c.rank}${c.suit.char}"

/** Chen formula — preflop hand ranking (open / 3-bet ranges). */
fun chenScore(a: Card, b: Card): Double {
    val hi = max(a.rank, b.rank)
    val lo = min(a.rank, b.rank)
    fun scoreRank(r: Int): Double = when (r) {
        14 -> 10.0
        13 -> 8.0
        12 -> 7.0
        11 -> 6.0
        10 -> 5.0
        else -> r / 2.0
    }
    var score = scoreRank(hi)
    if (a.rank == b.rank) {
        score = max(5.0, scoreRank(hi) * 2)
    } else {
        if (a.suit == b.suit) score += 2
        val gap = hi - lo - 1
        score += when {
            gap == 1 -> -1.0
            gap == 2 -> -2.0
            gap == 3 -> -4.0
            gap >= 4 -> -5.0
            else -> 0.0
        }
        if (hi < 12 && gap <= 1) score += 1
    }
    return score
}

private fun preflopEquity(a: Card, b: Card, opponents: Int): Double {
    val s = (chenScore(a, b).coerceIn(0.0, 20.0)) / 20.0
    val multi = s.pow(1 + 0.22 * max(0, opponents - 1))
    return multi.coerceIn(0.02, 0.95)
}

private fun <T> MutableList<T>.shuffleInPlace() {
    for (i in size - 1 downTo 1) {
        val j = Random.nextInt(i + 1)
        val t = this[i]
        this[i] = this[j]
        this[j] = t
    }
}

/** Monte-Carlo equity vs n random opponents using only known cards. */
fun estimateEquity(
    hole: Pair<Card, Card>,
    board: List<Card>,
    opponents: Int,
    trials: Int = 72,
): Double {
    val nOpp = opponents.coerceIn(1, 5)
    if (board.isEmpty()) return preflopEquity(hole.first, hole.second, nOpp)

    val known = buildSet {
        add(cardKey(hole.first))
        add(cardKey(hole.second))
        board.forEach { add(cardKey(it)) }
    }
    val remaining = createDeck().filter { cardKey(it) !in known }.toMutableList()
    val needBoard = 5 - board.size
    val needCards = nOpp * 2 + needBoard
    if (remaining.size < needCards) return preflopEquity(hole.first, hole.second, nOpp)

    var wins = 0.0
    var ties = 0.0

    repeat(trials) {
        val deck = remaining.toMutableList()
        deck.shuffleInPlace()
        var ix = 0
        val fullBoard = board.toMutableList()
        repeat(needBoard) { fullBoard.add(deck[ix++]) }

        val myRank = evaluateBest(listOf(hole.first, hole.second) + fullBoard)
        var bestOpp = -1
        var tiedOpp = 0
        repeat(nOpp) {
            val c1 = deck[ix++]
            val c2 = deck[ix++]
            val rank = evaluateBest(listOf(c1, c2) + fullBoard)
            when {
                rank > bestOpp -> {
                    bestOpp = rank
                    tiedOpp = 1
                }
                rank == bestOpp -> tiedOpp += 1
            }
        }
        when {
            myRank > bestOpp -> wins += 1
            myRank == bestOpp -> ties += 1.0 / (tiedOpp + 1)
        }
    }
    return (wins + ties) / trials
}

private fun activeOtherCount(state: HandState, seat: Int): Int =
    state.players.count {
        it.seat != seat &&
            it.userId != null &&
            (it.status == PlayerStatus.Active || it.status == PlayerStatus.AllIn)
    }

private fun lateFactor(seat: Int, button: Int, nSeats: Int): Double {
    if (nSeats <= 1) return 1.0
    val fromBtn = (button - seat + nSeats) % nSeats
    return 1.0 - fromBtn.toDouble() / (nSeats - 1)
}

private fun sizeTo(
    minRaiseTo: Int,
    maxRaiseTo: Int,
    pot: Int,
    currentBet: Int,
    bb: Int,
    potFrac: Double,
): Int {
    val raw = if (currentBet == 0) {
        max(minRaiseTo.toDouble(), pot * potFrac)
    } else {
        currentBet + max(bb.toDouble(), pot * potFrac)
    }
    return snapToBb(raw.toInt(), bb, minRaiseTo, maxRaiseTo)
}

private fun raiseOrBet(
    types: Set<ActionType>,
    prefer: ActionType,
    legal: LegalActions,
    pot: Int,
    currentBet: Int,
    playerBet: Int,
    bb: Int,
    potFrac: Double,
    stack: Int,
    seq: Int,
    jam: Boolean,
): ActionIntent? {
    if (jam && ActionType.AllIn in types) return ActionIntent(ActionType.AllIn, seq = seq)
    if (legal.maxRaiseTo <= legal.minRaiseTo && ActionType.AllIn in types) {
        return ActionIntent(ActionType.AllIn, seq = seq)
    }

    val target = sizeTo(legal.minRaiseTo, legal.maxRaiseTo, pot, currentBet, bb, potFrac)
    val moreToPut = max(0, target - playerBet)
    if (moreToPut >= stack * 0.75 && ActionType.AllIn in types) {
        return ActionIntent(ActionType.AllIn, seq = seq)
    }
    if (prefer in types) return ActionIntent(prefer, amount = target, seq = seq)
    if (ActionType.AllIn in types) return ActionIntent(ActionType.AllIn, seq = seq)
    return null
}

/**
 * Pro-style bot: Chen preflop ranges, Monte-Carlo postflop equity,
 * pot-odds calling, value-heavy aggression, selective semi-bluffs.
 */
fun chooseBotAction(
    state: HandState,
    seat: Int,
    config: TableConfig,
): ActionIntent? {
    val legal = legalActions(state, seat, config)
    if (legal.types.isEmpty()) return null

    val types = legal.types.toSet()
    val seq = state.actionSeq
    val player = state.players[seat]
    val bb = config.bigBlind
    val pot = max(1, state.pot)
    val hole = player.holeCards
    val r = Random.nextDouble()
    val opponents = max(1, activeOtherCount(state, seat))
    val late = lateFactor(seat, state.dealerButton, state.players.size)
    val stackBb = (player.stack + player.bet).toDouble() / max(1, bb)
    val effectiveStackBb = player.stack.toDouble() / max(1, bb)
    val street = state.street
    val preflop = street == Street.Preflop

    if (hole == null) {
        if (ActionType.Check in types) return ActionIntent(ActionType.Check, seq = seq)
        if (ActionType.Fold in types) return ActionIntent(ActionType.Fold, seq = seq)
        if (ActionType.Call in types) return ActionIntent(ActionType.Call, seq = seq)
        val t = legal.types.first()
        return ActionIntent(
            t,
            amount = if (t == ActionType.Bet || t == ActionType.Raise) legal.minRaiseTo else null,
            seq = seq,
        )
    }

    val equity = estimateEquity(Pair(hole.first, hole.second), state.community, opponents)
    val chen = chenScore(hole.first, hole.second)
    val callAmt = legal.callAmount
    val potOdds = if (callAmt > 0) callAmt.toDouble() / (pot + callAmt) else 0.0
    val commitFrac = callAmt.toDouble() / max(1, player.stack)

    // Short-stack push/fold
    if (preflop && effectiveStackBb <= 12) {
        val pushChen = 6 + (1 - late) * 3 + if (opponents >= 3) 1.5 else 0.0
        if (chen >= pushChen) {
            if (ActionType.AllIn in types) return ActionIntent(ActionType.AllIn, seq = seq)
            if (ActionType.Raise in types) {
                return ActionIntent(ActionType.Raise, amount = legal.maxRaiseTo, seq = seq)
            }
            if (ActionType.Bet in types) {
                return ActionIntent(ActionType.Bet, amount = legal.maxRaiseTo, seq = seq)
            }
            if (ActionType.Call in types) return ActionIntent(ActionType.Call, seq = seq)
        }
        if (ActionType.Check in types) return ActionIntent(ActionType.Check, seq = seq)
        if (ActionType.Call in types && potOdds <= 0.28 && chen >= 4.5) {
            return ActionIntent(ActionType.Call, seq = seq)
        }
        if (ActionType.Fold in types) return ActionIntent(ActionType.Fold, seq = seq)
    }

    // Free action
    if (ActionType.Check in types) {
        if (equity >= 0.7 || (!preflop && equity >= 0.6)) {
            val jam = equity >= 0.9 && effectiveStackBb <= 18
            raiseOrBet(
                types,
                ActionType.Bet,
                legal,
                pot,
                state.currentBet,
                player.bet,
                bb,
                if (equity >= 0.85) 0.75 else 0.55,
                player.stack,
                seq,
                jam,
            )?.let { return it }
        }

        if (preflop && ActionType.Bet in types) {
            val openChen = 10 - late * 4
            if (chen >= openChen || (chen >= openChen - 1.5 && r < 0.22)) {
                val openTo = snapToBb(
                    (bb * (2.2 + late * 0.35)).toInt(),
                    bb,
                    legal.minRaiseTo,
                    legal.maxRaiseTo,
                )
                return ActionIntent(ActionType.Bet, amount = openTo, seq = seq)
            }
        }

        if (!preflop && opponents <= 2 && equity >= 0.28 && equity < 0.55) {
            if (r < 0.4 + late * 0.12) {
                raiseOrBet(
                    types,
                    ActionType.Bet,
                    legal,
                    pot,
                    state.currentBet,
                    player.bet,
                    bb,
                    0.4,
                    player.stack,
                    seq,
                    false,
                )?.let { return it }
            }
        }

        if (preflop && chen >= 12 && ActionType.Bet in types) {
            return ActionIntent(
                ActionType.Bet,
                amount = snapToBb((bb * 2.5).toInt(), bb, legal.minRaiseTo, legal.maxRaiseTo),
                seq = seq,
            )
        }

        return ActionIntent(ActionType.Check, seq = seq)
    }

    // Facing aggression
    val multiwayPenalty = when {
        opponents >= 3 -> 0.08
        opponents == 2 -> 0.03
        else -> 0.0
    }
    val streetBuffer = when (street) {
        Street.River -> 0.04
        Street.Turn -> 0.02
        Street.Preflop -> 0.03
        else -> 0.01
    }
    val required = potOdds + multiwayPenalty + streetBuffer

    val preferRaise = if (ActionType.Raise in types) ActionType.Raise else ActionType.Bet
    val thrRaise = if (preflop) 0.6 else 0.68
    if (
        (ActionType.Raise in types || ActionType.Bet in types) &&
        equity >= thrRaise &&
        (!preflop || chen >= 10)
    ) {
        raiseOrBet(
            types,
            preferRaise,
            legal,
            pot,
            state.currentBet,
            player.bet,
            bb,
            if (equity >= 0.82) 0.9 else 0.65,
            player.stack,
            seq,
            equity >= 0.88 && commitFrac > 0.2,
        )?.let { return it }
    }

    if (
        preflop &&
        ActionType.Raise in types &&
        chen >= 6 &&
        chen < 10 &&
        late > 0.55 &&
        opponents <= 2 &&
        r < 0.12 &&
        commitFrac < 0.18
    ) {
        raiseOrBet(
            types,
            ActionType.Raise,
            legal,
            pot,
            state.currentBet,
            player.bet,
            bb,
            0.85,
            player.stack,
            seq,
            false,
        )?.let { return it }
    }

    if (
        !preflop &&
        ActionType.Raise in types &&
        equity >= 0.38 &&
        equity < 0.62 &&
        potOdds < 0.35 &&
        opponents <= 2 &&
        r < 0.18
    ) {
        raiseOrBet(
            types,
            ActionType.Raise,
            legal,
            pot,
            state.currentBet,
            player.bet,
            bb,
            0.7,
            player.stack,
            seq,
            false,
        )?.let { return it }
    }

    if (ActionType.Call in types) {
        val deep = stackBb > 40
        val implied =
            if (!preflop && deep && equity > potOdds - 0.04 && equity < required) 0.06 else 0.0
        val callThr = required - implied

        if (equity + 0.02 >= callThr && commitFrac < 0.55) {
            return ActionIntent(ActionType.Call, seq = seq)
        }
        if (preflop && chen >= 14 && commitFrac < 0.45) {
            return ActionIntent(ActionType.Call, seq = seq)
        }
        if (preflop && potOdds <= 0.3 && chen >= 5 + (1 - late) * 2) {
            return ActionIntent(ActionType.Call, seq = seq)
        }
        if (street == Street.River && potOdds < 0.28 && equity >= potOdds && r < 0.35) {
            return ActionIntent(ActionType.Call, seq = seq)
        }
    }

    if (
        ActionType.AllIn in types &&
        (commitFrac > 0.4 || effectiveStackBb <= 8) &&
        equity >= required - 0.02
    ) {
        return ActionIntent(ActionType.AllIn, seq = seq)
    }

    if (ActionType.Fold in types) return ActionIntent(ActionType.Fold, seq = seq)
    if (ActionType.Call in types && equity >= potOdds) return ActionIntent(ActionType.Call, seq = seq)
    if (ActionType.Check in types) return ActionIntent(ActionType.Check, seq = seq)

    val fallback = legal.types.firstOrNull { it != ActionType.Fold } ?: legal.types.first()
    return ActionIntent(
        type = fallback,
        amount = if (fallback == ActionType.Bet || fallback == ActionType.Raise) legal.minRaiseTo else null,
        seq = seq,
    )
}
