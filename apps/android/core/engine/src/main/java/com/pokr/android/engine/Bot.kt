package com.pokr.android.engine

import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.round
import kotlin.random.Random

private const val BOT_PREFIX = "bot:"

fun isBotUserId(userId: String?): Boolean =
    userId != null && userId.startsWith(BOT_PREFIX)

enum class BotPersonalityId(val wire: String) {
    Balanced("balanced"),
    Tight("tight"),
    Loose("loose"),
    Aggro("aggro"),
    Passive("passive"),
    Maniac("maniac"),
    Caller("caller"),
    Nit("nit"),
    Lag("lag"),
    Humanoid("humanoid"),
    ;

    companion object {
        fun fromWire(value: String?): BotPersonalityId? =
            entries.find { it.wire.equals(value, ignoreCase = true) }
    }
}

data class BotPersonality(
    val id: BotPersonalityId,
    val rangeOffset: Double,
    val aggression: Double,
    val bluffRate: Double,
    val callBias: Double,
    val jamBias: Double,
)

val BOT_PERSONALITIES: Map<BotPersonalityId, BotPersonality> = mapOf(
    BotPersonalityId.Balanced to BotPersonality(BotPersonalityId.Balanced, 0.0, 1.0, 1.0, 0.0, 0.0),
    BotPersonalityId.Tight to BotPersonality(BotPersonalityId.Tight, -1.4, 0.85, 0.55, -0.02, -0.02),
    BotPersonalityId.Loose to BotPersonality(BotPersonalityId.Loose, 1.6, 1.05, 1.15, 0.03, 0.0),
    BotPersonalityId.Aggro to BotPersonality(BotPersonalityId.Aggro, 0.6, 1.35, 1.25, -0.02, 0.04),
    BotPersonalityId.Passive to BotPersonality(BotPersonalityId.Passive, 0.4, 0.7, 0.45, 0.04, -0.03),
    BotPersonalityId.Maniac to BotPersonality(BotPersonalityId.Maniac, 2.2, 1.55, 1.7, 0.0, 0.12),
    BotPersonalityId.Caller to BotPersonality(BotPersonalityId.Caller, 1.1, 0.8, 0.5, 0.08, -0.04),
    BotPersonalityId.Nit to BotPersonality(BotPersonalityId.Nit, -2.4, 0.75, 0.35, -0.04, -0.04),
    BotPersonalityId.Lag to BotPersonality(BotPersonalityId.Lag, 1.8, 1.3, 1.5, 0.01, 0.05),
    BotPersonalityId.Humanoid to BotPersonality(BotPersonalityId.Humanoid, 0.8, 1.15, 1.4, 0.01, 0.03),
)

private val BOT_NAME_PERSONALITIES: Map<String, BotPersonalityId> = mapOf(
    "AceBot" to BotPersonalityId.Aggro,
    "RiverRat" to BotPersonalityId.Caller,
    "BluffByte" to BotPersonalityId.Lag,
    "PotOdds" to BotPersonalityId.Balanced,
    "ChipShark" to BotPersonalityId.Aggro,
    "FoldBot" to BotPersonalityId.Nit,
    "AllInAnnie" to BotPersonalityId.Maniac,
    "NutsNova" to BotPersonalityId.Tight,
    "CallCart" to BotPersonalityId.Caller,
    "RaiseRex" to BotPersonalityId.Aggro,
    "Humanoid" to BotPersonalityId.Humanoid,
)

fun makeBotUserId(id: String, personality: BotPersonalityId? = null): String {
    var bare = if (id.startsWith(BOT_PREFIX)) id.removePrefix(BOT_PREFIX) else id
    val existing = personalityIdFromRest(bare)
    if (existing != null) {
        bare = bare.substring(existing.wire.length + 1)
    }
    return if (personality != null) {
        "$BOT_PREFIX${personality.wire}:$bare"
    } else {
        "$BOT_PREFIX$bare"
    }
}

private fun personalityIdFromRest(rest: String): BotPersonalityId? {
    val i = rest.indexOf(':')
    if (i <= 0) return null
    return BotPersonalityId.fromWire(rest.substring(0, i))
}

