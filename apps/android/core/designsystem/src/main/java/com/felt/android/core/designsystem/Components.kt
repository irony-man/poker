package com.felt.android.core.designsystem

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

fun formatChips(n: Int): String = when {
    n >= 1_000_000 -> "${n / 1_000_000}M"
    n >= 10_000 -> "${n / 1_000}K"
    n >= 1_000 -> n.toString().reversed().chunked(3).joinToString(",").reversed()
    else -> n.toString()
}

fun formatMoney(n: Int): String = formatChips(n.coerceAtLeast(0))

@Composable
fun HudPanel(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(FeltRadius.Lg))
            .background(
                Brush.verticalGradient(
                    listOf(FeltColors.InkPanel, FeltColors.InkRaised),
                ),
            )
            .border(1.dp, FeltColors.Brass.copy(alpha = 0.18f), RoundedCornerShape(FeltRadius.Lg))
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
        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 10.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = FeltColors.Brass,
            contentColor = FeltColors.Ink,
            disabledContainerColor = FeltColors.Brass.copy(alpha = 0.35f),
            disabledContentColor = FeltColors.Ink.copy(alpha = 0.5f),
        ),
        shape = RoundedCornerShape(FeltRadius.Md),
    ) {
        Text(
            text = text,
            fontFamily = FeltFonts.Display,
            fontWeight = FontWeight.Bold,
            maxLines = 1,
        )
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
        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 10.dp),
        colors = ButtonDefaults.outlinedButtonColors(
            contentColor = FeltColors.Cream,
            disabledContentColor = FeltColors.Cream.copy(alpha = 0.35f),
        ),
        border = ButtonDefaults.outlinedButtonBorder.copy(
            brush = Brush.linearGradient(
                listOf(
                    FeltColors.Brass.copy(alpha = 0.45f),
                    FeltColors.Brass.copy(alpha = 0.2f),
                ),
            ),
        ),
        shape = RoundedCornerShape(FeltRadius.Md),
    ) {
        Text(
            text = text,
            fontFamily = FeltFonts.Display,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
        )
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
    val bg = if (selected) FeltColors.Brass.copy(alpha = 0.2f) else FeltColors.Ink.copy(alpha = 0.45f)
    val border = if (selected) FeltColors.Brass else FeltColors.Cream.copy(alpha = 0.15f)
    val fg = if (selected) FeltColors.BrassLight else FeltColors.Cream.copy(alpha = 0.8f)
    Text(
        text = text,
        modifier = modifier
            .clip(RoundedCornerShape(FeltRadius.Md))
            .background(bg)
            .border(1.dp, border, RoundedCornerShape(FeltRadius.Md))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        color = fg,
        fontFamily = FeltFonts.Display,
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
                    listOf(FeltColors.BrassLight, FeltColors.Brass, FeltColors.BrassDim),
                ),
            )
            .border(2.dp, FeltColors.Cream.copy(alpha = 0.3f), CircleShape)
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
        color = FeltColors.CreamMuted,
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
            .clip(RoundedCornerShape(28))
            .background(
                Brush.radialGradient(
                    listOf(FeltColors.FeltGreen, FeltColors.FeltGreenDark, Color(0xFF0C2A1F)),
                ),
            )
            .border(8.dp, FeltColors.FeltRim, RoundedCornerShape(28))
            .padding(6.dp),
    ) {
        // Thin brass edge where the rim meets the felt.
        Box(
            modifier = Modifier
                .matchParentSize()
                .clip(RoundedCornerShape(24))
                .border(1.dp, FeltColors.FeltRimEdge.copy(alpha = 0.55f), RoundedCornerShape(24)),
        )
        content()
    }
}

@Composable
fun PotDisplay(
    amount: Int,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        CasinoChip(amount = amount.coerceAtLeast(1), size = ChipSize.Sm)
        Text(
            text = formatMoney(amount),
            color = FeltColors.Cream,
            fontSize = 32.sp,
            fontFamily = FeltFonts.Serif,
        )
    }
}

@Composable
fun DealerPotZone(
    amount: Int,
    dealerName: String? = null,
    showDealer: Boolean = false,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        if (showDealer) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                Text(
                    text = "D",
                    color = FeltColors.Ink,
                    fontFamily = FeltFonts.Display,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Black,
                    modifier = Modifier
                        .clip(RoundedCornerShape(999.dp))
                        .background(FeltColors.Cream)
                        .border(2.dp, FeltColors.Brass.copy(alpha = 0.8f), RoundedCornerShape(999.dp))
                        .padding(horizontal = 8.dp, vertical = 4.dp),
                )
                if (!dealerName.isNullOrBlank()) {
                    Text(
                        text = dealerName.take(12),
                        color = FeltColors.Cream.copy(alpha = 0.75f),
                        fontSize = 9.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }
        PotDisplay(amount = amount)
    }
}
