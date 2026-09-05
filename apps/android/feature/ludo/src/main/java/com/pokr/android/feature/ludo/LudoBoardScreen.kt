package com.pokr.android.feature.ludo

import androidx.compose.foundation.Canvas
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
import androidx.compose.foundation.layout.size
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
import androidx.compose.ui.geometry.Offset
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
import com.pokr.android.core.model.LudoPlayerView

@Composable
fun LudoBoardScreen(
    onBack: () -> Unit,
    webBaseUrl: String = "http://localhost:3000",
    modifier: Modifier = Modifier,
    viewModel: LudoViewModel = hiltViewModel(),
) {
    UnlockSensorOrientation()
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    var chatInput by remember { mutableStateOf("") }
    val context = LocalContext.current
    val ludo = state.ludo
    val inviteCode = state.invite?.takeIf { it.isNotBlank() } ?: ludo?.inviteCode
    val ludoId = state.ludoId.ifBlank { ludo?.id.orEmpty() }
    val you = ludo?.seats?.find { it.seat == state.youSeat }
    val isHost = state.userId != null && ludo?.hostUserId == state.userId
    val waiting = ludo?.status == "waiting"
    val finished = ludo?.status == "finished"
    val playing = ludo?.status == "playing"
    val myTurn = playing && state.youSeat != null && ludo?.toAct == state.youSeat
    val canRoll = myTurn && ludo?.die == null
    val canMove = myTurn && ludo?.die != null && state.legalMoves.isNotEmpty()
    val emptySeats = if (ludo == null) {
        emptyList()
    } else {
        val taken = ludo.seats.mapNotNull {
            if (it.userId != null || it.isBot == true) it.seat else null
        }.toSet()
        (0 until ludo.maxSeats).filter { it !in taken }
    }

    fun leave() {
        viewModel.dispatch(LudoContract.Intent.Leave)
        onBack()
    }

    val overflowItems = buildList {
        if (!inviteCode.isNullOrBlank() && ludoId.isNotBlank()) {
            add(
                TableOverflowItem(
                    id = "copy-link",
                    label = "Copy invite · $inviteCode",
                    onClick = { copyLudoInvite(context, webBaseUrl, ludoId, inviteCode) },
                    tone = TableOverflowTone.Accent,
                ),
            )
            add(
                TableOverflowItem(
                    id = "share",
                    label = "Share invite",
                    onClick = { shareLudoInvite(context, webBaseUrl, ludoId, inviteCode) },
                    tone = TableOverflowTone.Gold,
                ),
            )
        }
        add(
            TableOverflowItem(
                id = "chat",
                label = "Chat",
                onClick = { viewModel.dispatch(LudoContract.Intent.ToggleChat) },
                tone = TableOverflowTone.Accent,
            ),
        )
        if (state.youSeat != null && waiting) {
            add(
                TableOverflowItem(
                    id = "stand",
                    label = "Stand up",
                    onClick = { viewModel.dispatch(LudoContract.Intent.Stand) },
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
        if (state.loading && ludo == null) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                PokerChipShuffle(size = 56.dp)
            }
        } else {
            Column(modifier = Modifier.fillMaxSize()) {
                TablePlayHeader(
                    statusPill = when {
                        finished -> "Finished"
                        playing -> "Playing"
                        else -> "Ludo"
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
                        if (ludo != null) {
                            StatusChip(
                                text = "${ludo.seats.count { it.userId != null || it.isBot == true }}/${ludo.maxSeats}",
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
                            .clickable { viewModel.dispatch(LudoContract.Intent.DismissError) },
                    )
                }

                LudoBoard(
                    seats = ludo?.seats.orEmpty(),
                    legalMoves = if (canMove) state.legalMoves else emptyList(),
                    youSeat = state.youSeat,
                    toAct = ludo?.toAct,
                    onToken = { _, tokenIndex ->
                        viewModel.dispatch(LudoContract.Intent.Move(tokenIndex))
                    },
                    modifier = Modifier
                        .weight(1f)
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                )

                LudoSeatStrip(
                    seats = ludo?.seats.orEmpty(),
                    maxSeats = ludo?.maxSeats ?: 4,
                    toAct = ludo?.toAct,
                    youSeat = state.youSeat,
                    canSit = !state.spectating && state.youSeat == null && waiting,
                    onSit = { viewModel.dispatch(LudoContract.Intent.Sit(it)) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp),
                )

                if (playing) {
                    MoveTimerStrip(
                        endsAt = ludo?.turnEndsAt,
                        totalMs = (ludo?.turnTimeMs ?: 20_000).toLong(),
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                    )
                }

                LudoActionBar(
                    waiting = waiting,
                    finished = finished,
                    you = you,
                    myTurn = myTurn,
                    canRoll = canRoll,
                    die = ludo?.die,
                    spectating = state.spectating,
                    isHost = isHost,
                    emptySeats = emptySeats,
                    onReady = { ready -> viewModel.dispatch(LudoContract.Intent.SetReady(ready)) },
                    onRoll = { viewModel.dispatch(LudoContract.Intent.Roll) },
                    onAddBot = { viewModel.dispatch(LudoContract.Intent.AddBot()) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                )
            }
        }

        if (state.chatOpen) {
            LudoChatDrawer(
                messages = state.chat,
                input = chatInput,
                onInputChange = { chatInput = it },
                onSend = {
                    if (chatInput.isNotBlank()) {
                        viewModel.dispatch(LudoContract.Intent.SendChat(chatInput.trim()))
                        chatInput = ""
                    }
                },
                onClose = { viewModel.dispatch(LudoContract.Intent.ToggleChat) },
                modifier = Modifier
                    .align(Alignment.CenterEnd)
                    .fillMaxHeight()
                    .width(280.dp)
                    .padding(8.dp),
            )
        }

        if (finished && ludo != null) {
            LudoWinOverlay(
                ludo = ludo,
                youSeat = state.youSeat,
                onReady = { viewModel.dispatch(LudoContract.Intent.SetReady(true)) },
                onDismiss = onBack,
            )
        }
    }
}

@Composable
private fun LudoSeatStrip(
    seats: List<LudoPlayerView>,
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
                    .then(
                        if (empty && canSit) Modifier.clickable { onSit(seat) } else Modifier,
                    )
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
                        player?.name != null -> player.name + if (seat == youSeat) " · you" else ""
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
private fun LudoActionBar(
    waiting: Boolean,
    finished: Boolean,
    you: LudoPlayerView?,
    myTurn: Boolean,
    canRoll: Boolean,
    die: Int?,
    spectating: Boolean,
    isHost: Boolean,
    emptySeats: List<Int>,
    onReady: (Boolean) -> Unit,
    onRoll: () -> Unit,
    onAddBot: () -> Unit,
    modifier: Modifier = Modifier,
) {
    HudPanel(modifier = modifier, chrome = PokrChrome.Play) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            when {
                spectating && you == null -> {
                    Text(
                        "Spectating — sit from an open color when the board is waiting.",
                        color = PokrColors.OnChrome.copy(alpha = 0.85f),
                        fontSize = 13.sp,
                    )
                }
                waiting && you != null -> {
                    Text(
                        if (you.ready) "You're ready. Waiting for the rest of the board."
                        else "Ready up when you want to start. First to get all 4 tokens home wins.",
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
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        LudoDie(value = die, highlighted = canRoll, onClick = if (canRoll) onRoll else null)
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = if (canRoll) "Your roll" else "Tap a highlighted token",
                                color = PokrColors.OnChrome,
                                fontFamily = PokrFonts.Display,
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp,
                            )
                            Text(
                                text = if (canRoll) "Need a 6 to leave the yard." else "Die $die",
                                color = PokrColors.OnChrome.copy(alpha = 0.8f),
                                fontSize = 12.sp,
                            )
                        }
                    }
                }
                else -> {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        LudoDie(value = die, highlighted = false, onClick = null)
                        Text(
                            text = "Waiting for the next roll",
                            color = PokrColors.OnChrome.copy(alpha = 0.85f),
                            fontSize = 13.sp,
                        )
                    }
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
private fun LudoDie(
    value: Int?,
    highlighted: Boolean,
    onClick: (() -> Unit)?,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(10.dp)
    val face = value?.coerceIn(1, 6)
    Box(
        modifier = modifier
            .size(56.dp)
            .clip(shape)
            .background(if (highlighted) PokrColors.Brass else PokrColors.Cream)
            .border(
                2.dp,
                if (highlighted) PokrColors.InkStrong else PokrColors.Sidebar.copy(alpha = 0.2f),
                shape,
            )
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier),
        contentAlignment = Alignment.Center,
    ) {
        if (face == null) {
            Text(
                "?",
                color = PokrColors.InkStrong,
                fontFamily = PokrFonts.Display,
                fontWeight = FontWeight.Bold,
                fontSize = 22.sp,
            )
        } else {
            Canvas(Modifier.fillMaxSize().padding(10.dp)) {
                val pips = diePips(face)
                val r = size.minDimension * 0.12f
                pips.forEach { (x, y) ->
                    drawCircle(
                        color = PokrColors.InkStrong,
                        radius = r,
                        center = Offset(size.width * x, size.height * y),
                    )
                }
            }
        }
    }
}

private fun diePips(value: Int): List<Pair<Float, Float>> = when (value) {
    1 -> listOf(0.5f to 0.5f)
    2 -> listOf(0.28f to 0.28f, 0.72f to 0.72f)
    3 -> listOf(0.28f to 0.28f, 0.5f to 0.5f, 0.72f to 0.72f)
    4 -> listOf(0.28f to 0.28f, 0.72f to 0.28f, 0.28f to 0.72f, 0.72f to 0.72f)
    5 -> listOf(0.28f to 0.28f, 0.72f to 0.28f, 0.5f to 0.5f, 0.28f to 0.72f, 0.72f to 0.72f)
    else -> listOf(
        0.28f to 0.22f, 0.72f to 0.22f,
        0.28f to 0.5f, 0.72f to 0.5f,
        0.28f to 0.78f, 0.72f to 0.78f,
    )
}

@Composable
private fun LudoWinOverlay(
    ludo: com.pokr.android.core.model.LudoPublicView,
    youSeat: Int?,
    onReady: () -> Unit,
    onDismiss: () -> Unit,
) {
    val winner = ludo.seats.find { it.seat == ludo.winnerSeat }
    val youWon = youSeat != null && youSeat == ludo.winnerSeat
    val you = ludo.seats.find { it.seat == youSeat }
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
                    text = "BOARD COMPLETE",
                    color = PokrColors.OnChrome.copy(alpha = 0.85f),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 2.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
                Text(
                    text = if (youWon) "You won" else "Winner",
                    color = PokrColors.OnChrome,
                    fontSize = 28.sp,
                    fontWeight = FontWeight.ExtraBold,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
                val colorName = LudoSeatColors.label(ludo.winnerSeat ?: 0)
                Text(
                    text = winner?.name?.takeIf { it.isNotBlank() } ?: colorName,
                    color = LudoSeatColors.of(ludo.winnerSeat ?: 0),
                    fontFamily = PokrFonts.Display,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                )
                Text(
                    text = "All four $colorName tokens home.",
                    color = PokrColors.Brass,
                    fontSize = 13.sp,
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
private fun LudoChatDrawer(
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
