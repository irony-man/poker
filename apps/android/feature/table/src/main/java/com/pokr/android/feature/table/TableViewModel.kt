package com.pokr.android.feature.table

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.toRoute
import com.pokr.android.core.datastore.SessionPreferences
import com.pokr.android.core.designsystem.TableSoundPlayer
import com.pokr.android.core.model.ChatMessage
import com.pokr.android.core.model.ClientMessage
import com.pokr.android.core.model.ConnectionStatus
import com.pokr.android.core.model.EmojiBurst
import com.pokr.android.core.model.ServerMessage
import com.pokr.android.core.model.UpdateMeBody
import com.pokr.android.core.network.PokrApi
import com.pokr.android.feature.table.OnlineTableRoute
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

@HiltViewModel
class TableViewModel @Inject constructor(
    private val repository: TableRepository,
    private val sessionPreferences: SessionPreferences,
    private val api: PokrApi,
    private val sounds: TableSoundPlayer,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val route = savedStateHandle.toRoute<OnlineTableRoute>()
    private val tableId: String = route.tableId
    private val invite: String? = route.invite

    private val _uiState = MutableStateFlow(
        TableContract.UiState(
            tableId = tableId,
            invite = invite,
            loading = true,
            spectating = route.spectate,
        ),
    )
    val uiState = _uiState.asStateFlow()

    private val _effects = MutableSharedFlow<TableContract.Effect>()
    val effects: SharedFlow<TableContract.Effect> = _effects.asSharedFlow()

    private var observeJob: Job? = null
    private var emojiClearJob: Job? = null
    private var autoSitSent = false
    private var prevStreet: String? = null
    private var prevHandId: String? = null
    private var prevActionSeq: Int? = null

    init {
        dispatch(TableContract.Intent.Connect)
    }

    fun dispatch(intent: TableContract.Intent) {
        when (intent) {
            TableContract.Intent.Connect -> {
                autoSitSent = false
                connect()
            }
            is TableContract.Intent.SendAction -> sendAction(intent.action, intent.amount)
            is TableContract.Intent.SendChat ->
                repository.send(ClientMessage.Chat(tableId, intent.text))
            is TableContract.Intent.SendEmoji ->
                repository.send(ClientMessage.Emoji(tableId, intent.emoji))
            TableContract.Intent.ToggleChat -> _uiState.update { it.copy(chatOpen = !it.chatOpen) }
            TableContract.Intent.DismissError -> _uiState.update { it.copy(lastError = null) }
            is TableContract.Intent.Sit ->
                repository.send(ClientMessage.Sit(tableId, intent.seat, intent.buyIn))
            TableContract.Intent.StartHand ->
                repository.send(ClientMessage.StartHand(tableId))
            is TableContract.Intent.AddBots -> {
                val buyIn = _uiState.value.table?.config?.buyIn ?: 1000
                repository.send(
                    ClientMessage.AddBot(
                        tableId = tableId,
                        buyIn = buyIn,
                        count = intent.count,
                        botGroupId = _uiState.value.botGroupId,
                    ),
                )
            }
            is TableContract.Intent.KickPlayer ->
                repository.send(ClientMessage.KickPlayer(tableId, intent.seat))
            is TableContract.Intent.SelectBotGroup ->
                _uiState.update { it.copy(botGroupId = intent.id) }
            TableContract.Intent.RemoveAllBots ->
                repository.send(ClientMessage.RemoveAllBots(tableId))
            is TableContract.Intent.TopUp ->
                repository.send(ClientMessage.TopUp(tableId, intent.seat, intent.amount))
            TableContract.Intent.SitOut -> {
                val seat = _uiState.value.table?.players?.find { it.userId == _uiState.value.userId }?.seat
                if (seat != null) repository.send(ClientMessage.SitOut(tableId, seat))
            }
            TableContract.Intent.SitIn -> {
                val seat = _uiState.value.table?.players?.find { it.userId == _uiState.value.userId }?.seat
                if (seat != null) repository.send(ClientMessage.SitIn(tableId, seat))
            }
            TableContract.Intent.EnableSitToPlay -> {
                _uiState.update { it.copy(spectating = false) }
                maybeAutoSit()
            }
            TableContract.Intent.LeaveTable -> leaveTable()
            TableContract.Intent.ToggleSfxMute -> toggleSfxMute()
        }
    }

    private fun toggleSfxMute() {
        val next = !_uiState.value.sfxMuted
        _uiState.update { it.copy(sfxMuted = next) }
        sounds.enabled = !next
        viewModelScope.launch {
            sessionPreferences.saveSfxMuted(next)
            runCatching { api.patchMe(UpdateMeBody(sfxMuted = next)) }
                .onSuccess { me ->
                    sessionPreferences.saveSfxMuted(me.sfxMuted)
                    _uiState.update { it.copy(sfxMuted = me.sfxMuted) }
                }
        }
    }

    private fun leaveTable() {
        repository.leave(tableId)
    }

    private fun connect() {
        observeJob?.cancel()
        observeJob = viewModelScope.launch {
            val me = runCatching { api.getMe() }.getOrNull()
            val colorId = me?.tableColorId ?: sessionPreferences.getTableColorId()
            sessionPreferences.saveTableColorId(colorId)
            val sfxMuted = me?.sfxMuted ?: sessionPreferences.getSfxMuted()
            sessionPreferences.saveSfxMuted(sfxMuted)
            if (me != null) {
                sessionPreferences.saveUiTheme(me.uiTheme)
                sessionPreferences.saveTableLayout(me.tableLayout)
            }
            sounds.enabled = !sfxMuted
            val botGroups = runCatching { api.getSite().botGroups }.getOrDefault(emptyList())
            _uiState.update {
                it.copy(
                    userId = sessionPreferences.getSession()?.userId,
                    connection = ConnectionStatus.Connecting,
                    loading = true,
                    tableColorId = colorId,
                    sfxMuted = sfxMuted,
                    botGroups = botGroups,
                    botGroupId = it.botGroupId
                        ?: botGroups.find { g -> g.isDefault }?.id
                        ?: botGroups.firstOrNull()?.id,
                )
            }

            launch {
                repository.messages.collect { msg ->
                    when (msg) {
                        is ServerMessage.AuthOk -> {
                            _uiState.update { it.copy(connection = ConnectionStatus.Open) }
                            repository.send(
                                ClientMessage.JoinTable(
                                    tableId = tableId,
                                    spectate = if (route.spectate) true else null,
                                ),
                            )
                        }
                        is ServerMessage.StateSync -> {
                            val incoming = msg.table
                            val prevS = prevStreet
                            val prevH = prevHandId
                            val prevSeq = prevActionSeq
                            sounds.onTableTransition(
                                prevStreet = prevS,
                                prevHandId = prevH,
                                street = incoming.street,
                                handId = incoming.handId,
                            )
                            // Local/remote action: actionSeq advances with each seat action.
                            if (prevSeq != null && incoming.actionSeq > prevSeq) {
                                // Best-effort: play call for unknown remote actions when street unchanged mid-hand.
                                // Local sends also play explicitly in sendAction.
                            }
                            prevStreet = incoming.street
                            prevHandId = incoming.handId
                            prevActionSeq = incoming.actionSeq
                            _uiState.update { current ->
                                val table = incoming
                                if (current.table != null && table.version < current.table.version) {
                                    current
                                } else {
                                    val seated = table.players.any { it.userId == current.userId }
                                    current.copy(
                                        table = table,
                                        private = msg.privateView,
                                        loading = false,
                                        connection = ConnectionStatus.Open,
                                        spectating = if (seated) false else current.spectating,
                                    )
                                }
                            }
                            maybeAutoSit()
                        }
                        is ServerMessage.Chat -> {
                            val chatMsg = ChatMessage(msg.userId, msg.name, msg.text, msg.at)
                            _uiState.update { it.copy(chat = (it.chat + chatMsg).takeLast(80)) }
                        }
                        is ServerMessage.Emoji -> {
                            val burst = EmojiBurst(msg.emoji, msg.name, msg.at)
                            _uiState.update { it.copy(emojiBurst = burst) }
                            emojiClearJob?.cancel()
                            emojiClearJob = launch {
                                delay(1800)
                                _uiState.update { it.copy(emojiBurst = null) }
                            }
                        }
                        is ServerMessage.Error -> {
                            _uiState.update { it.copy(lastError = msg.message) }
                        }
                        ServerMessage.Pong -> Unit
                        is ServerMessage.ContestSync,
                        is ServerMessage.ContestEvent,
                        is ServerMessage.PublicTablesSync,
                        is ServerMessage.PublicContestsSync,
                        is ServerMessage.MyContestsSync,
                        is ServerMessage.SocialSync -> Unit // SocialRepository applies this
                    }
                }
            }

            runCatching { repository.connect(tableId, spectate = route.spectate) }
                .onFailure { err ->
                    _uiState.update {
                        it.copy(
                            loading = false,
                            connection = ConnectionStatus.Closed,
                            lastError = err.message,
                        )
                    }
                }
        }
    }

    private fun sendAction(action: String, amount: Int?) {
        val table = _uiState.value.table ?: return
        sounds.playAction(action)
        repository.send(
            ClientMessage.Action(
                tableId = tableId,
                handId = table.handId,
                seq = table.actionSeq,
                action = action,
                amount = amount,
            ),
        )
    }

    private fun maybeAutoSit() {
        val state = _uiState.value
        if (state.spectating || state.userId == null || state.connection != ConnectionStatus.Open) return
        val table = state.table ?: return
        if (table.players.any { it.userId == state.userId }) return
        if (autoSitSent) return
        val empty = table.players.firstOrNull { it.status == "empty" } ?: return
        autoSitSent = true
        repository.send(ClientMessage.Sit(tableId, empty.seat, table.config.buyIn))
    }

    override fun onCleared() {
        repository.leave(tableId)
        super.onCleared()
    }
}
