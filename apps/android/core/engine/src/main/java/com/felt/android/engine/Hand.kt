package com.felt.android.engine

enum class Street {
    Waiting,
    Preflop,
    Flop,
    Turn,
    River,
    Showdown,
    Payout,
}

enum class PlayerStatus {
    Empty,
    Seated,
    Active,
    Folded,
    AllIn,
    SittingOut,
}

data class PlayerState(
    val seat: Int,
    val userId: String? = null,
    val name: String? = null,
    val stack: Int = 0,
    val bet: Int = 0,
    /** Total committed this hand. */
    val committed: Int = 0,
    val status: PlayerStatus = PlayerStatus.Empty,
    val holeCards: Pair<Card, Card>? = null,
    /** Shown at showdown / voluntary show. */
    val revealed: Boolean = false,
)

enum class ActionType {
    Fold,
    Check,
    Call,
    Bet,
    Raise,
    AllIn,
}

data class ActionIntent(
    val type: ActionType,
    /** Absolute raise/bet-to amount for bet/raise; ignored otherwise. */
    val amount: Int? = null,
    val seq: Int,
)

data class TableConfig(
    val maxSeats: Int,
    val smallBlind: Int,
    val bigBlind: Int,
    val minBuyIn: Int,
    val maxBuyIn: Int,
    val turnTimeMs: Long,
)

data class ShowdownHand(
    val seat: Int,
    val handName: String,
    val cards: List<String> = emptyList(),
)

data class HandState(
    val handId: String = "",
    val street: Street = Street.Waiting,
    val deck: List<Card> = emptyList(),
    val community: List<Card> = emptyList(),
    val players: List<PlayerState> = emptyList(),
    val dealerButton: Int = 0,
    val sbSeat: Int = 0,
    val bbSeat: Int = 0,
    val toAct: Int? = null,
    val currentBet: Int = 0,
    /** Minimum total bet-to for a raise (absolute). */
    val minRaiseTo: Int = 0,
    /** Last raise size (increment), used for min-raise. */
    val lastRaiseSize: Int = 0,
    val pot: Int = 0,
    val sidePots: List<PotLayer> = emptyList(),
    val actionSeq: Int = 0,
    val winners: List<PotAward> = emptyList(),
    val showdownHands: List<ShowdownHand> = emptyList(),
    /** Seats that have acted since last aggression this street. */
    val actedSinceAggression: Set<Int> = emptySet(),
    val version: Int = 0,
)

sealed class EngineEvent {
    data class HandStarted(val handId: String) : EngineEvent()
    data class BlindsPosted(
        val sb: Int,
        val bb: Int,
        val sbSeat: Int,
        val bbSeat: Int,
    ) : EngineEvent()
    data object DealtHole : EngineEvent()
    data class StreetAdvanced(val street: Street, val cards: List<Card>) : EngineEvent()
    data class ActionApplied(val seat: Int, val action: ActionType, val amount: Int) : EngineEvent()
    data class Turn(val seat: Int) : EngineEvent()
    data class HandEnded(val winners: List<PotAward>) : EngineEvent()
    data class Error(val message: String) : EngineEvent()
}

data class ApplyResult(
    val state: HandState,
    val events: List<EngineEvent> = emptyList(),
    val ok: Boolean,
    val error: String? = null,
)

data class LegalActions(
    val types: List<ActionType> = emptyList(),
    val callAmount: Int = 0,
    val minRaiseTo: Int = 0,
    val maxRaiseTo: Int = 0,
)

private fun cloneState(state: HandState): HandState = state.copy(
    deck = state.deck.map { it.copy() },
    community = state.community.map { it.copy() },
    players = state.players.map { p ->
        p.copy(holeCards = p.holeCards?.let { (a, b) -> a.copy() to b.copy() })
    },
    sidePots = state.sidePots.map { it.copy(eligible = it.eligible.toList()) },
    winners = state.winners.map { it.copy() },
    showdownHands = state.showdownHands.map { it.copy() },
    actedSinceAggression = state.actedSinceAggression.toSet(),
)

