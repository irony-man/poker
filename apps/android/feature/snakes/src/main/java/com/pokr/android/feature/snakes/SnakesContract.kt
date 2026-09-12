package com.pokr.android.feature.snakes

import com.pokr.android.core.model.ChatMessage
import com.pokr.android.core.model.ConnectionStatus
import com.pokr.android.core.model.SnakesPublicView

object SnakesContract {

    sealed interface Intent {
        data object Connect : Intent
        data object DismissError : Intent
        data object ToggleChat : Intent
        data class SendChat(val text: String) : Intent
        data class Sit(val seat: Int) : Intent
        data object Stand : Intent
        data class SetReady(val ready: Boolean) : Intent
        data object Roll : Intent
        data class AddBot(val seat: Int? = null) : Intent
        data class RemoveBot(val seat: Int) : Intent
        data object Leave : Intent
    }

    data class UiState(
        val snakesId: String = "",
        val invite: String? = null,
        val userId: String? = null,
        val connection: ConnectionStatus = ConnectionStatus.Idle,
        val snakes: SnakesPublicView? = null,
        val youSeat: Int? = null,
        val chat: List<ChatMessage> = emptyList(),
        val chatOpen: Boolean = false,
        val lastError: String? = null,
        val loading: Boolean = true,
        val spectating: Boolean = false,
    )
}
