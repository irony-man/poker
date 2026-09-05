package com.pokr.android.core.designsystem

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin

data class TablePlayerUi(
    val seat: Int,
    val userId: String?,
    val name: String?,
    val stack: Int,
    val bet: Int,
    val status: String,
    val hasCards: Boolean = false,
    val holeCards: List<String>? = null,
    val avatarId: Int? = null,
    val avatarUrl: String? = null,
    val ready: Boolean = false,
)

data class TableUiState(
    val handId: String = "",
    val street: String,
    val community: List<String>,
    val pot: Int,
    val maxSeats: Int,
    val dealerButton: Int,
    val toAct: Int?,
    val actionSeq: Int,
    val bigBlind: Int,
    val players: List<TablePlayerUi>,
    val winningCards: Set<String> = emptySet(),
    val handNameBySeat: Map<Int, String> = emptyMap(),
    val winAmountBySeat: Map<Int, Int> = emptyMap(),
    val turnEndsAt: Long? = null,
    val turnTimeMs: Long = 20_000L,
)

data class LegalActionsUi(
    val types: List<String>,
    val callAmount: Int,
    val minRaiseTo: Int,
    val maxRaiseTo: Int,
)

/** Between-hand / sit / host controls for the Actions dock idle state. */
data class TableActionTools(
    val startLabel: String? = null,
    val onStart: (() -> Unit)? = null,
    val isReady: Boolean = false,
    val canSitOut: Boolean = false,
    val sitOutLabel: String = "Sit out",
    val onSitOut: (() -> Unit)? = null,
    val canSitIn: Boolean = false,
    val sitInLabel: String = "Sit in",
    val onSitIn: (() -> Unit)? = null,
    val canTopUp: Boolean = false,
    val topUpLabel: String = "Top up",
    val onTopUp: (() -> Unit)? = null,
    val canSitAndPlay: Boolean = false,
    val onSitAndPlay: (() -> Unit)? = null,
    val canAddBot: Boolean = false,
    val addBotLabel: String = "+ Bot",
    val onAddBot: (() -> Unit)? = null,
    val onFillBots: (() -> Unit)? = null,
    val canRemoveBots: Boolean = false,
    val onRemoveBots: (() -> Unit)? = null,
    val botGroups: List<Pair<String, String>> = emptyList(),
    val botGroupId: String? = null,
    val onBotGroupChange: ((String) -> Unit)? = null,
    val kickTargets: List<Pair<Int, String>> = emptyList(),
    val onKick: ((Int) -> Unit)? = null,
    val readyPlayers: List<ReadyRosterPlayer> = emptyList(),
    val readyCount: Int? = null,
    val readyTotal: Int? = null,
    val readyHeading: String = "Ready",
) {
    fun hasAny(): Boolean = onStart != null ||
        canSitOut ||
        canSitIn ||
        canTopUp ||
        canSitAndPlay ||
        canAddBot ||
        canRemoveBots ||
        kickTargets.isNotEmpty() ||
        readyPlayers.isNotEmpty()
}

private data class PendingConfirm(
    val action: String,
    val amount: Int?,
    val label: String,
)

