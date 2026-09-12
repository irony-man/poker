package com.pokr.android.feature.memory

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
class MemoryRepository @Inject constructor(
    private val wsClient: PokerWebSocketClient,
    private val social: SocialRepository,
    private val api: PokrApi,
) {
    val messages: SharedFlow<ServerMessage> = wsClient.messages

    suspend fun connect(memoryId: String, spectate: Boolean = false) {
        social.awaitAuthenticated()
        wsClient.send(
            ClientMessage.JoinMemory(
                memoryId = memoryId,
                spectate = if (spectate) true else null,
            ),
        )
    }

    fun send(message: ClientMessage) = wsClient.send(message)

    fun leave(memoryId: String) {
        wsClient.send(ClientMessage.LeaveMemory(memoryId))
    }

    suspend fun loadChat(memoryId: String): List<ChatMessage> {
        return api.getMemoryChat(memoryId).messages.map { line ->
            ChatMessage(line.userId, line.name, line.text, line.at)
        }
    }
}
