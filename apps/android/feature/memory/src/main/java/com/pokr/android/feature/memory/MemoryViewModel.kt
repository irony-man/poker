package com.pokr.android.feature.memory

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
class MemoryViewModel @Inject constructor(
    private val repository: MemoryRepository,
    private val sessionPreferences: SessionPreferences,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val route = savedStateHandle.toRoute<MemoryBoardRoute>()
    private val memoryId: String = route.id
    private val invite: String? = route.invite

    private val _uiState = MutableStateFlow(
        MemoryContract.UiState(
            memoryId = memoryId,
            invite = invite,
            loading = true,
            spectating = route.spectate,
        ),
    )
    val uiState = _uiState.asStateFlow()

    private var observeJob: Job? = null
    private var autoSitSent = false

    init {
        dispatch(MemoryContract.Intent.Connect)
    }

    fun dispatch(intent: MemoryContract.Intent) {
        when (intent) {
            MemoryContract.Intent.Connect -> {
                autoSitSent = false
                connect()
            }
            MemoryContract.Intent.DismissError -> _uiState.update { it.copy(lastError = null) }
            MemoryContract.Intent.ToggleChat -> _uiState.update { it.copy(chatOpen = !it.chatOpen) }
            is MemoryContract.Intent.SendChat -> {
                val text = intent.text.trim()
                if (text.isNotEmpty()) {
                    repository.send(ClientMessage.MemoryChat(memoryId, text.take(280)))
                }
            }
            is MemoryContract.Intent.Sit ->
                repository.send(ClientMessage.MemorySit(memoryId, intent.seat))
            MemoryContract.Intent.Stand -> {
                val seat = _uiState.value.youSeat ?: return
                repository.send(ClientMessage.MemoryStand(memoryId, seat))
            }
            is MemoryContract.Intent.SetReady ->
                repository.send(ClientMessage.MemorySetReady(memoryId, intent.ready))
            is MemoryContract.Intent.Flip -> {
                val seq = _uiState.value.memory?.seq ?: return
                repository.send(ClientMessage.MemoryFlip(memoryId, intent.index, seq))
            }
            is MemoryContract.Intent.AddBot ->
                repository.send(ClientMessage.MemoryAddBot(memoryId, intent.seat))
            is MemoryContract.Intent.RemoveBot ->
                repository.send(ClientMessage.MemoryRemoveBot(memoryId, intent.seat))
            MemoryContract.Intent.Leave -> repository.leave(memoryId)
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
                                ClientMessage.JoinMemory(
                                    memoryId = memoryId,
                                    spectate = if (route.spectate) true else null,
                                ),
                            )
                        }
                        is ServerMessage.MemoryStateSync -> {
                            if (msg.memory.id != memoryId) return@collect
                            _uiState.update { current ->
                                val seated = msg.you.seat != null
                                current.copy(
                                    memory = msg.memory,
                                    youSeat = msg.you.seat,
                                    invite = current.invite?.takeIf { it.isNotBlank() }
                                        ?: msg.memory.inviteCode,
                                    loading = false,
                                    connection = ConnectionStatus.Open,
                                    spectating = if (seated) false else current.spectating,
                                )
                            }
                            maybeAutoSit()
                        }
                        is ServerMessage.MemoryChat -> {
                            if (msg.memoryId != memoryId) return@collect
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

            runCatching { repository.connect(memoryId, spectate = route.spectate) }
                .onSuccess {
                    runCatching { repository.loadChat(memoryId) }
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
        val memory = state.memory ?: return
        if (memory.status != "waiting") return
        val taken = memory.seats.mapNotNull { if (it.userId != null || it.isBot == true) it.seat else null }.toSet()
        val empty = (0 until memory.maxSeats).firstOrNull { it !in taken } ?: return
        autoSitSent = true
        repository.send(ClientMessage.MemorySit(memoryId, empty))
    }

    override fun onCleared() {
        repository.leave(memoryId)
        super.onCleared()
    }
}