@Composable
fun PokrTableLayout(
    table: TableUiState,
    userId: String?,
    holeCards: List<String>?,
    onSit: (Int) -> Unit,
    modifier: Modifier = Modifier,
    canSit: Boolean = true,
    landscape: Boolean = false,
    tableColorId: Int = 0,
) {
    BoxWithConstraints(
        modifier = modifier
            .fillMaxWidth()
            .fillMaxHeight(),
    ) {
        val tableHeight = maxHeight
        PokrTableSurface(
            modifier = Modifier
                .fillMaxWidth()
                .height(tableHeight),
            tableColorId = tableColorId,
        ) {
            Box(Modifier.fillMaxSize()) {
                Box(
                    modifier = Modifier
                        .align(Alignment.TopCenter)
                        .fillMaxWidth()
                        .padding(top = 10.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    DealerPotZone(
                        amount = table.pot.coerceAtLeast(0),
                        dealerName = table.players.find { it.seat == table.dealerButton }?.name,
                        showDealer = table.street != "waiting",
                    )
                }

                Box(
                    modifier = Modifier
                        .align(Alignment.Center)
                        .offset(y = 10.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(5.dp),
                        ) {
                            val highlightMode = table.winningCards.isNotEmpty()
                            table.community.forEachIndexed { index, card ->
                                key("${table.handId}-$card") {
                                    PlayingCard(
                                        code = card,
                                        highlight = highlightMode && card in table.winningCards,
                                        dimmed = highlightMode && card !in table.winningCards,
                                        width = 40.dp,
                                        height = 56.dp,
                                        dealDelayMs = index * 70,
                                    )
                                }
                            }
                        }
                        if (table.community.isEmpty() && table.street != "waiting") {
                            Text("Dealing…", color = PokrColors.Cream.copy(alpha = 0.9f), fontSize = 12.sp)
                        }
                    }
                }

                table.players.forEach { player ->
                    SeatChip(
                        player = player,
                        handId = table.handId,
                        angleDeg = seatAngleForHero(player.seat, table.maxSeats, userId?.let { uid ->
                            table.players.find { it.userId == uid }?.seat
                        }),
                        isSelf = player.userId == userId,
                        isToAct = table.toAct == player.seat,
                        isWinner = table.winAmountBySeat.containsKey(player.seat) &&
                            (table.street == "payout" || table.street == "showdown"),
                        winAmount = table.winAmountBySeat[player.seat],
                        handName = table.handNameBySeat[player.seat],
                        myCards = when {
                            player.userId == userId -> holeCards
                            !player.holeCards.isNullOrEmpty() -> player.holeCards
                            else -> null
                        },
                        winningCards = table.winningCards,
                        showReady = (table.street == "waiting" || table.street == "payout") &&
                            player.ready &&
                            player.status != "sittingOut",
                        turnEndsAt = if (table.toAct == player.seat) table.turnEndsAt else null,
                        turnTotalMs = table.turnTimeMs,
                        onSit = { onSit(player.seat) },
                        canSit = canSit,
                        landscape = landscape,
                        modifier = Modifier.fillMaxSize(),
                    )
                }
            }
        }
    }
}

