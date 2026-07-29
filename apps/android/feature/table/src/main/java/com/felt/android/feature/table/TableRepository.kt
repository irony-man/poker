package com.felt.android.feature.table

import com.felt.android.core.datastore.SessionPreferences
import com.felt.android.core.model.ClientMessage
import com.felt.android.core.model.RegisterRequest
import com.felt.android.core.model.ServerMessage
import com.felt.android.core.model.TicketRequest
import com.felt.android.core.network.FeltApi
import com.felt.android.core.network.PokerWebSocketClient
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
) {
    val messages: SharedFlow<ServerMessage> = wsClient.messages

    suspend fun connect(tableId: String, spectate: Boolean = false) {
        val saved = sessionPreferences.getSession()
            ?: error("Enter a callsign in the lobby first")
        val session = runCatching {
            feltApi.refreshTicket(TicketRequest(saved.userId))
        }.getOrElse {
            feltApi.register(
                RegisterRequest(saved.name, saved.avatarId, saved.userId),
            )
        }.let { it.copy(avatarId = saved.avatarId) }
            .also { sessionPreferences.saveSession(it) }

        // Refresh name / avatar on the server user record.
        runCatching {
            feltApi.register(
                RegisterRequest(saved.name, saved.avatarId, session.userId),
            )
        }

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
