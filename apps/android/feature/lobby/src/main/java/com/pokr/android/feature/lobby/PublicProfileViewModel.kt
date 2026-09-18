package com.pokr.android.feature.lobby

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.toRoute
import com.pokr.android.core.datastore.SessionPreferences
import com.pokr.android.core.model.ChallengeFriendBody
import com.pokr.android.core.model.FriendRequestBody
import com.pokr.android.core.model.FriendRespondBody
import com.pokr.android.core.model.PlayedHandLevel
import com.pokr.android.core.model.PublicProfile
import com.pokr.android.core.model.parsePlayedHand
import com.pokr.android.core.network.PokrApi
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class PublicProfileUiState(
    val username: String = "",
    val profile: PublicProfile? = null,
    val hands: List<PlayedHandLevel> = emptyList(),
    val loading: Boolean = true,
    val error: String? = null,
    val busy: Boolean = false,
    val self: Boolean = false,
    val openedTable: Pair<String, String>? = null,
)

@HiltViewModel
class PublicProfileViewModel @Inject constructor(
    private val api: PokrApi,
    private val sessionPreferences: SessionPreferences,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {
    private val route = savedStateHandle.toRoute<PublicProfileRoute>()

    private val _uiState = MutableStateFlow(PublicProfileUiState(username = route.username))
    val uiState = _uiState.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.update { it.copy(loading = true, error = null) }
            val meId = sessionPreferences.getSession()?.userId
            runCatching { api.getPublicProfile(route.username) }
                .onSuccess { profile ->
                    val self = profile.id == meId || profile.relationship == "self"
                    _uiState.update { it.copy(profile = profile, self = self, loading = false) }
                    if (!self) {
                        runCatching { api.getHandsTogether(route.username) }
                            .onSuccess { page ->
                                _uiState.update { state ->
                                    state.copy(
                                        hands = page.hands.map { row ->
                                            parsePlayedHand(row, meId.orEmpty())
                                        },
                                    )
                                }
                            }
                    }
                }
                .onFailure { err ->
                    _uiState.update {
                        it.copy(loading = false, error = err.message ?: "Couldn't load profile")
                    }
                }
        }
    }

    fun challenge() {
        val id = _uiState.value.profile?.id ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(busy = true, error = null) }
            runCatching { api.challengeFriend(ChallengeFriendBody(id)) }
                .onSuccess { result ->
                    _uiState.update {
                        it.copy(busy = false, openedTable = result.tableId to result.inviteCode)
                    }
                }
                .onFailure { err ->
                    _uiState.update { it.copy(busy = false, error = err.message ?: "Challenge failed") }
                }
        }
    }

    fun addFriend() {
        val id = _uiState.value.profile?.id ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(busy = true, error = null) }
            runCatching { api.sendFriendRequest(FriendRequestBody(id)) }
                .onSuccess { refresh() }
                .onFailure { err ->
                    _uiState.update { it.copy(busy = false, error = err.message ?: "Request failed") }
                }
        }
    }

    fun respondIncoming(accept: Boolean) {
        val requestId = _uiState.value.profile?.incomingRequestId ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(busy = true, error = null) }
            runCatching { api.respondFriendRequest(requestId, FriendRespondBody(accept)) }
                .onSuccess { refresh() }
                .onFailure { err ->
                    _uiState.update { it.copy(busy = false, error = err.message ?: "Couldn't respond") }
                }
        }
    }
}