fun personalityIdFromBotUserId(userId: String?): BotPersonalityId? {
    if (!isBotUserId(userId)) return null
    return personalityIdFromRest(userId!!.removePrefix(BOT_PREFIX))
}

private fun hashString(s: String): Int {
    var h = 2166136261L
    for (ch in s) {
        h = h xor ch.code.toLong()
        h = (h * 16777619L) and 0xffffffffL
    }
    return h.toInt()
}

fun resolveBotPersonalityId(
    name: String?,
    seed: String,
): BotPersonalityId {
    if (!name.isNullOrBlank()) {
        val byName = BOT_NAME_PERSONALITIES[name]
            ?: BOT_NAME_PERSONALITIES.entries.find { it.key.equals(name, ignoreCase = true) }?.value
        if (byName != null) return byName
    }
    val h = seed.ifBlank { name ?: "bot" }
    val ids = BotPersonalityId.entries
    val idx = (hashString(h).toUInt() % ids.size.toUInt()).toInt()
    return ids[idx]
}

fun personalityForBot(userId: String?, name: String? = null): BotPersonality {
    val fromId = personalityIdFromBotUserId(userId)
    if (fromId != null) return BOT_PERSONALITIES.getValue(fromId)
    val id = resolveBotPersonalityId(name, userId ?: name ?: "bot")
    return BOT_PERSONALITIES.getValue(id)
}

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
    "Humanoid",
)

fun pickBotName(taken: Set<String>): String {
    for (n in BOT_NAMES) {
        if (n !in taken) return n
    }
    return "Bot${Random.nextInt(100, 1000)}"
}

enum class BoardWetness { Dry, Semi, Wet }

fun boardTexture(community: List<Card>): BoardWetness {
    if (community.size < 3) return BoardWetness.Semi
    val suits = community.groupingBy { it.suit }.eachCount()
    val maxSuit = suits.values.maxOrNull() ?: 0
    val ranks = community.map { it.rank }
    val uniqueRanks = ranks.toSet()
    val paired = uniqueRanks.size < ranks.size
    val sorted = uniqueRanks.sorted()
    var connected = 0
    for (i in 1 until sorted.size) {
        val gap = sorted[i] - sorted[i - 1]
        connected += when (gap) {
            1 -> 2
            2 -> 1
            else -> 0
        }
    }
    if (14 in uniqueRanks && (2 in uniqueRanks || 3 in uniqueRanks)) connected += 1
    var score = 0
    score += when {
        maxSuit >= 3 -> 3
        maxSuit == 2 -> 1
        else -> 0
    }
    score += min(3, connected)
    if (paired) score += 1
    return when {
        score <= 1 -> BoardWetness.Dry
        score <= 3 -> BoardWetness.Semi
        else -> BoardWetness.Wet
    }
}

fun positionOpenSizeBb(
    late: Double,
    texture: BoardWetness,
    aggression: Double,
    kind: String,
): Double {
    val agg = max(0.35, aggression)
    if (kind == "open") {
        return (2.15 + late * 0.55) * min(1.55, 0.88 + agg * 0.14)
    }
    val texMul = when (texture) {
        BoardWetness.Dry -> 1.05
        BoardWetness.Semi -> 0.85
        BoardWetness.Wet -> 0.65
    }
    val base = if (kind == "bluff") 0.38 else 0.52
    return base * texMul * min(1.45, 0.9 + agg * 0.12) * (0.92 + late * 0.12)
}

private fun clamp01(n: Double): Double = n.coerceIn(0.0, 1.0)

