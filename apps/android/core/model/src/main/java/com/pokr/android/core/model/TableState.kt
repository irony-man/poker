package com.pokr.android.core.model

import kotlinx.serialization.Serializable

@Serializable
data class PublicPlayer(
    val seat: Int,
    val userId: String? = null,
    val name: String? = null,
    val stack: Int,
    val bet: Int,
    val status: String,
    val hasCards: Boolean,
    val holeCards: List<String>? = null,
    val avatarId: Int? = null,
    val avatarUrl: String? = null,
    val ready: Boolean? = null,
    val pendingSitOut: Boolean? = null,
)

@Serializable
data class SidePot(
    val amount: Int,
    val eligible: List<Int>,
)

@Serializable
data class Winner(
    val seat: Int,
    val amount: Int,
    val handName: String? = null,
)

@Serializable
data class ShowdownHand(
    val seat: Int,
    val handName: String,
    val cards: List<String> = emptyList(),
)

@Serializable
data class TournamentInfo(
    val contestId: String,
    val mode: String,
    val matchId: String? = null,
    val frozen: Boolean = false,
    val noTopUp: Boolean = true,
)

@Serializable
data class PublicTable(
    val tableId: String,
    val handId: String,
    val street: String,
    val community: List<String>,
    val players: List<PublicPlayer>,
    val dealerButton: Int,
    val sbSeat: Int,
    val bbSeat: Int,
    val toAct: Int? = null,
    val currentBet: Int,
    val pot: Int,
    val sidePots: List<SidePot>,
    val actionSeq: Int,
    val version: Int,
    val winners: List<Winner>,
    val showdownHands: List<ShowdownHand> = emptyList(),
    val turnEndsAt: Long? = null,
    val tournament: TournamentInfo? = null,
    val hostUserId: String? = null,
    val isPrivate: Boolean? = null,
    val config: TableConfig,
)

@Serializable
data class LegalActions(
    val types: List<String>,
    val callAmount: Int,
    val minRaiseTo: Int,
    val maxRaiseTo: Int,
)

@Serializable
data class PrivateView(
    val seat: Int,
    val holeCards: List<String>? = null,
    val legal: LegalActions,
)

@Serializable
data class ChatMessage(
    val userId: String,
    val name: String,
    val text: String,
    val at: Long,
)
