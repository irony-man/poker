package com.felt.android.feature.table

import com.felt.android.feature.table.PublicTableMapper.toTableUi
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.felt.android.core.designsystem.FeltColors
import com.felt.android.core.designsystem.FeltGhostButton
import com.felt.android.core.designsystem.FeltPrimaryButton
import com.felt.android.core.designsystem.FeltTableLayout
import com.felt.android.core.designsystem.HudPanel
import com.felt.android.core.designsystem.LegalActionsUi
import com.felt.android.core.designsystem.StatusChip
import com.felt.android.core.designsystem.TableActionControls
import com.felt.android.core.model.ConnectionStatus
import com.felt.android.core.model.PublicTable

@Composable
fun TableScreen(
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: TableViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    var chatInput by remember { mutableStateOf("") }
    var buyInSeat by remember { mutableIntStateOf(-1) }

    Box(modifier = modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(12.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                FeltGhostButton(text = "← Lobby", onClick = onBack)
                ConnectionBadge(state.connection)
            }

            state.invite?.let { code ->
                Text(
                    text = "Invite: $code",
                    color = FeltColors.Gold,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 12.sp,
                    modifier = Modifier.padding(vertical = 4.dp),
                )
            }

            state.lastError?.let { err ->
                StatusChip(text = "$err", accent = FeltColors.Danger, modifier = Modifier.padding(bottom = 8.dp))
            }

            state.emojiBurst?.let { burst ->
                Text(
                    text = "${burst.emoji} ${burst.name}",
                    fontSize = 28.sp,
                    modifier = Modifier.align(Alignment.CenterHorizontally),
                )
            }

            if (state.loading && state.table == null) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = FeltColors.Gold)
                }
            } else {
                state.table?.let { table ->
                    FeltTableLayout(
                        table = table.toTableUi(),
                        userId = state.userId,
                        holeCards = state.private?.holeCards,
                        onSit = { buyInSeat = it },
                    )

                    TableActionControls(
                        table = table.toTableUi(),
                        userId = state.userId,
                        legal = state.private?.legal?.let {
                            LegalActionsUi(it.types, it.callAmount, it.minRaiseTo, it.maxRaiseTo)
                        },
                        onAction = { action, amount ->
                            viewModel.dispatch(TableContract.Intent.SendAction(action, amount))
                        },
                    )

                    TableFooterControls(
                        table = table,
                        userId = state.userId,
                        onStartHand = { viewModel.dispatch(TableContract.Intent.StartHand) },
                        onAddBots = { viewModel.dispatch(TableContract.Intent.AddBots(it)) },
                        onRemoveBots = { viewModel.dispatch(TableContract.Intent.RemoveAllBots) },
                        onTopUp = { seat, amount ->
                            viewModel.dispatch(TableContract.Intent.TopUp(seat, amount))
                        },
                    )
                }
            }
        }

        Row(modifier = Modifier.align(Alignment.TopEnd).padding(12.dp)) {
            FeltGhostButton(
                text = if (state.chatOpen) "Hide chat" else "Chat",
                onClick = { viewModel.dispatch(TableContract.Intent.ToggleChat) },
            )
        }

        if (state.chatOpen) {
            ChatDrawer(
                messages = state.chat,
                input = chatInput,
                onInputChange = { chatInput = it },
                onSend = {
                    if (chatInput.isNotBlank()) {
                        viewModel.dispatch(TableContract.Intent.SendChat(chatInput.trim()))
                        chatInput = ""
                    }
                },
                onEmoji = { viewModel.dispatch(TableContract.Intent.SendEmoji(it)) },
                modifier = Modifier
                    .align(Alignment.CenterEnd)
                    .fillMaxHeight()
                    .width(280.dp)
                    .padding(8.dp),
            )
        }

        if (buyInSeat >= 0 && state.table != null) {
            BuyInDialog(
                seat = buyInSeat,
                minBuyIn = state.table!!.config.minBuyIn,
                maxBuyIn = state.table!!.config.maxBuyIn,
                onDismiss = { buyInSeat = -1 },
                onConfirm = { buyIn ->
                    viewModel.dispatch(TableContract.Intent.Sit(buyInSeat, buyIn))
                    buyInSeat = -1
                },
            )
        }
    }
}

