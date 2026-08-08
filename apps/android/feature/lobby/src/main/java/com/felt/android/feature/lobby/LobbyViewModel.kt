package com.felt.android.feature.lobby

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.felt.android.core.datastore.SessionPreferences
import com.felt.android.core.model.CreateContestRequest
import com.felt.android.core.model.CreateTableRequest
import com.felt.android.core.model.LoginRequest
import com.felt.android.core.model.SessionDto
import com.felt.android.core.model.SignupRequest
import com.felt.android.core.network.EmptyBody
import com.felt.android.core.network.FeltApi
import com.felt.android.core.network.SessionTokenHolder
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class LobbyUiState(
    val signedIn: Boolean = false,
    val username: String = "",
    val password: String = "",
    val name: String = "",
    val avatarId: Int = 0,
    val authMode: String = "login", // login | signup
    val maxSeats: Int = 6,
    val botCount: Int = 2,
    val customRoomCode: String = "",
    val inviteCode: String = "",
    val offlineSeats: Int = 6,
    val contestMode: String = "chips",
    val contestFieldSize: Int = 6,
    val contestBotCount: Int = 3,
    val contestHandLimit: Int = 20,
    val contestInvite: String = "",
    val busy: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class LobbyViewModel @Inject constructor(
    private val feltApi: FeltApi,
    private val sessionPreferences: SessionPreferences,
    private val tokenHolder: SessionTokenHolder,
) : ViewModel() {

    private val _uiState = MutableStateFlow(LobbyUiState())
    val uiState: StateFlow<LobbyUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            val saved = sessionPreferences.getSession()
            if (saved != null && saved.sessionToken.isNotBlank()) {
                tokenHolder.set(saved.sessionToken)
                val restored = runCatching {
                    feltApi.refreshTicket().copy(
                        sessionToken = saved.sessionToken,
                        avatarId = saved.avatarId,
                    )
                }.getOrNull()
                if (restored != null) {
                    sessionPreferences.saveSession(restored)
                    _uiState.update {
                        it.copy(
                            signedIn = true,
                            name = restored.name,
                            username = restored.username.ifBlank { restored.name },
                            avatarId = restored.avatarId,
                        )
                    }
                } else {
                    tokenHolder.clear()
                    sessionPreferences.clear()
                    val avatar = sessionPreferences.getAvatarId()
                    _uiState.update { it.copy(avatarId = avatar, signedIn = false) }
                }
            } else {
                val avatar = sessionPreferences.getAvatarId()
                _uiState.update { it.copy(avatarId = avatar) }
            }
        }
    }

    fun onUsernameChange(value: String) = _uiState.update { it.copy(username = value.filter { ch -> ch.isLetterOrDigit() || ch == '_' }.take(24)) }
    fun onPasswordChange(value: String) = _uiState.update { it.copy(password = value.take(128)) }
    fun onAuthModeChange(mode: String) = _uiState.update { it.copy(authMode = mode, error = null) }
    fun onNameChange(value: String) = _uiState.update { it.copy(name = value) }
    fun onAvatarChange(value: Int) {
        _uiState.update { it.copy(avatarId = value.coerceIn(0, 4)) }
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
        _uiState.update {
            it.copy(
                contestMode = value,
                contestBotCount = it.contestBotCount.coerceAtMost(it.contestFieldSize - 1),
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
    fun onContestHandLimitChange(value: Int) = _uiState.update { it.copy(contestHandLimit = value) }
    fun onContestInviteChange(value: String) =
        _uiState.update { it.copy(contestInvite = value.filter { ch -> ch.isDigit() }.take(8)) }
    fun clearError() = _uiState.update { it.copy(error = null) }

    fun submitAuth() {
        val state = _uiState.value
        val username = state.username.trim()
        val password = state.password
        if (username.length < 3) {
            _uiState.update { it.copy(error = "Username must be at least 3 characters") }
            return
        }
        if (password.length < 6) {
            _uiState.update { it.copy(error = "Password must be at least 6 characters") }
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(busy = true, error = null) }
            runCatching {
                val session = if (state.authMode == "signup") {
                    feltApi.signup(SignupRequest(username, password, state.avatarId))
                } else {
                    feltApi.login(LoginRequest(username, password))
                }.let { it.copy(avatarId = it.avatarId.takeIf { a -> a in 0..4 } ?: state.avatarId) }
                persistSession(session)
                session
            }.onSuccess { session ->
                _uiState.update {
                    it.copy(
                        busy = false,
                        signedIn = true,
                        name = session.name,
                        username = session.username.ifBlank { session.name },
                        password = "",
                    )
                }
            }.onFailure { err ->
                _uiState.update { it.copy(busy = false, error = err.message ?: "Auth failed") }
            }
        }
    }

    fun signOut() {
        viewModelScope.launch {
            runCatching { feltApi.logout(EmptyBody()) }
            tokenHolder.clear()
            sessionPreferences.clear()
            _uiState.update {
                it.copy(
                    signedIn = false,
                    name = "",
                    username = "",
                    password = "",
                    error = null,
                )
            }
        }
    }

    fun host(onSuccess: (tableId: String, invite: String) -> Unit) {
        viewModelScope.launch {
            _uiState.update { it.copy(busy = true, error = null) }
            runCatching {
                val state = _uiState.value
                val code = state.customRoomCode.trim()
                if (code.isNotEmpty() && !code.matches(Regex("^\\d{4,8}$"))) {
                    error("Room code must be 4–8 digits")
                }
                val session = requireSession()
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
        viewModelScope.launch {
            _uiState.update { it.copy(busy = true, error = null) }
            runCatching {
                requireSession()
                val resolved = feltApi.resolveInvite(_uiState.value.inviteCode.trim())
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
        viewModelScope.launch {
            _uiState.update { it.copy(busy = true, error = null) }
            runCatching {
                val state = _uiState.value
                val session = requireSession()
                val mode = state.contestMode
                val field = state.contestFieldSize
                val modeLabel = if (mode == "rounds") "Rounds" else "Chips"
                feltApi.createContest(
                    CreateContestRequest(
                        userId = session.userId,
                        name = "${session.name}'s $modeLabel Contest",
                        mode = mode,
                        fieldSize = field,
                        botCount = state.contestBotCount.coerceAtMost(field - 1),
                        isPrivate = true,
                        autoStart = true,
                        handLimit = if (mode == "rounds") state.contestHandLimit else null,
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
        viewModelScope.launch {
            _uiState.update { it.copy(busy = true, error = null) }
            runCatching {
                requireSession()
                val resolved = feltApi.resolveContestInvite(_uiState.value.contestInvite.trim()).contest
                feltApi.registerContest(resolved.id)
                resolved.id
            }.onSuccess { id ->
                _uiState.update { it.copy(busy = false) }
                onSuccess(id)
            }.onFailure { err ->
                _uiState.update { it.copy(busy = false, error = err.message ?: "Join contest failed") }
            }
        }
    }

    private suspend fun requireSession(): SessionDto {
        val saved = sessionPreferences.getSession()
            ?: error("Sign in first")
        if (saved.sessionToken.isBlank()) error("Sign in first")
        tokenHolder.set(saved.sessionToken)
        val refreshed = feltApi.refreshTicket().copy(
            sessionToken = saved.sessionToken,
            avatarId = saved.avatarId,
        )
        persistSession(refreshed)
        return refreshed
    }

    private suspend fun persistSession(session: SessionDto) {
        tokenHolder.set(session.sessionToken)
        sessionPreferences.saveSession(session)
        sessionPreferences.saveAvatarId(session.avatarId)
    }
}
