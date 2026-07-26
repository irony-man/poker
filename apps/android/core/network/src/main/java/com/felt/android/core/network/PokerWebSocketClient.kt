package com.felt.android.core.network

import com.felt.android.core.model.ClientMessage
import com.felt.android.core.model.ServerMessage
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener

@Singleton
class PokerWebSocketClient(
    private val okHttpClient: OkHttpClient,
    private val json: Json,
    private val defaultWsUrl: String,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val _messages = MutableSharedFlow<ServerMessage>(extraBufferCapacity = 64)
    val messages: SharedFlow<ServerMessage> = _messages.asSharedFlow()

    private var webSocket: WebSocket? = null
    private var pingJob: Job? = null
    private var reconnectJob: Job? = null
    private var currentWsUrl: String? = null
    private var shouldReconnect = false

    fun connect(wsUrl: String = defaultWsUrl) {
        disconnect(reconnect = false)
        currentWsUrl = wsUrl
        shouldReconnect = true
        openSocket(wsUrl)
    }

    fun send(message: ClientMessage) {
        send(json.encodeToString(ClientMessage.serializer(), message))
    }

    fun send(rawJson: String) {
        webSocket?.send(rawJson)
    }

    fun disconnect(reconnect: Boolean = false) {
        shouldReconnect = reconnect
        reconnectJob?.cancel()
        reconnectJob = null
        pingJob?.cancel()
        pingJob = null
        webSocket?.close(NORMAL_CLOSE_CODE, "client disconnect")
        webSocket = null
        if (!reconnect) {
            currentWsUrl = null
        }
    }

    private fun openSocket(wsUrl: String) {
        val request = Request.Builder().url(wsUrl).build()
        webSocket = okHttpClient.newWebSocket(request, socketListener)
    }

    private fun startPingLoop() {
        pingJob?.cancel()
        pingJob = scope.launch {
            while (isActive) {
                delay(PING_INTERVAL_MS)
                send(ClientMessage.Ping)
            }
        }
    }

    private fun scheduleReconnect() {
        if (!shouldReconnect || currentWsUrl == null) return
        reconnectJob?.cancel()
        reconnectJob = scope.launch {
            delay(RECONNECT_DELAY_MS)
            currentWsUrl?.let { openSocket(it) }
        }
    }

    private val socketListener = object : WebSocketListener() {
        override fun onOpen(webSocket: WebSocket, response: Response) {
            pingJob?.cancel()
            startPingLoop()
        }

        override fun onMessage(webSocket: WebSocket, text: String) {
            runCatching {
                json.decodeFromString(ServerMessage.serializer(), text)
            }.onSuccess { message ->
                scope.launch { _messages.emit(message) }
            }
        }

        override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
            webSocket.close(code, reason)
        }

        override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
            pingJob?.cancel()
            if (shouldReconnect && code != NORMAL_CLOSE_CODE) {
                scheduleReconnect()
            }
        }

        override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
            pingJob?.cancel()
            scheduleReconnect()
        }
    }

    internal fun closeScope() {
        disconnect(reconnect = false)
        scope.cancel()
    }

    private companion object {
        const val PING_INTERVAL_MS = 20_000L
        const val RECONNECT_DELAY_MS = 2_000L
        const val NORMAL_CLOSE_CODE = 1000
    }
}
