package com.felt.android.core.designsystem

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

@Composable
fun TurnTimerBar(
    endsAt: Long?,
    totalMs: Long,
    isMyTurn: Boolean,
    modifier: Modifier = Modifier,
) {
    val remaining = rememberTurnRemainingMs(endsAt)
    if (endsAt == null || remaining <= 0L || totalMs <= 0L) return

    val pct = (remaining.toFloat() / totalMs.toFloat()).coerceIn(0f, 1f)
    val urgent = remaining <= 5_000L
    val accent = if (urgent) FeltColors.Danger else FeltColors.Neon

    HudPanel(modifier = modifier.fillMaxWidth()) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = if (isMyTurn) "YOUR CLOCK" else "TURN CLOCK",
                    color = accent,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp,
                )
                Text(
                    text = "${ceil(remaining / 1000.0).toInt()}s",
                    color = if (urgent) FeltColors.Danger else FeltColors.Cream,
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
                    color = FeltColors.Cream.copy(alpha = 0.12f),
                    size = size,
                    cornerRadius = CornerRadius(999f, 999f),
                )
                drawRoundRect(
                    color = accent,
                    size = Size(size.width * pct, size.height),
                    cornerRadius = CornerRadius(999f, 999f),
                )
            }
            if (isMyTurn) {
                Text(
                    text = "Time out → fold",
                    color = FeltColors.Cream.copy(alpha = 0.4f),
                    fontSize = 10.sp,
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
) {
    val remaining = rememberTurnRemainingMs(if (active) endsAt else null)
    if (!active || endsAt == null || remaining <= 0L || totalMs <= 0L) return
    val pct = (remaining.toFloat() / totalMs.toFloat()).coerceIn(0f, 1f)
    val urgent = remaining <= 5_000L
    val accent = if (urgent) FeltColors.Danger else FeltColors.Neon

    Canvas(modifier = modifier.size(48.dp)) {
        val stroke = Stroke(width = 3.dp.toPx(), cap = StrokeCap.Round)
        val diam = size.minDimension - stroke.width
        val topLeft = Offset((size.width - diam) / 2f, (size.height - diam) / 2f)
        drawArc(
            color = FeltColors.Cream.copy(alpha = 0.1f),
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
    val step = 360.0 / maxSeats
    val offset = ((seat - hero) % maxSeats + maxSeats) % maxSeats
    return 90.0 + offset * step
}
