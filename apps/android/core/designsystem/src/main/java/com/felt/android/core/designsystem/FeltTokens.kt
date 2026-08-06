package com.felt.android.core.designsystem

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp

/**
 * Canonical design tokens — "Card Room".
 *
 * These hex values mirror the CSS vars in `apps/web/app/globals.css` exactly.
 * Change them in both places or not at all. See `docs/DESIGN_SYSTEM.md`.
 */
object FeltColors {
    // Surfaces
    val Ink = Color(0xFF12100E)
    val InkPanel = Color(0xFF1C1916)
    val InkRaised = Color(0xFF262119)
    val InkOverlay = Color(0xFF0A0908)

    // Table
    val FeltGreen = Color(0xFF1E5B43)
    val FeltGreenDark = Color(0xFF123A2B)
    val FeltRim = Color(0xFF3A2A1C)
    val FeltRimEdge = Color(0xFF8A6B3A)

    // Accent
    val Brass = Color(0xFFC9A227)
    val BrassLight = Color(0xFFE8CE83)
    val BrassDim = Color(0xFF7A6218)

    // Text
    val Cream = Color(0xFFF2EDE4)
    val CreamMuted = Color(0xFFA8A197)

    // State
    val Danger = Color(0xFFC0392B)
    val Positive = Color(0xFF3E9E6A)
    val Patina = Color(0xFF6E9C86)
    val PatinaDim = Color(0xFF3F5B50)

    // Cards
    val CardFace = Color(0xFFFAF7F0)
    val CardRed = Color(0xFFC8102E)
    val CardInk = Color(0xFF1A1A1A)

    /** Stack bar on a seat — deep wine, not the old fire engine red. */
    val StackRed = Color(0xFF8C2F27)

    // —— Legacy aliases, kept so existing call sites keep compiling ——
    val Gold = Brass
    val GoldDim = BrassDim
    val Cyan = Patina
    val Neon = Positive
    val YouYellow = BrassLight
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
