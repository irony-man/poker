package com.pokr.android.feature.lobby

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.toRoute
import com.pokr.android.core.datastore.SessionPreferences
import com.pokr.android.core.model.ClientMessage
import com.pokr.android.core.model.ContestView
import com.pokr.android.core.model.FriendGroupView
import com.pokr.android.core.model.FriendProfile
import com.pokr.android.core.model.InviteFriendsBody
import com.pokr.android.core.model.ServerMessage
import com.pokr.android.core.network.PokrApi
import com.pokr.android.core.network.PokerWebSocketClient
import com.pokr.android.core.network.SessionTokenHolder
import com.pokr.android.core.network.SocialRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class ContestUiState(
    val contest: ContestView? = null,
    val userId: String? = null,
    val friends: List<FriendProfile> = emptyList(),
    val groups: List<FriendGroupView> = emptyList(),
    val inviteFriendIds: List<String> = emptyList(),
    val busy: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class ContestViewModel @Inject constructor(
    private val api: PokrApi,
    private val sessionPreferences: SessionPreferences,
    private val tokenHolder: SessionTokenHolder,
    private val wsClient: PokerWebSocketClient,
    private val social: SocialRepository,
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
            runCatching { api.getContest(contestId).contest }
                .onSuccess { c -> _uiState.update { it.copy(contest = c, error = null) } }
                .onFailure { err ->
                    if (_uiState.value.contest == null) {
                        _uiState.update { it.copy(error = err.message ?: "Not found") }
                    }
                }

            if (session != null) {
                runCatching { social.refresh() }
                _uiState.update {
                    it.copy(
                        friends = social.snapshot.value.friends,
                        groups = social.snapshot.value.groups,
                    )
                }
                connectContest()
            }
        }
    }

    private suspend fun connectContest() {
        runCatching {
            messagesJob?.cancel()
            messagesJob = viewModelScope.launch {
                wsClient.messages.collect { msg ->
                    when (msg) {
                        is ServerMessage.AuthOk -> {
                            wsClient.send(ClientMessage.JoinContest(contestId))
                        }
                        is ServerMessage.ContestSync -> {
                            if (msg.contest.id == contestId) {
                                _uiState.update { it.copy(contest = msg.contest, error = null) }
                            }
                        }
                        is ServerMessage.SocialSync -> {
                            _uiState.update {
                                it.copy(friends = msg.friends, groups = msg.groups)
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

            social.awaitAuthenticated()
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
            runCatching { api.registerContest(contestId).contest }
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
            runCatching { api.unregisterContest(contestId).contest }
                .onSuccess { c -> _uiState.update { it.copy(busy = false, contest = c) } }
                .onFailure { err ->
                    _uiState.update { it.copy(busy = false, error = err.message ?: "Failed") }
                }
        }
    }

    fun onInviteFriendsChange(ids: List<String>) =
        _uiState.update { it.copy(inviteFriendIds = ids.take(8)) }

    fun sendInvites() {
        val ids = _uiState.value.inviteFriendIds
        if (ids.isEmpty()) return
        viewModelScope.launch {
            _uiState.update { it.copy(busy = true, error = null) }
            runCatching { api.inviteContestFriends(contestId, InviteFriendsBody(ids)) }
                .onSuccess { result ->
                    _uiState.update {
                        it.copy(
                            busy = false,
                            inviteFriendIds = emptyList(),
                            contest = result.contest ?: it.contest,
                        )
                    }
                }
                .onFailure { err ->
                    _uiState.update { it.copy(busy = false, error = err.message ?: "Invite failed") }
                }
        }
    }

    fun start() {
        if (_uiState.value.userId == null) return
        viewModelScope.launch {
            _uiState.update { it.copy(busy = true, error = null) }
            runCatching { api.startContest(contestId).contest }
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
        super.onCleared()
    }
}
