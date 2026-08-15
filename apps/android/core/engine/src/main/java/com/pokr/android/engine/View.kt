package com.pokr.android.engine

data class PublicPlayerView(
    val seat: Int,
    val userId: String?,
    val name: String?,
    val stack: Int,
    val bet: Int,
    val status: PlayerStatus,
    val hasCards: Boolean,
    /** Only present when revealed at showdown. */
    val holeCards: Pair<String, String>?,
)

data class PublicTableView(
    val tableId: String,
    val handId: String,
    val street: Street,
    val community: List<String>,
    val players: List<PublicPlayerView>,
    val dealerButton: Int,
    val sbSeat: Int,
    val bbSeat: Int,
    val toAct: Int?,
    val currentBet: Int,
    val pot: Int,
    val sidePots: List<PotLayer>,
    val actionSeq: Int,
    val version: Int,
    val winners: List<PotAward>,
    val showdownHands: List<ShowdownHand>,
    val config: TableConfig,
)

data class PrivateView(
    val seat: Int,
    val holeCards: Pair<String, String>?,
    val legal: LegalActions,
)

private fun cardStr(c: Card): String = cardToString(c)

fun toPublicView(tableId: String, state: HandState, config: TableConfig): PublicTableView =
    PublicTableView(
        tableId = tableId,
        handId = state.handId,
        street = state.street,
        community = state.community.map(::cardStr),
        players = state.players.map { p ->
            PublicPlayerView(
                seat = p.seat,
                userId = p.userId,
                name = p.name,
                stack = p.stack,
                bet = p.bet,
                status = p.status,
                hasCards = p.holeCards != null &&
                    p.status != PlayerStatus.Folded &&
                    p.status != PlayerStatus.Empty,
                holeCards = if (p.revealed && p.holeCards != null) {
                    cardStr(p.holeCards.first) to cardStr(p.holeCards.second)
                } else {
                    null
                },
            )
        },
        dealerButton = state.dealerButton,
        sbSeat = state.sbSeat,
        bbSeat = state.bbSeat,
        toAct = state.toAct,
        currentBet = state.currentBet,
        pot = state.pot,
        sidePots = state.sidePots,
        actionSeq = state.actionSeq,
        version = state.version,
        winners = state.winners,
        showdownHands = state.showdownHands,
        config = config,
    )

fun toPrivateView(state: HandState, seat: Int, config: TableConfig): PrivateView {
    val p = state.players.getOrNull(seat)
    return PrivateView(
        seat = seat,
        holeCards = p?.holeCards?.let { (a, b) -> cardStr(a) to cardStr(b) },
        legal = legalActions(state, seat, config),
    )
}
