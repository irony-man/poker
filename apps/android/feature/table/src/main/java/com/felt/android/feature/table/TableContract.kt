package com.felt.android.feature.table

import com.felt.android.core.model.ChatMessage
import com.felt.android.core.model.ConnectionStatus
import com.felt.android.core.model.EmojiBurst
import com.felt.android.core.model.PrivateView
import com.felt.android.core.model.PublicTable

object TableContract {

    sealed interface Intent {
        data object Connect : Intent
        data class SendAction(val action: String, val amount: Int? = null) : Intent
        data class SendChat(val text: String) : Intent
        data class SendEmoji(val emoji: String) : Intent
        data object ToggleChat : Intent
        data object DismissError : Intent
        data class Sit(val seat: Int, val buyIn: Int) : Intent
        data object StartHand : Intent
        data class AddBots(val count: Int) : Intent
        data object RemoveAllBots : Intent
        data class TopUp(val seat: Int, val amount: Int) : Intent
        data object EnableSitToPlay : Intent
        data object LeaveTable : Intent
    }

    data class UiState(
        val tableId: String = "",
        val invite: String? = null,
        val userId: String? = null,
        val connection: ConnectionStatus = ConnectionStatus.Idle,
        val table: PublicTable? = null,
        val private: PrivateView? = null,
        val chat: List<ChatMessage> = emptyList(),
        val chatOpen: Boolean = false,
        val lastError: String? = null,
        val emojiBurst: EmojiBurst? = null,
        val loading: Boolean = true,
        val spectating: Boolean = false,
    )

    sealed interface Effect {
        data class ShowMessage(val text: String) : Effect
    }
}
