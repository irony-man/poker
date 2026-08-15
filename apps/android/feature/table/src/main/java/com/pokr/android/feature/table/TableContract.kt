package com.pokr.android.feature.table

import com.pokr.android.core.model.ChatMessage
import com.pokr.android.core.model.ConnectionStatus
import com.pokr.android.core.model.EmojiBurst
import com.pokr.android.core.model.PrivateView
import com.pokr.android.core.model.PublicBotGroup
import com.pokr.android.core.model.PublicTable

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
        data class KickPlayer(val seat: Int) : Intent
        data class SelectBotGroup(val id: String) : Intent
        data object RemoveAllBots : Intent
        data class TopUp(val seat: Int, val amount: Int) : Intent
        data object SitOut : Intent
        data object SitIn : Intent
        data object EnableSitToPlay : Intent
        data object LeaveTable : Intent
        data object ToggleSfxMute : Intent
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
        val tableColorId: Int = 0,
        val sfxMuted: Boolean = false,
        val botGroups: List<PublicBotGroup> = emptyList(),
        val botGroupId: String? = null,
    )

    sealed interface Effect {
        data class ShowMessage(val text: String) : Effect
    }
}
