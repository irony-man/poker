package com.felt.android.feature.lobby

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.toRoute
import com.felt.android.core.datastore.SessionPreferences
import com.felt.android.core.model.ClientMessage
import com.felt.android.core.model.ContestView
import com.felt.android.core.model.ServerMessage
import com.felt.android.core.network.FeltApi
import com.felt.android.core.network.PokerWebSocketClient
import com.felt.android.core.network.SessionTokenHolder
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout

data class ContestUiState(
    val contest: ContestView? = null,
    val userId: String? = null,
    val busy: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class ContestViewModel @Inject constructor(
    private val feltApi: FeltApi,
    private val sessionPreferences: SessionPreferences,
    private val tokenHolder: SessionTokenHolder,
    private val wsClient: PokerWebSocketClient,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val contestId = savedStateHandle.toRoute<ContestRoute>().contestId

    private val _uiState = MutableStateFlow(ContestUiState())
    val uiState: StateFlow<ContestUiState> = _uiState.asStateFlow()

    private var messagesJob: Job? = null

    init {
        viewModelScope.launch {
            val session = sessionPreferences.getSession()
            if (session != null) {
                tokenHolder.set(session.sessionToken)
            }
            _uiState.update { it.copy(userId = session?.userId) }

            // One-shot REST seed so UI populates before WS contest_sync.
            runCatching { feltApi.getContest(contestId).contest }
                .onSuccess { c -> _uiState.update { it.copy(contest = c, error = null) } }
                .onFailure { err ->
                    if (_uiState.value.contest == null) {
                        _uiState.update { it.copy(error = err.message ?: "Not found") }
                    }
                }

            if (session != null) {
                connectContest(session.sessionToken)
            }
        }
    }

    private suspend fun connectContest(sessionToken: String) {
        runCatching {
            tokenHolder.set(sessionToken)
            val saved = sessionPreferences.getSession()
                ?: error("Sign in from the lobby first")
            val session = feltApi.refreshTicket().copy(
                sessionToken = saved.sessionToken,
                avatarId = saved.avatarId,
            ).also { sessionPreferences.saveSession(it) }

            messagesJob?.cancel()
            messagesJob = viewModelScope.launch {
                wsClient.messages.collect { msg ->
                    when (msg) {
                        is ServerMessage.ContestSync -> {
                            if (msg.contest.id == contestId) {
                                _uiState.update { it.copy(contest = msg.contest, error = null) }
                            }
                        }
                        is ServerMessage.ContestEvent -> {
                            if (msg.contestId != contestId) return@collect
                            // UI re-navigates via assignment in ContestScreen; refresh body via sync.
                        }
                        is ServerMessage.Error -> {
                            _uiState.update { it.copy(error = msg.message) }
                        }
                        else -> Unit
                    }
                }
            }

            wsClient.connect()
            wsClient.send(ClientMessage.Auth(session.ticket))
            withTimeout(15_000) {
                wsClient.messages.first { it is ServerMessage.AuthOk }
            }
            wsClient.send(ClientMessage.JoinContest(contestId))
        }.onFailure { err ->
            _uiState.update {
                it.copy(error = err.message ?: "Could not connect for live updates")
            }
        }
    }

    fun register() {
        if (_uiState.value.userId == null) return
        viewModelScope.launch {
            _uiState.update { it.copy(busy = true, error = null) }
            runCatching { feltApi.registerContest(contestId).contest }
                .onSuccess { c -> _uiState.update { it.copy(busy = false, contest = c) } }
                .onFailure { err ->
                    _uiState.update { it.copy(busy = false, error = err.message ?: "Failed") }
                }
        }
    }

    fun unregister() {
        if (_uiState.value.userId == null) return
        viewModelScope.launch {
            _uiState.update { it.copy(busy = true, error = null) }
            runCatching { feltApi.unregisterContest(contestId).contest }
                .onSuccess { c -> _uiState.update { it.copy(busy = false, contest = c) } }
                .onFailure { err ->
                    _uiState.update { it.copy(busy = false, error = err.message ?: "Failed") }
                }
        }
    }

    fun start() {
        if (_uiState.value.userId == null) return
        viewModelScope.launch {
            _uiState.update { it.copy(busy = true, error = null) }
            runCatching { feltApi.startContest(contestId).contest }
                .onSuccess { c -> _uiState.update { it.copy(busy = false, contest = c) } }
                .onFailure { err ->
                    _uiState.update { it.copy(busy = false, error = err.message ?: "Failed") }
                }
        }
    }

    fun assignedTableId(): String? {
        val state = _uiState.value
        val userId = state.userId ?: return null
        return state.contest?.assignments?.find { it.userId == userId }?.tableId
    }

    override fun onCleared() {
        messagesJob?.cancel()
        runCatching {
            wsClient.send(ClientMessage.LeaveContest(contestId))
        }
        wsClient.disconnect(reconnect = false)
        super.onCleared()
    }
}
