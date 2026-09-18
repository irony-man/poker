package com.pokr.android.core.designsystem

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.key
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun StackedPokrTable(
    table: TableUiState,
    userId: String?,
    holeCards: List<String>?,
    onSit: (Int) -> Unit,
    modifier: Modifier = Modifier,
    canSit: Boolean = true,
    tableColorId: Int = 0,
) {
    val hero = table.players.find { it.userId != null && it.userId == userId }
    val opponents = if (hero != null) {
        table.players.filter { it.seat != hero.seat }
    } else {
        table.players
    }
    val highlightMode = table.winningCards.isNotEmpty()
    val heroCards = when {
        hero != null && !holeCards.isNullOrEmpty() -> holeCards
        hero != null && !hero.holeCards.isNullOrEmpty() -> hero.holeCards
        else -> null
    }

    PokrTableSurface(
        modifier = modifier.fillMaxSize(),
        tableColorId = tableColorId,
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 10.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.SpaceBetween,
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                opponents.forEach { player ->
                    key(player.seat) {
                        StackedOpponentSeat(
                            player = player,
                            isToAct = table.toAct == player.seat,
                            isDealer = table.dealerButton == player.seat,
                            isWinner = table.winAmountBySeat.containsKey(player.seat),
                            winAmount = table.winAmountBySeat[player.seat],
                            actionLabel = table.actionLabelBySeat[player.seat],
                            turnEndsAt = if (table.toAct == player.seat) table.turnEndsAt else null,
                            turnTotalMs = table.turnTimeMs,
                            canSit = canSit,
                            onSit = { onSit(player.seat) },
                        )
                    }
                }
            }

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                    table.community.forEachIndexed { index, card ->
                        key("${table.handId}-$card-$index") {
                            PlayingCard(
                                code = card,
                                highlight = highlightMode && card in table.winningCards,
                                dimmed = highlightMode && card !in table.winningCards,
                                width = 44.dp,
                                height = 62.dp,
                                dealDelayMs = index * 70,
                            )
                        }
                    }
                }
                if (table.community.isEmpty() && table.street != "waiting") {
                    Text("Dealing…", color = PokrColors.Cream.copy(alpha = 0.9f), fontSize = 12.sp)
                }
                Text(
                    text = formatMoney(table.pot.coerceAtLeast(0)),
                    color = Color.White,
                    fontFamily = PokrFonts.Display,
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 28.sp,
                    modifier = Modifier.padding(top = 10.dp),
                )
                table.players.find { it.seat == table.dealerButton }?.name?.let { dealer ->
                    Text(
                        "Dealer · $dealer",
                        color = PokrColors.Cream.copy(alpha = 0.85f),
                        fontSize = 11.sp,
                    )
                }
            }

            if (hero != null) {
                StackedHeroHud(
                    player = hero,
                    holeCards = heroCards,
                    handId = table.handId,
                    isToAct = table.toAct == hero.seat,
                    isWinner = table.winAmountBySeat.containsKey(hero.seat),
                    winAmount = table.winAmountBySeat[hero.seat],
                    handName = table.handNameBySeat[hero.seat],
                    actionLabel = table.actionLabelBySeat[hero.seat],
                    winningCards = table.winningCards,
                    turnEndsAt = if (table.toAct == hero.seat) table.turnEndsAt else null,
                    turnTotalMs = table.turnTimeMs,
                )
            }
        }
    }
}

