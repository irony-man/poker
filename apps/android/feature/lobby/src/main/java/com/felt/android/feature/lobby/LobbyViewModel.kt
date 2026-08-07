package com.felt.android.feature.lobby

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.felt.android.core.datastore.SessionPreferences
import com.felt.android.core.model.CreateContestRequest
import com.felt.android.core.model.CreateTableRequest
import com.felt.android.core.model.RegisterRequest
import com.felt.android.core.model.SessionDto
import com.felt.android.core.model.UserIdBody
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
    val customRoomCode: String = "",
    val inviteCode: String = "",
    val offlineSeats: Int = 6,
    val contestMode: String = "table_match",
    val contestFieldSize: Int = 6,
    val contestBotCount: Int = 3,
    val contestInvite: String = "",
    val busy: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class LobbyViewModel @Inject constructor(
    private val feltApi: FeltApi,
    private val sessionPreferences: SessionPreferences,
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
    fun onCustomRoomCodeChange(value: String) =
        _uiState.update { it.copy(customRoomCode = value.filter { ch -> ch.isDigit() }.take(8)) }
    fun onInviteChange(value: String) =
        _uiState.update { it.copy(inviteCode = value.trim().take(8)) }
    fun onOfflineSeatsChange(value: Int) = _uiState.update { it.copy(offlineSeats = value) }
    fun onContestModeChange(value: String) {
        val size = if (value == "knockout") 4 else 6
        _uiState.update {
            it.copy(
                contestMode = value,
                contestFieldSize = size,
                contestBotCount = it.contestBotCount.coerceAtMost(size - 1),
            )
        }
    }
    fun onContestFieldSizeChange(value: Int) =
        _uiState.update {
            it.copy(
                contestFieldSize = value,
                contestBotCount = it.contestBotCount.coerceAtMost(value - 1),
            )
        }
    fun onContestBotCountChange(value: Int) = _uiState.update { it.copy(contestBotCount = value) }
    fun onContestInviteChange(value: String) =
        _uiState.update { it.copy(contestInvite = value.filter { ch -> ch.isDigit() }.take(8)) }
    fun clearError() = _uiState.update { it.copy(error = null) }

    fun host(onSuccess: (tableId: String, invite: String) -> Unit) {
        val state = _uiState.value
        if (state.name.isBlank()) {
            _uiState.update { it.copy(error = "Enter a callsign to play") }
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(busy = true, error = null) }
            runCatching {
                val code = state.customRoomCode.trim()
                if (code.isNotEmpty() && !code.matches(Regex("^\\d{4,8}$"))) {
                    error("Room code must be 4–8 digits")
                }
                val session = ensureSession(state.name.trim())
                val table = feltApi.createTable(
                    CreateTableRequest(
                        userId = session.userId,
                        name = "${session.name}'s Table",
                        maxSeats = state.maxSeats,
                        botCount = state.botCount.coerceAtMost(state.maxSeats - 1),
                        isPrivate = true,
                        inviteCode = code.ifBlank { null },
                    ),
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
        if (state.name.isBlank()) {
            _uiState.update { it.copy(error = "Enter a callsign to play") }
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(busy = true, error = null) }
            runCatching {
                ensureSession(state.name.trim())
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

    fun createContest(onSuccess: (contestId: String) -> Unit) {
        val state = _uiState.value
        if (state.name.isBlank()) {
            _uiState.update { it.copy(error = "Enter a callsign to play") }
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(busy = true, error = null) }
            runCatching {
                val session = ensureSession(state.name.trim())
                val mode = state.contestMode
                val field = state.contestFieldSize
                feltApi.createContest(
                    CreateContestRequest(
                        userId = session.userId,
                        name = "${session.name}'s ${if (mode == "knockout") "Knockout" else "Table Match"}",
                        mode = mode,
                        fieldSize = field,
                        botCount = state.contestBotCount.coerceAtMost(field - 1),
                        isPrivate = true,
                        autoStart = true,
                    ),
                ).contest.id
            }.onSuccess { id ->
                _uiState.update { it.copy(busy = false) }
                onSuccess(id)
            }.onFailure { err ->
                _uiState.update { it.copy(busy = false, error = err.message ?: "Contest failed") }
            }
        }
    }

    fun joinContest(onSuccess: (contestId: String) -> Unit) {
        val state = _uiState.value
        if (state.name.isBlank()) {
            _uiState.update { it.copy(error = "Enter a callsign to play") }
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(busy = true, error = null) }
            runCatching {
                val session = ensureSession(state.name.trim())
                val resolved = feltApi.resolveContestInvite(state.contestInvite.trim()).contest
                feltApi.registerContest(resolved.id, UserIdBody(session.userId))
                resolved.id
            }.onSuccess { id ->
                _uiState.update { it.copy(busy = false) }
                onSuccess(id)
            }.onFailure { err ->
                _uiState.update { it.copy(busy = false, error = err.message ?: "Join contest failed") }
            }
        }
    }

    private suspend fun ensureSession(displayName: String): SessionDto {
        val avatarId = _uiState.value.avatarId.coerceIn(0, 7)
        val existingUserId = sessionPreferences.getSession()?.userId
        val session = feltApi.register(
            RegisterRequest(displayName, avatarId, existingUserId),
        ).copy(avatarId = avatarId)
        sessionPreferences.saveSession(session)
        sessionPreferences.saveAvatarId(avatarId)
        return session
    }
}
