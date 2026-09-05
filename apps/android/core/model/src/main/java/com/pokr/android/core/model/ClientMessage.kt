package com.pokr.android.core.model

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
    data class JoinTable(
        val tableId: String,
        val spectate: Boolean? = null,
    ) : ClientMessage

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
    @SerialName("sit_out")
    data class SitOut(
        val tableId: String,
        val seat: Int,
    ) : ClientMessage

    @Serializable
    @SerialName("sit_in")
    data class SitIn(
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
    @SerialName("kick_player")
    data class KickPlayer(
        val tableId: String,
        val seat: Int,
    ) : ClientMessage

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
        val botGroupId: String? = null,
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

    @Serializable
    @SerialName("join_contest")
    data class JoinContest(val contestId: String) : ClientMessage

    @Serializable
    @SerialName("leave_contest")
    data class LeaveContest(val contestId: String) : ClientMessage

    @Serializable
    @SerialName("join_ludo")
    data class JoinLudo(
        val ludoId: String,
        val spectate: Boolean? = null,
    ) : ClientMessage

    @Serializable
    @SerialName("leave_ludo")
    data class LeaveLudo(val ludoId: String) : ClientMessage

    @Serializable
    @SerialName("ludo_sit")
    data class LudoSit(
        val ludoId: String,
        val seat: Int,
    ) : ClientMessage

    @Serializable
    @SerialName("ludo_stand")
    data class LudoStand(
        val ludoId: String,
        val seat: Int,
    ) : ClientMessage

    @Serializable
    @SerialName("ludo_set_ready")
    data class LudoSetReady(
        val ludoId: String,
        val ready: Boolean,
    ) : ClientMessage

    @Serializable
    @SerialName("ludo_roll")
    data class LudoRoll(
        val ludoId: String,
        val seq: Int,
    ) : ClientMessage

    @Serializable
    @SerialName("ludo_move")
    data class LudoMove(
        val ludoId: String,
        val tokenIndex: Int,
        val seq: Int,
    ) : ClientMessage

    @Serializable
    @SerialName("ludo_add_bot")
    data class LudoAddBot(
        val ludoId: String,
        val seat: Int? = null,
    ) : ClientMessage

    @Serializable
    @SerialName("ludo_remove_bot")
    data class LudoRemoveBot(
        val ludoId: String,
        val seat: Int,
    ) : ClientMessage

    @Serializable
    @SerialName("ludo_chat")
    data class LudoChat(
        val ludoId: String,
        val text: String,
    ) : ClientMessage
}
