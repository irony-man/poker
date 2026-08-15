package com.pokr.android.feature.progress

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.pokr.android.core.designsystem.PokrColors
import com.pokr.android.core.designsystem.pokrPageGround
import com.pokr.android.core.designsystem.tableColorPreset
import com.pokr.android.core.designsystem.PokrFonts
import com.pokr.android.core.designsystem.PokrGhostButton
import com.pokr.android.core.designsystem.PokrSoftButton
import com.pokr.android.core.designsystem.PokrPrimaryButton
import com.pokr.android.core.designsystem.PokrRadius
import com.pokr.android.core.designsystem.LockPortraitOrientation
import com.pokr.android.core.designsystem.PlayingCard
import com.pokr.android.core.designsystem.PokerChipShuffle
import com.pokr.android.core.model.PlayedHandLevel
import com.pokr.android.core.model.formatHandWhen
import kotlin.math.roundToInt

@Composable
fun HandsScreen(
    onBack: () -> Unit,
    onPlay: () -> Unit,
    modifier: Modifier = Modifier,
    embedded: Boolean = false,
    viewModel: HandsViewModel = hiltViewModel(),
) {
    if (!embedded) LockPortraitOrientation()
    val state by viewModel.uiState.collectAsState()
    val chapter = remember(state.handsPlayed) { chapterProgress(state.handsPlayed) }
    val window = remember(chapter.level) { nodeWindow(chapter.level) }

    Column(
        modifier = modifier
            .fillMaxSize()
            .then(
                if (embedded) Modifier.pokrPageGround()
                else Modifier.background(PokrColors.Sidebar),
            )
            .then(
                if (embedded) Modifier
                else Modifier.statusBarsPadding().navigationBarsPadding(),
            ),
    ) {
        if (!embedded) {
            HandsHeader(
                level = chapter.level,
                onBack = onBack,
            )
        }

        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth(),
        ) {
            if (state.loading) {
                PokerChipShuffle(
                    modifier = Modifier.align(Alignment.Center),
                    size = 56.dp,
                )
            } else if (state.listOpen) {
                HandsList(
                    start = window.start,
                    end = window.end,
                    handsPlayed = state.handsPlayed,
                    byLevel = state.byLevel,
                    onBackToMap = { viewModel.setListOpen(false) },
                )
            } else {
                HandsMapCanvas(
                    start = window.start,
                    end = window.end,
                    handsPlayed = state.handsPlayed,
                    byLevel = state.byLevel,
                    selectedLevel = state.selectedLevel,
                    tableColorId = state.tableColorId,
                    onSelectLevel = viewModel::selectLevel,
                )
            }

            if (!state.listOpen && state.selectedLevel != null) {
                val hand = state.byLevel[state.selectedLevel]
                if (hand != null) {
                    HandPeek(
                        level = state.selectedLevel!!,
                        hand = hand,
                        onClose = { viewModel.selectLevel(null) },
                        modifier = Modifier
                            .align(Alignment.BottomCenter)
                            .padding(horizontal = 12.dp, vertical = 12.dp),
                    )
                }
            }
        }

        HandsFooter(
            handsPlayed = state.handsPlayed,
            nextMilestone = chapter.nextMilestone,
            fill = chapter.fill,
            listOpen = state.listOpen,
            onToggleList = viewModel::toggleList,
            onPlay = onPlay,
        )
    }
}

@Composable
private fun HandsHeader(
    level: Int,
    onBack: () -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(PokrColors.White)
            .padding(horizontal = 12.dp, vertical = 12.dp),
    ) {
        PokrGhostButton(
            text = "← Lobby",
            onClick = onBack,
            modifier = Modifier.align(Alignment.CenterStart),
        )
        Row(
            modifier = Modifier.align(Alignment.Center),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            HandBadge(n = level)
            Text(
                text = "Hands",
                color = PokrColors.Sidebar,
                fontFamily = PokrFonts.Display,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 18.sp,
            )
        }
    }
}

