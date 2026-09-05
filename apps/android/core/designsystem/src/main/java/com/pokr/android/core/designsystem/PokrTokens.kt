package com.pokr.android.core.designsystem

import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp

/** App chrome look. Independent of table felt color. */
enum class PokrUiTheme {
    Classic,
    Arcade,
    Glass,
    ;

    fun toApi(): String = when (this) {
        Arcade -> "v2"
        Glass -> "v3"
        Classic -> "v1"
    }

    companion object {
        fun fromApi(value: String?): PokrUiTheme = when (value) {
            "v2" -> Arcade
            "v3" -> Glass
            else -> Classic
        }
    }
}

/**
 * Surface tokens that follow Classic vs Arcade vs Glass.
 * Status / brass / card faces stay on [PokrColors] as invariants.
 */
@Immutable
data class PokrPalette(
    val ink: Color,
    val inkPanel: Color,
    val inkRaised: Color,
    val inkOverlay: Color,
    val inkStrong: Color,
    val inkStrongMuted: Color,
    val mushroom: Color,
    val sidebar: Color,
    val lobbyPanel: Color,
    val feltGreen: Color,
    val feltGreenDark: Color,
    val feltMid: Color,
    val feltEdge: Color,
    val feltRim: Color,
    val feltRimEdge: Color,
    val cream: Color,
    val creamMuted: Color,
    val stackRed: Color,
    /** Text/icons on purple sidebar chrome. */
    val onChrome: Color,
) {
    companion object {
        val Classic = PokrPalette(
            ink = Color(0xFF0E0618),
            inkPanel = Color(0xFF1D0432),
            inkRaised = Color(0xFF2E1048),
            inkOverlay = Color(0xFF08030E),
            inkStrong = Color(0xFF1D0432),
            inkStrongMuted = Color(0xFF4A3650),
            mushroom = Color(0xFFE6D9D7),
            sidebar = Color(0xFF1D0432),
            lobbyPanel = Color(0xFFFFFFFF),
            feltGreen = Color(0xFF1D0432),
            feltGreenDark = Color(0xFF120220),
            feltMid = Color(0xFF341252),
            feltEdge = Color(0xFF0A0414),
            feltRim = Color(0xFF120220),
            feltRimEdge = Color(0xFFA88CA2),
            cream = Color(0xFFF2EAE8),
            creamMuted = Color(0xFFBCAABA),
            stackRed = Color(0xFF1D0432),
            onChrome = Color(0xFFE6D9D7),
        )

        /** Matches web `html[data-ui-theme='v2']` token remap. */
        val Arcade = PokrPalette(
            ink = Color(0xFF1A0A2E),
            inkPanel = Color(0xFF4C1D95),
            inkRaised = Color(0xFF6D28D9),
            inkOverlay = Color(0xFF120620),
            inkStrong = Color(0xFF1A1028),
            inkStrongMuted = Color(0xFF483060),
            mushroom = Color(0xFFFDE93D),
            sidebar = Color(0xFF5B21B6),
            lobbyPanel = Color(0xFFFFFFFF),
            feltGreen = Color(0xFF4C1D95),
            feltGreenDark = Color(0xFF2E1065),
            feltMid = Color(0xFF6D28D9),
            feltEdge = Color(0xFF1A0A2E),
            feltRim = Color(0xFF1A0A2E),
            feltRimEdge = Color(0xFF000000),
            cream = Color(0xFFFFFFFF),
            creamMuted = Color(0xFFD6C4E8),
            stackRed = Color(0xFF5B21B6),
            onChrome = Color(0xFFFFFFFF),
        )

        /** Matches web `html[data-ui-theme='v3']` dusk-aurora token remap. */
        val Glass = PokrPalette(
            ink = Color(0xFF0A0616),
            inkPanel = Color(0xFF1C1238),
            inkRaised = Color(0xFF342460),
            inkOverlay = Color(0xFF060410),
            inkStrong = Color(0xFF160C28),
            inkStrongMuted = Color(0xFF58486E),
            mushroom = Color(0xFF2A1848),
            sidebar = Color(0xFF6040A8),
            lobbyPanel = Color(0xFFFFFFFF),
            feltGreen = Color(0xFF1C1238),
            feltGreenDark = Color(0xFF120C20),
            feltMid = Color(0xFF342460),
            feltEdge = Color(0xFF060410),
            feltRim = Color(0xFF120C20),
            feltRimEdge = Color(0xFFC4B8D6),
            cream = Color(0xFFFFFFFF),
            creamMuted = Color(0xFFC4B8D6),
            stackRed = Color(0xFF6040A8),
            onChrome = Color(0xFFFFFFFF),
        )
    }
}

