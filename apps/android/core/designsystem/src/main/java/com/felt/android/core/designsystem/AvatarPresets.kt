package com.felt.android.core.designsystem

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlin.math.cos
import kotlin.math.sin

const val AVATAR_PRESET_COUNT = 8

private data class AvatarPalette(val bg: Color, val accent: Color)

private val AVATAR_PALETTES = listOf(
    AvatarPalette(Color(0xFF1A2332), Color(0xFF3DE0FF)),
    AvatarPalette(Color(0xFF2A1520), Color(0xFFFF6B8A)),
    AvatarPalette(Color(0xFF1E2A18), Color(0xFF2AFF9A)),
    AvatarPalette(Color(0xFF2A2410), Color(0xFFE0B43A)),
    AvatarPalette(Color(0xFF1A1A2E), Color(0xFFA78BFA)),
    AvatarPalette(Color(0xFF241810), Color(0xFFFB923C)),
    AvatarPalette(Color(0xFF102428), Color(0xFF2DD4BF)),
    AvatarPalette(Color(0xFF281018), Color(0xFFF472B6)),
)

fun avatarIdFromUserId(userId: String?): Int {
    if (userId.isNullOrBlank()) return 0
    var h = -2128831035 // FNV offset basis as signed Int
    for (ch in userId) {
        h = h xor ch.code
        h *= 16777619
    }
    return (h ushr 1) % AVATAR_PRESET_COUNT
}

fun resolveAvatarId(userId: String?, preferred: Int?): Int {
    if (preferred != null && preferred in 0 until AVATAR_PRESET_COUNT) return preferred
    return avatarIdFromUserId(userId)
}

