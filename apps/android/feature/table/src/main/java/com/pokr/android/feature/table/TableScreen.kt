package com.pokr.android.feature.table

import com.pokr.android.feature.table.PublicTableMapper.toTableUi
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
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import com.pokr.android.core.designsystem.PokrColors
import com.pokr.android.core.designsystem.pokrPageGround
import com.pokr.android.core.designsystem.PokrChrome
import com.pokr.android.core.designsystem.PokrGhostButton
import com.pokr.android.core.designsystem.PokerChipShuffle
import com.pokr.android.core.designsystem.PokrPrimaryButton
import com.pokr.android.core.designsystem.PokrTableLayout
import com.pokr.android.core.designsystem.HudPanel
import com.pokr.android.core.designsystem.LegalActionsUi
import com.pokr.android.core.designsystem.ReadyRosterPlayer
import com.pokr.android.core.designsystem.StatusChip
import com.pokr.android.core.designsystem.TableActionControls
import com.pokr.android.core.designsystem.TableActionDock
import com.pokr.android.core.designsystem.TableActionTools
import com.pokr.android.core.designsystem.TableEmojiStrip
import com.pokr.android.core.designsystem.TableOverflowItem
import com.pokr.android.core.designsystem.TableOverflowTone
import com.pokr.android.core.designsystem.TablePlayHeader
import com.pokr.android.core.designsystem.UnlockSensorOrientation
import com.pokr.android.core.designsystem.rememberIsLandscapePhone
import com.pokr.android.core.designsystem.WinHandDialog
import com.pokr.android.core.designsystem.WinLineUi
import com.pokr.android.core.model.PublicTable

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
    val context = LocalContext.current

    val table = state.table
    val inviteCode = state.invite
    val tableIdForShare = state.tableId.ifBlank { table?.tableId.orEmpty() }
    val myPlayer = table?.players?.find { it.userId == state.userId }
    val betweenHands = table?.street == "waiting" || table?.street == "payout"
    val canSitOut = !state.spectating && myPlayer != null && betweenHands &&
        myPlayer.status != "empty" && myPlayer.status != "sittingOut"
    val canSitIn = !state.spectating && myPlayer?.status == "sittingOut" && betweenHands
    val canTopUp = !state.spectating && myPlayer != null &&
        table?.tournament?.noTopUp != true && myPlayer.stack == 0 && betweenHands
    val emptySeats = table?.players?.count { it.status == "empty" } ?: 0
    val isHost = state.userId != null && table?.hostUserId == state.userId
    val isTournament = table?.tournament != null
    val canAddBot = !state.spectating && !isTournament && emptySeats > 0
    val botSeats = table?.players?.count { it.userId?.startsWith("bot:") == true } ?: 0

    fun leave() {
        viewModel.dispatch(TableContract.Intent.LeaveTable)
        onBack()
    }

    val overflowItems = buildList {
        if (!inviteCode.isNullOrBlank() && tableIdForShare.isNotBlank()) {
            add(
                TableOverflowItem(
                    id = "copy-link",
                    label = "Copy link · $inviteCode",
                    onClick = {
                        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                        clipboard.setPrimaryClip(
                            ClipData.newPlainText(
                                "Pokr table invite",
                                buildTableJoinShareText(webBaseUrl, tableIdForShare, inviteCode),
                            ),
                        )
                    },
                    tone = TableOverflowTone.Accent,
                ),
            )
        }
        add(
            TableOverflowItem(
                id = "chat",
                label = "Chat",
                onClick = { viewModel.dispatch(TableContract.Intent.ToggleChat) },
                tone = TableOverflowTone.Accent,
            ),
        )
        if (canAddBot) {
            add(TableOverflowItem(id = "add-bot", label = "+ Bot", onClick = {
                viewModel.dispatch(TableContract.Intent.AddBots(minOf(3, emptySeats.coerceAtLeast(1))))
            }))
            add(TableOverflowItem(id = "fill", label = "Fill empty seats", onClick = {
                viewModel.dispatch(TableContract.Intent.AddBots(emptySeats))
            }))
        }
        if (canAddBot && botSeats > 0) {
            add(
                TableOverflowItem(
                    id = "remove-bots",
                    label = "Remove bots",
                    onClick = { viewModel.dispatch(TableContract.Intent.RemoveAllBots) },
                    tone = TableOverflowTone.Danger,
                ),
            )
        }
        if (isHost && betweenHands && !isTournament) {
            table?.players
                ?.filter { it.userId != null && it.userId != state.userId && it.status != "empty" }
                ?.forEach { player ->
                    add(
                        TableOverflowItem(
                            id = "kick-${player.seat}",
                            label = "Kick ${player.name ?: "seat ${player.seat}"}",
                            onClick = { viewModel.dispatch(TableContract.Intent.KickPlayer(player.seat)) },
                            tone = TableOverflowTone.Danger,
                        ),
                    )
                }
        }
        if (canSitOut) {
            add(TableOverflowItem(id = "sit-out", label = "Sit out", onClick = {
                viewModel.dispatch(TableContract.Intent.SitOut)
            }))
        }
        if (canSitIn) {
            add(
                TableOverflowItem(
                    id = "sit-in",
                    label = "Sit in",
                    onClick = { viewModel.dispatch(TableContract.Intent.SitIn) },
                    tone = TableOverflowTone.Accent,
                ),
            )
        }
        if (canTopUp) {
            add(
                TableOverflowItem(
                    id = "top-up",
                    label = "Top up",
                    onClick = { topUpOpen = true },
                    tone = TableOverflowTone.Gold,
                ),
            )
        }
        add(
            TableOverflowItem(
                id = "leave",
                label = "Leave table",
                onClick = { leave() },
                tone = TableOverflowTone.Danger,
            ),
        )
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .pokrPageGround()
            .statusBarsPadding()
            .navigationBarsPadding(),
    ) {
        Column(
            modifier = Modifier.fillMaxSize(),
        ) {
            TablePlayHeader(
                statusPill = if (state.spectating) "Spec" else null,
                overflowItems = overflowItems,
            )

            state.lastError?.let { err ->
                StatusChip(
                    text = err,
                    accent = PokrColors.Danger,
                    chrome = PokrChrome.Play,
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
                    PokerChipShuffle(size = 56.dp)
                }
            } else {
                state.table?.let { liveTable ->
                    val tableUi = liveTable.toTableUi()
                    val tools = rememberTableActionTools(
                        table = liveTable,
                        userId = state.userId,
                        spectating = state.spectating,
                        botGroups = state.botGroups,
                        botGroupId = state.botGroupId,
                        onStartHand = { viewModel.dispatch(TableContract.Intent.StartHand) },
                        onAddBots = { viewModel.dispatch(TableContract.Intent.AddBots(it)) },
                        onSelectBotGroup = { viewModel.dispatch(TableContract.Intent.SelectBotGroup(it)) },
                        onKick = { viewModel.dispatch(TableContract.Intent.KickPlayer(it)) },
                        onRemoveBots = { viewModel.dispatch(TableContract.Intent.RemoveAllBots) },
                        onTopUp = { topUpOpen = true },
                        onSitOut = { viewModel.dispatch(TableContract.Intent.SitOut) },
                        onSitIn = { viewModel.dispatch(TableContract.Intent.SitIn) },
                        onSitAndPlay = { viewModel.dispatch(TableContract.Intent.EnableSitToPlay) },
                    )

                    PokrTableLayout(
                        table = tableUi,
                        userId = state.userId,
                        holeCards = state.private?.holeCards,
                        tableColorId = state.tableColorId,
                        onSit = { seat ->
                            viewModel.dispatch(
                                TableContract.Intent.Sit(seat, liveTable.config.buyIn),
                            )
                        },
                        canSit = !state.spectating,
                        landscape = landscape,
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth()
                            .padding(top = 6.dp),
                    )

                    if (!landscape) {
                        TableEmojiStrip(
                            onEmoji = { viewModel.dispatch(TableContract.Intent.SendEmoji(it)) },
                        )
                    }

                    TableActionDock(landscape = landscape) {
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
                            tools = tools,
                        )
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

private fun rememberTableActionTools(
    table: PublicTable,
    userId: String?,
    spectating: Boolean,
    botGroups: List<com.pokr.android.core.model.PublicBotGroup>,
    botGroupId: String?,
    onStartHand: () -> Unit,
    onAddBots: (Int) -> Unit,
    onSelectBotGroup: (String) -> Unit,
    onKick: (Int) -> Unit,
    onRemoveBots: () -> Unit,
    onTopUp: () -> Unit,
    onSitOut: () -> Unit,
    onSitIn: () -> Unit,
    onSitAndPlay: () -> Unit,
): TableActionTools {
    val myPlayer = table.players.find { it.userId == userId }
    val mySeat = myPlayer?.seat
    val emptySeats = table.players.count { it.status == "empty" }
    val playersInHand = table.players.count {
        it.userId != null && it.stack > 0 && it.status != "sittingOut"
    }
    val betweenHands = table.street == "waiting" || table.street == "payout"
    val canSitOut =
        !spectating &&
            myPlayer != null &&
            betweenHands &&
            myPlayer.status != "empty" &&
            myPlayer.status != "sittingOut"
    val canSitIn = !spectating && myPlayer?.status == "sittingOut" && betweenHands
    val canTopUp = !spectating &&
        myPlayer != null &&
        table.tournament?.noTopUp != true &&
        myPlayer.stack == 0 &&
        betweenHands
    val isTournament = table.tournament != null
    val contestOver = table.tournament?.frozen == true
    val canStart = !spectating &&
        !contestOver &&
        myPlayer != null &&
        myPlayer.status != "sittingOut" &&
        myPlayer.stack > 0 &&
        playersInHand >= 2 &&
        betweenHands
    val isHost = userId != null && table.hostUserId == userId
    val canAddBot = !spectating && !isTournament && emptySeats > 0
    val kickTargets = if (isHost && !isTournament && betweenHands) {
        table.players
            .filter { it.userId != null && it.userId != userId && it.status != "empty" }
            .map { it.seat to (it.name ?: "seat ${it.seat}") }
    } else {
        emptyList()
    }
    val botCount = minOf(3, emptySeats.coerceAtLeast(1))
    val (roster, readyCount, readyHeading) = table.toReadyRoster(userId)
    return TableActionTools(
        startLabel = if (myPlayer?.ready == true) "Not ready" else "Start hand",
        onStart = if (canStart) onStartHand else null,
        isReady = myPlayer?.ready == true,
        canSitOut = canSitOut,
        onSitOut = if (canSitOut) onSitOut else null,
        canSitIn = canSitIn,
        onSitIn = if (canSitIn) onSitIn else null,
        canTopUp = canTopUp,
        onTopUp = if (canTopUp) onTopUp else null,
        canSitAndPlay = spectating,
        onSitAndPlay = if (spectating) onSitAndPlay else null,
        canAddBot = canAddBot,
        addBotLabel = "Add $botCount bots",
        onAddBot = if (canAddBot) {{ onAddBots(botCount) }} else null,
        canRemoveBots = canAddBot,
        onRemoveBots = if (canAddBot) onRemoveBots else null,
        botGroups = botGroups.map { it.id to it.name },
        botGroupId = botGroupId,
        onBotGroupChange = if (canAddBot) onSelectBotGroup else null,
        kickTargets = kickTargets,
        onKick = if (kickTargets.isNotEmpty()) onKick else null,
        readyPlayers = roster,
        readyCount = readyCount,
        readyTotal = roster.size,
        readyHeading = readyHeading,
    )
}

private fun PublicTable.toReadyRoster(userId: String?): Triple<List<ReadyRosterPlayer>, Int, String> {
    val betweenHands = street == "waiting" || street == "payout"
    if (!betweenHands) return Triple(emptyList(), 0, "Ready")
    val eligible = players.filter {
        it.userId != null && it.stack > 0 && it.status != "sittingOut" && it.status != "empty"
    }
    val roster = eligible.map {
        ReadyRosterPlayer(
            seat = it.seat,
            name = it.name ?: "Seat ${it.seat}",
            userId = it.userId,
            avatarId = it.avatarId,
            avatarUrl = it.avatarUrl,
            ready = it.ready == true,
            isSelf = it.userId == userId,
            sittingOut = it.status == "sittingOut",
        )
    }
    val count = roster.count { it.ready }
    val heading = when {
        street == "waiting" && count == 0 -> "Players"
        street == "waiting" -> "Ready to start"
        else -> "Ready for next hand"
    }
    return Triple(roster, count, heading)
}

@Composable
private fun ChatDrawer(
    messages: List<com.pokr.android.core.model.ChatMessage>,
    input: String,
    onInputChange: (String) -> Unit,
    onSend: () -> Unit,
    onEmoji: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    HudPanel(modifier = modifier) {
        Column(modifier = Modifier.fillMaxSize()) {
            Text("Chat", color = PokrColors.Mushroom, fontWeight = FontWeight.Bold)
            LazyColumn(modifier = Modifier.weight(1f).padding(vertical = 8.dp)) {
                items(messages) { msg ->
                    Text("${msg.name}: ${msg.text}", fontSize = 12.sp, color = PokrColors.Cream.copy(0.85f))
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                listOf("👍", "😂", "🔥", "💀").forEach { emoji ->
                    PokrGhostButton(text = emoji, onClick = { onEmoji(emoji) }, chrome = PokrChrome.Play)
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(
                    value = input,
                    onValueChange = onInputChange,
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                )
                PokrPrimaryButton(text = "Send", onClick = onSend)
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
        modifier = Modifier.fillMaxSize().background(PokrColors.Ink.copy(alpha = 0.7f)),
        contentAlignment = Alignment.Center,
    ) {
        HudPanel(modifier = Modifier.padding(24.dp)) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Top up", color = PokrColors.Mushroom, fontWeight = FontWeight.Bold)
                Text(
                    "Stack $currentStack · table buy-in $buyIn",
                    color = PokrColors.Cream.copy(alpha = 0.7f),
                    fontSize = 12.sp,
                )
                Text("Add $amount to reach $buyIn")
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    PokrGhostButton(text = "Cancel", onClick = onDismiss, chrome = PokrChrome.Play, modifier = Modifier.weight(1f))
                    PokrPrimaryButton(
                        text = "Top up $amount",
                        onClick = { onConfirm(amount) },
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }
    }
}
