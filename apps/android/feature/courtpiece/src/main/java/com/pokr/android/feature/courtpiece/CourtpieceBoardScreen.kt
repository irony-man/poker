package com.pokr.android.feature.courtpiece

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
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
import com.pokr.android.core.designsystem.PlayingCard
import com.pokr.android.core.designsystem.PlayerAvatar
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
import com.pokr.android.core.model.CourtpiecePlayerView
import com.pokr.android.core.model.CourtpiecePublicView
import kotlin.math.cos
import kotlin.math.sin

private val SuitOrder = mapOf('s' to 0, 'h' to 1, 'd' to 2, 'c' to 3)
private val RankOrder = mapOf(
    'A' to 14, 'K' to 13, 'Q' to 12, 'J' to 11, 'T' to 10,
    '9' to 9, '8' to 8, '7' to 7, '6' to 6, '5' to 5, '4' to 4, '3' to 3, '2' to 2,
)
private val Suits = listOf("s", "h", "d", "c")

private fun suitLabel(suit: String): String = when (suit.lowercase()) {
    "s" -> "♠"
    "h" -> "♥"
    "d" -> "♦"
    else -> "♣"
}

private fun rulesLabel(v: String): String = when (v) {
    "classic_full" -> "Classic Full"
    "hokm" -> "Hokm"
    else -> "Classic"
}

private fun teamLabel(team: Int): String = if (team == 0) "NS" else "EW"

private fun sortHand(codes: List<String>): List<String> =
    codes.sortedWith { a, b ->
        val sa = SuitOrder[a.getOrNull(1)?.lowercaseChar()] ?: 9
        val sb = SuitOrder[b.getOrNull(1)?.lowercaseChar()] ?: 9
        if (sa != sb) sa - sb
        else {
            val ra = RankOrder[a.getOrNull(0)?.uppercaseChar()] ?: 0
            val rb = RankOrder[b.getOrNull(0)?.uppercaseChar()] ?: 0
            rb - ra
        }
    }

