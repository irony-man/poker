package com.pokr.android.core.designsystem

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlin.math.ceil

@Composable
fun rememberTurnRemainingMs(endsAt: Long?): Long {
    var remaining by remember(endsAt) { mutableLongStateOf(0L) }
    LaunchedEffect(endsAt) {
        if (endsAt == null) {
            remaining = 0L
            return@LaunchedEffect
        }
        while (true) {
            remaining = (endsAt - System.currentTimeMillis()).coerceAtLeast(0L)
            if (remaining <= 0L) break
            delay(100)
        }
    }
    return remaining
}

/** Thin progress strip for the top of the Your move panel (light dock). */
@Composable
fun MoveTimerStrip(
    endsAt: Long?,
    totalMs: Long,
    modifier: Modifier = Modifier,
    compact: Boolean = false,
) {
    val remaining = rememberTurnRemainingMs(endsAt)
    if (endsAt == null || remaining <= 0L || totalMs <= 0L) return

    val pct = (remaining.toFloat() / totalMs.toFloat()).coerceIn(0f, 1f)
    val urgent = remaining <= 5_000L
    val accent = if (urgent) PokrColors.Danger else PokrColors.Positive

    Canvas(
        modifier = modifier
            .fillMaxWidth()
            .height(if (compact) 4.dp else 6.dp),
    ) {
        drawRect(color = PokrColors.Sidebar.copy(alpha = 0.12f), size = size)
        drawRect(
            color = accent,
            size = Size(size.width * pct, size.height),
        )
    }
}

@Composable
fun turnSecondsLabel(endsAt: Long?): Pair<String?, Boolean> {
    val remaining = rememberTurnRemainingMs(endsAt)
    if (endsAt == null || remaining <= 0L) return null to false
    return "${ceil(remaining / 1000.0).toInt()}s" to (remaining <= 5_000L)
}

/** Opponent turn clock — not used on your move. */
@Composable
fun TurnTimerBar(
    endsAt: Long?,
    totalMs: Long,
    isMyTurn: Boolean = false,
    modifier: Modifier = Modifier,
) {
    if (isMyTurn) return
    val remaining = rememberTurnRemainingMs(endsAt)
    if (endsAt == null || remaining <= 0L || totalMs <= 0L) return

    val pct = (remaining.toFloat() / totalMs.toFloat()).coerceIn(0f, 1f)
    val urgent = remaining <= 5_000L
    val accent = if (urgent) PokrColors.Danger else PokrColors.Neon

    HudPanel(modifier = modifier.fillMaxWidth()) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "TURN CLOCK",
                    color = accent,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp,
                )
                Text(
                    text = "${ceil(remaining / 1000.0).toInt()}s",
                    color = if (urgent) PokrColors.Danger else PokrColors.Cream,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                )
            }
            Canvas(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(6.dp),
            ) {
                drawRoundRect(
                    color = PokrColors.Cream.copy(alpha = 0.12f),
                    size = size,
                    cornerRadius = CornerRadius(999f, 999f),
                )
                drawRoundRect(
                    color = accent,
                    size = Size(size.width * pct, size.height),
                    cornerRadius = CornerRadius(999f, 999f),
                )
            }
        }
    }
}

@Composable
fun SeatTurnRing(
    endsAt: Long?,
    totalMs: Long,
    active: Boolean,
    modifier: Modifier = Modifier,
    ringSize: androidx.compose.ui.unit.Dp = 56.dp,
) {
    val remaining = rememberTurnRemainingMs(if (active) endsAt else null)
    if (!active || endsAt == null || remaining <= 0L || totalMs <= 0L) return
    val pct = (remaining.toFloat() / totalMs.toFloat()).coerceIn(0f, 1f)
    val urgent = remaining <= 5_000L
    val accent = if (urgent) PokrColors.Danger else PokrColors.Neon

    Canvas(modifier = modifier.size(ringSize)) {
        val stroke = Stroke(width = 3.5.dp.toPx(), cap = StrokeCap.Round)
        val diam = this.size.minDimension - stroke.width
        val topLeft = Offset((this.size.width - diam) / 2f, (this.size.height - diam) / 2f)
        drawArc(
            color = PokrColors.Cream.copy(alpha = 0.12f),
            startAngle = -90f,
            sweepAngle = 360f,
            useCenter = false,
            topLeft = topLeft,
            size = Size(diam, diam),
            style = stroke,
        )
        drawArc(
            color = accent,
            startAngle = -90f,
            sweepAngle = 360f * pct,
            useCenter = false,
            topLeft = topLeft,
            size = Size(diam, diam),
            style = stroke,
        )
    }
}

fun seatAngleForHero(seat: Int, maxSeats: Int, heroSeat: Int?): Double {
    val hero = heroSeat ?: 0
    if (seat == hero) return 90.0
    val gapHalf = 40.0
    val arcStart = 270.0 + gapHalf
    val arcEnd = 270.0 - gapHalf + 360.0
    val arcSpan = arcEnd - arcStart

    fun normalize(deg: Double) = ((deg % 360.0) + 360.0) % 360.0

    val positions = (0 until maxSeats).map { i ->
        val frac = if (maxSeats <= 1) 0.5 else i.toDouble() / (maxSeats - 1)
        normalize(arcStart + frac * arcSpan)
    }

    val bottomIdx = positions.indices.minByOrNull { idx ->
        kotlin.math.abs(normalize(positions[idx]) - 90.0)
    } ?: 0

    val offset = ((seat - hero) % maxSeats + maxSeats) % maxSeats
    val posIdx = (bottomIdx + offset) % maxSeats
    return positions[posIdx]
}
