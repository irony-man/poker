package com.felt.android.core.designsystem

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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.cos
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

@Composable
fun FeltTableLayout(
    table: TableUiState,
    userId: String?,
    holeCards: List<String>?,
    onSit: (Int) -> Unit,
    modifier: Modifier = Modifier,
    canSit: Boolean = true,
) {
    BoxWithConstraints(
        modifier = modifier
            .fillMaxWidth()
            .fillMaxHeight(),
    ) {
        val tableHeight = maxHeight
        FeltTableSurface(
            modifier = Modifier
                .fillMaxWidth()
                .height(tableHeight),
        ) {
            Box(Modifier.fillMaxSize()) {
                Box(
                    modifier = Modifier
                        .align(Alignment.TopCenter)
                        .fillMaxWidth()
                        .padding(top = 18.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    PotDisplay(amount = table.pot.coerceAtLeast(0))
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
                            Text("Dealing…", color = FeltColors.Cream.copy(alpha = 0.4f), fontSize = 12.sp)
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
                        isDealer = table.dealerButton == player.seat && table.street != "waiting",
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
                        turnEndsAt = if (table.toAct == player.seat) table.turnEndsAt else null,
                        turnTotalMs = table.turnTimeMs,
                        onSit = { onSit(player.seat) },
                        canSit = canSit,
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
    isDealer: Boolean,
    isToAct: Boolean,
    isWinner: Boolean,
    winAmount: Int?,
    handName: String?,
    myCards: List<String>?,
    winningCards: Set<String>,
    turnEndsAt: Long?,
    turnTotalMs: Long,
    onSit: () -> Unit,
    modifier: Modifier = Modifier,
    canSit: Boolean = true,
) {
    BoxWithConstraints(modifier = modifier) {
        val rad = Math.toRadians(angleDeg)
        val x = maxWidth * (0.5f + cos(rad).toFloat() * 0.40f)
        val y = maxHeight * (0.5f + sin(rad).toFloat() * 0.36f)
        val faceDown = myCards.isNullOrEmpty() && player.hasCards
        val dealKey = handId.ifBlank { "idle" }
        val highlightMode = winningCards.isNotEmpty()
        val isBot = player.userId?.startsWith("bot:") == true

        Column(
            modifier = Modifier
                .offset(x = x - 52.dp, y = y - 40.dp)
                .width(104.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            when {
                faceDown -> {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        modifier = Modifier.padding(bottom = 4.dp),
                    ) {
                        key("$dealKey-${player.seat}-back-0") {
                            PlayingCard(
                                code = null,
                                faceDown = true,
                                width = if (isSelf) 42.dp else 34.dp,
                                height = if (isSelf) 60.dp else 48.dp,
                                dealDelayMs = 0,
                            )
                        }
                        key("$dealKey-${player.seat}-back-1") {
                            PlayingCard(
                                code = null,
                                faceDown = true,
                                width = if (isSelf) 42.dp else 34.dp,
                                height = if (isSelf) 60.dp else 48.dp,
                                dealDelayMs = 80,
                            )
                        }
                    }
                }
                !myCards.isNullOrEmpty() -> {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        modifier = Modifier.padding(bottom = 4.dp),
                    ) {
                        myCards.forEachIndexed { index, code ->
                            key("$dealKey-${player.seat}-$code") {
                                PlayingCard(
                                    code = code,
                                    highlight = highlightMode && code in winningCards,
                                    dimmed = highlightMode && code !in winningCards,
                                    width = if (isSelf) 42.dp else 34.dp,
                                    height = if (isSelf) 60.dp else 48.dp,
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
                    color = if (isWinner) FeltColors.Ink else FeltColors.Cream.copy(alpha = 0.85f),
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier
                        .padding(bottom = 4.dp)
                        .clip(RoundedCornerShape(999.dp))
                        .background(
                            if (isWinner) FeltColors.Gold
                            else FeltColors.Ink.copy(alpha = 0.8f),
                        )
                        .border(
                            1.dp,
                            if (isWinner) FeltColors.Gold else FeltColors.Cream.copy(alpha = 0.2f),
                            RoundedCornerShape(999.dp),
                        )
                        .padding(horizontal = 8.dp, vertical = 2.dp),
                )
            }

            if (player.status == "empty") {
                if (canSit) {
                    FeltGhostButton(text = "Sit", onClick = onSit)
                } else {
                    Text("Empty", fontSize = 11.sp, color = FeltColors.Cream.copy(alpha = 0.4f))
                }
            } else {
                val avatarSize = if (isSelf) 48.dp else 42.dp
                val ringSize = avatarSize + 12.dp
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier.size(ringSize),
                ) {
                    if (isToAct) {
                        SeatTurnRing(
                            endsAt = turnEndsAt,
                            totalMs = turnTotalMs,
                            active = true,
                            ringSize = ringSize,
                        )
                    }
                    PlayerAvatar(
                        avatarId = player.avatarId,
                        userId = player.userId,
                        size = avatarSize,
                        selected = isSelf || isWinner,
                    )
                    if (isDealer) {
                        Text(
                            "D",
                            color = FeltColors.Ink,
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier
                                .align(Alignment.TopStart)
                                .clip(RoundedCornerShape(999.dp))
                                .background(FeltColors.Cream)
                                .padding(horizontal = 4.dp, vertical = 1.dp),
                        )
                    }
                    if (isBot && !isWinner) {
                        Text(
                            "BOT",
                            color = FeltColors.Cyan,
                            fontSize = 7.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier
                                .align(Alignment.BottomEnd)
                                .clip(RoundedCornerShape(4.dp))
                                .background(FeltColors.Cyan.copy(alpha = 0.2f))
                                .padding(horizontal = 3.dp, vertical = 1.dp),
                        )
                    }
                    if (player.status == "folded") {
                        Box(
                            modifier = Modifier
                                .size(avatarSize)
                                .clip(RoundedCornerShape(999.dp))
                                .background(FeltColors.Ink.copy(alpha = 0.72f)),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                "FOLD",
                                color = FeltColors.Cream.copy(alpha = 0.8f),
                                fontSize = 8.sp,
                                fontWeight = FontWeight.Bold,
                            )
                        }
                    }
                }
                Column(
                    modifier = Modifier
                        .padding(top = 4.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(
                            when {
                                isWinner -> FeltColors.Gold
                                isToAct -> FeltColors.Gold.copy(alpha = 0.92f)
                                isSelf -> FeltColors.Ink.copy(alpha = 0.9f)
                                else -> FeltColors.Ink.copy(alpha = 0.82f)
                            },
                        )
                        .then(
                            when {
                                isWinner || isToAct -> Modifier.border(1.dp, FeltColors.Gold, RoundedCornerShape(10.dp))
                                isSelf -> Modifier.border(1.dp, FeltColors.Gold.copy(alpha = 0.45f), RoundedCornerShape(10.dp))
                                else -> Modifier
                            },
                        )
                        .padding(horizontal = 6.dp, vertical = 4.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(
                        text = buildString {
                            append(player.name ?: "Seat ${player.seat}")
                            if (isSelf) append(" · you")
                        },
                        color = when {
                            isWinner || isToAct -> FeltColors.Ink
                            isSelf -> FeltColors.Cyan
                            else -> FeltColors.Cream
                        },
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    CasinoChip(amount = player.stack)
                    if (player.bet > 0) {
                        Text(
                            "Bet ${formatChips(player.bet)}",
                            fontSize = 9.sp,
                            color = if (isWinner || isToAct) FeltColors.Ink.copy(0.55f)
                            else FeltColors.Cream.copy(0.5f),
                        )
                    }
                    if (player.status == "allin") {
                        Text(
                            "ALL-IN",
                            fontSize = 8.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (isWinner || isToAct) FeltColors.Ink else FeltColors.Neon,
                        )
                    }
                }
            }

            if (isWinner && winAmount != null && winAmount > 0) {
                Text(
                    text = "+${formatChips(winAmount)}",
                    color = FeltColors.Gold,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
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
) {
    val mySeat = table.players.find { it.userId == userId }?.seat
    val isTurn = table.toAct == mySeat && legal != null
    val bb = table.bigBlind
    val min = legal?.minRaiseTo ?: 0
    val max = legal?.maxRaiseTo ?: 0
    var raiseTo by remember(min, table.actionSeq) { mutableIntStateOf(min) }

    if (!isTurn || legal == null || legal.types.isEmpty()) {
        HudPanel(modifier = modifier.fillMaxWidth().padding(top = 4.dp)) {
            Text(
                text = waitingLabel
                    ?: when {
                        table.street == "waiting" -> "Waiting for players…"
                        table.toAct != mySeat -> "Waiting for your turn…"
                        else -> "—"
                    },
                color = FeltColors.Cream.copy(alpha = 0.55f),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        return
    }

    val (timerLabel, timerUrgent) = turnSecondsLabel(
        if (table.toAct == mySeat) table.turnEndsAt else null,
    )

    Column(modifier = modifier.fillMaxWidth().padding(top = 4.dp)) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(
                    Brush.verticalGradient(
                        listOf(FeltColors.InkPanel, FeltColors.InkRaised),
                    ),
                )
                .border(1.dp, FeltColors.Gold.copy(alpha = 0.25f), RoundedCornerShape(16.dp)),
        ) {
            Column {
                MoveTimerStrip(
                    endsAt = table.turnEndsAt,
                    totalMs = table.turnTimeMs,
                )
                Column(
                    modifier = Modifier.padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        StatusChip(text = "Your move", accent = FeltColors.Neon)
                        if (timerLabel != null) {
                            Text(
                                text = timerLabel,
                                color = if (timerUrgent) FeltColors.Danger else FeltColors.Cream.copy(alpha = 0.75f),
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                fontFamily = FontFamily.Monospace,
                            )
                        }
                    }
            if ("bet" in legal.types || "raise" in legal.types) {
                Text("Raise to $raiseTo ($min – $max)", fontSize = 12.sp, color = FeltColors.Cream.copy(0.7f))
                Slider(
                    value = raiseTo.toFloat().coerceIn(min.toFloat(), max.toFloat()),
                    onValueChange = { raiseTo = ((it / bb).toInt() * bb).coerceIn(min, max) },
                    valueRange = min.toFloat()..max.toFloat().coerceAtLeast(min.toFloat()),
                )
            }
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                if ("fold" in legal.types) {
                    FeltGhostButton(
                        text = "Fold",
                        onClick = { onAction("fold", null) },
                        modifier = Modifier.weight(1f),
                    )
                }
                if ("check" in legal.types) {
                    FeltGhostButton(
                        text = "Check",
                        onClick = { onAction("check", null) },
                        modifier = Modifier.weight(1f),
                    )
                }
                if ("call" in legal.types) {
                    FeltGhostButton(
                        text = "Call ${legal.callAmount}",
                        onClick = { onAction("call", null) },
                        modifier = Modifier.weight(1f),
                    )
                }
                if ("bet" in legal.types) {
                    FeltPrimaryButton(
                        text = "Bet $raiseTo",
                        onClick = { onAction("bet", raiseTo) },
                        modifier = Modifier.weight(1f),
                    )
                }
                if ("raise" in legal.types) {
                    FeltPrimaryButton(
                        text = "Raise $raiseTo",
                        onClick = { onAction("raise", raiseTo) },
                        modifier = Modifier.weight(1f),
                    )
                }
                if ("allin" in legal.types) {
                    FeltPrimaryButton(
                        text = "All-in",
                        onClick = { onAction("allin", null) },
                        modifier = Modifier.weight(1f),
                    )
                }
            }
                }
            }
        }
    }
}
