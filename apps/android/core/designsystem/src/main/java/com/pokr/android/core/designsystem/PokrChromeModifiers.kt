package com.pokr.android.core.designsystem

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.padding
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.drawOutline
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Arcade hard offset shadow. Drawn behind the same measured size as the
 * foreground, so [Modifier.fillMaxWidth] fills both the face and the shadow.
 */
fun Modifier.arcadeOffsetShadow(
    shape: Shape,
    offset: Dp = 4.dp,
): Modifier = this
    .padding(end = offset, bottom = offset)
    .drawBehind {
        val dx = offset.toPx()
        translate(left = dx, top = dx) {
            drawOutline(
                outline = shape.createOutline(size, layoutDirection, this),
                color = Color.Black,
            )
        }
    }

/** Stakes / seats / table-size chips — Arcade hard shadow vs Classic/Glass outline. */
fun Modifier.pokrChoiceChipSurface(
    selected: Boolean,
    shape: Shape,
    arcade: Boolean,
    chrome: PokrChrome = PokrChrome.Lobby,
    glass: Boolean = false,
): Modifier {
    if (arcade) {
        return this
            .arcadeOffsetShadow(shape, offset = 3.dp)
            .background(
                if (selected) PokrColors.Mushroom else PokrColors.White,
                shape,
            )
            .border(2.dp, Color.Black, shape)
    }
    if (glass) {
        return this
            .clip(shape)
            .background(
                if (selected) PokrColors.InkRaised
                else Color.White.copy(alpha = 0.22f),
                shape,
            )
            .border(
                1.dp,
                Color.White.copy(alpha = if (selected) 0.45f else 0.3f),
                shape,
            )
    }
    val (bg, border, width) = when (chrome) {
        PokrChrome.Lobby -> if (selected) {
            Triple(PokrColors.Sidebar.copy(alpha = 0.1f), PokrColors.Sidebar, 2.dp)
        } else {
            Triple(PokrColors.Mushroom.copy(alpha = 0.5f), PokrColors.Sidebar.copy(alpha = 0.14f), 1.dp)
        }
        PokrChrome.Play -> if (selected) {
            Triple(PokrColors.Mushroom.copy(alpha = 0.15f), PokrColors.Mushroom.copy(alpha = 0.55f), 2.dp)
        } else {
            Triple(PokrColors.Ink.copy(alpha = 0.45f), PokrColors.Mushroom.copy(alpha = 0.15f), 1.dp)
        }
    }
    return this
        .clip(shape)
        .background(bg)
        .border(width, border, shape)
}

/** Label color for [pokrChoiceChipSurface] — dark ink on Arcade selected yellow. */
fun pokrChoiceForeground(
    selected: Boolean,
    arcade: Boolean,
    muted: Boolean = false,
    chrome: PokrChrome = PokrChrome.Lobby,
    glass: Boolean = false,
): Color = when {
    arcade && selected -> if (muted) PokrColors.InkStrong.copy(alpha = 0.7f) else PokrColors.InkStrong
    arcade -> if (muted) PokrColors.InkStrongMuted else PokrColors.InkStrong.copy(alpha = 0.85f)
    glass && selected -> if (muted) Color.White.copy(alpha = 0.75f) else Color.White
    glass -> if (muted) PokrColors.InkStrongMuted else PokrColors.InkStrong.copy(alpha = 0.85f)
    chrome == PokrChrome.Play && selected -> PokrColors.Mushroom
    chrome == PokrChrome.Play -> if (muted) PokrColors.Cream.copy(alpha = 0.65f) else PokrColors.Cream.copy(alpha = 0.8f)
    selected -> PokrColors.Sidebar
    muted -> PokrColors.InkStrongMuted
    else -> PokrColors.InkStrong.copy(alpha = 0.85f)
}

/** Yellow graph-paper ground in Arcade; mushroom fill in Classic. */
fun Modifier.pokrPageGround(): Modifier = composed {
    val mushroom = PokrColors.Mushroom
    val arcade = LocalPokrUiTheme.current == PokrUiTheme.Arcade
    then(
        if (!arcade) {
            Modifier.background(mushroom)
        } else {
            Modifier.background(mushroom).drawBehind {
                val step = 24.dp.toPx()
                val line = Color.Black.copy(alpha = 0.07f)
                var x = 0f
                while (x <= size.width) {
                    drawLine(line, Offset(x, 0f), Offset(x, size.height), strokeWidth = 1f)
                    x += step
                }
                var y = 0f
                while (y <= size.height) {
                    drawLine(line, Offset(0f, y), Offset(size.width, y), strokeWidth = 1f)
                    y += step
                }
            }
        },
    )
}
