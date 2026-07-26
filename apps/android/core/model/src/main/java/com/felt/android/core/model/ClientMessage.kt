package com.felt.android.core.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonClassDiscriminator

@Serializable
@JsonClassDiscriminator("type")
sealed interface ClientMessage {

    @Serializable
    @SerialName("auth")
    data class Auth(val ticket: String) : ClientMessage

    @Serializable
    @SerialName("join_table")
    data class JoinTable(val tableId: String) : ClientMessage

    @Serializable
    @SerialName("leave_table")
    data class LeaveTable(val tableId: String) : ClientMessage

    @Serializable
    @SerialName("sit")
    data class Sit(
        val tableId: String,
        val seat: Int,
        val buyIn: Int,
    ) : ClientMessage

    @Serializable
    @SerialName("stand")
    data class Stand(
        val tableId: String,
        val seat: Int,
    ) : ClientMessage

    @Serializable
    @SerialName("top_up")
    data class TopUp(
        val tableId: String,
        val seat: Int,
        val amount: Int,
    ) : ClientMessage

    @Serializable
    @SerialName("start_hand")
    data class StartHand(val tableId: String) : ClientMessage

    @Serializable
    @SerialName("action")
    data class Action(
        val tableId: String,
        val handId: String,
        val seq: Int,
        val action: String,
        val amount: Int? = null,
    ) : ClientMessage

    @Serializable
    @SerialName("chat")
    data class Chat(
        val tableId: String,
        val text: String,
    ) : ClientMessage

    @Serializable
    @SerialName("emoji")
    data class Emoji(
        val tableId: String,
        val emoji: String,
    ) : ClientMessage

    @Serializable
    @SerialName("add_bot")
    data class AddBot(
        val tableId: String,
        val seat: Int? = null,
        val buyIn: Int? = null,
        val count: Int? = null,
    ) : ClientMessage

    @Serializable
    @SerialName("remove_bot")
    data class RemoveBot(
        val tableId: String,
        val seat: Int,
    ) : ClientMessage

    @Serializable
    @SerialName("remove_all_bots")
    data class RemoveAllBots(val tableId: String) : ClientMessage

    @Serializable
    @SerialName("ping")
    data object Ping : ClientMessage
}
