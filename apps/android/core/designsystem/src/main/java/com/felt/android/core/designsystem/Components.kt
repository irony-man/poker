package com.felt.android.core.designsystem

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

object FeltColors {
    val Gold = Color(0xFFE0B43A)
    val GoldDim = Color(0xFFB8942A)
    val Cyan = Color(0xFF3DE0FF)
    val Neon = Color(0xFF2AFF9A)
    val Ink = Color(0xFF07090D)
    val InkPanel = Color(0xFF12161E)
    val InkRaised = Color(0xFF1A2030)
    val Cream = Color(0xFFF5F0E6)
    val FeltGreen = Color(0xFF0D4A32)
    val FeltGreenDark = Color(0xFF083024)
    val Danger = Color(0xFFE05555)
}

fun formatChips(n: Int): String = when {
    n >= 1_000_000 -> "${n / 1_000_000}M"
    n >= 1_000 -> "${n / 1_000}K"
    else -> n.toString()
}

@Composable
fun HudPanel(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(16.dp))
            .background(
                Brush.verticalGradient(
                    listOf(FeltColors.InkPanel, FeltColors.InkRaised),
                ),
            )
            .border(1.dp, FeltColors.Gold.copy(alpha = 0.25f), RoundedCornerShape(16.dp))
            .padding(18.dp),
    ) {
        content()
    }
}

@Composable
fun FeltPrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    Button(
        onClick = onClick,
        modifier = modifier,
        enabled = enabled,
        colors = ButtonDefaults.buttonColors(
            containerColor = FeltColors.Gold,
            contentColor = FeltColors.Ink,
            disabledContainerColor = FeltColors.Gold.copy(alpha = 0.35f),
            disabledContentColor = FeltColors.Ink.copy(alpha = 0.5f),
        ),
        shape = RoundedCornerShape(12.dp),
    ) {
        Text(text = text, fontWeight = FontWeight.Bold)
    }
}

@Composable
fun FeltGhostButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    OutlinedButton(
        onClick = onClick,
        modifier = modifier,
        enabled = enabled,
        colors = ButtonDefaults.outlinedButtonColors(
            contentColor = FeltColors.Cream,
            disabledContentColor = FeltColors.Cream.copy(alpha = 0.35f),
        ),
        border = ButtonDefaults.outlinedButtonBorder.copy(
            brush = Brush.linearGradient(listOf(FeltColors.Cyan.copy(alpha = 0.5f), FeltColors.Gold.copy(alpha = 0.3f))),
        ),
        shape = RoundedCornerShape(12.dp),
    ) {
        Text(text = text, fontWeight = FontWeight.SemiBold, maxLines = 1)
    }
}

/** Compact selectable chip for seat/bot counts — avoids full-width OutlinedButton crowding. */
@Composable
fun FeltChoiceChip(
    text: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val bg = if (selected) FeltColors.Gold.copy(alpha = 0.22f) else FeltColors.Ink.copy(alpha = 0.45f)
    val border = if (selected) FeltColors.Gold else FeltColors.Cream.copy(alpha = 0.2f)
    val fg = if (selected) FeltColors.Gold else FeltColors.Cream.copy(alpha = 0.8f)
    Text(
        text = text,
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .background(bg)
            .border(1.dp, border, RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        color = fg,
        fontSize = 13.sp,
        fontWeight = if (selected) FontWeight.Bold else FontWeight.SemiBold,
        maxLines = 1,
    )
}

@Composable
fun CasinoChip(
    amount: Int,
    modifier: Modifier = Modifier,
    size: ChipSize = ChipSize.Md,
) {
    val dim = when (size) {
        ChipSize.Sm -> 28.dp
        ChipSize.Md -> 36.dp
        ChipSize.Lg -> 48.dp
    }
    val fontSize = when (size) {
        ChipSize.Sm -> 10.sp
        ChipSize.Md -> 12.sp
        ChipSize.Lg -> 14.sp
    }
    Box(
        modifier = modifier
            .clip(CircleShape)
            .background(
                Brush.radialGradient(
                    listOf(FeltColors.Gold, FeltColors.GoldDim, FeltColors.InkRaised),
                ),
            )
            .border(2.dp, FeltColors.Cream.copy(alpha = 0.35f), CircleShape)
            .padding(dim / 4),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = formatChips(amount),
            color = FeltColors.Ink,
            fontSize = fontSize,
            fontWeight = FontWeight.Bold,
        )
    }
}

enum class ChipSize {
    Sm,
    Md,
    Lg,
}

@Composable
fun FeltLabel(text: String) {
    Text(
        text = text.uppercase(),
        style = MaterialTheme.typography.labelSmall,
        color = FeltColors.Cream.copy(alpha = 0.55f),
        letterSpacing = 2.sp,
    )
}

@Composable
fun StatusChip(
    text: String,
    accent: Color,
    modifier: Modifier = Modifier,
) {
    Text(
        text = text,
        modifier = modifier
            .clip(RoundedCornerShape(999.dp))
            .background(accent.copy(alpha = 0.12f))
            .border(1.dp, accent.copy(alpha = 0.35f), RoundedCornerShape(999.dp))
            .padding(horizontal = 10.dp, vertical = 4.dp),
        color = accent,
        style = MaterialTheme.typography.labelSmall,
        fontWeight = FontWeight.SemiBold,
    )
}

@Composable
fun FeltTableSurface(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(50))
            .background(
                Brush.radialGradient(
                    listOf(FeltColors.FeltGreen, FeltColors.FeltGreenDark, FeltColors.Ink),
                ),
            )
            .border(12.dp, FeltColors.GoldDim.copy(alpha = 0.45f), RoundedCornerShape(50))
            .padding(8.dp),
    ) {
        Box(
            modifier = Modifier
                .matchParentSize()
                .clip(RoundedCornerShape(50))
                .border(1.dp, FeltColors.Neon.copy(alpha = 0.12f), RoundedCornerShape(50)),
        )
        content()
    }
}

@Composable
fun PotDisplay(
    amount: Int,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(16.dp))
            .background(FeltColors.Ink.copy(alpha = 0.75f))
            .border(1.dp, FeltColors.Gold.copy(alpha = 0.35f), RoundedCornerShape(16.dp))
            .padding(horizontal = 20.dp, vertical = 10.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = "POT",
            style = MaterialTheme.typography.labelSmall,
            color = FeltColors.Gold.copy(alpha = 0.75f),
            letterSpacing = 3.sp,
        )
        CasinoChip(amount = amount, size = ChipSize.Lg)
    }
}
