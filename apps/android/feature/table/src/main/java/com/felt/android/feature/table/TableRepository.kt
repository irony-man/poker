package com.felt.android.feature.table

import com.felt.android.core.datastore.SessionPreferences
import com.felt.android.core.model.ClientMessage
import com.felt.android.core.model.ServerMessage
import com.felt.android.core.network.FeltApi
import com.felt.android.core.network.PokerWebSocketClient
import com.felt.android.core.network.SessionTokenHolder
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withTimeout

@Singleton
class TableRepository @Inject constructor(
    private val wsClient: PokerWebSocketClient,
    private val feltApi: FeltApi,
    private val sessionPreferences: SessionPreferences,
    private val tokenHolder: SessionTokenHolder,
) {
    val messages: SharedFlow<ServerMessage> = wsClient.messages

    suspend fun connect(tableId: String, spectate: Boolean = false) {
        val saved = sessionPreferences.getSession()
            ?: error("Sign in from the lobby first")
        if (saved.sessionToken.isBlank()) error("Sign in from the lobby first")
        tokenHolder.set(saved.sessionToken)
        val session = feltApi.refreshTicket().copy(
            sessionToken = saved.sessionToken,
            avatarId = saved.avatarId,
        ).also { sessionPreferences.saveSession(it) }

        wsClient.connect()
        wsClient.send(ClientMessage.Auth(session.ticket))

        withTimeout(15_000) {
            messages.first { it is ServerMessage.AuthOk }
        }
        wsClient.send(
            ClientMessage.JoinTable(
                tableId = tableId,
                spectate = if (spectate) true else null,
            ),
        )
    }

    fun send(message: ClientMessage) = wsClient.send(message)

    fun disconnect() = wsClient.disconnect(reconnect = false)
}
