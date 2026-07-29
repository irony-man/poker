package com.felt.android.feature.offline

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.toRoute
import com.felt.android.core.datastore.SessionPreferences
import com.felt.android.core.model.ChatMessage
import com.felt.android.core.model.LegalActions
import com.felt.android.core.model.PublicTable
import com.felt.android.core.designsystem.avatarIdFromUserId
import com.felt.android.engine.ActionIntent
import com.felt.android.engine.ActionType
import com.felt.android.engine.EngineEvent
import com.felt.android.engine.HandState
import com.felt.android.engine.PlayerStatus
import com.felt.android.engine.Street
import com.felt.android.engine.TableConfig
import com.felt.android.engine.applyAction
import com.felt.android.engine.applyTimeout
import com.felt.android.engine.cardToString
import com.felt.android.engine.chooseBotAction
import com.felt.android.engine.createEmptyTable
import com.felt.android.engine.isBotUserId
import com.felt.android.engine.makeBotUserId
import com.felt.android.engine.pickBotName
import com.felt.android.engine.returnToWaiting
import com.felt.android.engine.sitDown
import com.felt.android.engine.startHand
import com.felt.android.engine.toPrivateView
import com.felt.android.engine.toPublicView
import dagger.hilt.android.lifecycle.HiltViewModel
import java.security.SecureRandom
import javax.inject.Inject
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlin.random.Random

private const val HUMAN_ID = "offline-human"

data class OfflineUiState(
    val playerName: String = "Player",
    val config: TableConfig = TableConfig(
        maxSeats = 6,
        smallBlind = 5,
        bigBlind = 10,
        buyIn = 1000,
        turnTimeMs = 20_000,
    ),
    val handState: HandState? = null,
    val publicTable: PublicTable? = null,
    val legal: LegalActions? = null,
    val holeCards: List<String>? = null,
    val chat: List<ChatMessage> = emptyList(),
    val chatOpen: Boolean = false,
    val bootstrapped: Boolean = false,
)

