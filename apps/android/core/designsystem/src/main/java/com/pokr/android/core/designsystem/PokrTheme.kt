package com.pokr.android.core.designsystem

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.key
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

/**
 * Material bridge for Compose. Primary is brand purple (sidebar), not brass —
 * brass stays a rare accent for money / live state.
 */
@Composable
fun PokrTheme(
    uiTheme: PokrUiTheme = PokrUiTheme.Classic,
    content: @Composable () -> Unit,
) {
    val palette = if (uiTheme == PokrUiTheme.Arcade) PokrPalette.Arcade else PokrPalette.Classic
    PokrColors.active = palette
    val colorScheme = darkColorScheme(
        primary = palette.sidebar,
        onPrimary = palette.mushroom,
        secondary = PokrColors.Patina,
        onSecondary = palette.ink,
        tertiary = PokrColors.Positive,
        onTertiary = palette.ink,
        background = palette.mushroom,
        onBackground = palette.inkStrong,
        surface = PokrColors.White,
        onSurface = palette.inkStrong,
        surfaceVariant = palette.inkRaised,
        onSurfaceVariant = palette.inkStrongMuted,
        outline = palette.sidebar.copy(alpha = 0.22f),
        error = PokrColors.Danger,
        onError = Color.White,
    )
    val typography = androidx.compose.material3.Typography().let { base ->
        base.copy(
            headlineLarge = TextStyle(
                fontFamily = PokrFonts.Display,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 36.sp,
                letterSpacing = (-0.5).sp,
                color = palette.inkStrong,
            ),
            titleLarge = TextStyle(
                fontFamily = PokrFonts.Display,
                fontWeight = FontWeight.Bold,
                fontSize = 20.sp,
                letterSpacing = 0.2.sp,
                color = palette.inkStrong,
            ),
            bodyLarge = TextStyle(
                fontFamily = PokrFonts.Body,
                fontSize = 16.sp,
                color = palette.inkStrong,
            ),
            bodySmall = TextStyle(
                fontFamily = PokrFonts.Body,
                fontSize = 13.sp,
                color = palette.inkStrongMuted,
            ),
            labelSmall = TextStyle(
                fontFamily = PokrFonts.Display,
                fontWeight = FontWeight.SemiBold,
                fontSize = 11.sp,
                letterSpacing = 1.6.sp,
            ),
        )
    }
    CompositionLocalProvider(
        LocalPokrUiTheme provides uiTheme,
        LocalPokrPalette provides palette,
    ) {
        key(uiTheme) {
            MaterialTheme(
                colorScheme = colorScheme,
                typography = typography,
                content = content,
            )
        }
    }
}
