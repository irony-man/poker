package com.pokr.android.feature.courtpiece

import com.pokr.android.core.model.ChatMessage
import com.pokr.android.core.model.ClientMessage
import com.pokr.android.core.model.ServerMessage
import com.pokr.android.core.network.PokrApi
import com.pokr.android.core.network.PokerWebSocketClient
import com.pokr.android.core.network.SocialRepository
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.SharedFlow

@Singleton
class CourtpieceRepository @Inject constructor(
    private val wsClient: PokerWebSocketClient,
    private val social: SocialRepository,
    private val api: PokrApi,
) {
    val messages: SharedFlow<ServerMessage> = wsClient.messages

    suspend fun connect(courtpieceId: String, spectate: Boolean = false) {
        social.awaitAuthenticated()
        wsClient.send(
            ClientMessage.JoinCourtpiece(
                courtpieceId = courtpieceId,
                spectate = if (spectate) true else null,
            ),
        )
    }

    fun send(message: ClientMessage) = wsClient.send(message)

    fun leave(courtpieceId: String) {
        wsClient.send(ClientMessage.LeaveCourtpiece(courtpieceId))
    }

    suspend fun loadChat(courtpieceId: String): List<ChatMessage> {
        return api.getCourtpieceChat(courtpieceId).messages.map { line ->
            ChatMessage(line.userId, line.name, line.text, line.at)
        }
    }
}
