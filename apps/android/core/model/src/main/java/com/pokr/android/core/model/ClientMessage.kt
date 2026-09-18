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
    @SerialName("voice_join")
    data class VoiceJoin(val tableId: String) : ClientMessage

    @Serializable
    @SerialName("voice_leave")
    data class VoiceLeave(val tableId: String) : ClientMessage

    @Serializable
    @SerialName("voice_signal")
    data class VoiceSignal(
        val tableId: String,
        val toUserId: String,
        val signal: VoiceSignalPayload,
    ) : ClientMessage

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

    @Serializable
    @SerialName("join_snakes")
    data class JoinSnakes(
        val snakesId: String,
        val spectate: Boolean? = null,
    ) : ClientMessage

    @Serializable
    @SerialName("leave_snakes")
    data class LeaveSnakes(val snakesId: String) : ClientMessage

    @Serializable
    @SerialName("snakes_sit")
    data class SnakesSit(
        val snakesId: String,
        val seat: Int,
    ) : ClientMessage

    @Serializable
    @SerialName("snakes_stand")
    data class SnakesStand(
        val snakesId: String,
        val seat: Int,
    ) : ClientMessage

    @Serializable
    @SerialName("snakes_set_ready")
    data class SnakesSetReady(
        val snakesId: String,
        val ready: Boolean,
    ) : ClientMessage

    @Serializable
    @SerialName("snakes_roll")
    data class SnakesRoll(
        val snakesId: String,
        val seq: Int,
    ) : ClientMessage

    @Serializable
    @SerialName("snakes_add_bot")
    data class SnakesAddBot(
        val snakesId: String,
        val seat: Int? = null,
    ) : ClientMessage

    @Serializable
    @SerialName("snakes_remove_bot")
    data class SnakesRemoveBot(
        val snakesId: String,
        val seat: Int,
    ) : ClientMessage

    @Serializable
    @SerialName("snakes_chat")
    data class SnakesChat(
        val snakesId: String,
        val text: String,
    ) : ClientMessage

    @Serializable
    @SerialName("join_memory")
    data class JoinMemory(
        val memoryId: String,
        val spectate: Boolean? = null,
    ) : ClientMessage

    @Serializable
    @SerialName("leave_memory")
    data class LeaveMemory(val memoryId: String) : ClientMessage

    @Serializable
    @SerialName("memory_sit")
    data class MemorySit(
        val memoryId: String,
        val seat: Int,
    ) : ClientMessage

    @Serializable
    @SerialName("memory_stand")
    data class MemoryStand(
        val memoryId: String,
        val seat: Int,
    ) : ClientMessage

    @Serializable
    @SerialName("memory_set_ready")
    data class MemorySetReady(
        val memoryId: String,
        val ready: Boolean,
    ) : ClientMessage

    @Serializable
    @SerialName("memory_flip")
    data class MemoryFlip(
        val memoryId: String,
        val index: Int,
        val seq: Int,
    ) : ClientMessage

    @Serializable
    @SerialName("memory_add_bot")
    data class MemoryAddBot(
        val memoryId: String,
        val seat: Int? = null,
    ) : ClientMessage

    @Serializable
    @SerialName("memory_remove_bot")
    data class MemoryRemoveBot(
        val memoryId: String,
        val seat: Int,
    ) : ClientMessage

    @Serializable
    @SerialName("memory_chat")
    data class MemoryChat(
        val memoryId: String,
        val text: String,
    ) : ClientMessage

    @Serializable
    @SerialName("join_courtpiece")
    data class JoinCourtpiece(
        val courtpieceId: String,
        val spectate: Boolean? = null,
    ) : ClientMessage

    @Serializable
    @SerialName("leave_courtpiece")
    data class LeaveCourtpiece(val courtpieceId: String) : ClientMessage

    @Serializable
    @SerialName("courtpiece_sit")
    data class CourtpieceSit(
        val courtpieceId: String,
        val seat: Int,
    ) : ClientMessage

    @Serializable
    @SerialName("courtpiece_stand")
    data class CourtpieceStand(
        val courtpieceId: String,
        val seat: Int,
    ) : ClientMessage

    @Serializable
    @SerialName("courtpiece_set_ready")
    data class CourtpieceSetReady(
        val courtpieceId: String,
        val ready: Boolean,
    ) : ClientMessage

    @Serializable
    @SerialName("courtpiece_set_trump")
    data class CourtpieceSetTrump(
        val courtpieceId: String,
        val suit: String,
        val seq: Int,
    ) : ClientMessage

    @Serializable
    @SerialName("courtpiece_play")
    data class CourtpiecePlay(
        val courtpieceId: String,
        val card: String,
        val seq: Int,
    ) : ClientMessage

    @Serializable
    @SerialName("courtpiece_add_bot")
    data class CourtpieceAddBot(
        val courtpieceId: String,
        val seat: Int? = null,
    ) : ClientMessage

    @Serializable
    @SerialName("courtpiece_remove_bot")
    data class CourtpieceRemoveBot(
        val courtpieceId: String,
        val seat: Int,
    ) : ClientMessage

    @Serializable
    @SerialName("courtpiece_chat")
    data class CourtpieceChat(
        val courtpieceId: String,
        val text: String,
    ) : ClientMessage
}
