package com.pokr.android.core.designsystem

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
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
    chrome: PokrChrome = PokrChrome.Play,
    content: @Composable () -> Unit,
) {
    val arcade = LocalPokrUiTheme.current == PokrUiTheme.Arcade
    val shape = RoundedCornerShape(if (arcade) PokrRadius.Xl else PokrRadius.Lg)
    val fill = when (chrome) {
        PokrChrome.Lobby -> PokrColors.White
        PokrChrome.Play -> PokrColors.InkPanel.copy(alpha = 0.95f)
    }
    if (arcade) {
        Box(
            modifier = modifier
                .arcadeOffsetShadow(shape)
                .background(fill, shape)
                .border(3.dp, Color.Black, shape)
                .padding(18.dp),
        ) {
            content()
        }
        return
    }
    val panelMod = when (chrome) {
        PokrChrome.Lobby -> Modifier
            .shadow(14.dp, shape, ambientColor = PokrColors.Sidebar.copy(alpha = 0.08f), spotColor = PokrColors.Sidebar.copy(alpha = 0.08f))
            .clip(shape)
            .background(PokrColors.White)
            .border(1.dp, PokrColors.Sidebar.copy(alpha = 0.12f), shape)
        PokrChrome.Play -> Modifier
            .clip(shape)
            .background(PokrColors.InkPanel.copy(alpha = 0.95f))
            .border(1.dp, PokrColors.Mushroom.copy(alpha = 0.15f), shape)
    }
    Box(
        modifier = modifier.then(panelMod).padding(18.dp),
    ) {
        content()
    }
}

@Composable
fun PokrPrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    val arcade = LocalPokrUiTheme.current == PokrUiTheme.Arcade
    val shape = RoundedCornerShape(if (arcade) 16.dp else PokrRadius.Md)
    if (arcade) {
        Box(
            modifier = modifier
                .arcadeOffsetShadow(shape)
                .background(
                    if (enabled) PokrColors.Mushroom else PokrColors.Mushroom.copy(alpha = 0.45f),
                    shape,
                )
                .border(3.dp, Color.Black, shape)
                .clickable(enabled = enabled, onClick = onClick)
                .padding(horizontal = 14.dp, vertical = 12.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = text.uppercase(),
                color = PokrColors.InkStrong.copy(alpha = if (enabled) 1f else 0.45f),
                fontFamily = PokrFonts.Display,
                fontWeight = FontWeight.Bold,
                fontSize = 13.sp,
                letterSpacing = 0.8.sp,
                maxLines = 1,
            )
        }
        return
    }
    Box(
        modifier = modifier
            .shadow(
                elevation = if (enabled) 8.dp else 0.dp,
                shape = shape,
                ambientColor = PokrColors.Sidebar.copy(alpha = 0.22f),
                spotColor = PokrColors.Sidebar.copy(alpha = 0.22f),
            )
            .clip(shape)
            .background(
                if (enabled) PokrColors.PrimaryGradient
                else Brush.verticalGradient(
                    listOf(
                        PokrColors.FeltMid.copy(alpha = 0.4f),
                        PokrColors.Sidebar.copy(alpha = 0.4f),
                    ),
                ),
            )
            .border(1.dp, PokrColors.Mushroom.copy(alpha = if (enabled) 0.2f else 0.08f), shape)
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 12.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = text.uppercase(),
            color = PokrColors.Mushroom.copy(alpha = if (enabled) 1f else 0.5f),
            fontFamily = PokrFonts.Display,
            fontWeight = FontWeight.Bold,
            fontSize = 13.sp,
            letterSpacing = 0.8.sp,
            maxLines = 1,
        )
    }
}

@Composable
fun PokrGhostButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    chrome: PokrChrome = PokrChrome.Lobby,
) {
    val arcade = LocalPokrUiTheme.current == PokrUiTheme.Arcade
    val shape = RoundedCornerShape(if (arcade) 16.dp else PokrRadius.Md)
    val (bg, border, fg) = when {
        arcade -> Triple(
            PokrColors.White,
            Color.Black,
            PokrColors.InkStrong.copy(alpha = if (enabled) 1f else 0.4f),
        )
        chrome == PokrChrome.Lobby -> Triple(
            PokrColors.Mushroom.copy(alpha = 0.65f),
            PokrColors.Sidebar.copy(alpha = 0.22f),
            PokrColors.InkStrong.copy(alpha = if (enabled) 1f else 0.4f),
        )
        else -> Triple(
            Color.Transparent,
            PokrColors.Mushroom.copy(alpha = 0.28f),
            PokrColors.Mushroom.copy(alpha = if (enabled) 0.92f else 0.35f),
        )
    }
    Box(
        modifier = modifier
            .then(if (arcade) Modifier.arcadeOffsetShadow(shape, offset = 3.dp) else Modifier)
            .clip(shape)
            .background(bg)
            .border(if (arcade) 3.dp else 1.dp, border, shape)
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = text,
            color = fg,
            fontFamily = PokrFonts.Display,
            fontWeight = FontWeight.SemiBold,
            fontSize = 13.sp,
            maxLines = 1,
        )
    }
}

