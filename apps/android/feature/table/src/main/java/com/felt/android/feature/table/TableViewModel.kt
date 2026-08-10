package com.felt.android.feature.table

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.toRoute
import com.felt.android.core.datastore.SessionPreferences
import com.felt.android.core.model.ChatMessage
import com.felt.android.core.model.ClientMessage
import com.felt.android.core.model.ConnectionStatus
import com.felt.android.core.model.EmojiBurst
import com.felt.android.core.model.ServerMessage
import com.felt.android.feature.table.OnlineTableRoute
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
                    ClientMessage.AddBot(tableId = tableId, buyIn = buyIn, count = intent.count),
                )
            }
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
        }
    }

    private fun leaveTable() {
        repository.send(ClientMessage.LeaveTable(tableId))
        repository.disconnect()
    }

    private fun connect() {
        observeJob?.cancel()
        observeJob = viewModelScope.launch {
            _uiState.update {
                it.copy(
                    userId = sessionPreferences.getSession()?.userId,
                    connection = ConnectionStatus.Connecting,
                    loading = true,
                )
            }

            launch {
                repository.messages.collect { msg ->
                    when (msg) {
                        is ServerMessage.AuthOk -> {
                            _uiState.update { it.copy(connection = ConnectionStatus.Open) }
                        }
                        is ServerMessage.StateSync -> {
                            _uiState.update { current ->
                                val table = msg.table
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
                        is ServerMessage.SocialSync -> Unit
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
        repository.disconnect()
        super.onCleared()
    }
}