fun createEmptyTable(config: TableConfig): HandState {
    val players = List(config.maxSeats) { seat ->
        PlayerState(seat = seat)
    }
    return HandState(
        players = players,
        minRaiseTo = config.bigBlind,
        lastRaiseSize = config.bigBlind,
    )
}

private fun seatedPlayers(state: HandState): List<PlayerState> =
    state.players.filter { it.status != PlayerStatus.Empty && it.userId != null && it.stack > 0 }

private fun nextOccupiedSeat(
    state: HandState,
    from: Int,
    predicate: ((PlayerState) -> Boolean)? = null,
): Int {
    val n = state.players.size
    for (i in 1..n) {
        val seat = (from + i) % n
        val p = state.players[seat]
        if (p.status == PlayerStatus.Empty || p.userId == null) continue
        if (predicate != null && !predicate(p)) continue
        return seat
    }
    return from
}

private fun canAct(p: PlayerState): Boolean =
    p.status == PlayerStatus.Active && p.stack > 0

fun livingPlayers(state: HandState): List<PlayerState> =
    state.players.filter { it.status == PlayerStatus.Active || it.status == PlayerStatus.AllIn }

private class MutableHandState(initial: HandState) {
    var handId: String = initial.handId
    var street: Street = initial.street
    var deck: MutableList<Card> = initial.deck.map { it.copy() }.toMutableList()
    var community: MutableList<Card> = initial.community.map { it.copy() }.toMutableList()
    var players: MutableList<PlayerState> = initial.players.map { p ->
        p.copy(holeCards = p.holeCards?.let { (a, b) -> a.copy() to b.copy() })
    }.toMutableList()
    var dealerButton: Int = initial.dealerButton
    var sbSeat: Int = initial.sbSeat
    var bbSeat: Int = initial.bbSeat
    var toAct: Int? = initial.toAct
    var currentBet: Int = initial.currentBet
    var minRaiseTo: Int = initial.minRaiseTo
    var lastRaiseSize: Int = initial.lastRaiseSize
    var pot: Int = initial.pot
    var sidePots: MutableList<PotLayer> = initial.sidePots.map { it.copy(eligible = it.eligible.toMutableList()) }.toMutableList()
    var actionSeq: Int = initial.actionSeq
    var winners: MutableList<PotAward> = initial.winners.map { it.copy() }.toMutableList()
    var showdownHands: MutableList<ShowdownHand> = initial.showdownHands.map { it.copy() }.toMutableList()
    var actedSinceAggression: MutableSet<Int> = initial.actedSinceAggression.toMutableSet()
    var version: Int = initial.version

    fun toImmutable(): HandState = HandState(
        handId = handId,
        street = street,
        deck = deck.toList(),
        community = community.toList(),
        players = players.toList(),
        dealerButton = dealerButton,
        sbSeat = sbSeat,
        bbSeat = bbSeat,
        toAct = toAct,
        currentBet = currentBet,
        minRaiseTo = minRaiseTo,
        lastRaiseSize = lastRaiseSize,
        pot = pot,
        sidePots = sidePots.map { it.copy(eligible = it.eligible.toList()) },
        actionSeq = actionSeq,
        winners = winners.toList(),
        showdownHands = showdownHands.toList(),
        actedSinceAggression = actedSinceAggression.toSet(),
        version = version,
    )
}

private fun commitChips(state: MutableHandState, seat: Int, amount: Int): Int {
    val p = state.players[seat]
    val pay = minOf(amount, p.stack)
    val newStack = p.stack - pay
    val newBet = p.bet + pay
    val newCommitted = p.committed + pay
    val newStatus = if (newStack == 0) PlayerStatus.AllIn else p.status
    state.players[seat] = p.copy(
        stack = newStack,
        bet = newBet,
        committed = newCommitted,
        status = newStatus,
    )
    state.pot += pay
    return pay
}

