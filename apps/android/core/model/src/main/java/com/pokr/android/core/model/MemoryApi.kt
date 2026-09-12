package com.pokr.android.core.model

import kotlinx.serialization.Serializable

@Serializable
data class MemoryCardView(
    val index: Int,
    val pairId: Int? = null,
    val matched: Boolean = false,
    val faceUp: Boolean = false,
)

@Serializable
data class MemoryPlayerView(
    val seat: Int,
    val userId: String? = null,
    val name: String? = null,
    val isBot: Boolean? = null,
    val ready: Boolean = false,
    val connected: Boolean? = null,
    val avatarId: Int? = null,
    val avatarUrl: String? = null,
    val pairs: Int = 0,
)

@Serializable
data class MemoryPublicView(
    val id: String,
    val inviteCode: String,
    val name: String,
    val hostUserId: String,
    val maxSeats: Int,
    val gridSize: Int = 16,
    val status: String,
    val seats: List<MemoryPlayerView> = emptyList(),
    val cards: List<MemoryCardView> = emptyList(),
    val faceUp: List<Int> = emptyList(),
    val toAct: Int? = null,
    val seq: Int = 0,
    val turnEndsAt: Long? = null,
    val turnTimeMs: Int? = null,
    val winnerSeats: List<Int> = emptyList(),
    val createdAt: Long = 0,
)

@Serializable
data class MemoryYou(
    val seat: Int? = null,
)

@Serializable
data class CreateMemoryRequest(
    val name: String? = null,
    val maxSeats: Int = 2,
    val gridSize: Int = 16,
    val botCount: Int = 0,
    val inviteCode: String? = null,
    val inviteFriendIds: List<String> = emptyList(),
)

@Serializable
data class CreateMemoryResponse(
    val memoryId: String = "",
    val id: String = "",
    val inviteCode: String = "",
    val name: String = "",
    val memory: MemoryPublicView? = null,
    val botsAdded: Int = 0,
    val inviteCount: Int = 0,
) {
    fun resolvedId(): String = memoryId.ifBlank { id }.ifBlank { memory?.id.orEmpty() }
    fun resolvedInvite(): String = inviteCode.ifBlank { memory?.inviteCode.orEmpty() }
}

@Serializable
data class MemoryInviteResolveResponse(
    val memoryId: String = "",
    val id: String = "",
    val inviteCode: String = "",
    val name: String = "",
    val memory: MemoryPublicView? = null,
) {
    fun resolvedId(): String = memoryId.ifBlank { id }.ifBlank { memory?.id.orEmpty() }
    fun resolvedInvite(): String = inviteCode.ifBlank { memory?.inviteCode.orEmpty() }
}

@Serializable
data class MemoryChatLine(
    val userId: String,
    val name: String = "",
    val text: String = "",
    val at: Long = 0,
)

@Serializable
data class MemoryChatListResponse(
    val messages: List<MemoryChatLine> = emptyList(),
)
