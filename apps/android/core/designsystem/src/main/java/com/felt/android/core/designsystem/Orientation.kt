package com.felt.android.core.designsystem

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.content.pm.ActivityInfo
import android.content.res.Configuration
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext

private fun Context.findActivity(): Activity? {
    var ctx = this
    while (ctx is ContextWrapper) {
        if (ctx is Activity) return ctx
        ctx = ctx.baseContext
    }
    return null
}

/**
 * Lock the host activity to portrait (ignores system auto-rotate).
 * Use on lobby so entry stays upright.
 */
@Composable
fun LockPortraitOrientation() {
    val context = LocalContext.current
    DisposableEffect(Unit) {
        val activity = context.findActivity()
        val previous = activity?.requestedOrientation
        activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
        onDispose {
            activity?.requestedOrientation =
                previous ?: ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        }
    }
}

/**
 * Allow sensor / user rotation (table screens).
 * Restores the previous orientation policy on leave.
 */
@Composable
fun UnlockSensorOrientation() {
    val context = LocalContext.current
    DisposableEffect(Unit) {
        val activity = context.findActivity()
        val previous = activity?.requestedOrientation
        activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_FULL_USER
        onDispose {
            activity?.requestedOrientation =
                previous ?: ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        }
    }
}

/**
 * Short landscape phone — matches web `useIsLandscapePhone`
 * (`orientation: landscape` and max-height ~500dp).
 */
@Composable
fun rememberIsLandscapePhone(): Boolean {
    val config = LocalConfiguration.current
    return remember(config.orientation, config.screenHeightDp, config.screenWidthDp) {
        config.orientation == Configuration.ORIENTATION_LANDSCAPE &&
            config.screenHeightDp <= 500
    }
}
