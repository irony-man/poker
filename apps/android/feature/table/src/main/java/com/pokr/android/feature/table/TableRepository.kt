package com.pokr.android.feature.table

import com.pokr.android.core.model.ClientMessage
import com.pokr.android.core.model.ServerMessage
import com.pokr.android.core.network.PokerWebSocketClient
import com.pokr.android.core.network.SocialRepository
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.SharedFlow

@Singleton
class TableRepository @Inject constructor(
    private val wsClient: PokerWebSocketClient,
    private val social: SocialRepository,
) {
    val messages: SharedFlow<ServerMessage> = wsClient.messages

    suspend fun connect(tableId: String, spectate: Boolean = false) {
        social.awaitAuthenticated()
        wsClient.send(
            ClientMessage.JoinTable(
                tableId = tableId,
                spectate = if (spectate) true else null,
            ),
        )
    }

    fun send(message: ClientMessage) = wsClient.send(message)

    fun leave(tableId: String) {
        wsClient.send(ClientMessage.LeaveTable(tableId))
    }
}
