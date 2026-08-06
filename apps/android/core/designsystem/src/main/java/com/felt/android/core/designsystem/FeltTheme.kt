package com.felt.android.core.designsystem

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

private val FeltDarkColorScheme = darkColorScheme(
    primary = FeltColors.Brass,
    onPrimary = FeltColors.Ink,
    secondary = FeltColors.Patina,
    onSecondary = FeltColors.Ink,
    tertiary = FeltColors.Positive,
    onTertiary = FeltColors.Ink,
    background = FeltColors.Ink,
    onBackground = FeltColors.Cream,
    surface = FeltColors.InkPanel,
    onSurface = FeltColors.Cream,
    surfaceVariant = FeltColors.InkRaised,
    onSurfaceVariant = FeltColors.CreamMuted,
    outline = FeltColors.Brass.copy(alpha = 0.3f),
    error = FeltColors.Danger,
    onError = Color.White,
)

/**
 * Type ramp mirroring the web scale. `headlineLarge` is the marquee serif
 * (wordmark, pot); everything else is the UI sans.
 */
private val FeltTypography = androidx.compose.material3.Typography().let { base ->
    base.copy(
        headlineLarge = TextStyle(
            fontFamily = FeltFonts.Serif,
            fontSize = 36.sp,
            letterSpacing = 1.sp,
            color = FeltColors.BrassLight,
        ),
        titleLarge = TextStyle(
            fontFamily = FeltFonts.Display,
            fontWeight = FontWeight.Bold,
            fontSize = 20.sp,
            letterSpacing = 0.5.sp,
        ),
        bodyLarge = TextStyle(
            fontFamily = FeltFonts.Body,
            fontSize = 16.sp,
            color = FeltColors.Cream,
        ),
        bodySmall = TextStyle(
            fontFamily = FeltFonts.Body,
            fontSize = 13.sp,
            color = FeltColors.CreamMuted,
        ),
        labelSmall = TextStyle(
            fontFamily = FeltFonts.Display,
            fontWeight = FontWeight.SemiBold,
            fontSize = 11.sp,
            letterSpacing = 1.sp,
        ),
    )
}

@Composable
fun FeltTheme(
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = FeltDarkColorScheme,
        typography = FeltTypography,
        content = content,
    )
}
