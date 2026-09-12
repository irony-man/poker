package com.pokr.android.feature.memory

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pokr.android.core.designsystem.HudPanel
import com.pokr.android.core.designsystem.LudoSeatColors
import com.pokr.android.core.designsystem.MoveTimerStrip
import com.pokr.android.core.designsystem.PokerChipShuffle
import com.pokr.android.core.designsystem.PokrChrome
import com.pokr.android.core.designsystem.PokrColors
import com.pokr.android.core.designsystem.PokrFonts
import com.pokr.android.core.designsystem.PokrGhostButton
import com.pokr.android.core.designsystem.PokrPrimaryButton
import com.pokr.android.core.designsystem.PokrRadius
import com.pokr.android.core.designsystem.StatusChip
import com.pokr.android.core.designsystem.TableOverflowItem
import com.pokr.android.core.designsystem.TableOverflowTone
import com.pokr.android.core.designsystem.TablePlayHeader
import com.pokr.android.core.designsystem.UnlockSensorOrientation
import com.pokr.android.core.designsystem.pokrPageGround
import com.pokr.android.core.model.ChatMessage
import com.pokr.android.core.model.MemoryPlayerView

@Composable
fun MemoryBoardScreen(
    onBack: () -> Unit,
    webBaseUrl: String = "http://localhost:3000",
    modifier: Modifier = Modifier,
    viewModel: MemoryViewModel = hiltViewModel(),
) {
    UnlockSensorOrientation()
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    var chatInput by remember { mutableStateOf("") }
    val context = LocalContext.current
    val memory = state.memory
    val inviteCode = state.invite?.takeIf { it.isNotBlank() } ?: memory?.inviteCode
    val memoryId = state.memoryId.ifBlank { memory?.id.orEmpty() }
    val you = memory?.seats?.find { it.seat == state.youSeat }
    val isHost = state.userId != null && memory?.hostUserId == state.userId
    val waiting = memory?.status == "waiting"
    val finished = memory?.status == "finished"
    val playing = memory?.status == "playing"
    val myTurn = playing && state.youSeat != null && memory?.toAct == state.youSeat
    val canFlip = myTurn && (memory?.faceUp?.size ?: 0) < 2
    val emptySeats = if (memory == null) {
        emptyList()
    } else {
        val taken = memory.seats.mapNotNull {
            if (it.userId != null || it.isBot == true) it.seat else null
        }.toSet()
        (0 until memory.maxSeats).filter { it !in taken }
    }

    fun leave() {
        viewModel.dispatch(MemoryContract.Intent.Leave)
        onBack()
    }

    val overflowItems = buildList {
        if (!inviteCode.isNullOrBlank() && memoryId.isNotBlank()) {
            add(
                TableOverflowItem(
                    id = "copy-link",
                    label = "Copy invite · $inviteCode",
                    onClick = { copyMemoryInvite(context, webBaseUrl, memoryId, inviteCode) },
                    tone = TableOverflowTone.Accent,
                ),
            )
            add(
                TableOverflowItem(
                    id = "share",
                    label = "Share invite",
                    onClick = { shareMemoryInvite(context, webBaseUrl, memoryId, inviteCode) },
                    tone = TableOverflowTone.Gold,
                ),
            )
        }
        add(
            TableOverflowItem(
                id = "chat",
                label = "Chat",
                onClick = { viewModel.dispatch(MemoryContract.Intent.ToggleChat) },
                tone = TableOverflowTone.Accent,
            ),
        )
        if (state.youSeat != null && waiting) {
            add(
                TableOverflowItem(
                    id = "stand",
                    label = "Stand up",
                    onClick = { viewModel.dispatch(MemoryContract.Intent.Stand) },
                ),
            )
        }
        add(
            TableOverflowItem(
                id = "lobby",
                label = "Back to lobby",
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
        if (state.loading && memory == null) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                PokerChipShuffle(size = 56.dp)
            }
        } else {
            Column(modifier = Modifier.fillMaxSize()) {
                TablePlayHeader(
                    statusPill = when {
                        finished -> "Finished"
                        playing -> "Playing"
                        else -> "Memory"
                    },
                    overflowItems = overflowItems,
                )

                if (!inviteCode.isNullOrBlank()) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 12.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        StatusChip(text = "Code $inviteCode", accent = PokrColors.Gold, chrome = PokrChrome.Play)
                        if (memory != null) {
                            StatusChip(
                                text = "${memory.gridSize} cards",
                                accent = PokrColors.Patina,
                                chrome = PokrChrome.Play,
                            )
                        }
                    }
                }

                state.lastError?.let { err ->
                    StatusChip(
                        text = err,
                        accent = PokrColors.Danger,
                        chrome = PokrChrome.Play,
                        modifier = Modifier
                            .padding(horizontal = 12.dp, vertical = 6.dp)
                            .clickable { viewModel.dispatch(MemoryContract.Intent.DismissError) },
                    )
                }

                MemoryBoard(
                    cards = memory?.cards.orEmpty(),
                    gridSize = memory?.gridSize ?: 16,
                    canFlip = canFlip,
                    onFlip = { viewModel.dispatch(MemoryContract.Intent.Flip(it)) },
                    modifier = Modifier
                        .weight(1f)
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                )

                MemorySeatStrip(
                    seats = memory?.seats.orEmpty(),
                    maxSeats = memory?.maxSeats ?: 2,
                    toAct = memory?.toAct,
                    youSeat = state.youSeat,
                    canSit = !state.spectating && state.youSeat == null && waiting,
                    onSit = { viewModel.dispatch(MemoryContract.Intent.Sit(it)) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp),
                )

                if (playing) {
                    MoveTimerStrip(
                        endsAt = memory?.turnEndsAt,
                        totalMs = (memory?.turnTimeMs ?: 20_000).toLong(),
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                    )
                }

                MemoryActionBar(
                    waiting = waiting,
                    finished = finished,
                    you = you,
                    myTurn = myTurn,
                    spectating = state.spectating,
                    isHost = isHost,
                    emptySeats = emptySeats,
                    onReady = { ready -> viewModel.dispatch(MemoryContract.Intent.SetReady(ready)) },
                    onAddBot = { viewModel.dispatch(MemoryContract.Intent.AddBot()) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                )
            }
        }

        if (state.chatOpen) {
            MemoryChatDrawer(
                messages = state.chat,
                input = chatInput,
                onInputChange = { chatInput = it },
                onSend = {
                    if (chatInput.isNotBlank()) {
                        viewModel.dispatch(MemoryContract.Intent.SendChat(chatInput.trim()))
                        chatInput = ""
                    }
                },
                onClose = { viewModel.dispatch(MemoryContract.Intent.ToggleChat) },
                modifier = Modifier
                    .align(Alignment.CenterEnd)
                    .fillMaxHeight()
                    .width(280.dp)
                    .padding(8.dp),
            )
        }

        if (finished && memory != null) {
            MemoryWinOverlay(
                memory = memory,
                youSeat = state.youSeat,
                onReady = { viewModel.dispatch(MemoryContract.Intent.SetReady(true)) },
                onDismiss = onBack,
            )
        }
    }
}