@Composable
private fun ConnectionBadge(status: ConnectionStatus) {
    val accent = when (status) {
        ConnectionStatus.Open -> FeltColors.Neon
        ConnectionStatus.Connecting -> FeltColors.Gold
        ConnectionStatus.Closed -> FeltColors.Danger
        ConnectionStatus.Idle -> FeltColors.Cream.copy(alpha = 0.5f)
    }
    StatusChip(text = status.name.lowercase(), accent = accent)
}

@Composable
private fun TableFooterControls(
    table: PublicTable,
    userId: String?,
    onStartHand: () -> Unit,
    onAddBots: (Int) -> Unit,
    onRemoveBots: () -> Unit,
    onTopUp: (Int, Int) -> Unit,
) {
    val mySeat = table.players.find { it.userId == userId }?.seat
    val emptySeats = table.players.count { it.status == "empty" }
    val seated = table.players.count { it.userId != null && it.stack > 0 }
    var botCount by remember { mutableIntStateOf(minOf(3, emptySeats.coerceAtLeast(1))) }

    Row(
        modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
    ) {
        if ((table.street == "waiting" || table.street == "payout") && mySeat != null && seated >= 2) {
            FeltGhostButton(text = "Start hand", onClick = onStartHand)
        }
        if ((table.street == "waiting" || table.street == "payout") && emptySeats > 0) {
            FeltGhostButton(text = "Add $botCount bots", onClick = { onAddBots(botCount) })
            FeltGhostButton(text = "Remove bots", onClick = onRemoveBots)
        }
        if (mySeat != null && (table.street == "waiting" || table.street == "payout")) {
            FeltGhostButton(
                text = "Top up +${table.config.minBuyIn}",
                onClick = { onTopUp(mySeat, table.config.minBuyIn) },
            )
        }
    }
}

@Composable
private fun ChatDrawer(
    messages: List<com.felt.android.core.model.ChatMessage>,
    input: String,
    onInputChange: (String) -> Unit,
    onSend: () -> Unit,
    onEmoji: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    HudPanel(modifier = modifier) {
        Column(modifier = Modifier.fillMaxSize()) {
            Text("Chat", color = FeltColors.Gold, fontWeight = FontWeight.Bold)
            LazyColumn(modifier = Modifier.weight(1f).padding(vertical = 8.dp)) {
                items(messages) { msg ->
                    Text("${msg.name}: ${msg.text}", fontSize = 12.sp, color = FeltColors.Cream.copy(0.85f))
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                listOf("👍", "😂", "🔥", "💀").forEach { emoji ->
                    FeltGhostButton(text = emoji, onClick = { onEmoji(emoji) })
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(
                    value = input,
                    onValueChange = onInputChange,
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                )
                FeltPrimaryButton(text = "Send", onClick = onSend)
            }
        }
    }
}

@Composable
private fun BuyInDialog(
    seat: Int,
    minBuyIn: Int,
    maxBuyIn: Int,
    onDismiss: () -> Unit,
    onConfirm: (Int) -> Unit,
) {
    var buyIn by remember { mutableIntStateOf(minBuyIn) }
    Box(
        modifier = Modifier.fillMaxSize().background(FeltColors.Ink.copy(alpha = 0.7f)),
        contentAlignment = Alignment.Center,
    ) {
        HudPanel(modifier = Modifier.padding(24.dp)) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Sit seat $seat", color = FeltColors.Gold, fontWeight = FontWeight.Bold)
                Text("Buy-in: $buyIn ($minBuyIn–$maxBuyIn)")
                Slider(
                    value = buyIn.toFloat(),
                    onValueChange = { buyIn = it.toInt() },
                    valueRange = minBuyIn.toFloat()..maxBuyIn.toFloat(),
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FeltGhostButton(text = "Cancel", onClick = onDismiss)
                    FeltPrimaryButton(text = "Sit", onClick = { onConfirm(buyIn) })
                }
            }
        }
    }
}