fun sitDown(
    state: HandState,
    seat: Int,
    userId: String,
    name: String,
    buyIn: Int,
): ApplyResult {
    val s = cloneState(state)
    val events = mutableListOf<EngineEvent>()
    val p = s.players.getOrNull(seat)
        ?: return ApplyResult(state, events, ok = false, error = "Invalid seat")
    if (p.status != PlayerStatus.Empty) {
        return ApplyResult(state, events, ok = false, error = "Seat taken")
    }
    if (s.players.any { it.userId == userId }) {
        return ApplyResult(state, events, ok = false, error = "Already seated")
    }
    val players = s.players.toMutableList()
    players[seat] = p.copy(
        userId = userId,
        name = name,
        stack = buyIn,
        status = PlayerStatus.Seated,
        bet = 0,
        committed = 0,
        holeCards = null,
        revealed = false,
    )
    return ApplyResult(
        state = s.copy(players = players, version = s.version + 1),
        events = events,
        ok = true,
    )
}

fun standUp(state: HandState, seat: Int): ApplyResult {
    val s = cloneState(state)
    if (s.street != Street.Waiting && s.street != Street.Payout) {
        val p = s.players.getOrNull(seat)
        if (p != null && (p.status == PlayerStatus.Active || p.status == PlayerStatus.AllIn)) {
            return ApplyResult(state, ok = false, error = "Cannot leave mid-hand")
        }
    }
    val p = s.players.getOrNull(seat)
        ?: return ApplyResult(state, ok = false, error = "Empty seat")
    if (p.status == PlayerStatus.Empty) {
        return ApplyResult(state, ok = false, error = "Empty seat")
    }
    val players = s.players.toMutableList()
    players[seat] = PlayerState(seat = seat)
    return ApplyResult(
        state = s.copy(players = players, version = s.version + 1),
        ok = true,
    )
}

fun topUp(state: HandState, seat: Int, amount: Int, maxBuyIn: Int): ApplyResult {
    val s = cloneState(state)
    if (s.street != Street.Waiting && s.street != Street.Payout) {
        return ApplyResult(state, ok = false, error = "Top-up only between hands")
    }
    val p = s.players.getOrNull(seat)
        ?: return ApplyResult(state, ok = false, error = "Empty seat")
    if (p.status == PlayerStatus.Empty) {
        return ApplyResult(state, ok = false, error = "Empty seat")
    }
    if (p.stack + amount > maxBuyIn) {
        return ApplyResult(state, ok = false, error = "Exceeds max buy-in")
    }
    val newStatus = if (p.status == PlayerStatus.SittingOut && p.stack + amount > 0) {
        PlayerStatus.Seated
    } else {
        p.status
    }
    val players = s.players.toMutableList()
    players[seat] = p.copy(stack = p.stack + amount, status = newStatus)
    return ApplyResult(
        state = s.copy(players = players, version = s.version + 1),
        ok = true,
    )
}

private fun resetHandFields(state: MutableHandState, handId: String, config: TableConfig) {
    state.handId = handId
    state.community.clear()
    state.pot = 0
    state.sidePots.clear()
    state.winners.clear()
    state.showdownHands.clear()
    state.currentBet = 0
    state.lastRaiseSize = config.bigBlind
    state.minRaiseTo = config.bigBlind * 2
    state.actedSinceAggression.clear()
    state.actionSeq = 0
    for (i in state.players.indices) {
        val p = state.players[i]
        val newStatus = when {
            p.status != PlayerStatus.Empty && p.userId != null && p.stack > 0 -> PlayerStatus.Active
            p.status != PlayerStatus.Empty && p.stack == 0 -> PlayerStatus.SittingOut
            else -> p.status
        }
        state.players[i] = p.copy(
            bet = 0,
            committed = 0,
            holeCards = null,
            revealed = false,
            status = newStatus,
        )
    }
}