@HiltViewModel
class OfflineViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val sessionPreferences: SessionPreferences,
) : ViewModel() {

    private val route = savedStateHandle.toRoute<OfflineTableRoute>()
    private val seats: Int = route.seats
    private val name: String = route.name
    @Volatile private var humanAvatarId: Int = 0

    private val config = TableConfig(
        maxSeats = seats,
        smallBlind = 5,
        bigBlind = 10,
        buyIn = 1000,
        turnTimeMs = 20_000,
    )

    private val random = SecureRandom()

    private val _uiState = MutableStateFlow(OfflineUiState(playerName = name, config = config))
    val uiState: StateFlow<OfflineUiState> = _uiState.asStateFlow()

    private var botJob: Job? = null
    private var payoutJob: Job? = null
    private var turnEndsAt: Long? = null

    init {
        viewModelScope.launch {
            humanAvatarId = sessionPreferences.getAvatarId()
            bootstrap()
        }
    }

    fun toggleChat() = _uiState.update { it.copy(chatOpen = !it.chatOpen) }

    fun sendChat(text: String) {
        val trimmed = text.trim()
        if (trimmed.isEmpty()) return
        pushChat(HUMAN_ID, name, trimmed)
    }

    fun sendEmoji(emoji: String) {
        pushChat(HUMAN_ID, name, emoji)
    }

    fun sendAction(action: String, amount: Int?) {
        val state = _uiState.value.handState ?: return
        val mySeat = state.players.indexOfFirst { it.userId == HUMAN_ID }
        if (mySeat < 0 || state.toAct != mySeat) return
        val type = parseActionType(action) ?: return
        val result = applyAction(
            state,
            mySeat,
            ActionIntent(type = type, amount = amount, seq = state.actionSeq),
            config,
        )
        if (result.ok) applyEngineResult(result.state, result.events)
    }

    fun startHandManual() {
        val state = _uiState.value.handState ?: return
        if (state.street != Street.Waiting && state.street != Street.Payout) return
        val base = if (state.street == Street.Payout) returnToWaiting(state) else state
        val result = startHand(base, config, "off-${System.currentTimeMillis()}") { n ->
            ByteArray(n).also { random.nextBytes(it) }
        }
        if (result.ok) applyEngineResult(result.state, result.events)
    }

    private fun bootstrap() {
        viewModelScope.launch {
            var state = createEmptyTable(config)
            val human = sitDown(state, 0, HUMAN_ID, name, config.buyIn)
            if (!human.ok) return@launch
            state = human.state
            val taken = mutableSetOf(name)
            val botCount = (seats - 1).coerceAtLeast(1)
            repeat(botCount) { i ->
                val empty = state.players.firstOrNull { it.status == PlayerStatus.Empty } ?: return@repeat
                val botName = pickBotName(taken)
                taken.add(botName)
                val r = sitDown(state, empty.seat, makeBotUserId("off-$i"), botName, config.buyIn)
                if (r.ok) state = r.state
            }
            pushSystem("Dealer", "Offline table ready — you vs $botCount bot(s)")
            syncState(state)
            _uiState.update { it.copy(bootstrapped = true) }
            scheduleBotLoop(state)
            autoStartAfterBootstrap(state)
        }
    }

    private fun autoStartAfterBootstrap(state: HandState) {
        viewModelScope.launch {
            delay(800)
            if (_uiState.value.handState?.street == Street.Waiting) {
                val result = startHand(state, config, "off-${System.currentTimeMillis()}") { n ->
                    ByteArray(n).also { random.nextBytes(it) }
                }
                if (result.ok) applyEngineResult(result.state, result.events)
            }
        }
    }

    private fun applyEngineResult(next: HandState, events: List<EngineEvent>) {
        announceEvents(next, events)
        syncState(next)
        scheduleBotLoop(next)
        // Stay on payout until the player taps Next Hand (startHandManual).
        if (next.street == Street.Payout) {
            payoutJob?.cancel()
            payoutJob = null
        }
    }

    private fun syncState(state: HandState) {
        val pub = toPublicView("offline", state, config)
        val mySeat = state.players.indexOfFirst { it.userId == HUMAN_ID }
        val priv = if (mySeat >= 0) toPrivateView(state, mySeat, config) else null
        _uiState.update {
            it.copy(
                handState = state,
                publicTable = mapPublicTable(pub, turnEndsAt),
                legal = priv?.legal?.let { la ->
                    LegalActions(
                        types = la.types.map { t -> t.name.lowercase() },
                        callAmount = la.callAmount,
                        minRaiseTo = la.minRaiseTo,
                        maxRaiseTo = la.maxRaiseTo,
                    )
                },
                holeCards = priv?.holeCards?.let { (a, b) -> listOf(a, b) },
            )
        }
    }

    private fun scheduleBotLoop(state: HandState) {
        botJob?.cancel()
        turnEndsAt = null
        val toAct = state.toAct ?: run {
            syncState(state)
            return
        }
        if (state.street == Street.Waiting || state.street == Street.Payout || state.street == Street.Showdown) {
            syncState(state)
            return
        }
        val actor = state.players.getOrNull(toAct) ?: return

        if (isBotUserId(actor.userId)) {
            val delayMs = Random.nextLong(700, 1500)
            turnEndsAt = System.currentTimeMillis() + delayMs
            syncState(state)
            botJob = viewModelScope.launch {
                delay(delayMs)
                val current = _uiState.value.handState ?: return@launch
                if (current.toAct != toAct) return@launch
                val intent = chooseBotAction(current, toAct, config)
                val result = if (intent != null) {
                    applyAction(current, toAct, intent, config)
                } else {
                    applyTimeout(current, config)
                }
                if (result.ok) applyEngineResult(result.state, result.events)
            }
            return
        }

        // Human clock — fold on timeout
        turnEndsAt = System.currentTimeMillis() + config.turnTimeMs
        syncState(state)
        botJob = viewModelScope.launch {
            delay(config.turnTimeMs)
            val current = _uiState.value.handState ?: return@launch
            if (current.toAct != toAct) return@launch
            val actorNow = current.players.getOrNull(toAct) ?: return@launch
            if (isBotUserId(actorNow.userId)) return@launch
            val result = applyTimeout(current, config)
            if (result.ok) {
                pushSystem("Dealer", "Time — folded")
                applyEngineResult(result.state, result.events)
            }
        }
    }

    private fun announceEvents(state: HandState, events: List<EngineEvent>) {
        for (event in events) {
            when (event) {
                is EngineEvent.ActionApplied -> {
                    val actorName = state.players[event.seat].name ?: "Seat ${event.seat}"
                    pushChat("system", actorName, formatAction(event.action.name.lowercase(), event.amount))
                }
                is EngineEvent.StreetAdvanced -> {
                    val label = event.street.name.lowercase().replaceFirstChar { it.uppercase() }
                    val cards = event.cards.joinToString(" ") { cardToString(it) }
                    pushSystem("Dealer", "$label — $cards")
                }
                is EngineEvent.HandEnded -> announceHandEnded(state, event)
                is EngineEvent.BlindsPosted -> {
                    val sb = state.players[event.sbSeat].name ?: "SB"
                    val bb = state.players[event.bbSeat].name ?: "BB"
                    pushSystem("Dealer", "Blinds — $sb posts ${event.sb}, $bb posts ${event.bb}")
                }
                else -> Unit
            }
        }
    }

    private fun announceHandEnded(state: HandState, event: EngineEvent.HandEnded) {
        if (event.winners.size == 1) {
            val w = event.winners.first()
            val winnerName = state.players[w.seat].name ?: "Seat ${w.seat}"
            val hand = w.handName?.takeIf { it != "Uncontested" }?.let { " with $it" } ?: ""
            pushSystem("Dealer", "$winnerName wins ${w.amount}$hand")
        } else if (event.winners.isNotEmpty()) {
            val parts = event.winners.map { w ->
                val winnerName = state.players[w.seat].name ?: "Seat ${w.seat}"
                val hand = w.handName?.takeIf { it != "Uncontested" }?.let { " ($it)" } ?: ""
                "$winnerName ${w.amount}$hand"
            }
            pushSystem("Dealer", "Split pot — ${parts.joinToString(", ")}")
        }
    }

    private fun formatAction(action: String, amount: Int): String = when (action) {
        "fold" -> "folds"
        "check" -> "checks"
        "call" -> "calls $amount"
        "bet" -> "bets $amount"
        "raise" -> "raises to $amount"
        "allin" -> if (amount > 0) "goes all-in ($amount)" else "goes all-in"
        else -> action
    }

    private fun pushSystem(name: String, text: String) = pushChat("system", name, text)

    private fun pushChat(userId: String, sender: String, text: String) {
        _uiState.update {
            it.copy(chat = it.chat + ChatMessage(userId, sender, text, System.currentTimeMillis()))
        }
    }

    private fun mapPublicTable(
        view: com.felt.android.engine.PublicTableView,
        endsAt: Long?,
    ): PublicTable =
        PublicTable(
            tableId = view.tableId,
            handId = view.handId,
            street = view.street.name.lowercase(),
            community = view.community,
            players = view.players.map { p ->
                com.felt.android.core.model.PublicPlayer(
                    seat = p.seat,
                    userId = p.userId,
                    name = p.name,
                    stack = p.stack,
                    bet = p.bet,
                    status = p.status.name.lowercase(),
                    hasCards = p.hasCards,
                    holeCards = p.holeCards?.let { listOf(it.first, it.second) },
                    avatarId = when {
                        p.userId == HUMAN_ID -> humanAvatarId
                        p.userId != null -> avatarIdFromUserId(p.userId)
                        else -> null
                    },
                )
            },
            dealerButton = view.dealerButton,
            sbSeat = view.sbSeat,
            bbSeat = view.bbSeat,
            toAct = view.toAct,
            currentBet = view.currentBet,
            pot = view.pot,
            sidePots = view.sidePots.map { com.felt.android.core.model.SidePot(it.amount, it.eligible) },
            actionSeq = view.actionSeq,
            version = view.version,
            winners = view.winners.map {
                com.felt.android.core.model.Winner(it.seat, it.amount, it.handName)
            },
            showdownHands = view.showdownHands.map {
                com.felt.android.core.model.ShowdownHand(it.seat, it.handName, it.cards)
            },
            turnEndsAt = endsAt,
            config = com.felt.android.core.model.TableConfig(
                maxSeats = view.config.maxSeats,
                smallBlind = view.config.smallBlind,
                bigBlind = view.config.bigBlind,
                buyIn = view.config.buyIn,
                turnTimeMs = view.config.turnTimeMs.toInt(),
            ),
        )

    private fun parseActionType(action: String): ActionType? = when (action.lowercase()) {
        "fold" -> ActionType.Fold
        "check" -> ActionType.Check
        "call" -> ActionType.Call
        "bet" -> ActionType.Bet
        "raise" -> ActionType.Raise
        "allin" -> ActionType.AllIn
        else -> null
    }
}
