package com.felt.android.engine

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
    val snapped = kotlin.math.round(amount.toDouble() / bb).toInt() * bb
    return snapped.coerceIn(min, max)
}

/** Lightweight heuristic bot — check/call-heavy with occasional aggression. */
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
    val r = Random.nextDouble()
    val bb = config.bigBlind

    fun tryRaiseOrBet(prefer: ActionType): ActionIntent? {
        if (prefer !in types && ActionType.AllIn !in types) return null
        val min = legal.minRaiseTo
        val max = legal.maxRaiseTo
        if (max < min) {
            return if (ActionType.AllIn in types) ActionIntent(ActionType.AllIn, seq = seq) else null
        }
        val stack = player.stack
        if (stack <= bb * 8 && ActionType.AllIn in types && r < 0.45) {
            return ActionIntent(ActionType.AllIn, seq = seq)
        }
        val span = max - min
        val target = snapToBb(min + (span * (0.2 + r * 0.35)).toInt(), bb, min, max)
        return ActionIntent(prefer, amount = target, seq = seq)
    }

    if (ActionType.Check in types) {
        if (r < 0.28) {
            val bet = tryRaiseOrBet(ActionType.Bet)
            if (bet != null) return bet
        }
        return ActionIntent(ActionType.Check, seq = seq)
    }

    val callAmt = legal.callAmount
    val pot = maxOf(1, state.pot)
    val commitFrac = callAmt.toDouble() / maxOf(1, player.stack)
    val potOdds = callAmt.toDouble() / (pot + callAmt)

    if (ActionType.Fold in types && commitFrac > 0.35 && r < 0.55 + potOdds * 0.2) {
        return ActionIntent(ActionType.Fold, seq = seq)
    }

    if (r < 0.18) {
        val raise = tryRaiseOrBet(ActionType.Raise)
        if (raise != null) return raise
    }

    if (ActionType.Call in types) {
        if (commitFrac < 0.2 || r < 0.65) return ActionIntent(ActionType.Call, seq = seq)
    }

    if (ActionType.AllIn in types && (player.stack <= bb * 6 || r < 0.08)) {
        return ActionIntent(ActionType.AllIn, seq = seq)
    }

    if (ActionType.Call in types) return ActionIntent(ActionType.Call, seq = seq)
    if (ActionType.Fold in types) return ActionIntent(ActionType.Fold, seq = seq)

    val fallback = legal.types.firstOrNull { it != ActionType.Fold } ?: legal.types.first()
    return ActionIntent(
        type = fallback,
        amount = if (fallback == ActionType.Bet || fallback == ActionType.Raise) legal.minRaiseTo else null,
        seq = seq,
    )
}