fun startHand(
    state: HandState,
    config: TableConfig,
    handId: String,
    randomBytes: (Int) -> ByteArray,
): ApplyResult {
    val s = MutableHandState(cloneState(state))
    val events = mutableListOf<EngineEvent>()
    val eligible = seatedPlayers(s.toImmutable())
    if (eligible.size < 2) {
        return ApplyResult(state, events, ok = false, error = "Need at least 2 players")
    }

    resetHandFields(s, handId, config)
    s.street = Street.Preflop
    s.deck = shuffle(createDeck(), randomBytes).toMutableList()

    s.dealerButton = nextOccupiedSeat(s.toImmutable(), s.dealerButton) { it.status == PlayerStatus.Active }

    val activeCount = s.players.count { it.status == PlayerStatus.Active }
    if (activeCount == 2) {
        s.sbSeat = s.dealerButton
        s.bbSeat = nextOccupiedSeat(s.toImmutable(), s.dealerButton) { it.status == PlayerStatus.Active }
    } else {
        s.sbSeat = nextOccupiedSeat(s.toImmutable(), s.dealerButton) { it.status == PlayerStatus.Active }
        s.bbSeat = nextOccupiedSeat(s.toImmutable(), s.sbSeat) { it.status == PlayerStatus.Active }
    }

    commitChips(s, s.sbSeat, config.smallBlind)
    commitChips(s, s.bbSeat, config.bigBlind)
    s.currentBet = maxOf(s.players[s.sbSeat].bet, s.players[s.bbSeat].bet)
    s.currentBet = s.players[s.bbSeat].bet
    if (s.players[s.sbSeat].bet > s.currentBet) s.currentBet = s.players[s.sbSeat].bet
    s.lastRaiseSize = config.bigBlind
    s.minRaiseTo = s.currentBet + config.bigBlind

    events.add(EngineEvent.HandStarted(handId))
    events.add(
        EngineEvent.BlindsPosted(
            sb = config.smallBlind,
            bb = config.bigBlind,
            sbSeat = s.sbSeat,
            bbSeat = s.bbSeat,
        ),
    )

    for (round in 0..1) {
        for (i in s.players.indices) {
            val seat = (s.dealerButton + 1 + i) % s.players.size
            val p = s.players[seat]
            if (p.status != PlayerStatus.Active && p.status != PlayerStatus.AllIn) continue
            val card = s.deck.removeAt(s.deck.lastIndex)
            var hole = p.holeCards ?: (card to card)
            hole = if (round == 0) card to hole.second else hole.first to card
            s.players[seat] = p.copy(holeCards = hole)
        }
    }

    events.add(EngineEvent.DealtHole)

    s.toAct = if (activeCount == 2) {
        s.sbSeat
    } else {
        nextOccupiedSeat(s.toImmutable(), s.bbSeat, ::canAct)
    }

    if (!bettingContinues(s)) {
        return runoutToShowdown(s, events)
    }

    s.actedSinceAggression.clear()
    events.add(EngineEvent.Turn(s.toAct!!))
    s.version += 1
    return ApplyResult(s.toImmutable(), events, ok = true)
}

private fun bettingContinues(state: MutableHandState): Boolean {
    val living = livingPlayers(state.toImmutable())
    if (living.size <= 1) return false
    val actors = living.filter(::canAct)
    if (actors.isEmpty()) return false
    if (actors.size == 1) {
        return actors[0].bet < state.currentBet
    }
    return true
}

private fun streetComplete(state: MutableHandState): Boolean {
    val actors = state.players.filter(::canAct)
    if (actors.isEmpty()) return true
    for (p in actors) {
        if (p.bet != state.currentBet) return false
        if (p.seat !in state.actedSinceAggression) return false
    }
    return true
}

private fun clearBets(state: MutableHandState) {
    for (i in state.players.indices) {
        state.players[i] = state.players[i].copy(bet = 0)
    }
    state.currentBet = 0
    state.actedSinceAggression.clear()
}

private fun dealCommunity(state: MutableHandState, count: Int): List<Card> {
    state.deck.removeAt(state.deck.lastIndex) // burn
    val dealt = mutableListOf<Card>()
    repeat(count) {
        val c = state.deck.removeAt(state.deck.lastIndex)
        state.community.add(c)
        dealt.add(c)
    }
    return dealt
}

