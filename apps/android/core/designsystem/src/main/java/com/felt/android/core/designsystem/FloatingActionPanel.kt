package com.felt.android.core.designsystem

import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import kotlin.math.roundToInt

/** Draggable floating shell for action CTAs; pops open on your turn. */
@Composable
fun BoxScope.FloatingActionPanel(
    expanded: Boolean,
    modifier: Modifier = Modifier,
    collapsedLabel: String = "Actions",
    content: @Composable () -> Unit,
) {
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