@Composable
private fun SeatChip(
    player: TablePlayerUi,
    handId: String,
    angleDeg: Double,
    isSelf: Boolean,
    isToAct: Boolean,
    isWinner: Boolean,
    winAmount: Int?,
    handName: String?,
    myCards: List<String>?,
    winningCards: Set<String>,
    showReady: Boolean,
    turnEndsAt: Long?,
    turnTotalMs: Long,
    onSit: () -> Unit,
    modifier: Modifier = Modifier,
    canSit: Boolean = true,
    landscape: Boolean = false,
) {
    BoxWithConstraints(modifier = modifier) {
        val rad = Math.toRadians(angleDeg)
        val ry = if (landscape) 0.34f else 0.36f
        val x = maxWidth * (0.5f + cos(rad).toFloat() * 0.40f)
        val y = maxHeight * (0.5f + sin(rad).toFloat() * ry)
        val faceDown = myCards.isNullOrEmpty() && player.hasCards
        val dealKey = handId.ifBlank { "idle" }
        val highlightMode = winningCards.isNotEmpty()
        val folded = player.status == "folded"
        val sittingOut = player.status == "sittingOut"
        val seatWidth = if (landscape) 76.dp else 116.dp
        val offsetX = if (landscape) 38.dp else 58.dp
        val offsetY = if (landscape) 42.dp else 48.dp
        Column(
            modifier = Modifier
                .offset(x = x - offsetX, y = y - offsetY)
                .width(seatWidth)
                .then(if (folded || sittingOut) Modifier else Modifier),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            if (player.status == "empty") {
                if (canSit) {
                    PokrGhostButton(text = "Sit", onClick = onSit, chrome = PokrChrome.Play)
                } else {
                    Text("Empty", fontSize = 11.sp, color = PokrColors.Cream.copy(alpha = 0.85f))
                }
                return@Column
            }

            if (landscape) {
                LandscapeSeatChrome(
                    player = player,
                    dealKey = dealKey,
                    faceDown = faceDown,
                    myCards = myCards,
                    winningCards = winningCards,
                    highlightMode = highlightMode,
                    isSelf = isSelf,
                    isToAct = isToAct,
                    isWinner = isWinner,
                    turnEndsAt = turnEndsAt,
                    turnTotalMs = turnTotalMs,
                    folded = folded,
                )
                if (showReady) {
                    Text(
                        "READY",
                        fontSize = 7.sp,
                        fontWeight = FontWeight.Bold,
                        color = PokrColors.Cream.copy(alpha = 0.85f),
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
                if (isWinner && winAmount != null && winAmount > 0) {
                    Text(
                        text = "+${formatMoney(winAmount)}",
                        color = PokrColors.Brass,
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
                return@Column
            }

            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp),
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.then(if (folded || sittingOut) Modifier else Modifier),
                ) {
                    when {
                        faceDown -> {
                            Row(horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                                key("$dealKey-${player.seat}-back-0") {
                                    PlayingCard(
                                        code = null,
                                        faceDown = true,
                                        width = if (isSelf) 40.dp else 32.dp,
                                        height = if (isSelf) 56.dp else 46.dp,
                                        dealDelayMs = 0,
                                    )
                                }
                                key("$dealKey-${player.seat}-back-1") {
                                    PlayingCard(
                                        code = null,
                                        faceDown = true,
                                        width = if (isSelf) 40.dp else 32.dp,
                                        height = if (isSelf) 56.dp else 46.dp,
                                        dealDelayMs = 80,
                                    )
                                }
                            }
                        }
                        !myCards.isNullOrEmpty() -> {
                            Row(horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                                myCards.forEachIndexed { index, code ->
                                    key("$dealKey-${player.seat}-$code") {
                                        PlayingCard(
                                            code = code,
                                            highlight = highlightMode && code in winningCards,
                                            dimmed = highlightMode && code !in winningCards,
                                            width = if (isSelf) 40.dp else 32.dp,
                                            height = if (isSelf) 56.dp else 46.dp,
                                            dealDelayMs = index * 80,
                                        )
                                    }
                                }
                            }
                        }
                    }

                    if (!handName.isNullOrBlank() && (isWinner || myCards != null)) {
                        Text(
                            text = handName,
                            color = if (isWinner) PokrColors.Ink else Color.White,
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier
                                .padding(top = 3.dp)
                                .clip(RoundedCornerShape(4.dp))
                                .background(if (isWinner) PokrColors.Brass else PokrColors.Ink.copy(alpha = 0.75f))
                                .padding(horizontal = 6.dp, vertical = 2.dp),
                        )
                    }

                    if (player.bet > 0) {
                        CasinoChip(
                            amount = player.bet,
                            size = ChipSize.Sm,
                            modifier = Modifier.padding(top = 2.dp),
                        )
                    }

                    Row(
                        verticalAlignment = Alignment.Bottom,
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        modifier = Modifier.padding(top = 4.dp),
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            if (isToAct) {
                                SeatTurnRing(
                                    endsAt = turnEndsAt,
                                    totalMs = turnTotalMs,
                                    active = true,
                                    ringSize = if (isSelf) 34.dp else 30.dp,
                                )
                            }
                            PlayerAvatar(
                                avatarId = player.avatarId,
                                avatarUrl = player.avatarUrl,
                                userId = player.userId,
                                size = if (isSelf) 26.dp else 22.dp,
                                selected = isSelf || isWinner,
                            )
                        }
                        Row(verticalAlignment = Alignment.Bottom) {
                            Column {
                                if (isSelf) {
                                    Text(
                                        text = "YOU",
                                        color = PokrColors.Ink,
                                        fontSize = 8.sp,
                                        fontWeight = FontWeight.ExtraBold,
                                        modifier = Modifier
                                            .clip(RoundedCornerShape(topStart = 3.dp, topEnd = 3.dp))
                                            .background(PokrColors.YouYellow)
                                            .padding(horizontal = 5.dp, vertical = 1.dp),
                                    )
                                }
                                Text(
                                    text = (player.name ?: "Seat").take(10),
                                    color = PokrColors.Ink,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                    modifier = Modifier
                                        .widthIn(max = 52.dp)
                                        .clip(
                                            if (isSelf) RoundedCornerShape(bottomStart = 3.dp, bottomEnd = 3.dp)
                                            else RoundedCornerShape(3.dp),
                                        )
                                        .background(Color.White)
                                        .padding(horizontal = 5.dp, vertical = 3.dp),
                                )
                            }
                            Text(
                                text = formatMoney(player.stack),
                                color = Color.White,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.ExtraBold,
                                modifier = Modifier
                                    .background(if (isWinner) PokrColors.Brass else PokrColors.StackRed)
                                    .padding(horizontal = 8.dp, vertical = 5.dp),
                            )
                        }
                    }

                    if (player.status == "allin") {
                        Text(
                            "ALL-IN",
                            fontSize = 8.sp,
                            fontWeight = FontWeight.Bold,
                            color = PokrColors.Positive,
                            modifier = Modifier.padding(top = 2.dp),
                        )
                    }
                    if (folded) {
                        Text(
                            "FOLD",
                            fontSize = 8.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White.copy(alpha = 0.7f),
                            modifier = Modifier.padding(top = 2.dp),
                        )
                    }
                    if (sittingOut) {
                        Text(
                            "OUT",
                            fontSize = 8.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFFFFD54F).copy(alpha = 0.85f),
                            modifier = Modifier.padding(top = 2.dp),
                        )
                    }
                    if (showReady) {
                        Text(
                            "READY",
                            fontSize = 7.sp,
                            fontWeight = FontWeight.Bold,
                            color = PokrColors.Cream.copy(alpha = 0.85f),
                            modifier = Modifier.padding(top = 2.dp),
                        )
                    }
                }
            }

            if (isWinner && winAmount != null && winAmount > 0) {
                Text(
                    text = "+${formatMoney(winAmount)}",
                    color = PokrColors.Brass,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
        }
    }
}


/** Landscape seat: cards → bet chip → avatar + turn ring → stack/name. */
@Composable
private fun LandscapeSeatChrome(
    player: TablePlayerUi,
    dealKey: String,
    faceDown: Boolean,
    myCards: List<String>?,
    winningCards: Set<String>,
    highlightMode: Boolean,
    isSelf: Boolean,
    isToAct: Boolean,
    isWinner: Boolean,
    turnEndsAt: Long?,
    turnTotalMs: Long,
    folded: Boolean,
) {
    val cardW = 26.dp
    val cardH = 36.dp
    val displayName = if (isSelf) "You" else (player.name ?: "Seat").take(8)

    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        if (faceDown || !myCards.isNullOrEmpty()) {
            Row(
                horizontalArrangement = Arrangement.spacedBy((-6).dp),
                verticalAlignment = Alignment.Bottom,
                modifier = Modifier.padding(bottom = 2.dp),
            ) {
                if (faceDown) {
                    key("$dealKey-${player.seat}-back-0") {
                        PlayingCard(
                            code = null,
                            faceDown = true,
                            width = cardW,
                            height = cardH,
                            dealDelayMs = 0,
                        )
                    }
                    key("$dealKey-${player.seat}-back-1") {
                        PlayingCard(
                            code = null,
                            faceDown = true,
                            width = cardW,
                            height = cardH,
                            dealDelayMs = 80,
                        )
                    }
                } else {
                    myCards!!.forEachIndexed { index, code ->
                        key("$dealKey-${player.seat}-$code") {
                            PlayingCard(
                                code = code,
                                highlight = highlightMode && code in winningCards,
                                dimmed = highlightMode && code !in winningCards,
                                width = cardW,
                                height = cardH,
                                dealDelayMs = index * 80,
                            )
                        }
                    }
                }
            }
        }

        if (player.bet > 0) {
            CasinoChip(
                amount = player.bet,
                size = ChipSize.Sm,
                modifier = Modifier.padding(bottom = 2.dp),
            )
        }

        Box(contentAlignment = Alignment.Center) {
            if (isToAct) {
                SeatTurnRing(
                    endsAt = turnEndsAt,
                    totalMs = turnTotalMs,
                    active = true,
                    ringSize = 36.dp,
                )
            }
            PlayerAvatar(
                avatarId = player.avatarId,
                avatarUrl = player.avatarUrl,
                userId = player.userId,
                size = 22.dp,
                selected = isSelf || isWinner,
            )
        }

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 2.dp)
                .clip(RoundedCornerShape(4.dp)),
        ) {
            Text(
                text = formatMoney(player.stack),
                color = Color.White,
                fontSize = 10.sp,
                fontWeight = FontWeight.ExtraBold,
                modifier = Modifier
                    .fillMaxWidth()
                    .background(if (isWinner) PokrColors.Brass else PokrColors.StackRed)
                    .padding(horizontal = 2.dp, vertical = 2.dp),
            )
            Text(
                text = displayName,
                color = PokrColors.Ink,
                fontSize = 8.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier
                    .fillMaxWidth()
                    .background(if (isSelf) PokrColors.YouYellow else Color.White)
                    .padding(horizontal = 2.dp, vertical = 2.dp),
            )
        }

        if (folded) {
            Text(
                "FOLD",
                fontSize = 7.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White.copy(alpha = 0.8f),
                modifier = Modifier.padding(top = 2.dp),
            )
        }
        if (player.status == "allin") {
            Text(
                "ALL-IN",
                fontSize = 7.sp,
                fontWeight = FontWeight.Bold,
                color = PokrColors.Positive,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
    }
}

