package com.pokr.android.core.network

import com.pokr.android.core.datastore.SessionPreferences
import com.pokr.android.core.model.ClientMessage
import com.pokr.android.core.model.FriendRespondBody
import com.pokr.android.core.model.FriendsSnapshot
import com.pokr.android.core.model.PendingChallenge
import com.pokr.android.core.model.ServerMessage
import com.pokr.android.core.model.SessionDto
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout

sealed class SocialJoinTarget {
    data class Table(val tableId: String, val invite: String) : SocialJoinTarget()
    data class Contest(val contestId: String) : SocialJoinTarget()
}

@Singleton
class SocialRepository @Inject constructor(
    private val api: PokrApi,
    private val wsClient: PokerWebSocketClient,
    private val sessionPreferences: SessionPreferences,
    private val tokenHolder: SessionTokenHolder,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val _snapshot = MutableStateFlow(FriendsSnapshot())
    val snapshot: StateFlow<FriendsSnapshot> = _snapshot.asStateFlow()

    private val _loaded = MutableStateFlow(false)
    val loaded: StateFlow<Boolean> = _loaded.asStateFlow()

    private val _authenticated = MutableStateFlow(false)
    val authenticated: StateFlow<Boolean> = _authenticated.asStateFlow()

    private val _openFriends = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val openFriends: SharedFlow<Unit> = _openFriends.asSharedFlow()

    private var startedUserId: String? = null

    init {
        scope.launch {
            sessionPreferences.sessionFlow
                .distinctUntilChanged { a, b ->
                    a?.userId == b?.userId && a?.sessionToken == b?.sessionToken
                }
                .collect { session ->
                    if (session == null || session.sessionToken.isBlank()) {
                        stopSession()
                    } else {
                        startSession(session)
                    }
                }
        }
        scope.launch {
            wsClient.opened.collect {
                val ticket = sessionPreferences.getSession()?.ticket
                if (ticket.isNullOrBlank()) return@collect
                _authenticated.value = false
                wsClient.send(ClientMessage.Auth(ticket))
            }
        }
        scope.launch {
            wsClient.connected.collect { open ->
                if (!open) _authenticated.value = false
            }
        }
        scope.launch {
            wsClient.messages.collect { msg ->
                when (msg) {
                    is ServerMessage.AuthOk -> _authenticated.value = true
                    is ServerMessage.SocialSync -> {
                        _snapshot.value = FriendsSnapshot(
                            friends = msg.friends,
                            incoming = msg.incoming,
                            pendingChallenges = msg.pendingChallenges,
                            groups = msg.groups,
                        )
                        _loaded.value = true
                    }
                    else -> Unit
                }
            }
        }
    }

    fun requestOpenFriends() {
        _openFriends.tryEmit(Unit)
    }

    suspend fun awaitAuthenticated(timeoutMs: Long = 15_000) {
        if (_authenticated.value) return
        withTimeout(timeoutMs) {
            authenticated.first { it }
        }
    }

    suspend fun refresh() {
        val session = sessionPreferences.getSession() ?: return
        if (session.sessionToken.isBlank()) return
        tokenHolder.set(session.sessionToken)
        runCatching { api.getFriends() }
            .onSuccess { snap ->
                _snapshot.value = snap
                _loaded.value = true
            }
    }

    suspend fun respondRequest(requestId: String, accept: Boolean) {
        api.respondFriendRequest(requestId, FriendRespondBody(accept))
        refresh()
    }

    suspend fun declineChallenge(challengeId: String) {
        api.declineFriendChallenge(challengeId)
        _snapshot.value = _snapshot.value.copy(
            pendingChallenges = _snapshot.value.pendingChallenges.filter { it.id != challengeId },
        )
        refresh()
    }

    suspend fun joinChallenge(challenge: PendingChallenge): SocialJoinTarget {
        api.joinFriendChallenge(challenge.id)
        val contestId = challenge.contestId
        val isContest = challenge.kind == "contest" || !contestId.isNullOrBlank()
        val target = if (isContest && !contestId.isNullOrBlank()) {
            runCatching { api.registerContest(contestId) }
            SocialJoinTarget.Contest(contestId)
        } else {
            val tableId = challenge.tableId ?: error("Invite is no longer valid")
            SocialJoinTarget.Table(tableId, challenge.inviteCode)
        }
        refresh()
        return target
    }

    private suspend fun startSession(session: SessionDto) {
        tokenHolder.set(session.sessionToken)
        if (startedUserId != session.userId) {
            startedUserId = session.userId
            _snapshot.value = FriendsSnapshot()
            _loaded.value = false
        }
        val fresh = runCatching {
            api.refreshTicket().copy(
                sessionToken = session.sessionToken,
                avatarId = session.avatarId,
            )
        }.getOrNull()
        if (fresh != null) {
            sessionPreferences.saveSession(fresh)
        }
        refresh()
        wsClient.ensureConnected()
        if (wsClient.isOpen && !_authenticated.value) {
            val ticket = fresh?.ticket ?: session.ticket
            if (ticket.isNotBlank()) {
                wsClient.send(ClientMessage.Auth(ticket))
            }
        }
    }

    private fun stopSession() {
        startedUserId = null
        _authenticated.value = false
        _loaded.value = false
        _snapshot.value = FriendsSnapshot()
        wsClient.disconnect(reconnect = false)
    }
}
