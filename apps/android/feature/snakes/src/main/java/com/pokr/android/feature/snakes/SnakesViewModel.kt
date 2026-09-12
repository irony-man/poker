package com.pokr.android.feature.snakes

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.toRoute
import com.pokr.android.core.datastore.SessionPreferences
import com.pokr.android.core.model.ChatMessage
import com.pokr.android.core.model.ClientMessage
import com.pokr.android.core.model.ConnectionStatus
import com.pokr.android.core.model.ServerMessage
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

@HiltViewModel
class SnakesViewModel @Inject constructor(
    private val repository: SnakesRepository,
    private val sessionPreferences: SessionPreferences,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val route = savedStateHandle.toRoute<SnakesBoardRoute>()
    private val snakesId: String = route.id
    private val invite: String? = route.invite

    private val _uiState = MutableStateFlow(
        SnakesContract.UiState(
            snakesId = snakesId,
            invite = invite,
            loading = true,
            spectating = route.spectate,
        ),
    )
    val uiState = _uiState.asStateFlow()

    private var observeJob: Job? = null
    private var autoSitSent = false

    init {
        dispatch(SnakesContract.Intent.Connect)
    }

    fun dispatch(intent: SnakesContract.Intent) {
        when (intent) {
            SnakesContract.Intent.Connect -> {
                autoSitSent = false
                connect()
            }
            SnakesContract.Intent.DismissError -> _uiState.update { it.copy(lastError = null) }
            SnakesContract.Intent.ToggleChat -> _uiState.update { it.copy(chatOpen = !it.chatOpen) }
            is SnakesContract.Intent.SendChat -> {
                val text = intent.text.trim()
                if (text.isNotEmpty()) {
                    repository.send(ClientMessage.SnakesChat(snakesId, text.take(280)))
                }
            }
            is SnakesContract.Intent.Sit ->
                repository.send(ClientMessage.SnakesSit(snakesId, intent.seat))
            SnakesContract.Intent.Stand -> {
                val seat = _uiState.value.youSeat ?: return
                repository.send(ClientMessage.SnakesStand(snakesId, seat))
            }
            is SnakesContract.Intent.SetReady ->
                repository.send(ClientMessage.SnakesSetReady(snakesId, intent.ready))
            SnakesContract.Intent.Roll -> {
                val seq = _uiState.value.snakes?.seq ?: return
                repository.send(ClientMessage.SnakesRoll(snakesId, seq))
            }
            is SnakesContract.Intent.AddBot ->
                repository.send(ClientMessage.SnakesAddBot(snakesId, intent.seat))
            is SnakesContract.Intent.RemoveBot ->
                repository.send(ClientMessage.SnakesRemoveBot(snakesId, intent.seat))
            SnakesContract.Intent.Leave -> repository.leave(snakesId)
        }
    }

    private fun connect() {
        observeJob?.cancel()
        observeJob = viewModelScope.launch {
            _uiState.update {
                it.copy(
                    userId = sessionPreferences.getSession()?.userId,
                    connection = ConnectionStatus.Connecting,
                    loading = true,
                )
            }

            launch {
                repository.messages.collect { msg ->
                    when (msg) {
                        is ServerMessage.AuthOk -> {
                            _uiState.update { it.copy(connection = ConnectionStatus.Open) }
                            repository.send(
                                ClientMessage.JoinSnakes(
                                    snakesId = snakesId,
                                    spectate = if (route.spectate) true else null,
                                ),
                            )
                        }
                        is ServerMessage.SnakesStateSync -> {
                            if (msg.snakes.id != snakesId) return@collect
                            _uiState.update { current ->
                                val seated = msg.you.seat != null
                                current.copy(
                                    snakes = msg.snakes,
                                    youSeat = msg.you.seat,
                                    invite = current.invite?.takeIf { it.isNotBlank() }
                                        ?: msg.snakes.inviteCode,
                                    loading = false,
                                    connection = ConnectionStatus.Open,
                                    spectating = if (seated) false else current.spectating,
                                )
                            }
                            maybeAutoSit()
                        }
                        is ServerMessage.SnakesChat -> {
                            if (msg.snakesId != snakesId) return@collect
                            val line = ChatMessage(msg.userId, msg.name, msg.text, msg.at)
                            _uiState.update { it.copy(chat = (it.chat + line).takeLast(80)) }
                        }
                        is ServerMessage.Error -> {
                            _uiState.update { it.copy(lastError = msg.message) }
                        }
                        else -> Unit
                    }
                }
            }

            runCatching { repository.connect(snakesId, spectate = route.spectate) }
                .onSuccess {
                    runCatching { repository.loadChat(snakesId) }
                        .onSuccess { history ->
                            _uiState.update { current ->
                                if (current.chat.isEmpty()) current.copy(chat = history.takeLast(80))
                                else current
                            }
                        }
                }
                .onFailure { err ->
                    _uiState.update {
                        it.copy(
                            loading = false,
                            connection = ConnectionStatus.Closed,
                            lastError = err.message,
                        )
                    }
                }
        }
    }

    private fun maybeAutoSit() {
        val state = _uiState.value
        if (state.spectating || state.userId == null || state.connection != ConnectionStatus.Open) return
        if (state.youSeat != null || autoSitSent) return
        val snakes = state.snakes ?: return
        if (snakes.status != "waiting") return
        val taken = snakes.seats.mapNotNull { if (it.userId != null || it.isBot == true) it.seat else null }.toSet()
        val empty = (0 until snakes.maxSeats).firstOrNull { it !in taken } ?: return
        autoSitSent = true
        repository.send(ClientMessage.SnakesSit(snakesId, empty))
    }

    override fun onCleared() {
        repository.leave(snakesId)
        super.onCleared()
    }
}