fun botThinkDelayMs(
    state: HandState,
    seat: Int,
    config: TableConfig,
    personality: BotPersonality? = null,
): Long {
    val player = state.players.getOrNull(seat) ?: return 700
    val style = personality ?: personalityForBot(player.userId, player.name)
    val legal = legalActions(state, seat, config)
    val callAmt = legal.callAmount
    val pot = max(1, state.pot)
    val potOdds = if (callAmt > 0) callAmt.toDouble() / (pot + callAmt) else 0.0
    val commitFrac = callAmt.toDouble() / max(1, player.stack)
    val facingBet = callAmt > 0
    val street = state.street
    val freeCheck = !facingBet && ActionType.Check in legal.types
    val canOnlyFoldOrCall =
        facingBet &&
            ActionType.Raise !in legal.types &&
            ActionType.Bet !in legal.types &&
            ActionType.Fold in legal.types

    var base = 620
    when {
        freeCheck -> base = 480 + Random.nextInt(280)
        facingBet -> {
            base = 900 + Random.nextInt(500)
            if (potOdds in 0.18..0.42) base += 350
            if (commitFrac >= 0.25) base += 400
            if (commitFrac >= 0.45) base += 350
            base += when (street) {
                Street.River -> 450
                Street.Turn -> 200
                else -> 0
            }
            if (canOnlyFoldOrCall && potOdds < 0.15) base = min(base, 750)
        }
        else -> {
            base = 700 + Random.nextInt(400)
            if (street == Street.River) base += 250
        }
    }
    if (style.id == BotPersonalityId.Humanoid) {
        base = (base * 1.12).toInt() + Random.nextInt(180)
    }
    val jitter = Random.nextInt(220) - 80
    return (base + jitter).coerceIn(420, 3200).toLong()
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
 * Chen preflop + Monte-Carlo postflop equity, pot-odds calling, and selective
 * bluffs — scaled per seat by [BotPersonality]. The humanoid style adds
 * board-texture bluffs, slowplays, and river stabs.
 */
fun chooseBotAction(
    state: HandState,
    seat: Int,
    config: TableConfig,
    personality: BotPersonality? = null,
): ActionIntent? {
    val legal = legalActions(state, seat, config)
    if (legal.types.isEmpty()) return null

    val types = legal.types.toSet()
    val seq = state.actionSeq
    val player = state.players[seat]
    val style = personality ?: personalityForBot(player.userId, player.name)
    val humanoid = style.id == BotPersonalityId.Humanoid
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
    val agg = max(0.35, style.aggression)
    val bluff = max(0.0, style.bluffRate)
    val texture = boardTexture(state.community)

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
    val callEq = equity + style.callBias

    if (preflop && effectiveStackBb <= 12) {
        val pushChen =
            6 + (1 - late) * 3 + (if (opponents >= 3) 1.5 else 0.0) -
                style.rangeOffset - style.jamBias * 4
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
        if (
            ActionType.Call in types &&
            potOdds <= 0.28 + style.callBias &&
            chen >= 4.5 - style.rangeOffset * 0.4
        ) {
            return ActionIntent(ActionType.Call, seq = seq)
        }
        if (ActionType.Fold in types) return ActionIntent(ActionType.Fold, seq = seq)
    }

    if (ActionType.Check in types) {
        val valueThr = (if (preflop) 0.7 else 0.6) - (agg - 1) * 0.06
        if (
            humanoid &&
            !preflop &&
            street == Street.Flop &&
            texture == BoardWetness.Dry &&
            opponents <= 2 &&
            equity >= 0.78 &&
            r < 0.42
        ) {
            return ActionIntent(ActionType.Check, seq = seq)
        }

        if (equity >= valueThr) {
            val jam = equity >= 0.9 - style.jamBias && effectiveStackBb <= 18 + style.jamBias * 20
            var potFrac = (if (equity >= 0.85) 0.75 else 0.55) * agg
            if (humanoid && !preflop) {
                potFrac = positionOpenSizeBb(late, texture, agg, "cbet")
                if (equity >= 0.85) potFrac = max(potFrac, 0.65 * agg)
            }
            raiseOrBet(
                types,
                ActionType.Bet,
                legal,
                pot,
                state.currentBet,
                player.bet,
                bb,
                potFrac,
                player.stack,
                seq,
                jam,
            )?.let { return it }
        }

        if (preflop && ActionType.Bet in types) {
            val openChen = 10 - late * 4 - style.rangeOffset
            val stealOdds = clamp01(0.22 * bluff * if (humanoid) 1.15 else 1.0)
            if (chen >= openChen || (chen >= openChen - 1.5 && r < stealOdds)) {
                val openBb = if (humanoid) {
                    positionOpenSizeBb(late, BoardWetness.Semi, agg, "open")
                } else {
                    (2.2 + late * 0.35) * min(1.6, 0.85 + agg * 0.15)
                }
                val openTo = snapToBb(
                    (bb * openBb).toInt(),
                    bb,
                    legal.minRaiseTo,
                    legal.maxRaiseTo,
                )
                return ActionIntent(ActionType.Bet, amount = openTo, seq = seq)
            }
        }

        if (humanoid && !preflop && ActionType.Bet in types && opponents <= 2) {
            val dryOk = texture == BoardWetness.Dry ||
                (texture == BoardWetness.Semi && street != Street.River)
            val bluffEqLo = if (street == Street.River) 0.12 else 0.22
            val bluffEqHi = if (street == Street.River) 0.38 else 0.52
            val freq = if (street == Street.River) {
                clamp01(0.28 * bluff * if (texture == BoardWetness.Dry) 1.25 else 0.55)
            } else {
                clamp01(
                    (0.48 + late * 0.14) * bluff * when (texture) {
                        BoardWetness.Dry -> 1.2
                        BoardWetness.Semi -> 0.85
                        BoardWetness.Wet -> 0.4
                    },
                )
            }
            if (dryOk && equity >= bluffEqLo && equity < bluffEqHi && r < freq) {
                val potFrac = positionOpenSizeBb(
                    late,
                    texture,
                    agg,
                    if (street == Street.River) "bluff" else "cbet",
                )
                raiseOrBet(
                    types,
                    ActionType.Bet,
                    legal,
                    pot,
                    state.currentBet,
                    player.bet,
                    bb,
                    potFrac,
                    player.stack,
                    seq,
                    false,
                )?.let { return it }
            }
        }

        if (
            !preflop &&
            opponents <= 2 &&
            equity >= 0.28 - style.rangeOffset * 0.02 &&
            equity < 0.55
        ) {
            if (r < clamp01((0.4 + late * 0.12) * bluff * min(1.4, agg))) {
                val potFrac = if (humanoid) {
                    positionOpenSizeBb(late, texture, agg, "bluff")
                } else {
                    0.4 * agg
                }
                raiseOrBet(
                    types,
                    ActionType.Bet,
                    legal,
                    pot,
                    state.currentBet,
                    player.bet,
                    bb,
                    potFrac,
                    player.stack,
                    seq,
                    false,
                )?.let { return it }
            }
        }

        if (preflop && chen >= 12 - style.rangeOffset * 0.35 && ActionType.Bet in types) {
            return ActionIntent(
                ActionType.Bet,
                amount = snapToBb(
                    (bb * 2.5 * min(1.4, agg)).toInt(),
                    bb,
                    legal.minRaiseTo,
                    legal.maxRaiseTo,
                ),
                seq = seq,
            )
        }

        return ActionIntent(ActionType.Check, seq = seq)
    }

    var multiwayPenalty = when {
        opponents >= 3 -> 0.08
        opponents == 2 -> 0.03
        else -> 0.0
    }
    if (humanoid && !preflop && opponents >= 3 && texture == BoardWetness.Wet) {
        multiwayPenalty += 0.05
    } else if (humanoid && !preflop && texture == BoardWetness.Wet) {
        multiwayPenalty += 0.02
    }
    val streetBuffer = when (street) {
        Street.River -> 0.04
        Street.Turn -> 0.02
        Street.Preflop -> 0.03
        else -> 0.01
    }
    val required = potOdds + multiwayPenalty + streetBuffer - style.callBias * 0.5

    val preferRaise = if (ActionType.Raise in types) ActionType.Raise else ActionType.Bet
    val thrRaise = (if (preflop) 0.6 else 0.68) - (agg - 1) * 0.05 - style.jamBias * 0.04
    val raiseChen = 10 - style.rangeOffset * 0.6
    if (
        (ActionType.Raise in types || ActionType.Bet in types) &&
        equity >= thrRaise &&
        (!preflop || chen >= raiseChen)
    ) {
        var potFrac = (if (equity >= 0.82) 0.9 else 0.65) * agg
        if (humanoid && !preflop) {
            potFrac = positionOpenSizeBb(late, texture, agg, "cbet") * if (equity >= 0.82) 1.25 else 1.0
        }
        raiseOrBet(
            types,
            preferRaise,
            legal,
            pot,
            state.currentBet,
            player.bet,
            bb,
            potFrac,
            player.stack,
            seq,
            equity >= 0.88 - style.jamBias && commitFrac > 0.2 - style.jamBias,
        )?.let { return it }
    }

    if (
        preflop &&
        ActionType.Raise in types &&
        chen >= 6 - style.rangeOffset * 0.5 &&
        chen < 10 + style.rangeOffset * 0.3 &&
        late > 0.55 - (if (bluff > 1) 0.12 else 0.0) &&
        opponents <= 2 &&
        r < clamp01(0.12 * bluff * if (humanoid) 1.2 else 1.0) &&
        commitFrac < 0.18 + style.jamBias * 0.1
    ) {
        raiseOrBet(
            types,
            ActionType.Raise,
            legal,
            pot,
            state.currentBet,
            player.bet,
            bb,
            0.85 * min(1.5, agg),
            player.stack,
            seq,
            style.jamBias > 0.08 && r < 0.25,
        )?.let { return it }
    }

    val semiBluffOk = !humanoid || texture != BoardWetness.Wet || equity >= 0.45
    if (
        !preflop &&
        ActionType.Raise in types &&
        semiBluffOk &&
        equity >= 0.38 - style.rangeOffset * 0.015 &&
        equity < 0.62 &&
        potOdds < 0.35 + style.callBias * 0.2 &&
        opponents <= 2 &&
        r < clamp01(0.18 * bluff * if (humanoid && texture == BoardWetness.Dry) 1.25 else 1.0)
    ) {
        val potFrac = if (humanoid) {
            positionOpenSizeBb(late, texture, agg, "bluff") * 1.4
        } else {
            0.7 * agg
        }
        raiseOrBet(
            types,
            ActionType.Raise,
            legal,
            pot,
            state.currentBet,
            player.bet,
            bb,
            potFrac,
            player.stack,
            seq,
            false,
        )?.let { return it }
    }

    if (ActionType.Call in types) {
        val deep = stackBb > 40
        val implied =
            if (!preflop && deep && callEq > potOdds - 0.04 && callEq < required) 0.06 else 0.0
        val callThr = required - implied
        var commitCap = 0.55 + style.callBias * 0.8 + if (style.id == BotPersonalityId.Caller) 0.12 else 0.0
        if (humanoid && !preflop && texture == BoardWetness.Wet && opponents >= 3) {
            commitCap -= 0.08
        }

        if (callEq + 0.02 >= callThr && commitFrac < commitCap) {
            return ActionIntent(ActionType.Call, seq = seq)
        }
        if (preflop && chen >= 14 - style.rangeOffset * 0.4 && commitFrac < 0.45 + style.callBias) {
            return ActionIntent(ActionType.Call, seq = seq)
        }
        if (
            preflop &&
            potOdds <= 0.3 + style.callBias * 0.5 &&
            chen >= 5 + (1 - late) * 2 - style.rangeOffset
        ) {
            return ActionIntent(ActionType.Call, seq = seq)
        }
        if (
            street == Street.River &&
            potOdds < 0.28 + style.callBias &&
            callEq >= potOdds &&
            r < clamp01(0.35 + style.callBias * 2)
        ) {
            return ActionIntent(ActionType.Call, seq = seq)
        }
    }

    if (
        ActionType.AllIn in types &&
        (commitFrac > 0.4 - style.jamBias || effectiveStackBb <= 8 + style.jamBias * 10) &&
        callEq >= required - 0.02 - style.jamBias
    ) {
        return ActionIntent(ActionType.AllIn, seq = seq)
    }

    if (ActionType.Fold in types) return ActionIntent(ActionType.Fold, seq = seq)
    if (ActionType.Call in types && callEq >= potOdds) return ActionIntent(ActionType.Call, seq = seq)
    if (ActionType.Check in types) return ActionIntent(ActionType.Check, seq = seq)

    val fallback = legal.types.firstOrNull { it != ActionType.Fold } ?: legal.types.first()
    return ActionIntent(
        type = fallback,
        amount = if (fallback == ActionType.Bet || fallback == ActionType.Raise) legal.minRaiseTo else null,
        seq = seq,
    )
}
