package com.pokr.android.feature.lobby

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pokr.android.core.datastore.SessionPreferences
import com.pokr.android.core.model.ChallengeFriendBody
import com.pokr.android.core.model.CreateFriendGroupBody
import com.pokr.android.core.model.FriendGroupView
import com.pokr.android.core.model.FriendProfile
import com.pokr.android.core.model.FriendRequestBody
import com.pokr.android.core.model.FriendSearchUser
import com.pokr.android.core.model.InviteFriendGroupBody
import com.pokr.android.core.model.PendingChallenge
import com.pokr.android.core.model.PendingRequestView
import com.pokr.android.core.model.UpdateFriendGroupBody
import com.pokr.android.core.network.PokrApi
import com.pokr.android.core.network.SocialJoinTarget
import com.pokr.android.core.network.SocialRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class FriendsUiState(
    val query: String = "",
    val pane: String = "friends",
    val friends: List<FriendProfile> = emptyList(),
    val incoming: List<PendingRequestView> = emptyList(),
    val pendingChallenges: List<PendingChallenge> = emptyList(),
    val groups: List<FriendGroupView> = emptyList(),
    val results: List<FriendSearchUser> = emptyList(),
    val loading: Boolean = true,
    val searching: Boolean = false,
    val userId: String? = null,
    val showCreateGroup: Boolean = false,
    val newGroupName: String = "",
    val createMemberIds: List<String> = emptyList(),
    val editingGroupId: String? = null,
    val editMemberIds: List<String> = emptyList(),
    val confirmDeleteId: String? = null,
    val busyKey: String? = null,
    val error: String? = null,
)

