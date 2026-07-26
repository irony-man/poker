package com.felt.android.feature.table

import com.felt.android.core.datastore.SessionPreferences
import com.felt.android.core.model.ClientMessage
import com.felt.android.core.model.RegisterRequest
import com.felt.android.core.model.ServerMessage
import com.felt.android.core.model.TicketRequest
import com.felt.android.core.network.AuthTokenProvider
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
    private val authTokenProvider: AuthTokenProvider,
) {
    val messages: SharedFlow<ServerMessage> = wsClient.messages

    suspend fun connect(tableId: String) {
        val saved = sessionPreferences.getSession()
            ?: error("Register in lobby first")
        val auth = requireAuthHeader()
        val session = runCatching {
            feltApi.refreshTicket(TicketRequest(saved.userId), authorization = auth)
        }.getOrElse {
            feltApi.register(
                RegisterRequest(saved.name, saved.avatarId),
                authorization = auth,
            )
        }.let { it.copy(avatarId = saved.avatarId) }
            .also { sessionPreferences.saveSession(it) }

        // Persist current avatar preference on the server user record.
        runCatching {
            feltApi.register(
                RegisterRequest(saved.name, saved.avatarId),
                authorization = auth,
            )
        }

        wsClient.connect()
        wsClient.send(ClientMessage.Auth(session.ticket))

        // Wait briefly for auth_ok before joining
        withTimeout(15_000) {
            messages.first { it is ServerMessage.AuthOk }
        }
        wsClient.send(ClientMessage.JoinTable(tableId))
    }

    fun send(message: ClientMessage) = wsClient.send(message)

    fun disconnect() = wsClient.disconnect(reconnect = false)

    private suspend fun requireAuthHeader(): String {
        val token = authTokenProvider.bearerToken()
            ?: error("Sign in required for online play")
        return "Bearer $token"
    }
}
