package com.pokr.android.feature.offline

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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
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

@Composable
fun OfflineTableScreen(
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: OfflineViewModel = hiltViewModel(),
) {
    UnlockSensorOrientation()
    val landscape = rememberIsLandscapePhone()

    val state by viewModel.uiState.collectAsStateWithLifecycle()
    var chatInput by remember { mutableStateOf("") }
    var dismissedWinHandId by remember { mutableStateOf<String?>(null) }

    Box(
        modifier = modifier
            .fillMaxSize()
            .pokrPageGround()
            .statusBarsPadding()
            .navigationBarsPadding(),
    ) {
        if (!state.bootstrapped || state.publicTable == null) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                PokerChipShuffle(size = 56.dp)
            }
            return
        }

        val table = state.publicTable!!
        val tableUi = table.toOfflineTableUi()
        val myPlayer = table.players.find { it.userId == HUMAN_USER_ID }
        val sittingOut = myPlayer?.status == "sittingOut"
        val betweenHands = table.street == "waiting" || table.street == "payout"
        val canSitOut = betweenHands && !sittingOut && myPlayer != null && myPlayer.status != "empty"
        val canSitIn = betweenHands && sittingOut
        val canStart = betweenHands && !sittingOut && (myPlayer?.stack ?: 0) > 0
        val canTopUp = betweenHands && myPlayer != null && myPlayer.stack == 0
        val eligible = table.players.filter {
            it.userId != null && it.stack > 0 && it.status != "sittingOut" && it.status != "empty"
        }
        val roster = if (betweenHands) {
            eligible.map {
                ReadyRosterPlayer(
                    seat = it.seat,
                    name = it.name ?: "Seat ${it.seat}",
                    userId = it.userId,
                    avatarId = it.avatarId,
                    avatarUrl = it.avatarUrl,
                    ready = it.ready == true,
                    isSelf = it.userId == HUMAN_USER_ID,
                    sittingOut = it.status == "sittingOut",
                )
            }
        } else {
            emptyList()
        }
        val readyCount = roster.count { it.ready }
        val readyHeading = when {
            table.street == "waiting" && readyCount == 0 -> "Players"
            table.street == "waiting" -> "Ready to start"
            else -> "Ready for next hand"
        }

        val overflowItems = buildList {
            add(
                TableOverflowItem(
                    id = "chat",
                    label = "Chat",
                    onClick = viewModel::toggleChat,
                    tone = TableOverflowTone.Accent,
                ),
            )
            if (canSitOut) {
                add(TableOverflowItem(id = "sit-out", label = "Sit out", onClick = viewModel::sitOut))
            }
            if (canSitIn) {
                add(
                    TableOverflowItem(
                        id = "sit-in",
                        label = "Sit in",
                        onClick = viewModel::sitIn,
                        tone = TableOverflowTone.Accent,
                    ),
                )
            }
            if (canTopUp) {
                add(
                    TableOverflowItem(
                        id = "top-up",
                        label = "Top up",
                        onClick = viewModel::topUp,
                        tone = TableOverflowTone.Gold,
                    ),
                )
            }
            add(
                TableOverflowItem(
                    id = "lobby",
                    label = "Back to lobby",
                    onClick = onBack,
                    tone = TableOverflowTone.Danger,
                ),
            )
        }

        val tools = TableActionTools(
            startLabel = if (table.street == "waiting") "Start hand" else "Next hand",
            onStart = if (canStart) viewModel::startHandManual else null,
            canSitOut = canSitOut,
            onSitOut = if (canSitOut) viewModel::sitOut else null,
            canSitIn = canSitIn,
            onSitIn = if (canSitIn) viewModel::sitIn else null,
            canTopUp = canTopUp,
            onTopUp = if (canTopUp) viewModel::topUp else null,
            readyPlayers = roster,
            readyCount = readyCount,
            readyTotal = roster.size,
            readyHeading = readyHeading,
        )

        Column(
            modifier = Modifier.fillMaxSize(),
        ) {
            TablePlayHeader(
                statusPill = "Offline",
                overflowItems = overflowItems,
                sfxMuted = state.sfxMuted,
                onToggleSfxMute = viewModel::toggleSfxMute,
            )

            PokrTableLayout(
                table = tableUi,
                userId = HUMAN_USER_ID,
                holeCards = state.holeCards,
                tableColorId = state.tableColorId,
                onSit = {},
                landscape = landscape,
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
            )

            if (!landscape) {
                TableEmojiStrip(onEmoji = viewModel::sendEmoji)
            }

            TableActionDock(landscape = landscape) {
                TableActionControls(
                    table = tableUi,
                    userId = HUMAN_USER_ID,
                    legal = state.legal?.let {
                        LegalActionsUi(it.types, it.callAmount, it.minRaiseTo, it.maxRaiseTo)
                    },
                    onAction = { action, amount -> viewModel.sendAction(action, amount) },
                    landscape = landscape,
                    tools = tools,
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
                    Text("Chat", color = PokrColors.Mushroom, fontWeight = FontWeight.Bold)
                    LazyColumn(modifier = Modifier.weight(1f)) {
                        items(state.chat) { msg ->
                            Text(
                                "${msg.name}: ${msg.text}",
                                color = PokrColors.Cream.copy(alpha = 0.85f),
                            )
                        }
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        listOf("👍", "😂", "🔥").forEach { emoji ->
                            PokrGhostButton(text = emoji, onClick = { viewModel.sendEmoji(emoji) }, chrome = PokrChrome.Play)
                        }
                    }
                    Row {
                        OutlinedTextField(
                            value = chatInput,
                            onValueChange = { chatInput = it },
                            modifier = Modifier.weight(1f),
                            singleLine = true,
                        )
                        PokrPrimaryButton(
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
