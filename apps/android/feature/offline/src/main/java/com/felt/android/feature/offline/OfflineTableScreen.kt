package com.felt.android.feature.offline

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.felt.android.core.designsystem.FeltColors
import com.felt.android.core.designsystem.FeltGhostButton
import com.felt.android.core.designsystem.FeltPrimaryButton
import com.felt.android.core.designsystem.FeltTableLayout
import com.felt.android.core.designsystem.FloatingActionPanel
import com.felt.android.core.designsystem.HudPanel
import com.felt.android.core.designsystem.LegalActionsUi
import com.felt.android.core.designsystem.LockPortraitOrientation
import com.felt.android.core.designsystem.StatusChip
import com.felt.android.core.designsystem.TableActionControls
import com.felt.android.core.designsystem.TurnTimerBar
import com.felt.android.core.designsystem.WinHandDialog
import com.felt.android.core.designsystem.WinLineUi

@Composable
fun OfflineTableScreen(
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: OfflineViewModel = hiltViewModel(),
) {
    LockPortraitOrientation()

    val state by viewModel.uiState.collectAsStateWithLifecycle()
    var chatInput by remember { mutableStateOf("") }
    var dismissedWinHandId by remember { mutableStateOf<String?>(null) }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(FeltColors.Ink)
            .statusBarsPadding()
            .navigationBarsPadding(),
    ) {
        if (!state.bootstrapped || state.publicTable == null) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = FeltColors.Gold)
            }
            return
        }

        val table = state.publicTable!!
        val tableUi = table.toOfflineTableUi()

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 12.dp, vertical = 8.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                FeltGhostButton(text = "← Lobby", onClick = onBack)
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    StatusChip(text = "Offline", accent = FeltColors.Neon)
                    StatusChip(text = table.street, accent = FeltColors.Cyan)
                    FeltGhostButton(
                        text = if (state.chatOpen) "Hide" else "Chat",
                        onClick = viewModel::toggleChat,
                    )
                }
            }

            val mySeat = table.players.find { it.userId == HUMAN_USER_ID }?.seat
            val isMyTurn = tableUi.toAct == mySeat && (state.legal?.types?.isNotEmpty() == true)

            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .padding(top = 8.dp),
            ) {
                FeltTableLayout(
                    table = tableUi,
                    userId = HUMAN_USER_ID,
                    holeCards = state.holeCards,
                    onSit = {},
                    modifier = Modifier.fillMaxSize(),
                )

                if (tableUi.turnEndsAt != null &&
                    tableUi.toAct != null &&
                    tableUi.toAct != mySeat
                ) {
                    TurnTimerBar(
                        endsAt = tableUi.turnEndsAt,
                        totalMs = tableUi.turnTimeMs,
                        modifier = Modifier
                            .align(Alignment.TopCenter)
                            .padding(8.dp),
                    )
                }

                FloatingActionPanel(expanded = isMyTurn) {
                    TableActionControls(
                        table = tableUi,
                        userId = HUMAN_USER_ID,
                        legal = state.legal?.let {
                            LegalActionsUi(it.types, it.callAmount, it.minRaiseTo, it.maxRaiseTo)
                        },
                        onAction = { action, amount -> viewModel.sendAction(action, amount) },
                    )
                }
            }

            if (table.street == "waiting" || table.street == "payout") {
                FeltGhostButton(
                    text = if (table.street == "waiting") "Start hand" else "Next hand",
                    onClick = viewModel::startHandManual,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp),
                )
            }
        }

        if (state.chatOpen) {
            HudPanel(
                modifier = Modifier
                    .align(Alignment.CenterEnd)
                    .fillMaxHeight()
                    .width(280.dp)
                    .padding(8.dp),
            ) {
                Column(modifier = Modifier.fillMaxSize()) {
                    Text("Chat", color = FeltColors.Gold, fontWeight = FontWeight.Bold)
                    LazyColumn(modifier = Modifier.weight(1f)) {
                        items(state.chat) { msg ->
                            Text(
                                "${msg.name}: ${msg.text}",
                                color = FeltColors.Cream.copy(alpha = 0.85f),
                            )
                        }
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        listOf("👍", "😂", "🔥").forEach { emoji ->
                            FeltGhostButton(text = emoji, onClick = { viewModel.sendEmoji(emoji) })
                        }
                    }
                    Row {
                        OutlinedTextField(
                            value = chatInput,
                            onValueChange = { chatInput = it },
                            modifier = Modifier.weight(1f),
                            singleLine = true,
                        )
                        FeltPrimaryButton(
                            text = "Send",
                            onClick = {
                                viewModel.sendChat(chatInput)
                                chatInput = ""
                            },
                        )
                    }
                }
            }
        }

        val tableForWin = state.publicTable
        val showWin = tableForWin != null &&
            tableForWin.street == "payout" &&
            tableForWin.winners.isNotEmpty() &&
            tableForWin.handId != dismissedWinHandId
        if (showWin && tableForWin != null) {
            val youWon = tableForWin.winners.any { w ->
                tableForWin.players.find { it.seat == w.seat }?.userId == HUMAN_USER_ID
            }
            WinHandDialog(
                winners = tableForWin.winners
                    .groupBy { it.seat }
                    .map { (seat, awards) ->
                        val player = tableForWin.players.find { it.seat == seat }
                        val cards = tableForWin.showdownHands.find { it.seat == seat }?.cards.orEmpty()
                        WinLineUi(
                            seat = seat,
                            name = player?.name ?: "Seat $seat",
                            amount = awards.sumOf { it.amount },
                            handName = awards.firstNotNullOfOrNull { it.handName },
                            cards = cards,
                            isSelf = player?.userId == HUMAN_USER_ID,
                        )
                    },
                youWon = youWon,
                canStartNext = true,
                onNextHand = {
                    dismissedWinHandId = tableForWin.handId
                    viewModel.startHandManual()
                },
                onDismiss = { dismissedWinHandId = tableForWin.handId },
            )
        }
    }
}