@Composable
fun PlayerAvatar(
    avatarId: Int? = null,
    userId: String? = null,
    size: Dp = 44.dp,
    modifier: Modifier = Modifier,
    selected: Boolean = false,
) {
    val id = resolveAvatarId(userId, avatarId)
    val palette = AVATAR_PALETTES[id]
    Box(
        modifier = modifier
            .size(size)
            .clip(CircleShape)
            .then(
                if (selected) Modifier.border(2.dp, FeltColors.Gold, CircleShape)
                else Modifier.border(1.dp, FeltColors.Cream.copy(alpha = 0.15f), CircleShape),
            ),
        contentAlignment = Alignment.Center,
    ) {
        Canvas(modifier = Modifier.size(size)) {
            drawCircle(color = palette.bg)
            val accent = palette.accent
            val cx = this.size.width / 2f
            val cy = this.size.height / 2f
            val s = this.size.minDimension
            when (id) {
                0 -> { // spade
                    val path = Path().apply {
                        moveTo(cx, cy - s * 0.32f)
                        cubicTo(cx - s * 0.28f, cy - s * 0.05f, cx - s * 0.28f, cy + s * 0.12f, cx, cy + s * 0.22f)
                        cubicTo(cx + s * 0.28f, cy + s * 0.12f, cx + s * 0.28f, cy - s * 0.05f, cx, cy - s * 0.32f)
                        close()
                    }
                    drawPath(path, accent)
                    drawRect(
                        accent,
                        topLeft = Offset(cx - s * 0.04f, cy + s * 0.16f),
                        size = Size(s * 0.08f, s * 0.18f),
                    )
                }
                1 -> { // heart
                    val path = Path().apply {
                        moveTo(cx, cy + s * 0.28f)
                        cubicTo(cx - s * 0.42f, cy + s * 0.02f, cx - s * 0.32f, cy - s * 0.28f, cx, cy - s * 0.08f)
                        cubicTo(cx + s * 0.32f, cy - s * 0.28f, cx + s * 0.42f, cy + s * 0.02f, cx, cy + s * 0.28f)
                        close()
                    }
                    drawPath(path, accent)
                }
                2 -> { // diamond
                    val path = Path().apply {
                        moveTo(cx, cy - s * 0.32f)
                        lineTo(cx + s * 0.28f, cy)
                        lineTo(cx, cy + s * 0.32f)
                        lineTo(cx - s * 0.28f, cy)
                        close()
                    }
                    drawPath(path, accent)
                }
                3 -> { // club
                    drawCircle(accent, radius = s * 0.14f, center = Offset(cx - s * 0.16f, cy))
                    drawCircle(accent, radius = s * 0.14f, center = Offset(cx + s * 0.16f, cy))
                    drawCircle(accent, radius = s * 0.14f, center = Offset(cx, cy - s * 0.16f))
                    drawRect(
                        accent,
                        topLeft = Offset(cx - s * 0.04f, cy),
                        size = Size(s * 0.08f, s * 0.28f),
                    )
                }
                4 -> { // chip
                    drawCircle(accent.copy(alpha = 0.35f), radius = s * 0.18f, center = Offset(cx, cy))
                    drawCircle(
                        color = Color.Transparent,
                        radius = s * 0.3f,
                        center = Offset(cx, cy),
                        style = Stroke(width = s * 0.06f),
                    )
                    drawCircle(accent, radius = s * 0.3f, center = Offset(cx, cy), style = Stroke(width = s * 0.06f))
                    for (i in 0 until 8) {
                        val a = Math.toRadians(i * 45.0)
                        drawCircle(
                            accent,
                            radius = s * 0.035f,
                            center = Offset(
                                cx + (cos(a) * s * 0.3).toFloat(),
                                cy + (sin(a) * s * 0.3).toFloat(),
                            ),
                        )
                    }
                }
                5 -> { // crown
                    val path = Path().apply {
                        moveTo(cx - s * 0.28f, cy + s * 0.18f)
                        lineTo(cx - s * 0.28f, cy - s * 0.05f)
                        lineTo(cx - s * 0.12f, cy + s * 0.08f)
                        lineTo(cx, cy - s * 0.22f)
                        lineTo(cx + s * 0.12f, cy + s * 0.08f)
                        lineTo(cx + s * 0.28f, cy - s * 0.05f)
                        lineTo(cx + s * 0.28f, cy + s * 0.18f)
                        close()
                    }
                    drawPath(path, accent)
                    drawRoundRect(
                        accent,
                        topLeft = Offset(cx - s * 0.3f, cy + s * 0.2f),
                        size = Size(s * 0.6f, s * 0.08f),
                        cornerRadius = CornerRadius(2f, 2f),
                    )
                }
                6 -> { // dice
                    drawRoundRect(
                        accent,
                        topLeft = Offset(cx - s * 0.26f, cy - s * 0.26f),
                        size = Size(s * 0.52f, s * 0.52f),
                        cornerRadius = CornerRadius(s * 0.08f, s * 0.08f),
                    )
                    val ink = Color(0xFF0A0E12)
                    listOf(
                        Offset(cx - s * 0.12f, cy - s * 0.12f),
                        Offset(cx + s * 0.12f, cy - s * 0.12f),
                        Offset(cx, cy),
                        Offset(cx - s * 0.12f, cy + s * 0.12f),
                        Offset(cx + s * 0.12f, cy + s * 0.12f),
                    ).forEach { drawCircle(ink, radius = s * 0.045f, center = it) }
                }
                else -> { // ace
                    drawRoundRect(
                        accent.copy(alpha = 0.25f),
                        topLeft = Offset(cx - s * 0.2f, cy - s * 0.3f),
                        size = Size(s * 0.4f, s * 0.6f),
                        cornerRadius = CornerRadius(s * 0.04f, s * 0.04f),
                    )
                    drawRoundRect(
                        Color.Transparent,
                        topLeft = Offset(cx - s * 0.2f, cy - s * 0.3f),
                        size = Size(s * 0.4f, s * 0.6f),
                        cornerRadius = CornerRadius(s * 0.04f, s * 0.04f),
                        style = Stroke(width = s * 0.035f),
                    )
                    // Simplified "A" mark
                    val path = Path().apply {
                        moveTo(cx, cy - s * 0.14f)
                        lineTo(cx + s * 0.1f, cy + s * 0.16f)
                        lineTo(cx + s * 0.04f, cy + s * 0.16f)
                        lineTo(cx + s * 0.02f, cy + s * 0.08f)
                        lineTo(cx - s * 0.02f, cy + s * 0.08f)
                        lineTo(cx - s * 0.04f, cy + s * 0.16f)
                        lineTo(cx - s * 0.1f, cy + s * 0.16f)
                        close()
                    }
                    drawPath(path, accent)
                    drawRect(
                        accent,
                        topLeft = Offset(cx - s * 0.05f, cy + s * 0.02f),
                        size = Size(s * 0.1f, s * 0.03f),
                    )
                }
            }
        }
    }
}

@Composable
fun AvatarPicker(
    value: Int,
    onChange: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        FeltLabel("Profile picture")
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            for (rowStart in 0 until AVATAR_PRESET_COUNT step 4) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    for (id in rowStart until minOf(rowStart + 4, AVATAR_PRESET_COUNT)) {
                        PlayerAvatar(
                            avatarId = id,
                            size = 40.dp,
                            selected = value == id,
                            modifier = Modifier
                                .clickable { onChange(id) }
                                .padding(1.dp),
                        )
                    }
                }
            }
        }
    }
}
