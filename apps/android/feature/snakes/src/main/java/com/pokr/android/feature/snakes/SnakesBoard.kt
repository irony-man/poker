package com.pokr.android.feature.snakes

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pokr.android.core.designsystem.LudoSeatColors
import com.pokr.android.core.designsystem.PokrColors
import com.pokr.android.core.model.SnakesPlayerView

@Composable
fun SnakesBoard(
    seats: List<SnakesPlayerView>,
    toAct: Int?,
    lastFrom: Int?,
    lastTo: Int?,
    modifier: Modifier = Modifier,
) {
    BoxWithConstraints(
        modifier = modifier
            .aspectRatio(1f)
            .clip(androidx.compose.foundation.shape.RoundedCornerShape(12.dp))
            .background(PokrColors.Cream)
            .border(2.dp, PokrColors.Sidebar.copy(alpha = 0.2f), androidx.compose.foundation.shape.RoundedCornerShape(12.dp)),
    ) {
        val cell = maxWidth / 10
        Canvas(Modifier = Modifier.fillMaxSize()) {
            val w = size.width / 10f
            val h = size.height / 10f
            for (r in 0 until 10) {
                for (c in 0 until 10) {
                    val light = (r + c) % 2 == 0
                    drawRect(
                        color = if (light) Color(0xFFE8DCC8) else Color(0xFFD4C4A8),
                        topLeft = Offset(c * w, r * h),
                        size = androidx.compose.ui.geometry.Size(w, h),
                    )
                }
            }
            SnakesLayout.TELEPORTS.forEach { (from, to) ->
                val (fc, fr) = SnakesLayout.cellFor(from)
                val (tc, tr) = SnakesLayout.cellFor(to)
                val start = Offset((fc + 0.5f) * w, (fr + 0.5f) * h)
                val end = Offset((tc + 0.5f) * w, (tr + 0.5f) * h)
                val ladder = to > from
                val path = Path().apply {
                    moveTo(start.x, start.y)
                    quadraticTo(
                        (start.x + end.x) / 2f + (if (ladder) w * 0.2f else -w * 0.15f),
                        (start.y + end.y) / 2f,
                        end.x,
                        end.y,
                    )
                }
                drawPath(
                    path,
                    color = if (ladder) Color(0xFF2E7D4F) else Color(0xFFB33A3A),
                    style = Stroke(width = if (ladder) 4f else 5f),
                )
            }
            if (lastFrom != null && lastFrom > 0) {
                val (c, r) = SnakesLayout.cellFor(lastFrom)
                drawCircle(
                    color = PokrColors.Gold.copy(alpha = 0.35f),
                    radius = w * 0.35f,
                    center = Offset((c + 0.5f) * w, (r + 0.5f) * h),
                )
            }
            if (lastTo != null && lastTo > 0) {
                val (c, r) = SnakesLayout.cellFor(lastTo)
                drawCircle(
                    color = PokrColors.Patina.copy(alpha = 0.4f),
                    radius = w * 0.35f,
                    center = Offset((c + 0.5f) * w, (r + 0.5f) * h),
                )
            }
        }

        seats.filter { it.userId != null || it.isBot == true }.forEach { player ->
            val pos = player.position
            if (pos <= 0) return@forEach
            val (col, row) = SnakesLayout.cellFor(pos)
            val active = player.seat == toAct
            Box(
                modifier = Modifier
                    .offset(x = cell * col + cell * 0.15f, y = cell * row + cell * 0.15f)
                    .size(cell * 0.7f)
                    .clip(CircleShape)
                    .background(LudoSeatColors.of(player.seat))
                    .border(
                        if (active) 3.dp else 1.dp,
                        if (active) PokrColors.InkStrong else Color.White.copy(alpha = 0.7f),
                        CircleShape,
                    ),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = "${player.seat + 1}",
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 10.sp,
                )
            }
        }
    }
}
