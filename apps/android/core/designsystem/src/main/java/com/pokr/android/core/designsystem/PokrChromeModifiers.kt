package com.pokr.android.core.designsystem

import androidx.compose.foundation.background
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

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
