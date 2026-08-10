package com.felt.android.core.model

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
        val friends: List<kotlinx.serialization.json.JsonElement> = emptyList(),
        val incoming: List<kotlinx.serialization.json.JsonElement> = emptyList(),
        val pendingChallenges: List<kotlinx.serialization.json.JsonElement> = emptyList(),
        val groups: List<kotlinx.serialization.json.JsonElement> = emptyList(),
    ) : ServerMessage
}
