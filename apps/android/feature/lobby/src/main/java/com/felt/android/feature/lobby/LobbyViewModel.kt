package com.felt.android.feature.lobby

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.felt.android.core.datastore.SessionPreferences
import com.felt.android.core.model.CreateTableRequest
import com.felt.android.core.model.RegisterRequest
import com.felt.android.core.model.SessionDto
import com.felt.android.core.network.AuthTokenProvider
import com.felt.android.core.network.FeltApi
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class LobbyUiState(
    val name: String = "",
    val avatarId: Int = 0,
    val maxSeats: Int = 6,
    val botCount: Int = 2,
    val inviteCode: String = "",
    val offlineSeats: Int = 6,
    val busy: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class LobbyViewModel @Inject constructor(
    private val feltApi: FeltApi,
    private val sessionPreferences: SessionPreferences,
    private val authTokenProvider: AuthTokenProvider,
) : ViewModel() {

    private val _uiState = MutableStateFlow(LobbyUiState())
    val uiState: StateFlow<LobbyUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            sessionPreferences.getSession()?.let { saved ->
                _uiState.update {
                    it.copy(name = saved.name, avatarId = saved.avatarId)
                }
            } ?: run {
                val avatar = sessionPreferences.getAvatarId()
                _uiState.update { it.copy(avatarId = avatar) }
            }
        }
    }

    fun onNameChange(value: String) = _uiState.update { it.copy(name = value) }
    fun onAvatarChange(value: Int) {
        _uiState.update { it.copy(avatarId = value.coerceIn(0, 7)) }
        viewModelScope.launch { sessionPreferences.saveAvatarId(value) }
    }
    fun onMaxSeatsChange(value: Int) = _uiState.update { it.copy(maxSeats = value) }
    fun onBotCountChange(value: Int) = _uiState.update { it.copy(botCount = value) }
    fun onInviteChange(value: String) = _uiState.update { it.copy(inviteCode = value) }
    fun onOfflineSeatsChange(value: Int) = _uiState.update { it.copy(offlineSeats = value) }
    fun clearError() = _uiState.update { it.copy(error = null) }

    fun prefillNameIfBlank(displayName: String) {
        if (displayName.isBlank()) return
        _uiState.update { state ->
            if (state.name.isBlank()) state.copy(name = displayName) else state
        }
    }

    fun host(onSuccess: (tableId: String, invite: String) -> Unit) {
        val state = _uiState.value
        viewModelScope.launch {
            _uiState.update { it.copy(busy = true, error = null) }
            runCatching {
                val session = ensureSession(state.name.trim().ifBlank { "Player" })
                val auth = requireAuthHeader()
                val table = feltApi.createTable(
                    CreateTableRequest(
                        userId = session.userId,
                        name = "${session.name}'s Table",
                        maxSeats = state.maxSeats,
                        botCount = state.botCount.coerceAtMost(state.maxSeats - 1),
                        isPrivate = true,
                    ),
                    authorization = auth,
                )
                table.tableId to table.inviteCode
            }.onSuccess { (tableId, invite) ->
                _uiState.update { it.copy(busy = false) }
                onSuccess(tableId, invite)
            }.onFailure { err ->
                _uiState.update { it.copy(busy = false, error = err.message ?: "Host failed") }
            }
        }
    }

    fun join(onSuccess: (tableId: String, invite: String) -> Unit) {
        val state = _uiState.value
        viewModelScope.launch {
            _uiState.update { it.copy(busy = true, error = null) }
            runCatching {
                ensureSession(state.name.trim().ifBlank { "Player" })
                val resolved = feltApi.resolveInvite(state.inviteCode.trim())
                resolved.tableId to resolved.inviteCode
            }.onSuccess { (tableId, invite) ->
                _uiState.update { it.copy(busy = false) }
                onSuccess(tableId, invite)
            }.onFailure { err ->
                _uiState.update { it.copy(busy = false, error = err.message ?: "Join failed") }
            }
        }
    }

    fun offline(onNavigate: (seats: Int, bots: Int, name: String) -> Unit) {
        val state = _uiState.value
        val bots = (state.offlineSeats - 1).coerceAtLeast(1)
        onNavigate(
            state.offlineSeats,
            bots,
            state.name.trim().ifBlank { "Player" },
        )
    }

    private suspend fun ensureSession(displayName: String): SessionDto {
        val auth = requireAuthHeader()
        val avatarId = _uiState.value.avatarId.coerceIn(0, 7)
        val session = feltApi.register(
            RegisterRequest(displayName, avatarId),
            authorization = auth,
        ).copy(avatarId = avatarId)
        sessionPreferences.saveSession(session)
        sessionPreferences.saveAvatarId(avatarId)
        return session
    }

    private suspend fun requireAuthHeader(): String {
        val token = authTokenProvider.bearerToken()
            ?: error("Sign in required for online play")
        return "Bearer $token"
    }
}
