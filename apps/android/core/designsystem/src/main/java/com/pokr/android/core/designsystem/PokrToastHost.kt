package com.pokr.android.core.designsystem

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.MutableTransitionState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pokr.android.core.common.ToastBus
import com.pokr.android.core.common.ToastKind
import com.pokr.android.core.common.ToastMessage
import kotlinx.coroutines.delay

private fun ToastKind.accent(): Color = when (this) {
    ToastKind.Error -> PokrColors.Danger
    ToastKind.Success -> PokrColors.Brass
    ToastKind.Info -> PokrColors.Patina
}

private fun ToastKind.label(): String = when (this) {
    ToastKind.Error -> "NOTICE"
    ToastKind.Success -> "DONE"
    ToastKind.Info -> "INFO"
}

/** App-wide notification stack (top of screen). Push via [ToastBus]. */
@Composable
fun PokrToastHost(modifier: Modifier = Modifier) {
    val toasts by ToastBus.toasts.collectAsState()
    Column(
        modifier = modifier
            .fillMaxWidth()
            .statusBarsPadding()
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        toasts.forEach { toast ->
            key(toast.id) { ToastCard(toast) }
        }
    }
}

@Composable
private fun ToastCard(toast: ToastMessage) {
    val visibleState = remember { MutableTransitionState(false) }
    visibleState.targetState = !toast.leaving

    LaunchedEffect(toast.id, toast.shownAt) {
        delay(toast.durationMs)
        ToastBus.dismiss(toast.id)
    }
    LaunchedEffect(toast.leaving) {
        if (toast.leaving) {
            delay(ToastBus.EXIT_MS)
            ToastBus.remove(toast.id)
        }
    }

    val accent = toast.kind.accent()
    val shape = RoundedCornerShape(PokrRadius.Lg)
    AnimatedVisibility(
        visibleState = visibleState,
        enter = slideInVertically(tween(320)) { -it } + fadeIn(tween(320)),
        exit = slideOutVertically(tween(ToastBus.EXIT_MS.toInt())) { -it / 2 } +
            fadeOut(tween(ToastBus.EXIT_MS.toInt())),
    ) {
        Row(
            modifier = Modifier
                .widthIn(max = 420.dp)
                .fillMaxWidth()
                .clip(shape)
                .background(PokrColors.InkPanel)
                .background(accent.copy(alpha = 0.14f))
                .border(1.dp, accent.copy(alpha = 0.45f), shape)
                .semantics {
                    liveRegion = if (toast.kind == ToastKind.Error) {
                        LiveRegionMode.Assertive
                    } else {
                        LiveRegionMode.Polite
                    }
                },
            verticalAlignment = Alignment.Top,
        ) {
            Box(
                modifier = Modifier
                    .padding(start = 10.dp, top = 12.dp)
                    .size(width = 3.dp, height = 28.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(accent),
            )
            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(start = 10.dp, top = 10.dp, bottom = 10.dp),
            ) {
                Text(
                    text = toast.kind.label(),
                    color = accent,
                    fontFamily = PokrFonts.Display,
                    fontWeight = FontWeight.Bold,
                    fontSize = 10.sp,
                    letterSpacing = 1.4.sp,
                )
                Text(
                    text = toast.text,
                    color = PokrColors.Cream,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp,
                    lineHeight = 18.sp,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
            Box(
                modifier = Modifier
                    .padding(6.dp)
                    .size(32.dp)
                    .clip(CircleShape)
                    .clickable { ToastBus.dismiss(toast.id) }
                    .semantics { contentDescription = "Dismiss notification" },
                contentAlignment = Alignment.Center,
            ) {
                Text(text = "×", color = PokrColors.CreamMuted, fontSize = 18.sp)
            }
        }
    }
}

/**
 * Forwards a one-shot screen message (e.g. `state.lastError`) to [ToastBus], then calls
 * [onConsumed] so the caller can clear it.
 */
@Composable
fun ToastOnMessage(
    message: String?,
    kind: ToastKind = ToastKind.Error,
    onConsumed: () -> Unit,
) {
    val consume by rememberUpdatedState(onConsumed)
    LaunchedEffect(message) {
        if (message.isNullOrBlank()) return@LaunchedEffect
        ToastBus.push(kind, message)
        consume()
    }
}
