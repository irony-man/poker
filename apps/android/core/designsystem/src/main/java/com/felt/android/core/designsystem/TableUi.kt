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
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
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
        val folded = player.status == "folded"
        val sittingOut = player.status == "sittingOut"
        Column(
            modifier = Modifier
                .offset(x = x - 58.dp, y = y - 48.dp)
                .width(116.dp)
                .then(if (folded || sittingOut) Modifier else Modifier),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            if (player.status == "empty") {
                if (canSit) {
                    FeltGhostButton(text = "Sit", onClick = onSit)
                } else {
                    Text("Empty", fontSize = 11.sp, color = FeltColors.Cream.copy(alpha = 0.4f))
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
                            color = if (isWinner) FeltColors.Ink else Color.White,
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier
                                .padding(top = 3.dp)
                                .clip(RoundedCornerShape(4.dp))
                                .background(if (isWinner) FeltColors.Gold else FeltColors.Ink.copy(alpha = 0.75f))
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
                                        color = FeltColors.Ink,
                                        fontSize = 8.sp,
                                        fontWeight = FontWeight.ExtraBold,
                                        modifier = Modifier
                                            .clip(RoundedCornerShape(topStart = 3.dp, topEnd = 3.dp))
                                            .background(FeltColors.YouYellow)
                                            .padding(horizontal = 5.dp, vertical = 1.dp),
                                    )
                                }
                                Text(
                                    text = (player.name ?: "Seat").take(10),
                                    color = FeltColors.Ink,
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
                                    .background(if (isWinner) FeltColors.Gold else FeltColors.StackRed)
                                    .padding(horizontal = 8.dp, vertical = 5.dp),
                            )
                        }
                    }

                    if (player.status == "allin") {
                        Text(
                            "ALL-IN",
                            fontSize = 8.sp,
                            fontWeight = FontWeight.Bold,
                            color = FeltColors.Neon,
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
                }
            }

            if (isWinner && winAmount != null && winAmount > 0) {
                Text(
                    text = "+${formatMoney(winAmount)}",
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
    var raiseInput by remember(min, table.actionSeq) { mutableStateOf(min.toString()) }

    fun snap(v: Int) = ((v / bb) * bb).coerceIn(min, max)
    fun parseRaise() = snap(raiseInput.toIntOrNull() ?: min)
    fun commitRaiseInput() {
        raiseInput = parseRaise().toString()
    }

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

    val canBet = "bet" in legal.types || "raise" in legal.types
    val betLabel = if ("bet" in legal.types) "Bet" else "Raise"

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
            Column(
                modifier = Modifier.padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                StatusChip(text = "Your move", accent = FeltColors.Neon)
            if (canBet) {
                OutlinedTextField(
                    value = raiseInput,
                    onValueChange = { raiseInput = it.filter { ch -> ch.isDigit() } },
                    label = { Text("$betLabel to") },
                    supportingText = { Text("$min – $max") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    keyboardActions = KeyboardActions(onDone = { commitRaiseInput() }),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = FeltColors.Cream,
                        unfocusedTextColor = FeltColors.Cream,
                        focusedBorderColor = FeltColors.Gold.copy(alpha = 0.5f),
                        unfocusedBorderColor = FeltColors.Cream.copy(alpha = 0.2f),
                    ),
                    modifier = Modifier.fillMaxWidth(),
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
                        text = "Bet ${parseRaise()}",
                        onClick = {
                            commitRaiseInput()
                            onAction("bet", parseRaise())
                        },
                        modifier = Modifier.weight(1f),
                    )
                }
                if ("raise" in legal.types) {
                    FeltPrimaryButton(
                        text = "Raise ${parseRaise()}",
                        onClick = {
                            commitRaiseInput()
                            onAction("raise", parseRaise())
                        },
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