@Composable
fun CourtpieceBoardScreen(
    onBack: () -> Unit,
    webBaseUrl: String = "http://localhost:3000",
    modifier: Modifier = Modifier,
    viewModel: CourtpieceViewModel = hiltViewModel(),
) {
    UnlockSensorOrientation()
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    var chatInput by remember { mutableStateOf("") }
    val context = LocalContext.current
    val board = state.board
    val inviteCode = state.invite?.takeIf { it.isNotBlank() } ?: board?.inviteCode
    val courtpieceId = state.courtpieceId.ifBlank { board?.id.orEmpty() }
    val mySeat = state.you.seat
    val you = board?.seats?.find { it.seat == mySeat }
    val isHost = state.userId != null && board?.hostUserId == state.userId
    val waiting = board?.status == "waiting"
    val finished = board?.status == "finished"
    val playing = board?.status == "playing"
    val phase = board?.phase ?: "lobby"
    val isMyTurn = playing && mySeat != null && board?.toAct == mySeat
    val choosingTrump = phase == "choosing_trump" && isMyTurn
    val canPlay = phase == "playing" && isMyTurn
    val legal = state.you.legal.toSet()
    val hand = remember(state.you.hand) { sortHand(state.you.hand) }
    val emptySeats = if (board == null) {
        emptyList()
    } else {
        val taken = board.seats.mapNotNull {
            if (it.userId != null || it.isBot == true) it.seat else null
        }.toSet()
        (0 until 4).filter { it !in taken }
    }
    val teamHands = board?.teamHands ?: listOf(0, 0)
    val ns = teamHands.getOrElse(0) { 0 }
    val ew = teamHands.getOrElse(1) { 0 }

    fun leave() {
        viewModel.dispatch(CourtpieceContract.Intent.Leave)
        onBack()
    }

    val overflowItems = buildList {
        if (!inviteCode.isNullOrBlank() && courtpieceId.isNotBlank()) {
            add(
                TableOverflowItem(
                    id = "copy-link",
                    label = "Copy invite · $inviteCode",
                    onClick = { copyCourtpieceInvite(context, webBaseUrl, courtpieceId, inviteCode) },
                    tone = TableOverflowTone.Accent,
                ),
            )
            add(
                TableOverflowItem(
                    id = "share",
                    label = "Share invite",
                    onClick = { shareCourtpieceInvite(context, webBaseUrl, courtpieceId, inviteCode) },
                    tone = TableOverflowTone.Gold,
                ),
            )
        }
        add(
            TableOverflowItem(
                id = "chat",
                label = "Chat",
                onClick = { viewModel.dispatch(CourtpieceContract.Intent.ToggleChat) },
                tone = TableOverflowTone.Accent,
            ),
        )
        if (mySeat != null && waiting) {
            add(
                TableOverflowItem(
                    id = "stand",
                    label = "Stand up",
                    onClick = { viewModel.dispatch(CourtpieceContract.Intent.Stand) },
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
        if (state.loading && board == null) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                PokerChipShuffle(size = 56.dp)
            }
        } else {
            Column(modifier = Modifier.fillMaxSize()) {
                TablePlayHeader(
                    statusPill = when {
                        finished -> "Finished"
                        choosingTrump -> "Trump"
                        playing -> "Playing"
                        else -> "Court Piece"
                    },
                    overflowItems = overflowItems,
                )

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    if (!inviteCode.isNullOrBlank()) {
                        StatusChip(text = "Code $inviteCode", accent = PokrColors.Gold, chrome = PokrChrome.Play)
                    }
                    if (board != null) {
                        StatusChip(
                            text = rulesLabel(board.rulesVariant),
                            accent = PokrColors.Patina,
                            chrome = PokrChrome.Play,
                        )
                        StatusChip(
                            text = "NS $ns  ·  EW $ew",
                            accent = PokrColors.Brass,
                            chrome = PokrChrome.Play,
                        )
                        board.trump?.let { trump ->
                            StatusChip(
                                text = "Trump ${suitLabel(trump)}",
                                accent = PokrColors.Gold,
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
                            .clickable { viewModel.dispatch(CourtpieceContract.Intent.DismissError) },
                    )
                }

                CourtpieceTable(
                    board = board,
                    mySeat = mySeat,
                    canSit = !state.spectating && mySeat == null && waiting,
                    onSit = { viewModel.dispatch(CourtpieceContract.Intent.Sit(it)) },
                    modifier = Modifier
                        .weight(1f)
                        .padding(horizontal = 8.dp, vertical = 4.dp),
                )

                if (playing) {
                    MoveTimerStrip(
                        endsAt = board?.turnEndsAt,
                        totalMs = (board?.turnTimeMs ?: 20_000).toLong(),
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                    )
                }

                if (hand.isNotEmpty()) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState())
                            .padding(horizontal = 12.dp, vertical = 4.dp),
                        horizontalArrangement = Arrangement.spacedBy((-10).dp),
                    ) {
                        hand.forEach { card ->
                            val allowed = canPlay && (legal.isEmpty() || card in legal)
                            PlayingCard(
                                code = card,
                                dimmed = canPlay && !allowed,
                                highlight = allowed,
                                width = 44.dp,
                                height = 62.dp,
                                animateDeal = false,
                                modifier = if (allowed) {
                                    Modifier.clickable {
                                        viewModel.dispatch(CourtpieceContract.Intent.PlayCard(card))
                                    }
                                } else {
                                    Modifier
                                },
                            )
                        }
                    }
                }

                CourtpieceActionBar(
                    waiting = waiting,
                    finished = finished,
                    you = you,
                    choosingTrump = choosingTrump,
                    canPlay = canPlay,
                    spectating = state.spectating && mySeat == null,
                    isHost = isHost,
                    emptySeats = emptySeats,
                    phase = phase,
                    lastHand = board?.lastHand,
                    onReady = { ready -> viewModel.dispatch(CourtpieceContract.Intent.SetReady(ready)) },
                    onTrump = { viewModel.dispatch(CourtpieceContract.Intent.SetTrump(it)) },
                    onAddBot = { viewModel.dispatch(CourtpieceContract.Intent.AddBot()) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                )
            }
        }

        if (state.chatOpen) {
            ArcadeChatDrawer(
                messages = state.chat,
                input = chatInput,
                onInputChange = { chatInput = it },
                onSend = {
                    if (chatInput.isNotBlank()) {
                        viewModel.dispatch(CourtpieceContract.Intent.SendChat(chatInput.trim()))
                        chatInput = ""
                    }
                },
                onClose = { viewModel.dispatch(CourtpieceContract.Intent.ToggleChat) },
                modifier = Modifier
                    .align(Alignment.CenterEnd)
                    .fillMaxHeight()
                    .width(280.dp)
                    .padding(8.dp),
            )
        }

        if (finished && board != null && board.winnerTeam != null) {
            CourtpieceWinOverlay(
                board = board,
                myTeam = state.you.team ?: mySeat?.rem(2),
                onReady = { viewModel.dispatch(CourtpieceContract.Intent.SetReady(true)) },
                onDismiss = onBack,
            )
        }
    }
}

