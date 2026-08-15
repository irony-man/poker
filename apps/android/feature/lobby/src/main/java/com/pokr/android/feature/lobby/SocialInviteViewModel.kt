package com.pokr.android.feature.lobby

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pokr.android.core.model.PendingChallenge
import com.pokr.android.core.model.PendingRequestView
import com.pokr.android.core.network.SocialJoinTarget
import com.pokr.android.core.network.SocialRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class SocialInviteUiState(
    val challenge: PendingChallenge? = null,
    val request: PendingRequestView? = null,
    val extraCount: Int = 0,
    val pendingCount: Int = 0,
    val busyKey: String? = null,
    val error: String? = null,
)

@HiltViewModel
class SocialInviteViewModel @Inject constructor(
    private val social: SocialRepository,
) : ViewModel() {

    private val _busy = MutableStateFlow<SocialInviteUiState>(SocialInviteUiState())
    val actionState: StateFlow<SocialInviteUiState> = _busy.asStateFlow()

    val uiState: StateFlow<SocialInviteUiState> = social.snapshot
        .map { snap ->
            val incoming = snap.incoming.sortedByDescending { it.createdAt }
            val challenges = snap.pendingChallenges.sortedByDescending { it.createdAt }
            val request = incoming.firstOrNull()
            val challenge = challenges.firstOrNull()
            val visible = (if (request != null) 1 else 0) + (if (challenge != null) 1 else 0)
            val pending = incoming.size + challenges.size
            val actions = _busy.value
            SocialInviteUiState(
                challenge = challenge,
                request = request,
                extraCount = (pending - visible).coerceAtLeast(0),
                pendingCount = pending,
                busyKey = actions.busyKey,
                error = actions.error,
            )
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), SocialInviteUiState())

    fun requestOpenFriends() = social.requestOpenFriends()

    fun respond(requestId: String, accept: Boolean) {
        viewModelScope.launch {
            _busy.update { it.copy(busyKey = requestId, error = null) }
            runCatching { social.respondRequest(requestId, accept) }
                .onSuccess { _busy.update { it.copy(busyKey = null) } }
                .onFailure { err ->
                    _busy.update { it.copy(busyKey = null, error = err.message ?: "Couldn't respond") }
                }
        }
    }

    fun declineChallenge(challengeId: String) {
        viewModelScope.launch {
            _busy.update { it.copy(busyKey = "decline-$challengeId", error = null) }
            runCatching { social.declineChallenge(challengeId) }
                .onSuccess { _busy.update { it.copy(busyKey = null) } }
                .onFailure { err ->
                    _busy.update { it.copy(busyKey = null, error = err.message ?: "Couldn't decline") }
                }
        }
    }

    fun joinChallenge(
        challenge: PendingChallenge,
        onTable: (tableId: String, invite: String) -> Unit,
        onContest: (contestId: String) -> Unit,
    ) {
        viewModelScope.launch {
            _busy.update { it.copy(busyKey = "join-${challenge.id}", error = null) }
            runCatching { social.joinChallenge(challenge) }
                .onSuccess { target ->
                    _busy.update { it.copy(busyKey = null) }
                    when (target) {
                        is SocialJoinTarget.Table -> onTable(target.tableId, target.invite)
                        is SocialJoinTarget.Contest -> onContest(target.contestId)
                    }
                }
                .onFailure { err ->
                    _busy.update {
                        it.copy(busyKey = null, error = err.message ?: "Failed to join")
                    }
                }
        }
    }
}
