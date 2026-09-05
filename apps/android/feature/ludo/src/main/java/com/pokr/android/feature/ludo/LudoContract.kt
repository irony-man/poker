package com.pokr.android.feature.ludo

import com.pokr.android.core.model.ChatMessage
import com.pokr.android.core.model.ConnectionStatus
import com.pokr.android.core.model.LudoLegalMove
import com.pokr.android.core.model.LudoPublicView

object LudoContract {

    sealed interface Intent {
        data object Connect : Intent
        data object DismissError : Intent
        data object ToggleChat : Intent
        data class SendChat(val text: String) : Intent
        data class Sit(val seat: Int) : Intent
        data object Stand : Intent
        data class SetReady(val ready: Boolean) : Intent
        data object Roll : Intent
        data class Move(val tokenIndex: Int) : Intent
        data class AddBot(val seat: Int? = null) : Intent
        data class RemoveBot(val seat: Int) : Intent
        data object Leave : Intent
    }

    data class UiState(
        val ludoId: String = "",
        val invite: String? = null,
        val userId: String? = null,
        val connection: ConnectionStatus = ConnectionStatus.Idle,
        val ludo: LudoPublicView? = null,
        val youSeat: Int? = null,
        val legalMoves: List<LudoLegalMove> = emptyList(),
        val chat: List<ChatMessage> = emptyList(),
        val chatOpen: Boolean = false,
        val lastError: String? = null,
        val loading: Boolean = true,
        val spectating: Boolean = false,
    )
}
