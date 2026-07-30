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
import com.felt.android.core.designsystem.FloatingActionPanel
import com.felt.android.core.designsystem.HudPanel
import com.felt.android.core.designsystem.LegalActionsUi
import com.felt.android.core.designsystem.StatusChip
import com.felt.android.core.designsystem.TableActionControls
import com.felt.android.core.designsystem.UnlockSensorOrientation
import com.felt.android.core.designsystem.rememberIsLandscapePhone
import com.felt.android.core.designsystem.WinHandDialog
import com.felt.android.core.designsystem.WinLineUi
import com.felt.android.core.model.ConnectionStatus
import com.felt.android.core.model.PublicTable

@Composable
fun TableScreen(
    onBack: () -> Unit,
    webBaseUrl: String = "http://localhost:3000",
    modifier: Modifier = Modifier,
    viewModel: TableViewModel = hiltViewModel(),
) {
    UnlockSensorOrientation()
    val landscape = rememberIsLandscapePhone()

    val state by viewModel.uiState.collectAsStateWithLifecycle()
    var chatInput by remember { mutableStateOf("") }
    var topUpOpen by remember { mutableStateOf(false) }
    var dismissedWinHandId by remember { mutableStateOf<String?>(null) }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(FeltColors.Ink)
            .statusBarsPadding()
            .navigationBarsPadding(),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(
                    horizontal = if (landscape) 8.dp else 12.dp,
                    vertical = if (landscape) 4.dp else 8.dp,
                ),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                FeltGhostButton(text = "← Lobby", onClick = {
                    viewModel.dispatch(TableContract.Intent.LeaveTable)
                    onBack()
                })
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    ConnectionBadge(state.connection)
                    if (state.spectating) {
                        StatusChip(text = "Spectating", accent = FeltColors.Gold)
                    }
                    FeltGhostButton(
                        text = "Leave",
                        onClick = {
                            viewModel.dispatch(TableContract.Intent.LeaveTable)
                            onBack()
                        },
                    )
                    FeltGhostButton(
                        text = if (state.chatOpen) "Hide" else "Chat",
                        onClick = { viewModel.dispatch(TableContract.Intent.ToggleChat) },
                    )
                }
            }

            val inviteCode = state.invite
            val tableIdForShare = state.tableId.ifBlank { state.table?.tableId.orEmpty() }
            if (!landscape && inviteCode != null && tableIdForShare.isNotBlank()) {
                TableInviteShare(
                    tableId = tableIdForShare,
                    inviteCode = inviteCode,
                    webBaseUrl = webBaseUrl,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }

            state.lastError?.let { err ->
                StatusChip(
                    text = err,
                    accent = FeltColors.Danger,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }

            state.emojiBurst?.let { burst ->
                Text(
                    text = "${burst.emoji} ${burst.name}",
                    fontSize = 28.sp,
                    modifier = Modifier.align(Alignment.CenterHorizontally),
                )
            }

            if (state.loading && state.table == null) {
                Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = FeltColors.Gold)
                }
            } else {
                state.table?.let { table ->
                    val tableUi = table.toTableUi()
                    val mySeat = table.players.find { it.userId == state.userId }?.seat
                    val isMyTurn = tableUi.toAct == mySeat &&
                        (state.private?.legal?.types?.isNotEmpty() == true)

                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth()
                            .padding(top = 6.dp),
                    ) {
                        FeltTableLayout(
                            table = tableUi,
                            userId = state.userId,
                            holeCards = state.private?.holeCards,
                            onSit = { seat ->
                                viewModel.dispatch(
                                    TableContract.Intent.Sit(seat, table.config.buyIn),
                                )
                            },
                            canSit = !state.spectating,
                            landscape = landscape,
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(bottom = if (landscape) 64.dp else 0.dp),
                        )

                        FloatingActionPanel(expanded = isMyTurn, landscape = landscape) {
                            TableActionControls(
                                table = tableUi,
                                userId = state.userId,
                                legal = state.private?.legal?.let {
                                    LegalActionsUi(it.types, it.callAmount, it.minRaiseTo, it.maxRaiseTo)
                                },
                                onAction = { action, amount ->
                                    viewModel.dispatch(TableContract.Intent.SendAction(action, amount))
                                },
                                waitingLabel = if (state.spectating) {
                                    "Spectating — you are not seated"
                                } else {
                                    null
                                },
                                landscape = landscape,
                            )
                        }
                    }

                    if (state.spectating) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 6.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                "Watching",
                                color = FeltColors.Cream.copy(alpha = 0.55f),
                                fontSize = 12.sp,
                                modifier = Modifier.weight(1f),
                            )
                            FeltGhostButton(
                                text = "Sit and play",
                                onClick = {
                                    viewModel.dispatch(TableContract.Intent.EnableSitToPlay)
                                },
                            )
                        }
                    }

                    if (!state.spectating && !landscape) {
                        TableFooterControls(
                            table = table,
                            userId = state.userId,
                            onStartHand = { viewModel.dispatch(TableContract.Intent.StartHand) },
                            onAddBots = { viewModel.dispatch(TableContract.Intent.AddBots(it)) },
                            onRemoveBots = { viewModel.dispatch(TableContract.Intent.RemoveAllBots) },
                            onTopUp = { topUpOpen = true },
                            onSitOut = { viewModel.dispatch(TableContract.Intent.SitOut) },
                            onSitIn = { viewModel.dispatch(TableContract.Intent.SitIn) },
                        )
                    }
                    if (!state.spectating && landscape) {
                        val betweenHands = table.street == "waiting" || table.street == "payout"
                        val myPlayer = table.players.find { it.userId == state.userId }
                        val playersInHand = table.players.count {
                            it.userId != null && it.stack > 0 && it.status != "sittingOut"
                        }
                        if (myPlayer != null && myPlayer.status != "sittingOut" && playersInHand >= 2 && betweenHands) {
                            FeltGhostButton(
                                text = "Start",
                                onClick = { viewModel.dispatch(TableContract.Intent.StartHand) },
                                modifier = Modifier.padding(top = 2.dp),
                            )
                        }
                    }
                }
            }
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

        val mySeatForTopUp = state.table?.players?.find { it.userId == state.userId }
        if (topUpOpen && state.table != null && mySeatForTopUp != null && mySeatForTopUp.stack == 0) {
            val table = state.table!!
            TopUpDialog(
                currentStack = mySeatForTopUp.stack,
                buyIn = table.config.buyIn,
                onDismiss = { topUpOpen = false },
                onConfirm = { amount ->
                    viewModel.dispatch(TableContract.Intent.TopUp(mySeatForTopUp.seat, amount))
                    topUpOpen = false
                },
            )
        }

        val table = state.table
        val showWin = table != null &&
            table.street == "payout" &&
            table.winners.isNotEmpty() &&
            table.handId != dismissedWinHandId
        if (showWin && table != null) {
            val youWon = table.winners.any { w ->
                table.players.find { it.seat == w.seat }?.userId == state.userId
            }
            val mySeat = table.players.find { it.userId == state.userId }?.seat
            val canStart = !state.spectating &&
                mySeat != null &&
                table.players.count { it.userId != null && it.stack > 0 } >= 2
            WinHandDialog(
                winners = table.winners
                    .groupBy { it.seat }
                    .map { (seat, awards) ->
                        val player = table.players.find { it.seat == seat }
                        val cards = table.showdownHands.find { it.seat == seat }?.cards.orEmpty()
                        WinLineUi(
                            seat = seat,
                            name = player?.name ?: "Seat $seat",
                            amount = awards.sumOf { it.amount },
                            handName = awards.firstNotNullOfOrNull { it.handName },
                            cards = cards,
                            isSelf = player?.userId == state.userId,
                        )
                    },
                youWon = youWon,
                canStartNext = canStart,
                onNextHand = {
                    dismissedWinHandId = table.handId
                    viewModel.dispatch(TableContract.Intent.StartHand)
                },
                onDismiss = { dismissedWinHandId = table.handId },
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
    onTopUp: () -> Unit,
    onSitOut: () -> Unit,
    onSitIn: () -> Unit,
) {
    val myPlayer = table.players.find { it.userId == userId }
    val mySeat = myPlayer?.seat
    val emptySeats = table.players.count { it.status == "empty" }
    val playersInHand = table.players.count {
        it.userId != null && it.stack > 0 && it.status != "sittingOut"
    }
    val betweenHands = table.street == "waiting" || table.street == "payout"
    val canSitOut =
        myPlayer != null &&
        betweenHands &&
        myPlayer.status != "empty" &&
        myPlayer.status != "sittingOut"
    val canSitIn = myPlayer?.status == "sittingOut" && betweenHands
    val canTopUp = mySeat != null &&
        myPlayer?.stack == 0 &&
        (table.street == "waiting" || table.street == "payout")
    var botCount by remember { mutableIntStateOf(minOf(3, emptySeats.coerceAtLeast(1))) }

    Column(
        modifier = Modifier.padding(top = 6.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        if (mySeat != null && myPlayer.status != "sittingOut" && playersInHand >= 2 && betweenHands) {
            FeltGhostButton(
                text = "Start hand",
                onClick = onStartHand,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        if (emptySeats > 0) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                FeltGhostButton(
                    text = "Add $botCount bots",
                    onClick = { onAddBots(botCount) },
                    modifier = Modifier.weight(1f),
                )
                FeltGhostButton(
                    text = "Remove bots",
                    onClick = onRemoveBots,
                    modifier = Modifier.weight(1f),
                )
            }
        }
        if (canSitOut) {
            FeltGhostButton(
                text = "Sit out",
                onClick = onSitOut,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        if (canSitIn) {
            FeltGhostButton(
                text = "Sit in",
                onClick = onSitIn,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        if (canTopUp) {
            FeltGhostButton(
                text = "Top up",
                onClick = onTopUp,
                modifier = Modifier.fillMaxWidth(),
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
private fun TopUpDialog(
    currentStack: Int,
    buyIn: Int,
    onDismiss: () -> Unit,
    onConfirm: (Int) -> Unit,
) {
    val amount = (buyIn - currentStack).coerceAtLeast(0)
    Box(
        modifier = Modifier.fillMaxSize().background(FeltColors.Ink.copy(alpha = 0.7f)),
        contentAlignment = Alignment.Center,
    ) {
        HudPanel(modifier = Modifier.padding(24.dp)) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Top up", color = FeltColors.Gold, fontWeight = FontWeight.Bold)
                Text(
                    "Stack $currentStack · table buy-in $buyIn",
                    color = FeltColors.Cream.copy(alpha = 0.7f),
                    fontSize = 12.sp,
                )
                Text("Add $amount to reach $buyIn")
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FeltGhostButton(text = "Cancel", onClick = onDismiss, modifier = Modifier.weight(1f))
                    FeltPrimaryButton(
                        text = "Top up $amount",
                        onClick = { onConfirm(amount) },
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }
    }
}