@Composable
private fun HandsFooter(
    handsPlayed: Int,
    nextMilestone: Int,
    fill: Float,
    listOpen: Boolean,
    onToggleList: () -> Unit,
    onPlay: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(PokrColors.White)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = "%,d".format(handsPlayed),
                color = PokrColors.Sidebar,
                fontFamily = PokrFonts.Display,
                fontWeight = FontWeight.Bold,
                fontSize = 20.sp,
            )
            Box(
                modifier = Modifier
                    .weight(1f)
                    .height(8.dp)
                    .clip(RoundedCornerShape(999.dp))
                    .background(PokrColors.Sidebar.copy(alpha = 0.1f)),
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxHeight()
                        .fillMaxWidth((fill / 100f).coerceIn(0f, 1f))
                        .background(PokrColors.Sidebar),
                )
            }
            HandBadge(n = nextMilestone)
        }
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PokrSoftButton(
                text = if (listOpen) "Map" else "List",
                onClick = onToggleList,
                modifier = Modifier.width(72.dp),
            )
            PokrPrimaryButton(
                text = "Play Hands",
                onClick = onPlay,
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun HandsList(
    start: Int,
    end: Int,
    handsPlayed: Int,
    byLevel: Map<Int, PlayedHandLevel>,
    onBackToMap: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(PokrColors.White),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "Played hands",
                color = PokrColors.Sidebar,
                fontWeight = FontWeight.Bold,
                fontFamily = PokrFonts.Display,
            )
            TextButton(onClick = onBackToMap) {
                Text("Back to map", color = PokrColors.InkStrongMuted)
            }
        }
        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState()),
        ) {
            for (n in start..end) {
                val status = nodeStatus(n, handsPlayed)
                val hand = byLevel[n]
                val whenLabel = hand?.let { formatHandWhen(it.startedAt) }.orEmpty()
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(
                            if (n % 2 == 0) PokrColors.Mushroom.copy(alpha = 0.35f)
                            else Color.Transparent,
                        )
                        .padding(horizontal = 16.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    HoleThumb(
                        cards = if (status == NodeStatus.Locked) null else hand?.holeCards,
                    )
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Hand $n",
                            color = PokrColors.Sidebar,
                            fontWeight = FontWeight.Medium,
                        )
                        if (hand != null && status != NodeStatus.Locked) {
                            val detail = buildString {
                                append(if (hand.won) "Won" else "Played")
                                val hn = hand.handName
                                if (!hn.isNullOrBlank() && hn != "Uncontested") {
                                    append(" · ")
                                    append(hn)
                                }
                                if (whenLabel.isNotBlank()) {
                                    append(" · ")
                                    append(whenLabel)
                                }
                            }
                            Text(
                                text = detail,
                                color = PokrColors.InkStrongMuted,
                                fontSize = 12.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                    }
                    Text(
                        text = when (status) {
                            NodeStatus.Completed -> if (hand?.won == true) "Won" else "Done"
                            NodeStatus.Current -> "Current"
                            NodeStatus.Locked -> "Locked"
                        },
                        color = when (status) {
                            NodeStatus.Completed -> PokrColors.Positive
                            NodeStatus.Current -> PokrColors.Sidebar
                            NodeStatus.Locked -> PokrColors.InkStrongMuted.copy(alpha = 0.7f)
                        },
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }
        }
    }
}

@Composable
private fun HandsMapCanvas(
    start: Int,
    end: Int,
    handsPlayed: Int,
    byLevel: Map<Int, PlayedHandLevel>,
    selectedLevel: Int?,
    tableColorId: Int,
    onSelectLevel: (Int?) -> Unit,
) {
    val scroll = rememberScrollState()
    val density = LocalDensity.current
    val heightPx = mapHeight(end - start + 1)
    val heightDp = with(density) { heightPx.toDp() }

    LaunchedEffect(handsPlayed, heightPx) {
        val chapter = chapterProgress(handsPlayed)
        val window = nodeWindow(chapter.level)
        val positions = zigzagPositions(window.start, window.end, 360f)
        val current = positions.find { it.level == chapter.level.coerceAtLeast(1) }
        if (current != null) {
            val target = (current.y - 200f).toInt().coerceAtLeast(0)
            scroll.scrollTo(target)
        }
    }

    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scroll),
    ) {
        val widthPx = with(density) { maxWidth.toPx() }
        val positions = remember(start, end, widthPx) {
            zigzagPositions(start, end, widthPx)
        }

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(heightDp),
        ) {
            MapParkBackdrop(modifier = Modifier.fillMaxSize(), tableColorId = tableColorId)
            PathLine(positions = positions)
            positions.forEach { pos ->
                val status = nodeStatus(pos.level, handsPlayed)
                val isCurrent = status == NodeStatus.Current
                val hand = byLevel[pos.level]
                Box(
                    modifier = Modifier
                        .offset {
                            IntOffset(
                                x = (pos.x - NODE_SIZE_DP / 2f).roundToInt(),
                                y = pos.y.roundToInt(),
                            )
                        }
                        .width(NODE_SIZE_DP.dp)
                        .clickable {
                            when {
                                hand != null -> onSelectLevel(
                                    if (selectedLevel == pos.level) null else pos.level,
                                )
                                isCurrent -> Unit
                                else -> Unit
                            }
                        },
                ) {
                    LevelNode(
                        status = status,
                        badge = badgeForNode(pos.level, handsPlayed, status),
                        current = isCurrent,
                        checked = status == NodeStatus.Completed ||
                            (status == NodeStatus.Current && handsPlayed > 0),
                        hand = hand,
                        level = pos.level,
                    )
                }
            }
        }
    }
}

