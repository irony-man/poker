package com.felt.android.core.designsystem

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

private val FeltDarkColorScheme = darkColorScheme(
    primary = FeltColors.Gold,
    onPrimary = FeltColors.Ink,
    secondary = FeltColors.Cyan,
    onSecondary = FeltColors.Ink,
    tertiary = FeltColors.Neon,
    onTertiary = FeltColors.Ink,
    background = FeltColors.Ink,
    onBackground = FeltColors.Cream,
    surface = FeltColors.InkPanel,
    onSurface = FeltColors.Cream,
    surfaceVariant = FeltColors.InkRaised,
    onSurfaceVariant = FeltColors.Cream.copy(alpha = 0.7f),
    outline = FeltColors.Gold.copy(alpha = 0.35f),
    error = FeltColors.Danger,
    onError = Color.White,
)

@Composable
fun FeltTheme(
    content: @Composable () -> Unit,
) {
    val colorScheme = FeltDarkColorScheme
    MaterialTheme(
        colorScheme = colorScheme,
        typography = MaterialTheme.typography.copy(
            headlineLarge = TextStyle(
                fontFamily = FontFamily.SansSerif,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 36.sp,
                letterSpacing = 2.sp,
                color = FeltColors.Gold,
            ),
            titleLarge = TextStyle(
                fontFamily = FontFamily.SansSerif,
                fontWeight = FontWeight.Bold,
                fontSize = 20.sp,
                letterSpacing = 1.sp,
            ),
            bodyLarge = TextStyle(
                fontFamily = FontFamily.SansSerif,
                fontSize = 16.sp,
                color = FeltColors.Cream,
            ),
            labelSmall = TextStyle(
                fontFamily = FontFamily.SansSerif,
                fontWeight = FontWeight.SemiBold,
                fontSize = 11.sp,
                letterSpacing = 1.sp,
            ),
        ),
        content = content,
    )
}
