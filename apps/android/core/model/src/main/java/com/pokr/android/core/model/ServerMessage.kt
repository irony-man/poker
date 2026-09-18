package com.pokr.android.core.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonClassDiscriminator

@Serializable
@JsonClassDiscriminator("type")
sealed interface ServerMessage {

    @Serializable
    @SerialName("auth_ok")
    data class AuthOk(
        val userId: String,
        val name: String,
    ) : ServerMessage

    @Serializable
    @SerialName("error")
    data class Error(
        val message: String,
        val code: String? = null,
    ) : ServerMessage

    @Serializable
    @SerialName("state_sync")
    data class StateSync(
        val table: PublicTable,
        @SerialName("private")
        val privateView: PrivateView? = null,
    ) : ServerMessage

    @Serializable
    @SerialName("chat")
    data class Chat(
        val tableId: String,
        val userId: String,
        val name: String,
        val text: String,
        val at: Long,
    ) : ServerMessage

    @Serializable
    @SerialName("emoji")
    data class Emoji(
        val tableId: String,
        val userId: String,
        val name: String,
        val emoji: String,
        val at: Long,
    ) : ServerMessage

    @Serializable
    @SerialName("seat_action")
    data class SeatAction(
        val tableId: String,
        val seat: Int,
        val action: String = "",
        val amount: Int = 0,
        val label: String = "",
        val at: Long = 0,
    ) : ServerMessage

    @Serializable
    @SerialName("voice_roster")
    data class VoiceRoster(
        val peers: List<VoicePeer> = emptyList(),
    ) : ServerMessage

    @Serializable
    @SerialName("voice_peer_joined")
    data class VoicePeerJoined(
        val userId: String,
        val name: String = "",
    ) : ServerMessage

    @Serializable
    @SerialName("voice_peer_left")
    data class VoicePeerLeft(
        val userId: String,
    ) : ServerMessage

    @Serializable
    @SerialName("voice_signal")
    data class VoiceSignal(
        val fromUserId: String,
        val signal: VoiceSignalPayload,
    ) : ServerMessage

    @Serializable
    @SerialName("pong")
    data object Pong : ServerMessage

    @Serializable
    @SerialName("contest_sync")
    data class ContestSync(
        val contest: ContestView,
    ) : ServerMessage

    @Serializable
    @SerialName("contest_event")
    data class ContestEvent(
        val contestId: String,
        val event: String,
        val message: String? = null,
        val tableId: String? = null,
        val matchId: String? = null,
        val place: Int? = null,
    ) : ServerMessage

    /** Lobby / social push messages — ignored on table screens when unused. */
    @Serializable
    @SerialName("public_tables_sync")
    data class PublicTablesSync(
        val tables: List<kotlinx.serialization.json.JsonElement> = emptyList(),
    ) : ServerMessage

    @Serializable
    @SerialName("public_contests_sync")
    data class PublicContestsSync(
        val contests: List<ContestView> = emptyList(),
    ) : ServerMessage

    @Serializable
    @SerialName("my_contests_sync")
    data class MyContestsSync(
        val contests: List<ContestView> = emptyList(),
    ) : ServerMessage

    @Serializable
    @SerialName("social_sync")
    data class SocialSync(
        val friends: List<FriendProfile> = emptyList(),
        val incoming: List<PendingRequestView> = emptyList(),
        val outgoing: List<OutgoingRequestView> = emptyList(),
        val pendingChallenges: List<PendingChallenge> = emptyList(),
        val outgoingChallenges: List<OutgoingChallenge> = emptyList(),
        val groups: List<FriendGroupView> = emptyList(),
    ) : ServerMessage

    @Serializable
    @SerialName("ludo_state_sync")
    data class LudoStateSync(
        val ludo: LudoPublicView,
        val you: LudoYou,
        val legalMoves: List<LudoLegalMove>? = null,
    ) : ServerMessage

    @Serializable
    @SerialName("ludo_chat")
    data class LudoChat(
        val ludoId: String,
        val userId: String,
        val name: String,
        val text: String,
        val at: Long,
    ) : ServerMessage

    @Serializable
    @SerialName("snakes_state_sync")
    data class SnakesStateSync(
        val snakes: SnakesPublicView,
        val you: SnakesYou,
    ) : ServerMessage

    @Serializable
    @SerialName("snakes_chat")
    data class SnakesChat(
        val snakesId: String,
        val userId: String,
        val name: String,
        val text: String,
        val at: Long,
    ) : ServerMessage

    @Serializable
    @SerialName("memory_state_sync")
    data class MemoryStateSync(
        val memory: MemoryPublicView,
        val you: MemoryYou,
    ) : ServerMessage

    @Serializable
    @SerialName("memory_chat")
    data class MemoryChat(
        val memoryId: String,
        val userId: String,
        val name: String,
        val text: String,
        val at: Long,
    ) : ServerMessage

    @Serializable
    @SerialName("courtpiece_state_sync")
    data class CourtpieceStateSync(
        val courtpiece: CourtpiecePublicView,
        val you: CourtpieceYou,
    ) : ServerMessage

    @Serializable
    @SerialName("courtpiece_chat")
    data class CourtpieceChat(
        val courtpieceId: String,
        val userId: String,
        val name: String,
        val text: String,
        val at: Long,
    ) : ServerMessage
}