val LocalPokrUiTheme = staticCompositionLocalOf { PokrUiTheme.Classic }
val LocalPokrPalette = staticCompositionLocalOf { PokrPalette.Classic }

/**
 * Canonical design tokens — POKR purple / mushroom (mirrors web globals.css).
 *
 * Surface getters read the active palette (set by [PokrTheme]) so Classic/Arcade/Glass
 * restyle existing screens. Not @Composable — DrawScope / Canvas cannot call
 * composable getters; [PokrTheme] keys the tree so reads stay in sync.
 * Status, brass, and card faces stay constant. See `docs/DESIGN_SYSTEM.md`.
 */
object PokrColors {
    @Volatile
    internal var active: PokrPalette = PokrPalette.Classic

    val Ink get() = active.ink
    val InkPanel get() = active.inkPanel
    val InkRaised get() = active.inkRaised
    val InkOverlay get() = active.inkOverlay
    val InkStrong get() = active.inkStrong
    val InkStrongMuted get() = active.inkStrongMuted
    val Mushroom get() = active.mushroom
    val Sidebar get() = active.sidebar
    val LobbyPanel get() = active.lobbyPanel
    val White = Color(0xFFFFFFFF)

    val FeltGreen get() = active.feltGreen
    val FeltGreenDark get() = active.feltGreenDark
    val FeltMid get() = active.feltMid
    val FeltEdge get() = active.feltEdge
    val FeltRim get() = active.feltRim
    val FeltRimEdge get() = active.feltRimEdge

    val Brass = Color(0xFFD6BA80)
    val BrassLight = Color(0xFFECDAB0)
    val BrassDim = Color(0xFF765C30)

    val Cream get() = active.cream
    val CreamMuted get() = active.creamMuted
    val OnChrome get() = active.onChrome

    val Danger = Color(0xFFC0392B)
    val Positive = Color(0xFF48A87A)
    val Patina = Color(0xFFBAA2C6)
    val PatinaDim = Color(0xFF583E70)

    val CardFace = Color(0xFFFAF7F0)
    val CardRed = Color(0xFFE53935)
    val CardInk = Color(0xFF1A1A1A)

    val StackRed get() = active.stackRed

    val Gold get() = Brass
    val GoldDim get() = BrassDim
    val Cyan get() = Patina
    val Neon get() = Positive
    val YouYellow get() = BrassLight

    val PrimaryGradient: Brush
        get() = Brush.verticalGradient(listOf(FeltMid, Sidebar))
}

/** Ludo seat colors (0 red, 1 green, 2 yellow, 3 blue). */
object LudoSeatColors {
    val Red = Color(0xFFC0392B)
    val Green = Color(0xFF2E8B57)
    val Yellow = Color(0xFFE0B43A)
    val Blue = Color(0xFF2F6FBF)

    fun of(seat: Int): Color = when (seat) {
        0 -> Red
        1 -> Green
        2 -> Yellow
        else -> Blue
    }

    fun label(seat: Int): String = when (seat) {
        0 -> "Red"
        1 -> "Green"
        2 -> "Yellow"
        else -> "Blue"
    }
}

/**
 * Chrome context: light lobby pages vs dark play HUD.
 * Matches web `.lobby-shell` vs default `.hud-*` / play chrome.
 */
enum class PokrChrome {
    Lobby,
    Play,
}

/**
 * Type roles. Web uses RF Tone (Classic) / Clash Display (Arcade) and Inter for body.
 * Android uses system stand-ins until families are bundled under `res/font`.
 */
object PokrFonts {
    val Display: FontFamily = FontFamily.SansSerif
    val Body: FontFamily = FontFamily.SansSerif
    val Serif: FontFamily = FontFamily.Serif
}

/** Corner radii, matching `--radius-*` on web. */
object PokrRadius {
    val Xs = 4.dp
    val Sm = 6.dp
    val Md = 10.dp
    val Lg = 14.dp
    val Xl = 20.dp
}