@Composable
private fun MapParkBackdrop(modifier: Modifier = Modifier, tableColorId: Int = 0) {
    val theme = tableColorPreset(tableColorId)
    val suits = listOf("♠", "♥", "♦", "♣")
    Box(modifier = modifier.background(
        Brush.radialGradient(
            listOf(theme.feltMid, theme.felt, theme.feltEdge),
        ),
    )) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val step = 56.dp.toPx()
            var y = 0f
            while (y < size.height) {
                var x = 0f
                while (x < size.width) {
                    drawCircle(
                        color = PokrColors.Mushroom.copy(alpha = 0.06f),
                        radius = 1.5f,
                        center = Offset(x + step / 2f, y + step / 2f),
                    )
                    x += step
                }
                y += step
            }
        }
        suits.forEachIndexed { i, suit ->
            Text(
                text = suit,
                color = PokrColors.Mushroom.copy(alpha = 0.12f),
                fontSize = 36.sp,
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .offset(
                        x = ((12 + (i * 37) % 76) * 3).dp,
                        y = ((8 + (i * 53) % 84) * 4).dp,
                    )
                    .rotate(((i * 23) % 40 - 20).toFloat()),
            )
        }
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(80.dp)
                .align(Alignment.TopCenter)
                .background(
                    Brush.verticalGradient(
                        listOf(Color.Black.copy(alpha = 0.25f), Color.Transparent),
                    ),
                ),
        )
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(100.dp)
                .align(Alignment.BottomCenter)
                .background(
                    Brush.verticalGradient(
                        listOf(Color.Transparent, Color.Black.copy(alpha = 0.35f)),
                    ),
                ),
        )
    }
}

@Composable
private fun PathLine(positions: List<NodePos>) {
    if (positions.size < 2) return
    Canvas(modifier = Modifier.fillMaxSize()) {
        val effect = PathEffect.dashPathEffect(floatArrayOf(7f, 12f), 0f)
        for (i in 0 until positions.lastIndex) {
            val a = positions[i]
            val b = positions[i + 1]
            drawLine(
                color = PokrColors.Mushroom.copy(alpha = 0.38f),
                start = Offset(a.x, a.y + 62f),
                end = Offset(b.x, b.y + 62f),
                strokeWidth = 5f,
                cap = StrokeCap.Round,
                pathEffect = effect,
            )
        }
    }
}

