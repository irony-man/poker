package com.pokr.android.core.model

import kotlinx.serialization.Serializable

@Serializable
data class SnakesPlayerView(
    val seat: Int,
    val userId: String? = null,
    val name: String? = null,
    val isBot: Boolean? = null,
    val ready: Boolean = false,
    val connected: Boolean? = null,
    val avatarId: Int? = null,
    val avatarUrl: String? = null,
    val position: Int = 0,
)

@Serializable
data class SnakesPublicView(
    val id: String,
    val inviteCode: String,
    val name: String,
    val hostUserId: String,
    val maxSeats: Int,
    val status: String,
    val seats: List<SnakesPlayerView> = emptyList(),
    val toAct: Int? = null,
    val die: Int? = null,
    val lastFrom: Int? = null,
    val lastTo: Int? = null,
    val lastTeleport: Int? = null,
    val seq: Int = 0,
    val turnEndsAt: Long? = null,
    val turnTimeMs: Int? = null,
    val winnerSeat: Int? = null,
    val createdAt: Long = 0,
)

@Serializable
data class SnakesYou(
    val seat: Int? = null,
)

@Serializable
data class CreateSnakesRequest(
    val name: String? = null,
    val maxSeats: Int = 4,
    val botCount: Int = 0,
    val inviteCode: String? = null,
    val inviteFriendIds: List<String> = emptyList(),
)

@Serializable
data class CreateSnakesResponse(
    val snakesId: String = "",
    val id: String = "",
    val inviteCode: String = "",
    val name: String = "",
    val snakes: SnakesPublicView? = null,
    val botsAdded: Int = 0,
    val inviteCount: Int = 0,
) {
    fun resolvedId(): String = snakesId.ifBlank { id }.ifBlank { snakes?.id.orEmpty() }
    fun resolvedInvite(): String = inviteCode.ifBlank { snakes?.inviteCode.orEmpty() }
}

@Serializable
data class SnakesInviteResolveResponse(
    val snakesId: String = "",
    val id: String = "",
    val inviteCode: String = "",
    val name: String = "",
    val snakes: SnakesPublicView? = null,
) {
    fun resolvedId(): String = snakesId.ifBlank { id }.ifBlank { snakes?.id.orEmpty() }
    fun resolvedInvite(): String = inviteCode.ifBlank { snakes?.inviteCode.orEmpty() }
}

@Serializable
data class SnakesChatLine(
    val userId: String,
    val name: String = "",
    val text: String = "",
    val at: Long = 0,
)

@Serializable
data class SnakesChatListResponse(
    val messages: List<SnakesChatLine> = emptyList(),
)
