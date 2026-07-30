package com.felt.android.core.designsystem

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import kotlin.math.roundToInt

/**
 * Action CTA shell.
 * - Portrait: draggable floating panel that pops open on your turn.
 * - Landscape phone: slim docked strip pinned to the bottom.
 */
@Composable
fun BoxScope.FloatingActionPanel(
    expanded: Boolean,
    modifier: Modifier = Modifier,
    collapsedLabel: String = "Actions",
    landscape: Boolean = false,
    content: @Composable () -> Unit,
) {
    if (landscape) {
        val height = if (expanded) 56.dp else 40.dp
        val shape = RoundedCornerShape(12.dp)
        Box(
            modifier = modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .padding(horizontal = 6.dp, vertical = 4.dp)
                .height(height)
                .clip(shape)
                .background(
                    Brush.verticalGradient(
                        listOf(FeltColors.InkPanel.copy(alpha = 0.95f), FeltColors.InkRaised),
                    ),
                )
                .border(
                    1.dp,
                    if (expanded) FeltColors.Gold.copy(alpha = 0.45f)
                    else FeltColors.Cream.copy(alpha = 0.15f),
                    shape,
                ),
            contentAlignment = Alignment.Center,
        ) {
            Box(modifier = Modifier.fillMaxSize()) {
                content()
            }
        }
        return
    }

    var open by remember { mutableStateOf(expanded) }
    if (expanded) open = true

    var offsetX by remember { mutableFloatStateOf(0f) }
    var offsetY by remember { mutableFloatStateOf(0f) }

    Box(
        modifier = modifier
            .align(Alignment.BottomCenter)
            .padding(bottom = 10.dp, start = 8.dp, end = 8.dp)
            .offset { IntOffset(offsetX.roundToInt(), offsetY.roundToInt()) }
            .widthIn(max = 420.dp)
            .fillMaxWidth(0.96f)
            .pointerInput(Unit) {
                detectDragGestures { change, drag ->
                    change.consume()
                    offsetX += drag.x
                    offsetY += drag.y
                }
            },
    ) {
        if (!open) {
            FeltGhostButton(
                text = if (expanded) "Your move" else collapsedLabel,
                onClick = { open = true },
                modifier = Modifier.align(Alignment.Center),
            )
        } else {
            content()
        }
    }
}