private fun advanceStreet(state: MutableHandState, events: MutableList<EngineEvent>): ApplyResult {
    clearBets(state)
    state.lastRaiseSize = 0
    state.minRaiseTo = 0

    when (state.street) {
        Street.Preflop -> {
            state.street = Street.Flop
            val cards = dealCommunity(state, 3)
            events.add(EngineEvent.StreetAdvanced(Street.Flop, cards))
        }
        Street.Flop -> {
            state.street = Street.Turn
            val cards = dealCommunity(state, 1)
            events.add(EngineEvent.StreetAdvanced(Street.Turn, cards))
        }
        Street.Turn -> {
            state.street = Street.River
            val cards = dealCommunity(state, 1)
            events.add(EngineEvent.StreetAdvanced(Street.River, cards))
        }
        Street.River -> return goToShowdown(state, events)
        else -> {}
    }

    if (!bettingContinues(state)) {
        return runoutToShowdown(state, events)
    }

    state.toAct = nextOccupiedSeat(state.toImmutable(), state.dealerButton, ::canAct)
    state.minRaiseTo = 0
    state.toAct?.let { events.add(EngineEvent.Turn(it)) }
    state.version += 1
    return ApplyResult(state.toImmutable(), events, ok = true)
}

private fun runoutToShowdown(state: MutableHandState, events: MutableList<EngineEvent>): ApplyResult {
    while (state.community.size < 5) {
        when (state.community.size) {
            0 -> {
                state.street = Street.Flop
                val cards = dealCommunity(state, 3)
                events.add(EngineEvent.StreetAdvanced(Street.Flop, cards))
            }
            3 -> {
                state.street = Street.Turn
                val cards = dealCommunity(state, 1)
                events.add(EngineEvent.StreetAdvanced(Street.Turn, cards))
            }
            4 -> {
                state.street = Street.River
                val cards = dealCommunity(state, 1)
                events.add(EngineEvent.StreetAdvanced(Street.River, cards))
            }
        }
    }
    return goToShowdown(state, events)
}

private fun goToShowdown(state: MutableHandState, events: MutableList<EngineEvent>): ApplyResult {
    state.street = Street.Showdown
    state.toAct = null

    val living = livingPlayers(state.toImmutable())
    val ranks = mutableMapOf<Int, HandRank>()
    val bestCardsBySeat = mutableMapOf<Int, List<String>>()

    if (living.size == 1) {
        val winner = living[0]
        state.winners = mutableListOf(PotAward(seat = winner.seat, amount = state.pot))
        state.showdownHands.clear()
        state.players[winner.seat] = state.players[winner.seat].copy(stack = state.players[winner.seat].stack + state.pot)
        state.pot = 0
        state.street = Street.Payout
        events.add(EngineEvent.HandEnded(state.winners.toList()))
        state.version += 1
        return ApplyResult(state.toImmutable(), events, ok = true)
    }

    for (p in living) {
        val hole = p.holeCards ?: continue
        val seat = p.seat
        state.players[seat] = state.players[seat].copy(revealed = true)
        val seven = listOf(hole.first, hole.second) + state.community
        val best = evaluateBestHand(seven)
        ranks[seat] = best.rank
        bestCardsBySeat[seat] = best.cards.map { cardToString(it) }
    }

    state.showdownHands = ranks.entries.map { (seat, rank) ->
        ShowdownHand(
            seat = seat,
            handName = HAND_CATEGORY_NAMES.getValue(categoryOf(rank)),
            cards = bestCardsBySeat[seat].orEmpty(),
        )
    }.toMutableList()

    val contributions = state.players
        .filter { it.committed > 0 }
        .map { Contribution(it.seat, it.committed, it.status == PlayerStatus.Folded) }

    state.sidePots = buildSidePots(contributions).toMutableList()
    val awards = awardPots(state.sidePots, ranks, state.dealerButton, state.players.size)
    state.winners = awards.map { w ->
        val handName = state.showdownHands.find { it.seat == w.seat }?.handName ?: "High Card"
        w.copy(handName = handName)
    }.toMutableList()

    for (w in state.winners) {
        val p = state.players[w.seat]
        state.players[w.seat] = p.copy(stack = p.stack + w.amount)
    }
    state.pot = 0
    state.street = Street.Payout
    events.add(EngineEvent.HandEnded(state.winners.toList()))
    state.version += 1
    return ApplyResult(state.toImmutable(), events, ok = true)
}