@Composable
fun TableActionControls(
    table: TableUiState,
    userId: String?,
    legal: LegalActionsUi?,
    onAction: (String, Int?) -> Unit,
    modifier: Modifier = Modifier,
    waitingLabel: String? = null,
    landscape: Boolean = false,
    tools: TableActionTools? = null,
) {
    val myPlayer = table.players.find { it.userId == userId }
    val mySeat = myPlayer?.seat
    val myStack = myPlayer?.stack ?: 0
    val isTurn = table.toAct == mySeat && legal != null && legal.types.isNotEmpty()
    val bb = table.bigBlind.coerceAtLeast(1)
    val min = legal?.minRaiseTo ?: 0
    val max = legal?.maxRaiseTo ?: 0
    var raiseAmount by remember(min, table.actionSeq) { mutableIntStateOf(min) }
    var confirm by remember(table.actionSeq) { mutableStateOf<PendingConfirm?>(null) }
    val isCompact = LocalConfiguration.current.screenWidthDp < 600

    fun snap(v: Int): Int {
        if (max <= min) return min
        val snapped = ((v.toFloat() / bb).roundToInt() * bb)
        return snapped.coerceIn(min, max)
    }

    fun setRaise(raw: Int) {
        raiseAmount = snap(raw)
    }

    val waitingCopy = waitingLabel
        ?: when {
            table.street == "waiting" -> "Waiting for players…"
            table.street == "payout" || table.street == "showdown" -> "Hand complete — start next when ready"
            table.toAct != mySeat -> "Waiting for your turn…"
            else -> "—"
        }

    if (!isTurn || legal == null) {
        val betweenHands = table.street == "waiting" || table.street == "payout"
        if (tools != null && tools.hasAny() && (betweenHands || tools.canSitAndPlay)) {
            TableToolsPanel(
                tools = tools,
                copy = waitingCopy,
                landscape = landscape,
                modifier = modifier,
            )
            return
        }
        Column(
            modifier = modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            PokerChipShuffle(size = 40.dp)
            Text(
                text = waitingCopy,
                color = PokrColors.InkStrongMuted,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
            )
        }
        return
    }

    val canBet = "bet" in legal.types || "raise" in legal.types
    val betLabel = if ("bet" in legal.types) "Bet" else "Raise"
    val betAction = if ("bet" in legal.types) "bet" else "raise"
    val amount = snap(raiseAmount)
    val pot = table.pot
    val currentBet = table.players.maxOfOrNull { it.bet } ?: 0
    val halfPot = snap((pot / 2) + currentBet)
    val potBet = snap(pot + currentBet)
    val callAmount = legal.callAmount

    fun needsConfirm(action: String, amt: Int?): Boolean {
        if (action == "allin") return true
        if (action == "fold" && callAmount > 0 && callAmount >= myStack * 0.4) return true
        if ((action == "bet" || action == "raise") && amt != null && myStack > 0 && amt >= myStack * 0.5) {
            return true
        }
        return false
    }

    fun commit(action: String, amt: Int?, label: String) {
        if (needsConfirm(action, amt)) {
            confirm = PendingConfirm(action, amt, label)
            return
        }
        onAction(action, amt)
    }

    if (confirm != null) {
        val pending = confirm!!
        Column(
            modifier = modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                text = "Confirm ${pending.label}?",
                color = PokrColors.InkStrong,
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                PokrGhostButton(
                    text = "Cancel",
                    onClick = { confirm = null },
                    chrome = PokrChrome.Lobby,
                    modifier = Modifier.weight(1f),
                )
                PokrPrimaryButton(
                    text = "Confirm",
                    onClick = {
                        onAction(pending.action, pending.amount)
                        confirm = null
                    },
                    modifier = Modifier.weight(1f),
                )
            }
        }
        return
    }

    val sliderColors = SliderDefaults.colors(
        thumbColor = PokrColors.Sidebar,
        activeTrackColor = PokrColors.Sidebar.copy(alpha = 0.85f),
        inactiveTrackColor = PokrColors.Sidebar.copy(alpha = 0.15f),
        disabledThumbColor = PokrColors.Sidebar.copy(alpha = 0.35f),
        disabledActiveTrackColor = PokrColors.Sidebar.copy(alpha = 0.25f),
    )
    val sliderSteps = if (max > min && bb > 0) {
        (((max - min) / bb) - 1).coerceAtLeast(0)
    } else {
        0
    }

    if (landscape) {
        Column(modifier = modifier.fillMaxWidth()) {
            MoveTimerStrip(
                endsAt = table.turnEndsAt,
                totalMs = table.turnTimeMs,
                compact = true,
            )
            if (canBet) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 6.dp, vertical = 2.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Text(
                        text = formatMoney(amount),
                        color = PokrColors.InkStrong,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                    )
                    Slider(
                        value = amount.toFloat(),
                        onValueChange = { setRaise(it.roundToInt()) },
                        valueRange = min.toFloat()..max.coerceAtLeast(min).toFloat(),
                        steps = sliderSteps,
                        enabled = max > min,
                        colors = sliderColors,
                        modifier = Modifier.weight(1f),
                    )
                    listOf("Min" to min, "½" to halfPot, "Pot" to potBet, "Max" to max).forEach { (label, value) ->
                        PokrChoiceChip(
                            text = label,
                            selected = amount == value,
                            onClick = { setRaise(value) },
                            chrome = PokrChrome.Lobby,
                        )
                    }
                }
            }
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 6.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                if ("fold" in legal.types) {
                    PokrDangerButton(
                        text = "Fold",
                        onClick = { commit("fold", null, "Fold") },
                        modifier = Modifier.weight(1f),
                    )
                } else {
                    Box(Modifier.weight(1f))
                }
                when {
                    "check" in legal.types -> PokrSoftButton(
                        text = "Check",
                        onClick = { commit("check", null, "Check") },
                        modifier = Modifier.weight(1f),
                    )
                    "call" in legal.types -> PokrSoftButton(
                        text = "Call ${formatMoney(callAmount)}",
                        onClick = { commit("call", null, "Call") },
                        modifier = Modifier.weight(1f),
                    )
                    else -> Box(Modifier.weight(1f))
                }
                when {
                    canBet -> PokrPrimaryButton(
                        text = betLabel,
                        onClick = { commit(betAction, amount, "$betLabel ${formatMoney(amount)}") },
                        modifier = Modifier.weight(1f),
                    )
                    "allin" in legal.types -> PokrPrimaryButton(
                        text = "All-in",
                        onClick = { commit("allin", null, "All-in") },
                        modifier = Modifier.weight(1f),
                    )
                    else -> Box(Modifier.weight(1f))
                }
            }
        }
        return
    }

    Column(modifier = modifier.fillMaxWidth()) {
        MoveTimerStrip(
            endsAt = table.turnEndsAt,
            totalMs = table.turnTimeMs,
        )
        Column(
            modifier = Modifier.padding(10.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            if (canBet) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Bottom,
                ) {
                    Text(
                        text = "$betLabel to",
                        color = PokrColors.InkStrongMuted,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        text = "${formatMoney(amount)}  ${formatMoney(min)}–${formatMoney(max)}",
                        color = PokrColors.InkStrong,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                    )
                }
                Slider(
                    value = amount.toFloat(),
                    onValueChange = { setRaise(it.roundToInt()) },
                    valueRange = min.toFloat()..max.coerceAtLeast(min).toFloat(),
                    steps = sliderSteps,
                    enabled = max > min,
                    colors = sliderColors,
                    modifier = Modifier.fillMaxWidth(),
                )
                if (!isCompact) {
                    OutlinedTextField(
                        value = amount.toString(),
                        onValueChange = { raw ->
                            val digits = raw.filter { it.isDigit() }
                            if (digits.isEmpty()) setRaise(min)
                            else setRaise(digits.toIntOrNull() ?: min)
                        },
                        label = { Text("$betLabel to") },
                        supportingText = { Text("$min – $max") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        keyboardActions = KeyboardActions(onDone = { setRaise(amount) }),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = PokrColors.InkStrong,
                            unfocusedTextColor = PokrColors.InkStrong,
                            focusedBorderColor = PokrColors.Sidebar.copy(alpha = 0.45f),
                            unfocusedBorderColor = PokrColors.Sidebar.copy(alpha = 0.18f),
                        ),
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    listOf(
                        "Min" to min,
                        "½" to halfPot,
                        "Pot" to potBet,
                        "Max" to max,
                    ).forEach { (label, value) ->
                        PokrChoiceChip(
                            text = label,
                            selected = amount == value,
                            onClick = { setRaise(value) },
                            chrome = PokrChrome.Lobby,
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                if ("fold" in legal.types) {
                    PokrDangerButton(
                        text = "Fold",
                        onClick = { commit("fold", null, "Fold") },
                        modifier = Modifier.weight(1f),
                    )
                }
                if ("check" in legal.types) {
                    PokrSoftButton(
                        text = "Check",
                        onClick = { commit("check", null, "Check") },
                        modifier = Modifier.weight(1f),
                    )
                }
                if ("call" in legal.types) {
                    PokrSoftButton(
                        text = "Call ${formatMoney(callAmount)}",
                        onClick = { commit("call", null, "Call") },
                        modifier = Modifier.weight(1f),
                    )
                }
                if (canBet) {
                    PokrPrimaryButton(
                        text = "$betLabel ${formatMoney(amount)}",
                        onClick = { commit(betAction, amount, "$betLabel ${formatMoney(amount)}") },
                        modifier = Modifier.weight(1f),
                    )
                }
                if ("allin" in legal.types) {
                    PokrPrimaryButton(
                        text = "All-in",
                        onClick = { commit("allin", null, "All-in") },
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }
    }
}

@Composable
private fun TableToolsPanel(
    tools: TableActionTools,
    copy: String,
    landscape: Boolean,
    modifier: Modifier = Modifier,
) {
    val primaryLabel = when {
        tools.onStart != null -> tools.startLabel ?: "Next hand"
        tools.canSitIn -> tools.sitInLabel
        tools.canSitAndPlay -> "Sit and play"
        tools.canTopUp -> tools.topUpLabel
        else -> null
    }
    val primaryOnClick = when {
        tools.onStart != null -> tools.onStart
        tools.canSitIn -> tools.onSitIn
        tools.canSitAndPlay -> tools.onSitAndPlay
        tools.canTopUp -> tools.onTopUp
        else -> null
    }
    val primaryIsReady = tools.onStart != null && tools.isReady
    val showSecondarySitIn = tools.canSitIn && tools.onSitIn != null && tools.onStart != null
    val showSecondaryTopUp = tools.canTopUp && tools.onTopUp != null &&
        !(tools.onStart == null && !tools.canSitIn && !tools.canSitAndPlay)
    val hostRow = tools.canAddBot || tools.canRemoveBots || showSecondaryTopUp || tools.kickTargets.isNotEmpty()

    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = if (landscape) 6.dp else 10.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(
            text = copy,
            color = PokrColors.InkStrongMuted,
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium,
        )
        if (tools.readyPlayers.isNotEmpty()) {
            ReadyPlayersRoster(
                players = tools.readyPlayers,
                heading = tools.readyHeading,
                readyCount = tools.readyCount ?: tools.readyPlayers.count { it.ready },
                readyTotal = tools.readyTotal ?: tools.readyPlayers.size,
            )
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
        ) {
            if (primaryLabel != null && primaryOnClick != null) {
                if (primaryIsReady) {
                    PokrGhostButton(
                        text = primaryLabel,
                        onClick = primaryOnClick,
                        chrome = PokrChrome.Lobby,
                        modifier = Modifier.weight(1f, fill = false),
                    )
                } else {
                    PokrPrimaryButton(
                        text = primaryLabel,
                        onClick = primaryOnClick,
                        modifier = Modifier.weight(1f, fill = false),
                    )
                }
            }
            if (tools.canSitOut && tools.onSitOut != null) {
                PokrSoftButton(
                    text = tools.sitOutLabel,
                    onClick = tools.onSitOut,
                )
            }
            if (showSecondarySitIn) {
                val sitIn = tools.onSitIn
                if (sitIn != null) {
                    PokrSoftButton(
                        text = tools.sitInLabel,
                        onClick = sitIn,
                    )
                }
            }
        }
        if (hostRow) {
            if (tools.canAddBot && tools.botGroups.size > 1 && tools.onBotGroupChange != null) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    tools.botGroups.forEach { (id, name) ->
                        PokrChoiceChip(
                            text = name,
                            selected = (tools.botGroupId ?: tools.botGroups.first().first) == id,
                            onClick = { tools.onBotGroupChange.invoke(id) },
                            chrome = PokrChrome.Lobby,
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }
            Row(
                horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
                modifier = Modifier.fillMaxWidth(),
            ) {
                if (tools.canAddBot && tools.onAddBot != null) {
                    PokrSoftButton(text = tools.addBotLabel, onClick = tools.onAddBot)
                }
                if (tools.canAddBot && tools.onFillBots != null) {
                    PokrGhostButton(
                        text = "Fill",
                        onClick = tools.onFillBots,
                        chrome = PokrChrome.Lobby,
                    )
                }
                if (tools.canRemoveBots && tools.onRemoveBots != null) {
                    PokrGhostButton(
                        text = "Remove bots",
                        onClick = tools.onRemoveBots,
                        chrome = PokrChrome.Lobby,
                    )
                }
                if (showSecondaryTopUp) {
                    val topUp = tools.onTopUp
                    if (topUp != null) {
                        PokrSoftButton(text = tools.topUpLabel, onClick = topUp)
                    }
                }
            }
            tools.kickTargets.forEach { (seat, name) ->
                PokrGhostButton(
                    text = "Kick $name",
                    onClick = { tools.onKick?.invoke(seat) },
                    chrome = PokrChrome.Lobby,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }
}
