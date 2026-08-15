package com.pokr.android.core.designsystem

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.unit.dp

/**
 * Pinned white action dock — matches web mobile `ActionDockBody`.
 * Portrait: full-width sheet under the emoji bar. Landscape: compact rounded dock.
 */
@Composable
fun TableActionDock(
    modifier: Modifier = Modifier,
    landscape: Boolean = false,
    content: @Composable () -> Unit,
) {
    val shape = RoundedCornerShape(if (landscape) 12.dp else 0.dp)
    val surface = if (landscape) {
        Modifier
            .padding(horizontal = 6.dp, vertical = 4.dp)
            .shadow(
                elevation = 10.dp,
                shape = shape,
                ambientColor = PokrColors.Sidebar.copy(alpha = 0.12f),
                spotColor = PokrColors.Sidebar.copy(alpha = 0.12f),
            )
            .clip(shape)
            .background(PokrColors.White)
            .border(1.dp, PokrColors.Sidebar.copy(alpha = 0.12f), shape)
    } else {
        Modifier
            .background(PokrColors.White)
            .border(width = 1.dp, color = PokrColors.Sidebar.copy(alpha = 0.12f), shape = RoundedCornerShape(0.dp))
    }
    Box(
        modifier = modifier
            .fillMaxWidth()
            .then(surface)
            .heightIn(min = if (landscape) 0.dp else 152.dp),
    ) {
        content()
    }
}
