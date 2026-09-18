package com.pokr.android.feature.courtpiece

import com.pokr.android.core.model.ChatMessage
import com.pokr.android.core.model.ConnectionStatus
import com.pokr.android.core.model.CourtpiecePublicView
import com.pokr.android.core.model.CourtpieceYou

object CourtpieceContract {

    sealed interface Intent {
        data object Connect : Intent
        data object DismissError : Intent
        data object ToggleChat : Intent
        data class SendChat(val text: String) : Intent
        data class Sit(val seat: Int) : Intent
        data object Stand : Intent
        data class SetReady(val ready: Boolean) : Intent
        data class SetTrump(val suit: String) : Intent
        data class PlayCard(val card: String) : Intent
        data class AddBot(val seat: Int? = null) : Intent
        data class RemoveBot(val seat: Int) : Intent
        data object Leave : Intent
    }

    data class UiState(
        val courtpieceId: String = "",
        val invite: String? = null,
        val userId: String? = null,
        val connection: ConnectionStatus = ConnectionStatus.Idle,
        val board: CourtpiecePublicView? = null,
        val you: CourtpieceYou = CourtpieceYou(),
        val chat: List<ChatMessage> = emptyList(),
        val chatOpen: Boolean = false,
        val lastError: String? = null,
        val loading: Boolean = true,
        val spectating: Boolean = false,
    )
}