private fun nextActor(state: MutableHandState, from: Int): Int? {
    val n = state.players.size
    for (i in 1..n) {
        val seat = (from + i) % n
        if (canAct(state.players[seat])) return seat
    }
    return null
}

private fun afterAction(state: MutableHandState, events: MutableList<EngineEvent>): ApplyResult {
    val living = livingPlayers(state.toImmutable())
    if (living.size == 1) {
        return goToShowdown(state, events)
    }

    if (!bettingContinues(state) || streetComplete(state)) {
        if (state.street == Street.River || !bettingContinues(state)) {
            if (state.street == Street.River && streetComplete(state)) {
                return goToShowdown(state, events)
            }
            if (!bettingContinues(state)) {
                return runoutToShowdown(state, events)
            }
        }
        return advanceStreet(state, events)
    }

    val next = nextActor(state, state.toAct!!)
    state.toAct = next
    if (next != null) events.add(EngineEvent.Turn(next))
    state.version += 1
    return ApplyResult(state.toImmutable(), events, ok = true)
}

fun applyAction(
    state: HandState,
    seat: Int,
    action: ActionIntent,
    config: TableConfig,
): ApplyResult {
    val s = MutableHandState(cloneState(state))
    val events = mutableListOf<EngineEvent>()

    if (s.street == Street.Waiting || s.street == Street.Showdown || s.street == Street.Payout) {
        return ApplyResult(state, events, ok = false, error = "No action expected")
    }
    if (s.toAct != seat) return ApplyResult(state, events, ok = false, error = "Not your turn")
    if (action.seq != s.actionSeq) return ApplyResult(state, events, ok = false, error = "Stale action seq")

    val p = s.players[seat]
    if (!canAct(p)) return ApplyResult(state, events, ok = false, error = "Cannot act")

    val toCall = s.currentBet - p.bet

    when (action.type) {
        ActionType.Fold -> {
            s.players[seat] = p.copy(status = PlayerStatus.Folded)
            events.add(EngineEvent.ActionApplied(seat, ActionType.Fold, 0))
            s.actedSinceAggression.add(seat)
        }
        ActionType.Check -> {
            if (toCall > 0) return ApplyResult(state, events, ok = false, error = "Cannot check")
            events.add(EngineEvent.ActionApplied(seat, ActionType.Check, 0))
            s.actedSinceAggression.add(seat)
        }
        ActionType.Call -> {
            if (toCall <= 0) return ApplyResult(state, events, ok = false, error = "Nothing to call")
            val paid = commitChips(s, seat, toCall)
            val actionType = if (s.players[seat].status == PlayerStatus.AllIn) ActionType.AllIn else ActionType.Call
            events.add(EngineEvent.ActionApplied(seat, actionType, paid))
            s.actedSinceAggression.add(seat)
        }
        ActionType.Bet, ActionType.Raise -> {
            val amountTo = action.amount ?: 0
            if (amountTo <= s.currentBet && s.currentBet > 0) {
                return ApplyResult(state, events, ok = false, error = "Raise must exceed current bet")
            }
            val need = amountTo - p.bet
            if (need <= 0) return ApplyResult(state, events, ok = false, error = "Invalid amount")
            if (need > p.stack) return ApplyResult(state, events, ok = false, error = "Insufficient chips")

            val isAllIn = need == p.stack
            val raiseSize = amountTo - s.currentBet

            if (!isAllIn) {
                if (s.currentBet == 0) {
                    if (amountTo < config.bigBlind) {
                        return ApplyResult(state, events, ok = false, error = "Bet below minimum")
                    }
                } else if (amountTo < s.minRaiseTo) {
                    return ApplyResult(state, events, ok = false, error = "Raise below minimum")
                }
            }

            commitChips(s, seat, need)
            val prevBet = s.currentBet
            s.currentBet = s.players[seat].bet
            if (s.currentBet > prevBet) {
                if (raiseSize >= (s.lastRaiseSize.takeIf { it > 0 } ?: config.bigBlind) || prevBet == 0) {
                    s.lastRaiseSize = if (prevBet == 0) s.currentBet else raiseSize
                    s.minRaiseTo = s.currentBet + s.lastRaiseSize
                    s.actedSinceAggression = mutableSetOf(seat)
                } else {
                    s.actedSinceAggression.add(seat)
                }
            } else {
                s.actedSinceAggression.add(seat)
            }

            val at = when {
                s.players[seat].status == PlayerStatus.AllIn -> ActionType.AllIn
                prevBet == 0 -> ActionType.Bet
                else -> ActionType.Raise
            }
            events.add(EngineEvent.ActionApplied(seat, at, amountTo))
        }
        ActionType.AllIn -> {
            val need = p.stack
            val amountTo = p.bet + need
            return applyAction(
                state,
                seat,
                ActionIntent(
                    type = if (amountTo > s.currentBet) {
                        if (s.currentBet == 0) ActionType.Bet else ActionType.Raise
                    } else {
                        ActionType.Call
                    },
                    amount = if (amountTo > s.currentBet) amountTo else null,
                    seq = action.seq,
                ),
                config,
            )
        }
    }

    s.actionSeq += 1
    return afterAction(s, events)
}