@Composable
private fun CourtpieceTable(
    board: CourtpiecePublicView?,
    mySeat: Int?,
    canSit: Boolean,
    onSit: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    val bySeat = board?.seats.orEmpty().associateBy { it.seat }
    val seats = (0 until 4).map { seat ->
        bySeat[seat] ?: CourtpiecePlayerView(seat = seat, team = seat % 2)
    }
    val origin = mySeat ?: 0
    BoxWithConstraints(modifier = modifier.fillMaxSize()) {
        Box(
            modifier = Modifier
                .align(Alignment.Center)
                .fillMaxWidth(0.72f)
                .fillMaxHeight(0.58f)
                .clip(RoundedCornerShape(50))
                .background(PokrColors.FeltGreen.copy(alpha = 0.55f))
                .border(2.dp, PokrColors.Brass.copy(alpha = 0.4f), RoundedCornerShape(50)),
        )
        val trick = board?.currentTrick.orEmpty()
        if (trick.isNotEmpty()) {
            Row(
                modifier = Modifier.align(Alignment.Center),
                horizontalArrangement = Arrangement.spacedBy((-8).dp),
            ) {
                trick.forEach { play ->
                    PlayingCard(
                        code = play.card,
                        width = 36.dp,
                        height = 52.dp,
                        animateDeal = false,
                    )
                }
            }
        } else {
            Text(
                text = "NS vs EW",
                color = PokrColors.OnChrome.copy(alpha = 0.7f),
                fontFamily = PokrFonts.Display,
                fontWeight = FontWeight.Bold,
                fontSize = 12.sp,
                modifier = Modifier.align(Alignment.Center),
            )
        }
        seats.forEach { player ->
            val visual = (player.seat - origin + 4) % 4
            val angleDeg = when (visual) {
                0 -> 90.0
                1 -> 0.0
                2 -> 270.0
                else -> 180.0
            }
            val rad = Math.toRadians(angleDeg)
            val x = maxWidth * (0.5f + cos(rad).toFloat() * 0.38f)
            val y = maxHeight * (0.5f + sin(rad).toFloat() * 0.36f)
            val empty = player.userId == null && player.isBot != true
            Column(
                modifier = Modifier
                    .offset(x = x - 48.dp, y = y - 36.dp)
                    .width(96.dp)
                    .clip(RoundedCornerShape(PokrRadius.Md))
                    .background(
                        if (board?.toAct == player.seat) PokrColors.Brass.copy(alpha = 0.28f)
                        else PokrColors.Ink.copy(alpha = 0.45f),
                    )
                    .then(if (empty && canSit) Modifier.clickable { onSit(player.seat) } else Modifier)
                    .padding(6.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                if (!empty) {
                    PlayerAvatar(
                        avatarId = player.avatarId ?: 0,
                        avatarUrl = player.avatarUrl,
                        userId = player.userId,
                        size = 28.dp,
                    )
                }
                Text(
                    text = when {
                        player.name != null -> player.name
                        empty && canSit -> "Sit"
                        empty -> "Open"
                        else -> "Seat ${player.seat + 1}"
                    }.orEmpty(),
                    color = PokrColors.OnChrome,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    textAlign = TextAlign.Center,
                )
                Text(
                    text = "${teamLabel(player.team)} · ${player.tricksThisHand} tricks",
                    color = PokrColors.OnChrome.copy(alpha = 0.75f),
                    fontSize = 10.sp,
                )
                if (player.ready) {
                    Text("Ready", color = PokrColors.Positive, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
private fun CourtpieceActionBar(
    waiting: Boolean,
    finished: Boolean,
    you: CourtpiecePlayerView?,
    choosingTrump: Boolean,
    canPlay: Boolean,
    spectating: Boolean,
    isHost: Boolean,
    emptySeats: List<Int>,
    phase: String,
    lastHand: com.pokr.android.core.model.CourtpieceLastHand?,
    onReady: (Boolean) -> Unit,
    onTrump: (String) -> Unit,
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
                choosingTrump -> {
                    Text(
                        "Choose trump",
                        color = PokrColors.OnChrome,
                        fontFamily = PokrFonts.Display,
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Suits.forEach { suit ->
                            PokrPrimaryButton(
                                text = suitLabel(suit),
                                onClick = { onTrump(suit) },
                                modifier = Modifier.weight(1f),
                            )
                        }
                    }
                }
                waiting && you != null -> {
                    Text(
                        if (you.ready) "You're ready. Waiting for the rest of the table."
                        else "Ready up. Partners sit opposite (NS vs EW).",
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
                canPlay -> {
                    Text(
                        "Your turn — play a card from your hand.",
                        color = PokrColors.OnChrome,
                        fontSize = 13.sp,
                    )
                }
                phase == "between_hands" -> {
                    val last = lastHand
                    Text(
                        if (last != null) {
                            "${teamLabel(last.winningTeam)} took the hand (${last.handsAwarded})"
                        } else {
                            "Between hands"
                        },
                        color = PokrColors.OnChrome.copy(alpha = 0.85f),
                        fontSize = 13.sp,
                    )
                }
                else -> {
                    Text(
                        "Waiting for the next play",
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
private fun CourtpieceWinOverlay(
    board: CourtpiecePublicView,
    myTeam: Int?,
    onReady: () -> Unit,
    onDismiss: () -> Unit,
) {
    val winner = board.winnerTeam ?: 0
    val youWon = myTeam != null && myTeam == winner
    val you = board.seats.find { it.seat == myTeam }
    val ns = board.teamHands.getOrElse(0) { 0 }
    val ew = board.teamHands.getOrElse(1) { 0 }
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
                    text = "MATCH OVER",
                    color = PokrColors.OnChrome.copy(alpha = 0.85f),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 2.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
                Text(
                    text = if (youWon) "Your team won" else "${teamLabel(winner)} won",
                    color = PokrColors.OnChrome,
                    fontSize = 26.sp,
                    fontWeight = FontWeight.ExtraBold,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
                Text(
                    text = "NS $ns  ·  EW $ew",
                    color = PokrColors.Brass,
                    fontFamily = PokrFonts.Display,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
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
private fun ArcadeChatDrawer(
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