@Composable
private fun MemorySeatStrip(
    seats: List<MemoryPlayerView>,
    maxSeats: Int,
    toAct: Int?,
    youSeat: Int?,
    canSit: Boolean,
    onSit: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        (0 until maxSeats).forEach { seat ->
            val player = seats.find { it.seat == seat }
            val empty = player == null || (player.userId == null && player.isBot != true)
            val shape = RoundedCornerShape(PokrRadius.Md)
            Column(
                modifier = Modifier
                    .weight(1f)
                    .clip(shape)
                    .background(LudoSeatColors.of(seat).copy(alpha = 0.18f))
                    .border(
                        width = if (seat == toAct) 2.dp else 1.dp,
                        color = if (seat == toAct) LudoSeatColors.of(seat) else PokrColors.Sidebar.copy(alpha = 0.12f),
                        shape = shape,
                    )
                    .then(if (empty && canSit) Modifier.clickable { onSit(seat) } else Modifier)
                    .padding(8.dp),
            ) {
                Text(
                    text = LudoSeatColors.label(seat).uppercase(),
                    color = LudoSeatColors.of(seat),
                    fontFamily = PokrFonts.Display,
                    fontWeight = FontWeight.Bold,
                    fontSize = 10.sp,
                    letterSpacing = 0.6.sp,
                )
                Text(
                    text = when {
                        player?.name != null -> buildString {
                            append(player.name)
                            if (seat == youSeat) append(" · you")
                            append(" · ${player.pairs} pairs")
                        }
                        empty && canSit -> "Sit"
                        empty -> "Open"
                        else -> "Seat $seat"
                    },
                    color = PokrColors.InkStrong,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                )
                if (player?.ready == true) {
                    Text("Ready", color = PokrColors.Positive, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
private fun MemoryActionBar(
    waiting: Boolean,
    finished: Boolean,
    you: MemoryPlayerView?,
    myTurn: Boolean,
    spectating: Boolean,
    isHost: Boolean,
    emptySeats: List<Int>,
    onReady: (Boolean) -> Unit,
    onAddBot: () -> Unit,
    modifier: Modifier = Modifier,
) {
    HudPanel(modifier = modifier, chrome = PokrChrome.Play) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            when {
                spectating && you == null -> {
                    Text(
                        "Spectating — sit from an open seat when the board is waiting.",
                        color = PokrColors.OnChrome.copy(alpha = 0.85f),
                        fontSize = 13.sp,
                    )
                }
                waiting && you != null -> {
                    Text(
                        if (you.ready) "You're ready. Waiting for the rest of the board."
                        else "Ready up when you want to start. Match pairs to score.",
                        color = PokrColors.OnChrome,
                        fontSize = 13.sp,
                    )
                    PokrPrimaryButton(
                        text = if (you.ready) "Unready" else "Ready",
                        onClick = { onReady(!you.ready) },
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
                finished && you != null -> {
                    PokrPrimaryButton(
                        text = if (you.ready) "Ready for rematch" else "Rematch",
                        onClick = { onReady(!you.ready) },
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
                myTurn -> {
                    Text(
                        text = "Your turn — flip two cards",
                        color = PokrColors.OnChrome,
                        fontFamily = PokrFonts.Display,
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                    )
                }
                else -> {
                    Text(
                        text = "Waiting for the next flip",
                        color = PokrColors.OnChrome.copy(alpha = 0.85f),
                        fontSize = 13.sp,
                    )
                }
            }
            if (isHost && waiting && emptySeats.isNotEmpty()) {
                PokrGhostButton(
                    text = "Add bot",
                    onClick = onAddBot,
                    chrome = PokrChrome.Play,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }
}

@Composable
private fun MemoryWinOverlay(
    memory: com.pokr.android.core.model.MemoryPublicView,
    youSeat: Int?,
    onReady: () -> Unit,
    onDismiss: () -> Unit,
) {
    val winners = memory.winnerSeats
    val youWon = youSeat != null && youSeat in winners
    val you = memory.seats.find { it.seat == youSeat }
    val winnerNames = winners.mapNotNull { seat ->
        memory.seats.find { it.seat == seat }?.name?.takeIf { it.isNotBlank() }
            ?: LudoSeatColors.label(seat)
    }
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(PokrColors.Ink.copy(alpha = 0.78f)),
        contentAlignment = Alignment.Center,
    ) {
        HudPanel(modifier = Modifier.padding(20.dp).fillMaxWidth(0.92f)) {
            Column(
                verticalArrangement = Arrangement.spacedBy(12.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    text = "MATCH COMPLETE",
                    color = PokrColors.OnChrome.copy(alpha = 0.85f),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 2.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
                Text(
                    text = when {
                        youWon && winners.size > 1 -> "You tied"
                        youWon -> "You won"
                        winners.size > 1 -> "Tie"
                        else -> "Winner"
                    },
                    color = PokrColors.OnChrome,
                    fontSize = 28.sp,
                    fontWeight = FontWeight.ExtraBold,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
                Text(
                    text = winnerNames.joinToString(" · "),
                    color = PokrColors.Brass,
                    fontFamily = PokrFonts.Display,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    textAlign = TextAlign.Center,
                )
                if (you != null) {
                    PokrPrimaryButton(
                        text = if (you.ready) "Ready for rematch" else "Rematch",
                        onClick = onReady,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
                PokrGhostButton(
                    text = "Close",
                    onClick = onDismiss,
                    chrome = PokrChrome.Play,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }
}

@Composable
private fun MemoryChatDrawer(
    messages: List<ChatMessage>,
    input: String,
    onInputChange: (String) -> Unit,
    onSend: () -> Unit,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    HudPanel(modifier = modifier, chrome = PokrChrome.Play) {
        Column(
            modifier = Modifier.fillMaxHeight(),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "CHAT",
                    color = PokrColors.OnChrome,
                    fontFamily = PokrFonts.Display,
                    fontWeight = FontWeight.Bold,
                    fontSize = 12.sp,
                    letterSpacing = 1.sp,
                )
                PokrGhostButton(text = "Close", onClick = onClose, chrome = PokrChrome.Play)
            }
            LazyColumn(
                modifier = Modifier
                    .weight(1f, fill = true)
                    .fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                items(messages) { msg ->
                    Column {
                        Text(
                            msg.name,
                            color = PokrColors.Brass,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                        )
                        Text(msg.text, color = PokrColors.OnChrome, fontSize = 13.sp)
                    }
                }
            }
            OutlinedTextField(
                value = input,
                onValueChange = onInputChange,
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                placeholder = { Text("Message") },
            )
            PokrPrimaryButton(text = "Send", onClick = onSend, modifier = Modifier.fillMaxWidth())
        }
    }
}