/** Fold / destructive — web `.btn-danger`. */
@Composable
fun PokrDangerButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    val arcade = LocalPokrUiTheme.current == PokrUiTheme.Arcade
    val shape = RoundedCornerShape(if (arcade) 16.dp else PokrRadius.Md)
    Box(
        modifier = modifier
            .then(if (arcade) Modifier.arcadeOffsetShadow(shape, offset = 3.dp) else Modifier)
            .clip(shape)
            .background(PokrColors.Danger.copy(alpha = if (enabled) 0.12f else 0.05f))
            .border(
                if (arcade) 3.dp else 1.dp,
                if (arcade) Color.Black else PokrColors.Danger.copy(alpha = if (enabled) 0.35f else 0.15f),
                shape,
            )
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = text,
            color = PokrColors.Danger.copy(alpha = if (enabled) 1f else 0.4f),
            fontFamily = PokrFonts.Display,
            fontWeight = FontWeight.Bold,
            fontSize = 13.sp,
            maxLines = 1,
        )
    }
}

/** Soft white control — web `.btn-soft` (hands map list toggle). */
@Composable
fun PokrSoftButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    val arcade = LocalPokrUiTheme.current == PokrUiTheme.Arcade
    val shape = RoundedCornerShape(if (arcade) 16.dp else 12.dp)
    Box(
        modifier = modifier
            .then(if (arcade) Modifier.arcadeOffsetShadow(shape, offset = 3.dp) else Modifier)
            .clip(shape)
            .background(PokrColors.White)
            .border(
                if (arcade) 3.dp else 1.dp,
                if (arcade) Color.Black else PokrColors.Sidebar.copy(alpha = 0.2f),
                shape,
            )
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = text,
            color = PokrColors.Sidebar.copy(alpha = if (enabled) 1f else 0.4f),
            fontFamily = PokrFonts.Display,
            fontWeight = FontWeight.SemiBold,
            fontSize = 13.sp,
            maxLines = 1,
        )
    }
}

@Composable
fun PokrChoiceChip(
    text: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    chrome: PokrChrome = PokrChrome.Lobby,
) {
    val arcade = LocalPokrUiTheme.current == PokrUiTheme.Arcade
    val shape = RoundedCornerShape(PokrRadius.Md)
    Text(
        text = text,
        modifier = modifier
            .pokrChoiceChipSurface(selected = selected, shape = shape, arcade = arcade, chrome = chrome)
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        color = pokrChoiceForeground(selected = selected, arcade = arcade, chrome = chrome),
        fontFamily = PokrFonts.Display,
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
            .background(PokrColors.Sidebar)
            .border(2.dp, PokrColors.Brass.copy(alpha = 0.85f), CircleShape)
            .padding(dim / 4),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = formatChips(amount),
            color = PokrColors.BrassLight,
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
fun PokrLabel(
    text: String,
    chrome: PokrChrome = PokrChrome.Lobby,
) {
    Text(
        text = text.uppercase(),
        style = MaterialTheme.typography.labelSmall,
        color = when (chrome) {
            PokrChrome.Lobby -> PokrColors.InkStrongMuted
            PokrChrome.Play -> PokrColors.CreamMuted
        },
        letterSpacing = 1.6.sp,
    )
}

@Composable
fun StatusChip(
    text: String,
    accent: Color = PokrColors.Sidebar,
    modifier: Modifier = Modifier,
    chrome: PokrChrome = PokrChrome.Lobby,
) {
    val (bg, border, fg) = when (chrome) {
        PokrChrome.Lobby -> Triple(
            PokrColors.Sidebar.copy(alpha = 0.06f),
            PokrColors.Sidebar.copy(alpha = 0.18f),
            PokrColors.Sidebar,
        )
        PokrChrome.Play -> Triple(
            accent.copy(alpha = 0.12f),
            accent.copy(alpha = 0.35f),
            accent,
        )
    }
    Text(
        text = text,
        modifier = modifier
            .clip(RoundedCornerShape(999.dp))
            .background(bg)
            .border(1.dp, border, RoundedCornerShape(999.dp))
            .padding(horizontal = 10.dp, vertical = 4.dp),
        color = fg,
        style = MaterialTheme.typography.labelSmall,
        fontWeight = FontWeight.SemiBold,
    )
}

@Composable
fun PokrTableSurface(
    modifier: Modifier = Modifier,
    tableColorId: Int = 0,
    content: @Composable () -> Unit,
) {
    val theme = tableColorPreset(tableColorId)
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(28))
            .background(
                Brush.radialGradient(
                    listOf(theme.feltMid, theme.felt, theme.feltEdge),
                ),
            )
            .border(8.dp, theme.feltRim, RoundedCornerShape(28))
            .padding(6.dp),
    ) {
        Box(
            modifier = Modifier
                .matchParentSize()
                .clip(RoundedCornerShape(24))
                .border(1.dp, theme.feltRimEdge.copy(alpha = 0.55f), RoundedCornerShape(24)),
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
            color = PokrColors.Cream,
            fontSize = 32.sp,
            fontFamily = PokrFonts.Display,
            fontWeight = FontWeight.Bold,
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
                    color = PokrColors.Ink,
                    fontFamily = PokrFonts.Display,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Black,
                    modifier = Modifier
                        .clip(RoundedCornerShape(999.dp))
                        .background(PokrColors.Mushroom)
                        .border(2.dp, PokrColors.Brass.copy(alpha = 0.8f), RoundedCornerShape(999.dp))
                        .padding(horizontal = 8.dp, vertical = 4.dp),
                )
                if (!dealerName.isNullOrBlank()) {
                    Text(
                        text = dealerName.take(12),
                        color = PokrColors.Cream.copy(alpha = 0.75f),
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