@HiltViewModel
class FriendsViewModel @Inject constructor(
    private val api: PokrApi,
    private val sessionPreferences: SessionPreferences,
    private val social: SocialRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(FriendsUiState())
    val uiState: StateFlow<FriendsUiState> = _uiState.asStateFlow()
    private var searchJob: Job? = null

    init {
        viewModelScope.launch {
            _uiState.update { it.copy(userId = sessionPreferences.getSession()?.userId) }
        }
        viewModelScope.launch {
            social.snapshot.collect { snap ->
                _uiState.update {
                    it.copy(
                        friends = snap.friends,
                        incoming = snap.incoming,
                        pendingChallenges = snap.pendingChallenges,
                        groups = snap.groups,
                        loading = !social.loaded.value,
                    )
                }
            }
        }
        refresh()
    }

    fun onQueryChange(value: String) {
        _uiState.update { it.copy(query = value.take(32)) }
        searchJob?.cancel()
        val q = value.trim()
        if (q.length < 2) {
            _uiState.update { it.copy(results = emptyList(), searching = false) }
            return
        }
        searchJob = viewModelScope.launch {
            delay(280)
            _uiState.update { it.copy(searching = true) }
            runCatching { api.searchFriends(q).users }
                .onSuccess { users ->
                    _uiState.update { it.copy(results = users, searching = false) }
                }
                .onFailure { err ->
                    _uiState.update {
                        it.copy(searching = false, error = err.message ?: "Search failed")
                    }
                }
        }
    }

    fun onPaneChange(pane: String) = _uiState.update { it.copy(pane = pane) }

    fun refresh() {
        viewModelScope.launch {
            _uiState.update { it.copy(error = null) }
            runCatching { social.refresh() }
                .onFailure { err ->
                    _uiState.update {
                        it.copy(loading = false, error = err.message ?: "Couldn't load friends")
                    }
                }
        }
    }

    fun sendRequest(userId: String) {
        viewModelScope.launch {
            runCatching { api.sendFriendRequest(FriendRequestBody(userId)) }
                .onSuccess {
                    _uiState.update { it.copy(query = "", results = emptyList()) }
                    refresh()
                }
                .onFailure { err ->
                    _uiState.update { it.copy(error = err.message ?: "Request failed") }
                }
        }
    }

    fun respond(requestId: String, accept: Boolean) {
        viewModelScope.launch {
            runCatching { social.respondRequest(requestId, accept) }
                .onFailure { err ->
                    _uiState.update { it.copy(error = err.message ?: "Couldn't respond") }
                }
        }
    }

    fun challenge(
        friendUserId: String,
        onOpened: (tableId: String, invite: String) -> Unit,
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(busyKey = "challenge-$friendUserId", error = null) }
            runCatching { api.challengeFriend(ChallengeFriendBody(friendUserId)) }
                .onSuccess { result ->
                    _uiState.update { it.copy(busyKey = null) }
                    onOpened(result.tableId, result.inviteCode)
                }
                .onFailure { err ->
                    _uiState.update {
                        it.copy(busyKey = null, error = err.message ?: "Challenge failed")
                    }
                }
        }
    }

    fun joinChallenge(
        challenge: PendingChallenge,
        onTable: (tableId: String, invite: String) -> Unit,
        onContest: (contestId: String) -> Unit,
        onLudo: (ludoId: String, invite: String) -> Unit = { _, _ -> },
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(busyKey = "join-${challenge.id}", error = null) }
            runCatching { social.joinChallenge(challenge) }
            .onSuccess { nav ->
                _uiState.update { it.copy(busyKey = null) }
                when (nav) {
                    is SocialJoinTarget.Table -> onTable(nav.tableId, nav.invite)
                    is SocialJoinTarget.Contest -> onContest(nav.contestId)
                    is SocialJoinTarget.Ludo -> onLudo(nav.ludoId, nav.invite)
                }
            }.onFailure { err ->
                _uiState.update {
                    it.copy(busyKey = null, error = err.message ?: "Failed to join challenge")
                }
            }
        }
    }

    fun declineChallenge(challengeId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(busyKey = "decline-$challengeId", error = null) }
            runCatching { social.declineChallenge(challengeId) }
                .onSuccess { _uiState.update { it.copy(busyKey = null) } }
                .onFailure { err ->
                    _uiState.update {
                        it.copy(busyKey = null, error = err.message ?: "Couldn't decline")
                    }
                }
        }
    }

    fun toggleCreateGroup() = _uiState.update {
        it.copy(
            showCreateGroup = !it.showCreateGroup,
            newGroupName = "",
            createMemberIds = emptyList(),
            editingGroupId = null,
            confirmDeleteId = null,
        )
    }

    fun onNewGroupName(value: String) = _uiState.update { it.copy(newGroupName = value.take(40)) }

    fun toggleCreateMember(userId: String) = _uiState.update { state ->
        val next = state.createMemberIds.toMutableList()
        if (userId in next) next.remove(userId) else if (next.size < 8) next.add(userId)
        state.copy(createMemberIds = next)
    }

    fun createGroup() {
        val name = _uiState.value.newGroupName.trim()
        if (name.isEmpty()) return
        viewModelScope.launch {
            _uiState.update { it.copy(busyKey = "create-group", error = null) }
            runCatching {
                api.createFriendGroup(CreateFriendGroupBody(name, _uiState.value.createMemberIds))
            }.onSuccess {
                _uiState.update {
                    it.copy(
                        busyKey = null,
                        showCreateGroup = false,
                        newGroupName = "",
                        createMemberIds = emptyList(),
                    )
                }
                refresh()
            }.onFailure { err ->
                _uiState.update { it.copy(busyKey = null, error = err.message ?: "Couldn't create group") }
            }
        }
    }

    fun openManage(group: FriendGroupView) {
        val ids = group.members
            .filter { it.userId != group.ownerUserId }
            .map { it.userId }
        _uiState.update {
            it.copy(
                editingGroupId = group.id,
                editMemberIds = ids,
                showCreateGroup = false,
                confirmDeleteId = null,
            )
        }
    }

    fun closeEditor() = _uiState.update { it.copy(editingGroupId = null, editMemberIds = emptyList()) }

    fun toggleEditMember(userId: String) = _uiState.update { state ->
        val next = state.editMemberIds.toMutableList()
        if (userId in next) next.remove(userId) else if (next.size < 8) next.add(userId)
        state.copy(editMemberIds = next)
    }

    fun saveMembers(groupId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(busyKey = "edit-$groupId", error = null) }
            runCatching {
                api.updateFriendGroup(groupId, UpdateFriendGroupBody(_uiState.value.editMemberIds))
            }.onSuccess {
                _uiState.update { it.copy(busyKey = null, editingGroupId = null, editMemberIds = emptyList()) }
                refresh()
            }.onFailure { err ->
                _uiState.update { it.copy(busyKey = null, error = err.message ?: "Couldn't save group") }
            }
        }
    }

    fun confirmDelete(groupId: String) = _uiState.update { it.copy(confirmDeleteId = groupId) }
    fun cancelDelete() = _uiState.update { it.copy(confirmDeleteId = null) }

    fun deleteGroup(groupId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(busyKey = "delete-$groupId", error = null) }
            runCatching { api.deleteFriendGroup(groupId) }
                .onSuccess {
                    _uiState.update { it.copy(busyKey = null, confirmDeleteId = null) }
                    refresh()
                }
                .onFailure { err ->
                    _uiState.update { it.copy(busyKey = null, error = err.message ?: "Couldn't delete group") }
                }
        }
    }

    fun inviteGroup(
        groupId: String,
        onOpened: (tableId: String, invite: String) -> Unit,
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(busyKey = "invite-$groupId", error = null) }
            runCatching { api.inviteFriendGroup(groupId, InviteFriendGroupBody()) }
                .onSuccess { result ->
                    _uiState.update { it.copy(busyKey = null) }
                    onOpened(result.tableId, result.inviteCode)
                }
                .onFailure { err ->
                    _uiState.update { it.copy(busyKey = null, error = err.message ?: "Invite failed") }
                }
        }
    }
}
