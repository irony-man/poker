package com.pokr.android.feature.courtpiece

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
class CourtpieceViewModel @Inject constructor(
    private val repository: CourtpieceRepository,
    private val sessionPreferences: SessionPreferences,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val route = savedStateHandle.toRoute<CourtpieceBoardRoute>()
    private val courtpieceId: String = route.id
    private val invite: String? = route.invite

    private val _uiState = MutableStateFlow(
        CourtpieceContract.UiState(
            courtpieceId = courtpieceId,
            invite = invite,
            loading = true,
            spectating = route.spectate,
        ),
    )
    val uiState = _uiState.asStateFlow()

    private var observeJob: Job? = null
    private var autoSitSent = false

    init {
        dispatch(CourtpieceContract.Intent.Connect)
    }

    fun dispatch(intent: CourtpieceContract.Intent) {
        when (intent) {
            CourtpieceContract.Intent.Connect -> {
                autoSitSent = false
                connect()
            }
            CourtpieceContract.Intent.DismissError -> _uiState.update { it.copy(lastError = null) }
            CourtpieceContract.Intent.ToggleChat -> _uiState.update { it.copy(chatOpen = !it.chatOpen) }
            is CourtpieceContract.Intent.SendChat -> {
                val text = intent.text.trim()
                if (text.isNotEmpty()) {
                    repository.send(ClientMessage.CourtpieceChat(courtpieceId, text.take(280)))
                }
            }
            is CourtpieceContract.Intent.Sit ->
                repository.send(ClientMessage.CourtpieceSit(courtpieceId, intent.seat))
            CourtpieceContract.Intent.Stand -> {
                val seat = _uiState.value.you.seat ?: return
                repository.send(ClientMessage.CourtpieceStand(courtpieceId, seat))
            }
            is CourtpieceContract.Intent.SetReady ->
                repository.send(ClientMessage.CourtpieceSetReady(courtpieceId, intent.ready))
            is CourtpieceContract.Intent.SetTrump -> {
                val seq = _uiState.value.board?.seq ?: return
                repository.send(ClientMessage.CourtpieceSetTrump(courtpieceId, intent.suit, seq))
            }
            is CourtpieceContract.Intent.PlayCard -> {
                val seq = _uiState.value.board?.seq ?: return
                repository.send(ClientMessage.CourtpiecePlay(courtpieceId, intent.card, seq))
            }
            is CourtpieceContract.Intent.AddBot ->
                repository.send(ClientMessage.CourtpieceAddBot(courtpieceId, intent.seat))
            is CourtpieceContract.Intent.RemoveBot ->
                repository.send(ClientMessage.CourtpieceRemoveBot(courtpieceId, intent.seat))
            CourtpieceContract.Intent.Leave -> repository.leave(courtpieceId)
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
                                ClientMessage.JoinCourtpiece(
                                    courtpieceId = courtpieceId,
                                    spectate = if (route.spectate) true else null,
                                ),
                            )
                        }
                        is ServerMessage.CourtpieceStateSync -> {
                            if (msg.courtpiece.id != courtpieceId) return@collect
                            _uiState.update { current ->
                                val seated = msg.you.seat != null
                                current.copy(
                                    board = msg.courtpiece,
                                    you = msg.you,
                                    invite = current.invite?.takeIf { it.isNotBlank() }
                                        ?: msg.courtpiece.inviteCode,
                                    loading = false,
                                    connection = ConnectionStatus.Open,
                                    spectating = if (seated) false else current.spectating,
                                )
                            }
                            maybeAutoSit()
                        }
                        is ServerMessage.CourtpieceChat -> {
                            if (msg.courtpieceId != courtpieceId) return@collect
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

            runCatching { repository.connect(courtpieceId, spectate = route.spectate) }
                .onSuccess {
                    runCatching { repository.loadChat(courtpieceId) }
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
        if (state.you.seat != null || autoSitSent) return
        val board = state.board ?: return
        if (board.status != "waiting") return
        val taken = board.seats.mapNotNull { if (it.userId != null || it.isBot == true) it.seat else null }.toSet()
        val empty = (0 until 4).firstOrNull { it !in taken } ?: return
        autoSitSent = true
        repository.send(ClientMessage.CourtpieceSit(courtpieceId, empty))
    }

    override fun onCleared() {
        repository.leave(courtpieceId)
        super.onCleared()
    }
}
