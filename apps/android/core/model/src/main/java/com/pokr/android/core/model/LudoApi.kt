package com.pokr.android.core.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonClassDiscriminator

/** Token location: yard, main track 0–51, home stretch 0–4, or home. */
@Serializable
@JsonClassDiscriminator("kind")
sealed interface LudoTokenPos {

    @Serializable
    @SerialName("yard")
    data object Yard : LudoTokenPos

    @Serializable
    @SerialName("track")
    data class Track(val index: Int) : LudoTokenPos

    @Serializable
    @SerialName("stretch")
    data class Stretch(val index: Int) : LudoTokenPos

    @Serializable
    @SerialName("home")
    data object Home : LudoTokenPos
}

@Serializable
data class LudoToken(
    val index: Int,
    val pos: LudoTokenPos,
)

@Serializable
data class LudoPlayerView(
    val seat: Int,
    val userId: String? = null,
    val name: String? = null,
    val isBot: Boolean? = null,
    val ready: Boolean = false,
    val connected: Boolean? = null,
    val avatarId: Int? = null,
    val avatarUrl: String? = null,
    val tokens: List<LudoToken> = emptyList(),
)

@Serializable
data class LudoLegalMove(
    val tokenIndex: Int,
)

@Serializable
data class LudoPublicView(
    val id: String,
    val inviteCode: String,
    val name: String,
    val hostUserId: String,
    val maxSeats: Int,
    val status: String,
    val seats: List<LudoPlayerView> = emptyList(),
    val toAct: Int? = null,
    val die: Int? = null,
    val consecutiveSixes: Int? = null,
    val seq: Int = 0,
    val turnEndsAt: Long? = null,
    val turnTimeMs: Int? = null,
    val winnerSeat: Int? = null,
    val createdAt: Long = 0,
)

@Serializable
data class LudoYou(
    val seat: Int? = null,
)

@Serializable
data class CreateLudoRequest(
    val userId: String,
    val name: String? = null,
    val maxSeats: Int = 4,
    val botCount: Int = 0,
    val inviteCode: String? = null,
    val inviteFriendIds: List<String> = emptyList(),
)

/** REST create / invite resolve — accepts flat fields or a wrapped [ludo] view. */
@Serializable
data class CreateLudoResponse(
    val ludoId: String = "",
    val id: String = "",
    val inviteCode: String = "",
    val name: String = "",
    val ludo: LudoPublicView? = null,
    val botsAdded: Int = 0,
    val inviteCount: Int = 0,
) {
    fun resolvedId(): String = ludoId.ifBlank { id }.ifBlank { ludo?.id.orEmpty() }
    fun resolvedInvite(): String = inviteCode.ifBlank { ludo?.inviteCode.orEmpty() }
}

@Serializable
data class LudoInviteResolveResponse(
    val ludoId: String = "",
    val id: String = "",
    val inviteCode: String = "",
    val name: String = "",
    val ludo: LudoPublicView? = null,
) {
    fun resolvedId(): String = ludoId.ifBlank { id }.ifBlank { ludo?.id.orEmpty() }
    fun resolvedInvite(): String = inviteCode.ifBlank { ludo?.inviteCode.orEmpty() }
}

@Serializable
data class LudoChatLine(
    val userId: String,
    val name: String = "",
    val text: String = "",
    val at: Long = 0,
)

@Serializable
data class LudoChatListResponse(
    val messages: List<LudoChatLine> = emptyList(),
)
