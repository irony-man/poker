package com.felt.android.core.designsystem

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp

/**
 * Canonical design tokens — POKR play room (mirrors web globals.css).
 *
 * These hex values mirror the CSS vars in `apps/web/app/globals.css` exactly.
 * Change them in both places or not at all. See `docs/DESIGN_SYSTEM.md`.
 */
object FeltColors {
    // Surfaces (deep brand purple)
    val Ink = Color(0xFF0E0618)
    val InkPanel = Color(0xFF1D0432)
    val InkRaised = Color(0xFF2E1048)
    val InkOverlay = Color(0xFF08030E)

    // Table
    val FeltGreen = Color(0xFF226048)
    val FeltGreenDark = Color(0xFF12342A)
    val FeltRim = Color(0xFF1D0432)
    val FeltRimEdge = Color(0xFFC4A8BA)

    // Accent
    val Brass = Color(0xFFD6BA80)
    val BrassLight = Color(0xFFECDAB0)
    val BrassDim = Color(0xFF765C30)

    // Text
    val Cream = Color(0xFFF2EAE8)
    val CreamMuted = Color(0xFFA896A6)

    // State
    val Danger = Color(0xFFC0392B)
    val Positive = Color(0xFF48A87A)
    val Patina = Color(0xFFBAA2C6)
    val PatinaDim = Color(0xFF583E70)

    // Cards
    val CardFace = Color(0xFFFAF7F0)
    val CardRed = Color(0xFFC8102E)
    val CardInk = Color(0xFF1A1A1A)

    /** Stack bar on a seat — brand purple. */
    val StackRed = Color(0xFF1D0432)

    // —— Legacy aliases, kept so existing call sites keep compiling ——
    val Gold = Brass
    val GoldDim = BrassDim
    val Cyan = Patina
    val Neon = Positive
    val YouYellow = BrassLight
    val Sidebar = InkPanel
    val Mushroom = Color(0xFFE6D9D7)
}

/**
 * Type roles. Instrument Serif / Inter on web; Android uses the system serif and
 * sans as stand-ins until the font resources are bundled under `res/font`.
 * Swapping them is a one-line change here.
 */
object FeltFonts {
    /** UI headings, buttons, labels. */
    val Display: FontFamily = FontFamily.SansSerif

    /** Body copy and all numerics. */
    val Body: FontFamily = FontFamily.SansSerif

    /** Marquee moments only: the wordmark and the pot. */
    val Serif: FontFamily = FontFamily.Serif
}

/** Corner radii, matching `--radius-*` on web. */
object FeltRadius {
    val Xs = 4.dp
    val Sm = 6.dp
    val Md = 10.dp
    val Lg = 14.dp
    val Xl = 20.dp
}
