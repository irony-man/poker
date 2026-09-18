package com.pokr.android.feature.lobby

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pokr.android.core.datastore.SessionPreferences
import com.pokr.android.core.model.ContestView
import com.pokr.android.core.model.CreateContestRequest
import com.pokr.android.core.model.CreateLudoRequest
import com.pokr.android.core.model.CreateCourtpieceRequest
import com.pokr.android.core.model.CreateMemoryRequest
import com.pokr.android.core.model.CreateSnakesRequest
import com.pokr.android.core.model.CreateTableRequest
import com.pokr.android.core.model.DEFAULT_STAKE_ID
import com.pokr.android.core.model.FriendGroupView
import com.pokr.android.core.model.FriendProfile
import com.pokr.android.core.model.LoginRequest
import com.pokr.android.core.model.PublicBotGroup
import com.pokr.android.core.model.SessionDto
import com.pokr.android.core.model.SignupRequest
import com.pokr.android.core.model.stakeById
import com.pokr.android.core.network.EmptyBody
import com.pokr.android.core.network.PokrApi
import com.pokr.android.core.network.SessionTokenHolder
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

data class LobbyUiState(
    val signedIn: Boolean = false,
    val username: String = "",
    val password: String = "",
    val name: String = "",
    val avatarId: Int = 0,
    val avatarUrl: String? = null,
    val authMode: String = "login", // login | signup
    val hostStakeId: String = DEFAULT_STAKE_ID,
    val maxSeats: Int = 6,
    val botCount: Int = 0,
    val customRoomCode: String = "",
    val inviteCode: String = "",
    val offlineSeats: Int = 6,
    val contestMode: String = "chips",
    val contestFieldSize: Int = 6,
    val contestHandLimit: Int = 20,
    val contestInvite: String = "",
    val ludoMaxSeats: Int = 4,
    val ludoBotCount: Int = 0,
    val ludoRoomCode: String = "",
    val snakesMaxSeats: Int = 4,
    val snakesBotCount: Int = 0,
    val snakesRoomCode: String = "",
    val memoryMaxSeats: Int = 2,
    val memoryBotCount: Int = 0,
    val memoryGridSize: Int = 16,
    val memoryRoomCode: String = "",
    val courtpieceRules: String = "classic",
    val courtpieceBotCount: Int = 0,
    val courtpieceRoomCode: String = "",
    val inviteFriendIds: List<String> = emptyList(),
    val friends: List<FriendProfile> = emptyList(),
    val groups: List<FriendGroupView> = emptyList(),
    val botGroups: List<PublicBotGroup> = emptyList(),
    val hostBotGroupId: String? = null,
    val publicContests: List<ContestView> = emptyList(),
    val announcement: String? = null,
    val busy: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class LobbyViewModel @Inject constructor(
    private val api: PokrApi,
    private val sessionPreferences: SessionPreferences,
    private val tokenHolder: SessionTokenHolder,
    private val social: SocialRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(LobbyUiState())
    val uiState: StateFlow<LobbyUiState> = _uiState.asStateFlow()

    val pendingInviteCount: StateFlow<Int> = social.snapshot
        .map { it.incoming.size + it.pendingChallenges.size }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 0)

    val openFriends = social.openFriends

    init {
        viewModelScope.launch {
            social.snapshot.collect { snap ->
                _uiState.update { it.copy(friends = snap.friends, groups = snap.groups) }
            }
        }
        viewModelScope.launch {
            val saved = sessionPreferences.getSession()
            if (saved != null && saved.sessionToken.isNotBlank()) {
                tokenHolder.set(saved.sessionToken)
                val restored = runCatching {
                    api.refreshTicket().copy(
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
                            avatarUrl = restored.avatarUrl,
                        )
                    }
                    loadSocialAndSite()
                } else {
                    tokenHolder.clear()
                    sessionPreferences.clear()
                    val avatar = sessionPreferences.getAvatarId()
                    _uiState.update { it.copy(avatarId = avatar, signedIn = false) }
                }
            } else {
                val avatar = sessionPreferences.getAvatarId()
                _uiState.update { it.copy(avatarId = avatar) }
                loadSite()
            }
        }
    }

    fun onUsernameChange(value: String) = _uiState.update { it.copy(username = value.filter { ch -> ch.isLetterOrDigit() || ch == '_' }.take(24)) }
    fun onPasswordChange(value: String) = _uiState.update { it.copy(password = value.take(128)) }
    fun onAuthModeChange(mode: String) = _uiState.update { it.copy(authMode = mode, error = null) }
    fun onNameChange(value: String) = _uiState.update { it.copy(name = value) }
    fun onAvatarChange(value: Int) {
        _uiState.update { it.copy(avatarId = value.coerceIn(0, 7)) }
        viewModelScope.launch { sessionPreferences.saveAvatarId(value) }
    }
    fun onHostStakeChange(value: String) = _uiState.update { it.copy(hostStakeId = value) }
    fun onMaxSeatsChange(value: Int) = _uiState.update { it.copy(maxSeats = value) }
    fun onBotCountChange(value: Int) = _uiState.update { it.copy(botCount = value) }
    fun onCustomRoomCodeChange(value: String) =
        _uiState.update { it.copy(customRoomCode = value.filter { ch -> ch.isDigit() }.take(8)) }
    fun onInviteChange(value: String) =
        _uiState.update { it.copy(inviteCode = value.trim().take(8)) }
    fun onOfflineSeatsChange(value: Int) = _uiState.update { it.copy(offlineSeats = value) }
    fun onContestModeChange(value: String) = _uiState.update { it.copy(contestMode = value) }
    fun onContestFieldSizeChange(value: Int) =
        _uiState.update { it.copy(contestFieldSize = value) }
    fun onContestHandLimitChange(value: Int) = _uiState.update { it.copy(contestHandLimit = value) }
    fun onContestInviteChange(value: String) =
        _uiState.update { it.copy(contestInvite = value.filter { ch -> ch.isDigit() }.take(8)) }
    fun onInviteFriendsChange(ids: List<String>) = _uiState.update { it.copy(inviteFriendIds = ids.take(8)) }
    fun onLudoMaxSeatsChange(value: Int) =
        _uiState.update { it.copy(ludoMaxSeats = value.coerceIn(2, 4), ludoBotCount = it.ludoBotCount.coerceAtMost(value - 1)) }
    fun onLudoBotCountChange(value: Int) = _uiState.update { it.copy(ludoBotCount = value) }
    fun onLudoRoomCodeChange(value: String) =
        _uiState.update { it.copy(ludoRoomCode = value.filter { ch -> ch.isDigit() }.take(8)) }
    fun onSnakesMaxSeatsChange(value: Int) =
        _uiState.update {
            it.copy(snakesMaxSeats = value.coerceIn(2, 4), snakesBotCount = it.snakesBotCount.coerceAtMost(value - 1))
        }
    fun onSnakesBotCountChange(value: Int) = _uiState.update { it.copy(snakesBotCount = value) }
    fun onSnakesRoomCodeChange(value: String) =
        _uiState.update { it.copy(snakesRoomCode = value.filter { ch -> ch.isDigit() }.take(8)) }
    fun onMemoryMaxSeatsChange(value: Int) =
        _uiState.update {
            it.copy(memoryMaxSeats = value.coerceIn(2, 4), memoryBotCount = it.memoryBotCount.coerceAtMost(value - 1))
        }
    fun onMemoryBotCountChange(value: Int) = _uiState.update { it.copy(memoryBotCount = value) }
    fun onMemoryGridSizeChange(value: Int) =
        _uiState.update { it.copy(memoryGridSize = if (value == 36) 36 else 16) }
    fun onMemoryRoomCodeChange(value: String) =
        _uiState.update { it.copy(memoryRoomCode = value.filter { ch -> ch.isDigit() }.take(8)) }
    fun onCourtpieceRulesChange(value: String) = _uiState.update { it.copy(courtpieceRules = value) }
    fun onCourtpieceBotCountChange(value: Int) = _uiState.update { it.copy(courtpieceBotCount = value.coerceIn(0, 3)) }
    fun onCourtpieceRoomCodeChange(value: String) =
        _uiState.update { it.copy(courtpieceRoomCode = value.filter { ch -> ch.isDigit() }.take(8)) }
    fun onHostBotGroupChange(id: String) = _uiState.update { it.copy(hostBotGroupId = id) }
    fun clearError() = _uiState.update { it.copy(error = null) }

    fun refreshPublicContests() {
        viewModelScope.launch {
            runCatching { api.listContests().contests }
                .onSuccess { list -> _uiState.update { it.copy(publicContests = list) } }
        }
    }

    private fun loadSocialAndSite() {
        viewModelScope.launch {
            runCatching { social.refresh() }
            loadSite()
            refreshPublicContests()
            runCatching { api.getMe() }
                .onSuccess { me ->
                    sessionPreferences.saveTableColorId(me.tableColorId)
                    sessionPreferences.saveUiTheme(me.uiTheme)
                    sessionPreferences.saveTableLayout(me.tableLayout)
                    sessionPreferences.saveSfxMuted(me.sfxMuted)
                }
        }
    }

    private fun loadSite() {
        viewModelScope.launch {
            runCatching { api.getSite() }
                .onSuccess { site ->
                    val text = site.announcement?.text?.trim().orEmpty()
                    val announcement = if (site.announcement?.enabled == true && text.isNotBlank()) text else null
                    _uiState.update { state ->
                        state.copy(
                            botGroups = site.botGroups,
                            announcement = announcement,
                            hostBotGroupId = state.hostBotGroupId
                                ?: site.botGroups.find { it.isDefault }?.id
                                ?: site.botGroups.firstOrNull()?.id,
                        )
                    }
                }
        }
    }

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
                    api.signup(SignupRequest(username, password, state.avatarId))
                } else {
                    api.login(LoginRequest(username, password))
                }.let { it.copy(avatarId = it.avatarId.takeIf { a -> a in 0..7 } ?: state.avatarId) }
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
                loadSocialAndSite()
            }.onFailure { err ->
                _uiState.update { it.copy(busy = false, error = err.message ?: "Auth failed") }
            }
        }
    }

    fun signOut() {
        viewModelScope.launch {
            runCatching { api.logout(EmptyBody()) }
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
                val stake = stakeById(state.hostStakeId)
                val table = api.createTable(
                    CreateTableRequest(
                        userId = session.userId,
                        name = "${session.name}'s Table",
                        smallBlind = stake.smallBlind,
                        bigBlind = stake.bigBlind,
                        buyIn = stake.buyIn,
                        maxSeats = state.maxSeats,
                        botCount = state.botCount.coerceAtMost(state.maxSeats - 1),
                        botGroupId = state.hostBotGroupId,
                        isPrivate = true,
                        inviteCode = code.ifBlank { null },
                        inviteFriendIds = state.inviteFriendIds,
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

    fun join(
        onTable: (tableId: String, invite: String) -> Unit,
        onContest: ((contestId: String) -> Unit)? = null,
        onLudo: ((ludoId: String, invite: String) -> Unit)? = null,
        onSnakes: ((snakesId: String, invite: String) -> Unit)? = null,
        onMemory: ((memoryId: String, invite: String) -> Unit)? = null,
        onCourtpiece: ((courtpieceId: String, invite: String) -> Unit)? = null,
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(busy = true, error = null) }
            val code = _uiState.value.inviteCode.trim()
            runCatching {
                requireSession()
                val table = runCatching { api.resolveInvite(code) }.getOrNull()
                if (table != null) {
                    return@runCatching JoinTarget.Table(table.tableId, table.inviteCode)
                }
                if (onContest != null) {
                    val contest = runCatching { api.resolveContestInvite(code).contest }.getOrNull()
                    if (contest != null) {
                        if (contest.status == "registering") {
                            api.registerContest(contest.id)
                        }
                        return@runCatching JoinTarget.Contest(contest.id)
                    }
                }
                if (onLudo != null) {
                    val ludo = runCatching { api.resolveLudoInvite(code) }.getOrNull()
                    val ludoId = ludo?.resolvedId().orEmpty()
                    if (ludoId.isNotBlank()) {
                        return@runCatching JoinTarget.Ludo(ludoId, ludo!!.resolvedInvite().ifBlank { code })
                    }
                }
                if (onSnakes != null) {
                    val snakes = runCatching { api.resolveSnakesInvite(code) }.getOrNull()
                    val snakesId = snakes?.resolvedId().orEmpty()
                    if (snakesId.isNotBlank()) {
                        return@runCatching JoinTarget.Snakes(snakesId, snakes!!.resolvedInvite().ifBlank { code })
                    }
                }
                if (onMemory != null) {
                    val memory = runCatching { api.resolveMemoryInvite(code) }.getOrNull()
                    val memoryId = memory?.resolvedId().orEmpty()
                    if (memoryId.isNotBlank()) {
                        return@runCatching JoinTarget.Memory(memoryId, memory!!.resolvedInvite().ifBlank { code })
                    }
                }
                if (onCourtpiece != null) {
                    val courtpiece = runCatching { api.resolveCourtpieceInvite(code) }.getOrNull()
                    val courtpieceId = courtpiece?.resolvedId().orEmpty()
                    if (courtpieceId.isNotBlank()) {
                        return@runCatching JoinTarget.Courtpiece(
                            courtpieceId,
                            courtpiece!!.resolvedInvite().ifBlank { code },
                        )
                    }
                }
                error("Invite not found")
            }.onSuccess { target ->
                _uiState.update { it.copy(busy = false) }
                when (target) {
                    is JoinTarget.Table -> onTable(target.tableId, target.invite)
                    is JoinTarget.Contest -> onContest?.invoke(target.contestId)
                    is JoinTarget.Ludo -> onLudo?.invoke(target.ludoId, target.invite)
                    is JoinTarget.Snakes -> onSnakes?.invoke(target.snakesId, target.invite)
                    is JoinTarget.Memory -> onMemory?.invoke(target.memoryId, target.invite)
                    is JoinTarget.Courtpiece -> onCourtpiece?.invoke(target.courtpieceId, target.invite)
                }
            }.onFailure { err ->
                _uiState.update { it.copy(busy = false, error = err.message ?: "Join failed") }
            }
        }
    }

    fun hostLudo(onSuccess: (ludoId: String, invite: String) -> Unit) {
        viewModelScope.launch {
            _uiState.update { it.copy(busy = true, error = null) }
            runCatching {
                val state = _uiState.value
                val code = state.ludoRoomCode.trim()
                if (code.isNotEmpty() && !code.matches(Regex("^\\d{4,8}$"))) {
                    error("Room code must be 4–8 digits")
                }
                val session = requireSession()
                val created = api.createLudo(
                    CreateLudoRequest(
                        userId = session.userId,
                        name = "${session.name}'s Ludo",
                        maxSeats = state.ludoMaxSeats.coerceIn(2, 4),
                        botCount = state.ludoBotCount.coerceAtMost(state.ludoMaxSeats - 1),
                        inviteCode = code.ifBlank { null },
                        inviteFriendIds = state.inviteFriendIds,
                    ),
                )
                val id = created.resolvedId()
                if (id.isBlank()) error("Could not create Ludo board")
                id to created.resolvedInvite()
            }.onSuccess { (ludoId, invite) ->
                _uiState.update { it.copy(busy = false) }
                onSuccess(ludoId, invite)
            }.onFailure { err ->
                _uiState.update { it.copy(busy = false, error = err.message ?: "Host failed") }
            }
        }
    }

    fun hostSnakes(onSuccess: (snakesId: String, invite: String) -> Unit) {
        viewModelScope.launch {
            _uiState.update { it.copy(busy = true, error = null) }
            runCatching {
                val state = _uiState.value
                val code = state.snakesRoomCode.trim()
                if (code.isNotEmpty() && !code.matches(Regex("^\\d{4,8}$"))) {
                    error("Room code must be 4–8 digits")
                }
                val session = requireSession()
                val created = api.createSnakes(
                    CreateSnakesRequest(
                        name = "${session.name}'s Snakes",
                        maxSeats = state.snakesMaxSeats.coerceIn(2, 4),
                        botCount = state.snakesBotCount.coerceAtMost(state.snakesMaxSeats - 1),
                        inviteCode = code.ifBlank { null },
                        inviteFriendIds = state.inviteFriendIds,
                    ),
                )
                val id = created.resolvedId()
                if (id.isBlank()) error("Could not create Snakes board")
                id to created.resolvedInvite()
            }.onSuccess { (snakesId, invite) ->
                _uiState.update { it.copy(busy = false) }
                onSuccess(snakesId, invite)
            }.onFailure { err ->
                _uiState.update { it.copy(busy = false, error = err.message ?: "Host failed") }
            }
        }
    }

    fun hostMemory(onSuccess: (memoryId: String, invite: String) -> Unit) {
        viewModelScope.launch {
            _uiState.update { it.copy(busy = true, error = null) }
            runCatching {
                val state = _uiState.value
                val code = state.memoryRoomCode.trim()
                if (code.isNotEmpty() && !code.matches(Regex("^\\d{4,8}$"))) {
                    error("Room code must be 4–8 digits")
                }
                val session = requireSession()
                val created = api.createMemory(
                    CreateMemoryRequest(
                        name = "${session.name}'s Memory",
                        maxSeats = state.memoryMaxSeats.coerceIn(2, 4),
                        gridSize = if (state.memoryGridSize == 36) 36 else 16,
                        botCount = state.memoryBotCount.coerceAtMost(state.memoryMaxSeats - 1),
                        inviteCode = code.ifBlank { null },
                        inviteFriendIds = state.inviteFriendIds,
                    ),
                )
                val id = created.resolvedId()
                if (id.isBlank()) error("Could not create Memory board")
                id to created.resolvedInvite()
            }.onSuccess { (memoryId, invite) ->
                _uiState.update { it.copy(busy = false) }
                onSuccess(memoryId, invite)
            }.onFailure { err ->
                _uiState.update { it.copy(busy = false, error = err.message ?: "Host failed") }
            }
        }
    }

    fun hostCourtpiece(onSuccess: (courtpieceId: String, invite: String) -> Unit) {
        viewModelScope.launch {
            _uiState.update { it.copy(busy = true, error = null) }
            runCatching {
                val state = _uiState.value
                val code = state.courtpieceRoomCode.trim()
                if (code.isNotEmpty() && !code.matches(Regex("^\\d{4,8}$"))) {
                    error("Room code must be 4–8 digits")
                }
                val session = requireSession()
                val created = api.createCourtpiece(
                    CreateCourtpieceRequest(
                        name = "${session.name}'s Court Piece",
                        rulesVariant = state.courtpieceRules,
                        botCount = state.courtpieceBotCount.coerceIn(0, 3),
                        inviteCode = code.ifBlank { null },
                        inviteFriendIds = state.inviteFriendIds,
                    ),
                )
                val id = created.resolvedId()
                if (id.isBlank()) error("Could not create Court Piece table")
                id to created.resolvedInvite()
            }.onSuccess { (courtpieceId, invite) ->
                _uiState.update { it.copy(busy = false) }
                onSuccess(courtpieceId, invite)
            }.onFailure { err ->
                _uiState.update { it.copy(busy = false, error = err.message ?: "Host failed") }
            }
        }
    }

    private sealed class JoinTarget {
        data class Table(val tableId: String, val invite: String) : JoinTarget()
        data class Contest(val contestId: String) : JoinTarget()
        data class Ludo(val ludoId: String, val invite: String) : JoinTarget()
        data class Snakes(val snakesId: String, val invite: String) : JoinTarget()
        data class Memory(val memoryId: String, val invite: String) : JoinTarget()
        data class Courtpiece(val courtpieceId: String, val invite: String) : JoinTarget()
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
                val modeLabel = if (mode == "rounds") "Rounds" else "Knockout"
                api.createContest(
                    CreateContestRequest(
                        userId = session.userId,
                        name = "${session.name}'s $modeLabel Contest",
                        mode = mode,
                        fieldSize = field,
                        botCount = 0,
                        isPrivate = true,
                        autoStart = false,
                        handLimit = if (mode == "rounds") state.contestHandLimit else null,
                        inviteFriendIds = state.inviteFriendIds,
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
                val resolved = api.resolveContestInvite(_uiState.value.contestInvite.trim()).contest
                api.registerContest(resolved.id)
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
        val refreshed = api.refreshTicket().copy(
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