@Composable
private fun StackedOpponentSeat(
    player: TablePlayerUi,
    isToAct: Boolean,
    isDealer: Boolean,
    isWinner: Boolean,
    winAmount: Int?,
    actionLabel: String?,
    turnEndsAt: Long?,
    turnTotalMs: Long,
    canSit: Boolean,
    onSit: () -> Unit,
) {
    val empty = player.status == "empty"
    Column(
        modifier = Modifier.widthIn(min = 56.dp, max = 72.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        SeatActionPopup(actionLabel)
        if (empty) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(CircleShape)
                    .border(1.dp, Color.White.copy(alpha = 0.4f), CircleShape)
                    .clickable(enabled = canSit, onClick = onSit),
                contentAlignment = Alignment.Center,
            ) {
                Text("Sit", color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold)
            }
            Text("Open", color = Color.White.copy(alpha = 0.8f), fontSize = 10.sp)
            return
        }
        Box {
            if (isToAct) {
                SeatTurnRing(
                    endsAt = turnEndsAt,
                    totalMs = turnTotalMs,
                    active = true,
                    ringSize = 52.dp,
                )
            }
            PlayerAvatar(
                avatarId = player.avatarId,
                avatarUrl = player.avatarUrl,
                userId = player.userId,
                size = 48.dp,
                selected = isWinner,
            )
            if (isDealer) {
                Text(
                    "D",
                    color = Color.Black,
                    fontSize = 8.sp,
                    fontWeight = FontWeight.Black,
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .clip(CircleShape)
                        .background(Color.White)
                        .padding(horizontal = 4.dp, vertical = 1.dp),
                )
            }
        }
        Text(
            text = (player.name ?: "Seat").take(10),
            color = if (player.status == "folded" || player.status == "sittingOut") {
                Color.White.copy(alpha = 0.7f)
            } else {
                Color.White
            },
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Text(
            text = formatMoney(player.stack),
            color = if (isWinner) PokrColors.Brass else Color.White,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
        )
        if (player.bet > 0) {
            Text(
                formatMoney(player.bet),
                color = PokrColors.YouYellow,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
            )
        }
        if (isWinner && winAmount != null && winAmount > 0) {
            Text("+${formatMoney(winAmount)}", color = PokrColors.Positive, fontSize = 10.sp)
        }
    }
}

@Composable
private fun StackedHeroHud(
    player: TablePlayerUi,
    holeCards: List<String>?,
    handId: String,
    isToAct: Boolean,
    isWinner: Boolean,
    winAmount: Int?,
    handName: String?,
    actionLabel: String?,
    winningCards: Set<String>,
    turnEndsAt: Long?,
    turnTotalMs: Long,
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        SeatActionPopup(actionLabel)
        handName?.let {
            Text(
                it.uppercase(),
                color = PokrColors.Cream.copy(alpha = 0.9f),
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }
        if (player.status == "folded") {
            Text("FOLDED", color = PokrColors.Cream.copy(alpha = 0.85f), fontSize = 11.sp)
        }
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Box {
                if (isToAct) {
                    SeatTurnRing(
                        endsAt = turnEndsAt,
                        totalMs = turnTotalMs,
                        active = true,
                        ringSize = 40.dp,
                    )
                }
                PlayerAvatar(
                    avatarId = player.avatarId,
                    avatarUrl = player.avatarUrl,
                    userId = player.userId,
                    size = 36.dp,
                    selected = true,
                )
            }
            Text(
                formatMoney(player.stack),
                color = Color.White,
                fontFamily = PokrFonts.Display,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 18.sp,
            )
            if (isWinner && winAmount != null && winAmount > 0) {
                Text("+${formatMoney(winAmount)}", color = PokrColors.Positive, fontWeight = FontWeight.Bold)
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy((-8).dp)) {
            val cards = holeCards.orEmpty()
            if (cards.isNotEmpty()) {
                cards.forEachIndexed { index, card ->
                    key("$handId-$card-$index") {
                        PlayingCard(
                            code = card,
                            highlight = winningCards.isNotEmpty() && card in winningCards,
                            dimmed = winningCards.isNotEmpty() && card !in winningCards,
                            width = 52.dp,
                            height = 74.dp,
                            dealDelayMs = index * 60,
                        )
                    }
                }
            } else if (player.hasCards) {
                repeat(2) {
                    PlayingCard(code = null, faceDown = true, width = 52.dp, height = 74.dp, animateDeal = false)
                }
            }
        }
    }
}