/** Auto-action on timeout: check if possible, else fold. */
fun applyTimeout(state: HandState, config: TableConfig): ApplyResult {
    val seat = state.toAct ?: return ApplyResult(state, ok = false, error = "No one to act")
    val p = state.players[seat]
    val toCall = state.currentBet - p.bet
    return if (toCall <= 0) {
        applyAction(state, seat, ActionIntent(ActionType.Check, seq = state.actionSeq), config)
    } else {
        applyAction(state, seat, ActionIntent(ActionType.Fold, seq = state.actionSeq), config)
    }
}

fun returnToWaiting(state: HandState): HandState {
    val s = cloneState(state)
    val players = s.players.map { p ->
        when {
            p.status == PlayerStatus.Empty -> p
            p.userId != null -> p.copy(
                bet = 0,
                committed = 0,
                holeCards = null,
                revealed = false,
                status = if (p.stack > 0) PlayerStatus.Seated else PlayerStatus.SittingOut,
            )
            else -> p.copy(
                bet = 0,
                committed = 0,
                holeCards = null,
                revealed = false,
            )
        }
    }
    return s.copy(
        street = Street.Waiting,
        toAct = null,
        handId = "",
        community = emptyList(),
        deck = emptyList(),
        pot = 0,
        sidePots = emptyList(),
        winners = emptyList(),
        showdownHands = emptyList(),
        actionSeq = 0,
        players = players,
        version = s.version + 1,
    )
}

fun legalActions(state: HandState, seat: Int, config: TableConfig): LegalActions {
    val empty = LegalActions()
    if (state.toAct != seat) return empty
    val p = state.players.getOrNull(seat) ?: return empty
    if (!canAct(p)) return empty

    val toCall = state.currentBet - p.bet
    val types = mutableListOf(ActionType.Fold)
    if (toCall <= 0) types.add(ActionType.Check) else types.add(ActionType.Call)

    val maxRaiseTo = p.bet + p.stack
    var minRaiseTo = if (state.currentBet == 0) config.bigBlind else state.minRaiseTo
    if (minRaiseTo > maxRaiseTo) minRaiseTo = maxRaiseTo

    if (p.stack > toCall) {
        types.add(if (state.currentBet == 0) ActionType.Bet else ActionType.Raise)
        types.add(ActionType.AllIn)
    } else if (p.stack > 0 && toCall > 0) {
        types.add(ActionType.AllIn)
    }

    return LegalActions(
        types = types,
        callAmount = minOf(toCall, p.stack),
        minRaiseTo = minRaiseTo,
        maxRaiseTo = maxRaiseTo,
    )
}
