package com.pokr.android.core.model

import kotlinx.serialization.Serializable

@Serializable
data class CourtpiecePlayerView(
    val seat: Int,
    val userId: String? = null,
    val name: String? = null,
    val isBot: Boolean? = null,
    val ready: Boolean = false,
    val connected: Boolean? = null,
    val avatarId: Int? = null,
    val avatarUrl: String? = null,
    val cardCount: Int = 0,
    val tricksThisHand: Int = 0,
    val team: Int = 0,
)

@Serializable
data class CourtpieceTrickPlay(
    val seat: Int,
    val card: String,
)

@Serializable
data class CourtpieceLastHand(
    val winningTeam: Int,
    val handsAwarded: Int = 1,
    val tricks: List<Int> = emptyList(),
)

@Serializable
data class CourtpiecePublicView(
    val id: String,
    val inviteCode: String = "",
    val name: String = "",
    val hostUserId: String = "",
    val maxSeats: Int = 4,
    val rulesVariant: String = "classic",
    val status: String = "waiting",
    val phase: String = "lobby",
    val seats: List<CourtpiecePlayerView> = emptyList(),
    val dealer: Int = 0,
    val hakem: Int? = null,
    val trumpSetter: Int? = null,
    val trump: String? = null,
    val currentTrick: List<CourtpieceTrickPlay> = emptyList(),
    val trickLeader: Int? = null,
    val toAct: Int? = null,
    val teamHands: List<Int> = listOf(0, 0),
    val handsToWin: Int = 7,
    val handNumber: Int = 0,
    val winnerTeam: Int? = null,
    val lastHand: CourtpieceLastHand? = null,
    val seq: Int = 0,
    val turnEndsAt: Long? = null,
    val turnTimeMs: Int? = null,
    val createdAt: Long = 0,
)

@Serializable
data class CourtpieceYou(
    val seat: Int? = null,
    val hand: List<String> = emptyList(),
    val legal: List<String> = emptyList(),
    val partnerSeat: Int? = null,
    val team: Int? = null,
)

@Serializable
data class CreateCourtpieceRequest(
    val name: String? = null,
    val rulesVariant: String = "classic",
    val botCount: Int = 0,
    val inviteCode: String? = null,
    val inviteFriendIds: List<String> = emptyList(),
)

@Serializable
data class CreateCourtpieceResponse(
    val courtpieceId: String = "",
    val id: String = "",
    val inviteCode: String = "",
    val name: String = "",
    val courtpiece: CourtpiecePublicView? = null,
    val botsAdded: Int = 0,
    val inviteCount: Int = 0,
) {
    fun resolvedId(): String = courtpieceId.ifBlank { id }.ifBlank { courtpiece?.id.orEmpty() }
    fun resolvedInvite(): String = inviteCode.ifBlank { courtpiece?.inviteCode.orEmpty() }
}

@Serializable
data class CourtpieceInviteResolveResponse(
    val courtpieceId: String = "",
    val id: String = "",
    val inviteCode: String = "",
    val name: String = "",
    val maxSeats: Int = 4,
    val rulesVariant: String = "classic",
    val courtpiece: CourtpiecePublicView? = null,
) {
    fun resolvedId(): String = courtpieceId.ifBlank { id }.ifBlank { courtpiece?.id.orEmpty() }
    fun resolvedInvite(): String = inviteCode.ifBlank { courtpiece?.inviteCode.orEmpty() }
}

@Serializable
data class CourtpieceChatLine(
    val userId: String,
    val name: String = "",
    val text: String = "",
    val at: Long = 0,
)

@Serializable
data class CourtpieceChatListResponse(
    val messages: List<CourtpieceChatLine> = emptyList(),
)
