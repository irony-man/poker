package com.pokr.android.feature.ludo

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp
import com.pokr.android.core.designsystem.LudoSeatColors
import com.pokr.android.core.designsystem.PokrColors
import com.pokr.android.core.model.LudoLegalMove
import com.pokr.android.core.model.LudoPlayerView
import com.pokr.android.core.model.LudoTokenPos
import kotlin.math.floor

@Composable
fun LudoBoard(
    seats: List<LudoPlayerView>,
    legalMoves: List<LudoLegalMove>,
    youSeat: Int?,
    toAct: Int?,
    onToken: (seat: Int, tokenIndex: Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    val legalForYou = if (youSeat != null) {
        legalMoves.map { it.tokenIndex }.toSet()
    } else {
        emptySet()
    }
    Box(
        modifier = modifier
            .fillMaxWidth()
            .aspectRatio(1f),
    ) {
        Canvas(
            modifier = Modifier
                .fillMaxSize()
                .pointerInput(seats, legalForYou, youSeat) {
                    detectTapGestures { tap ->
                        val cell = size.width / LudoLayout.GRID
                        if (cell <= 0f) return@detectTapGestures
                        val col = floor(tap.x / cell).toInt()
                        val row = floor(tap.y / cell).toInt()
                        if (youSeat == null) return@detectTapGestures
                        val player = seats.find { it.seat == youSeat } ?: return@detectTapGestures
                        player.tokens.forEach { token ->
                            if (token.index !in legalForYou) return@forEach
                            val (r, c) = LudoLayout.cellFor(youSeat, token.pos, token.index)
                            if (r == row && c == col) {
                                onToken(youSeat, token.index)
                            }
                        }
                    }
                },
        ) {
            val n = LudoLayout.GRID
            val cell = size.minDimension / n
            val board = Size(cell * n, cell * n)

            drawRoundRect(
                color = PokrColors.InkPanel,
                size = board,
                cornerRadius = CornerRadius(12.dp.toPx()),
            )

            for (row in 0 until n) {
                for (col in 0 until n) {
                    val topLeft = Offset(col * cell, row * cell)
                    val fill = cellFill(row, col)
                    drawRect(color = fill, topLeft = topLeft, size = Size(cell, cell))
                    drawRect(
                        color = PokrColors.Ink.copy(alpha = 0.18f),
                        topLeft = topLeft,
                        size = Size(cell, cell),
                        style = Stroke(width = 1.dp.toPx()),
                    )
                    val trackIndex = LudoLayout.TRACK.indexOfFirst { it.first == row && it.second == col }
                    if (trackIndex in LudoLayout.SAFE_SQUARES) {
                        drawCircle(
                            color = PokrColors.Brass.copy(alpha = 0.85f),
                            radius = cell * 0.16f,
                            center = Offset(topLeft.x + cell / 2f, topLeft.y + cell / 2f),
                        )
                    }
                }
            }

            val stacked = mutableMapOf<Pair<Int, Int>, MutableList<Triple<Int, Int, LudoTokenPos>>>()
            seats.filter { it.userId != null || it.isBot == true }.forEach { player ->
                player.tokens.forEach { token ->
                    val cellPos = LudoLayout.cellFor(player.seat, token.pos, token.index)
                    stacked.getOrPut(cellPos) { mutableListOf() }
                        .add(Triple(player.seat, token.index, token.pos))
                }
            }

            stacked.forEach { (cellPos, pieces) ->
                val (row, col) = cellPos
                val cx = col * cell + cell / 2f
                val cy = row * cell + cell / 2f
                pieces.forEachIndexed { i, (seat, tokenIndex, _) ->
                    val spread = if (pieces.size == 1) 0f else cell * 0.16f
                    val angle = (i * 360f / pieces.size) * (Math.PI / 180.0)
                    val ox = (kotlin.math.cos(angle) * spread).toFloat()
                    val oy = (kotlin.math.sin(angle) * spread).toFloat()
                    val legal = seat == youSeat && tokenIndex in legalForYou
                    val acting = seat == toAct
                    val radius = cell * if (legal) 0.34f else 0.28f
                    val color = LudoSeatColors.of(seat)
                    if (legal) {
                        drawCircle(
                            color = PokrColors.Brass,
                            radius = radius + 4.dp.toPx(),
                            center = Offset(cx + ox, cy + oy),
                            style = Stroke(width = 3.dp.toPx()),
                        )
                    } else if (acting) {
                        drawCircle(
                            color = color.copy(alpha = 0.35f),
                            radius = radius + 3.dp.toPx(),
                            center = Offset(cx + ox, cy + oy),
                        )
                    }
                    drawCircle(color = color, radius = radius, center = Offset(cx + ox, cy + oy))
                    drawCircle(
                        color = Color.White.copy(alpha = 0.88f),
                        radius = radius * 0.28f,
                        center = Offset(cx + ox - radius * 0.18f, cy + oy - radius * 0.18f),
                    )
                }
            }
        }
    }
}

private fun cellFill(row: Int, col: Int): Color {
    if (row == LudoLayout.HUB.first && col == LudoLayout.HUB.second) {
        return PokrColors.InkRaised
    }
    val home = LudoLayout.homeSeat(row, col)
    if (home != null) return LudoSeatColors.of(home).copy(alpha = 0.9f)
    val stretch = LudoLayout.stretchSeat(row, col)
    if (stretch != null) return LudoSeatColors.of(stretch).copy(alpha = 0.82f)
    val yard = LudoLayout.yardSeat(row, col)
    if (yard != null) return LudoSeatColors.of(yard).copy(alpha = 0.55f)
    val onTrack = LudoLayout.TRACK.any { it.first == row && it.second == col }
    if (onTrack) {
        val startSeat = LudoLayout.START_SQUARES.indexOfFirst { idx ->
            val cell = LudoLayout.TRACK.getOrNull(idx)
            cell?.first == row && cell.second == col
        }
        if (startSeat >= 0) return LudoSeatColors.of(startSeat).copy(alpha = 0.7f)
        return PokrColors.Cream.copy(alpha = 0.92f)
    }
    val inCross = row in 6..8 || col in 6..8
    return if (inCross) PokrColors.Mushroom.copy(alpha = 0.35f) else PokrColors.Ink.copy(alpha = 0.35f)
}
