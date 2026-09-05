package com.pokr.android.feature.ludo

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
class LudoViewModel @Inject constructor(
    private val repository: LudoRepository,
    private val sessionPreferences: SessionPreferences,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val route = savedStateHandle.toRoute<LudoBoardRoute>()
    private val ludoId: String = route.id
    private val invite: String? = route.invite

    private val _uiState = MutableStateFlow(
        LudoContract.UiState(
            ludoId = ludoId,
            invite = invite,
            loading = true,
            spectating = route.spectate,
        ),
    )
    val uiState = _uiState.asStateFlow()

    private var observeJob: Job? = null
    private var autoSitSent = false

    init {
        dispatch(LudoContract.Intent.Connect)
    }

    fun dispatch(intent: LudoContract.Intent) {
        when (intent) {
            LudoContract.Intent.Connect -> {
                autoSitSent = false
                connect()
            }
            LudoContract.Intent.DismissError -> _uiState.update { it.copy(lastError = null) }
            LudoContract.Intent.ToggleChat -> _uiState.update { it.copy(chatOpen = !it.chatOpen) }
            is LudoContract.Intent.SendChat -> {
                val text = intent.text.trim()
                if (text.isNotEmpty()) {
                    repository.send(ClientMessage.LudoChat(ludoId, text.take(280)))
                }
            }
            is LudoContract.Intent.Sit ->
                repository.send(ClientMessage.LudoSit(ludoId, intent.seat))
            LudoContract.Intent.Stand -> {
                val seat = _uiState.value.youSeat ?: return
                repository.send(ClientMessage.LudoStand(ludoId, seat))
            }
            is LudoContract.Intent.SetReady ->
                repository.send(ClientMessage.LudoSetReady(ludoId, intent.ready))
            LudoContract.Intent.Roll -> {
                val seq = _uiState.value.ludo?.seq ?: return
                repository.send(ClientMessage.LudoRoll(ludoId, seq))
            }
            is LudoContract.Intent.Move -> {
                val seq = _uiState.value.ludo?.seq ?: return
                repository.send(ClientMessage.LudoMove(ludoId, intent.tokenIndex, seq))
            }
            is LudoContract.Intent.AddBot ->
                repository.send(ClientMessage.LudoAddBot(ludoId, intent.seat))
            is LudoContract.Intent.RemoveBot ->
                repository.send(ClientMessage.LudoRemoveBot(ludoId, intent.seat))
            LudoContract.Intent.Leave -> repository.leave(ludoId)
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
                                ClientMessage.JoinLudo(
                                    ludoId = ludoId,
                                    spectate = if (route.spectate) true else null,
                                ),
                            )
                        }
                        is ServerMessage.LudoStateSync -> {
                            if (msg.ludo.id != ludoId) return@collect
                            _uiState.update { current ->
                                val seated = msg.you.seat != null
                                current.copy(
                                    ludo = msg.ludo,
                                    youSeat = msg.you.seat,
                                    legalMoves = msg.legalMoves.orEmpty(),
                                    invite = current.invite?.takeIf { it.isNotBlank() }
                                        ?: msg.ludo.inviteCode,
                                    loading = false,
                                    connection = ConnectionStatus.Open,
                                    spectating = if (seated) false else current.spectating,
                                )
                            }
                            maybeAutoSit()
                        }
                        is ServerMessage.LudoChat -> {
                            if (msg.ludoId != ludoId) return@collect
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

            runCatching { repository.connect(ludoId, spectate = route.spectate) }
                .onSuccess {
                    runCatching { repository.loadChat(ludoId) }
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
        val ludo = state.ludo ?: return
        if (ludo.status != "waiting") return
        val taken = ludo.seats.mapNotNull { if (it.userId != null || it.isBot == true) it.seat else null }.toSet()
        val empty = (0 until ludo.maxSeats).firstOrNull { it !in taken } ?: return
        autoSitSent = true
        repository.send(ClientMessage.LudoSit(ludoId, empty))
    }

    override fun onCleared() {
        repository.leave(ludoId)
        super.onCleared()
    }
}