@Composable
private fun LevelNode(
    status: NodeStatus,
    badge: NodeBadgeKind?,
    current: Boolean,
    checked: Boolean,
    hand: PlayedHandLevel?,
    level: Int,
) {
    val locked = status == NodeStatus.Locked
    val faceDown = locked || hand?.holeCards == null
    Column(
        modifier = Modifier
            .width(86.dp)
            .height(88.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Bottom,
    ) {
        if (badge != null) {
            NodeBadge(kind = badge)
            Spacer(modifier = Modifier.height(4.dp))
        }
        Box(
            modifier = Modifier
                .height(70.dp)
                .fillMaxWidth(),
            contentAlignment = Alignment.BottomCenter,
        ) {
            MiniHoleFan(
                cards = hand?.holeCards,
                faceDown = faceDown,
                dimmed = locked,
            )
            if (checked && !locked) {
                Box(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .offset(x = 2.dp, y = (-2).dp)
                        .size(18.dp)
                        .clip(CircleShape)
                        .background(if (hand?.won == true) PokrColors.Brass else PokrColors.Ink)
                        .border(1.dp, Color.White.copy(alpha = 0.3f), CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = "✓",
                        color = if (hand?.won == true) PokrColors.Ink else PokrColors.Mushroom,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
        }
        Text(
            text = "$level",
            color = if (locked) PokrColors.Mushroom.copy(alpha = 0.4f)
            else PokrColors.Mushroom.copy(alpha = 0.85f),
            fontSize = 10.sp,
            fontWeight = FontWeight.ExtraBold,
            fontFamily = PokrFonts.Display,
        )
        if (current) {
            Spacer(modifier = Modifier.height(2.dp))
        }
    }
}

@Composable
private fun NodeBadge(kind: NodeBadgeKind) {
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(PokrRadius.Sm))
            .background(PokrColors.Ink.copy(alpha = 0.9f))
            .border(1.dp, PokrColors.Mushroom.copy(alpha = 0.2f), RoundedCornerShape(PokrRadius.Sm))
            .padding(horizontal = 8.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        when (kind) {
            NodeBadgeKind.Chip -> {
                Text("♣", color = PokrColors.BrassLight, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
            NodeBadgeKind.Spade -> {
                Text("♠", color = PokrColors.Mushroom, fontSize = 14.sp)
            }
            NodeBadgeKind.Heart -> {
                Text("♥", color = PokrColors.CardRed, fontSize = 14.sp)
            }
            NodeBadgeKind.Plus -> {
                Text("♣", color = PokrColors.BrassLight, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                Text("+5", color = PokrColors.Mushroom, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold)
            }
        }
    }
}

@Composable
private fun MiniHoleFan(
    cards: Pair<String, String>?,
    faceDown: Boolean,
    dimmed: Boolean,
) {
    Box(
        modifier = Modifier
            .width(58.dp)
            .height(56.dp),
        contentAlignment = Alignment.BottomCenter,
    ) {
        PlayingCard(
            code = cards?.first,
            faceDown = faceDown || cards == null,
            dimmed = dimmed,
            width = 34.dp,
            height = 48.dp,
            animateDeal = false,
            modifier = Modifier
                .align(Alignment.BottomStart)
                .offset(x = 2.dp)
                .rotate(-14f),
        )
        PlayingCard(
            code = cards?.second ?: cards?.first,
            faceDown = faceDown || cards == null,
            dimmed = dimmed,
            width = 34.dp,
            height = 48.dp,
            animateDeal = false,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .offset(x = (-2).dp)
                .rotate(12f),
        )
    }
}

@Composable
private fun HoleThumb(cards: Pair<String, String>?) {
    Box(
        modifier = Modifier
            .width(44.dp)
            .height(40.dp),
    ) {
        PlayingCard(
            code = cards?.first,
            faceDown = cards == null,
            width = 26.dp,
            height = 36.dp,
            animateDeal = false,
            modifier = Modifier
                .align(Alignment.BottomStart)
                .rotate(-10f),
        )
        PlayingCard(
            code = cards?.second,
            faceDown = cards == null,
            width = 26.dp,
            height = 36.dp,
            animateDeal = false,
            modifier = Modifier
                .align(Alignment.BottomStart)
                .offset(x = 12.dp)
                .rotate(8f),
        )
    }
}

@Composable
private fun HandPeek(
    level: Int,
    hand: PlayedHandLevel,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val whenLabel = formatHandWhen(hand.startedAt)
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(PokrColors.Ink.copy(alpha = 0.92f))
            .border(1.dp, PokrColors.Mushroom.copy(alpha = 0.2f), RoundedCornerShape(16.dp))
            .padding(12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.Top,
    ) {
        HoleThumb(cards = hand.holeCards)
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "Hand $level",
                color = PokrColors.Mushroom,
                fontWeight = FontWeight.Bold,
                fontFamily = PokrFonts.Display,
            )
            val subtitle = buildString {
                append(if (hand.won) "Won" else "Played")
                val hn = hand.handName
                if (!hn.isNullOrBlank() && hn != "Uncontested") {
                    append(" · ")
                    append(hn)
                }
                if (whenLabel.isNotBlank()) {
                    append(" · ")
                    append(whenLabel)
                }
                if (hand.source == "offline") append(" · Solo")
            }
            Text(
                text = subtitle,
                color = PokrColors.Mushroom.copy(alpha = 0.7f),
                fontSize = 12.sp,
            )
            if (hand.community.isNotEmpty()) {
                Row(
                    modifier = Modifier.padding(top = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    hand.community.forEach { code ->
                        PlayingCard(
                            code = code,
                            width = 24.dp,
                            height = 34.dp,
                            animateDeal = false,
                        )
                    }
                }
            }
        }
        Text(
            text = "×",
            color = PokrColors.Mushroom.copy(alpha = 0.6f),
            fontSize = 20.sp,
            modifier = Modifier
                .clip(RoundedCornerShape(8.dp))
                .clickable(onClick = onClose)
                .padding(4.dp),
        )
    }
}

@Composable
private fun HandBadge(n: Int) {
    Box(
        modifier = Modifier
            .height(32.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(Color.White)
            .border(1.dp, PokrColors.Sidebar.copy(alpha = 0.15f), RoundedCornerShape(8.dp))
            .padding(horizontal = 8.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = "$n",
            color = PokrColors.Sidebar,
            fontWeight = FontWeight.ExtraBold,
            fontFamily = PokrFonts.Display,
            fontSize = 14.sp,
        )
    }
}
