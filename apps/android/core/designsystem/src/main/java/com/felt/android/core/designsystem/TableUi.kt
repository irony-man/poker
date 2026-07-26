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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
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
    val holeCards: List<String>? = null,
)

data class TableUiState(
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
                        .align(Alignment.Center)
                        .offset(y = (-8).dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        PotDisplay(amount = table.pot.coerceAtLeast(0))
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(5.dp),
                            modifier = Modifier.padding(top = 8.dp),
                        ) {
                            val highlightMode = table.winningCards.isNotEmpty()
                            table.community.forEach { card ->
                                PlayingCard(
                                    code = card,
                                    highlight = highlightMode && card in table.winningCards,
                                    dimmed = highlightMode && card !in table.winningCards,
                                    width = 40.dp,
                                    height = 56.dp,
                                )
                            }
                        }
                        if (table.community.isEmpty() && table.street != "waiting") {
                            Text("Dealing…", color = FeltColors.Cream.copy(alpha = 0.4f), fontSize = 12.sp)
                        }
                    }
                }

                table.players.forEachIndexed { _, player ->
                    SeatChip(
                        player = player,
                        angleDeg = seatAngleForHero(player.seat, table.maxSeats, userId?.let { uid ->
                            table.players.find { it.userId == uid }?.seat
                        }),
                        isSelf = player.userId == userId,
                        isDealer = table.dealerButton == player.seat && table.street != "waiting",
                        isToAct = table.toAct == player.seat,
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
    angleDeg: Double,
    isSelf: Boolean,
    isDealer: Boolean,
    isToAct: Boolean,
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

        Column(
            modifier = Modifier
                .offset(x = x - 52.dp, y = y - 40.dp)
                .width(104.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(FeltColors.Ink.copy(alpha = 0.82f))
                .then(
                    if (isToAct) Modifier.border(1.dp, FeltColors.Neon, RoundedCornerShape(10.dp))
                    else Modifier,
                )
                .padding(6.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(contentAlignment = Alignment.Center) {
                if (isToAct) {
                    SeatTurnRing(
                        endsAt = turnEndsAt,
                        totalMs = turnTotalMs,
                        active = true,
                        modifier = Modifier.align(Alignment.Center),
                    )
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    if (isDealer) {
                        Text("D", color = FeltColors.Gold, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    }
                    Text(
                        text = player.name ?: if (player.status == "empty") "Empty" else "Seat ${player.seat}",
                        color = if (isSelf) FeltColors.Cyan else FeltColors.Cream,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    if (player.status != "empty") {
                        CasinoChip(amount = player.stack)
                        if (player.bet > 0) {
                            Text("Bet ${formatChips(player.bet)}", fontSize = 9.sp, color = FeltColors.Cream.copy(0.5f))
                        }
                    } else {
                        if (canSit) {
                            FeltGhostButton(text = "Sit", onClick = onSit)
                        } else {
                            Text("Empty", fontSize = 11.sp, color = FeltColors.Cream.copy(alpha = 0.4f))
                        }
                    }
                    myCards?.let { cards ->
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                            modifier = Modifier.padding(top = 4.dp),
                        ) {
                            val highlightMode = winningCards.isNotEmpty()
                            cards.forEach { code ->
                                PlayingCard(
                                    code = code,
                                    highlight = highlightMode && code in winningCards,
                                    dimmed = highlightMode && code !in winningCards,
                                    width = if (isSelf) 42.dp else 34.dp,
                                    height = if (isSelf) 60.dp else 48.dp,
                                )
                            }
                        }
                    }
                }
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

    HudPanel(modifier = modifier.fillMaxWidth().padding(top = 4.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            StatusChip(text = "Your move", accent = FeltColors.Neon)
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
