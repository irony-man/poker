package com.pokr.android.core.designsystem

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.widthIn
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** Full POKR wordmark — web `pokr-logo.png`. */
@Composable
fun PokrLogo(
    modifier: Modifier = Modifier,
    height: Dp = 36.dp,
) {
    Image(
        painter = painterResource(R.drawable.pokr_logo),
        contentDescription = "POKR",
        modifier = modifier
            .height(height)
            .widthIn(max = 180.dp),
        contentScale = ContentScale.Fit,
    )
}

/** Compact purple mark — web `purple-logo.png` (table chrome / card backs). */
@Composable
fun PurpleLogo(
    modifier: Modifier = Modifier,
    height: Dp = 22.dp,
) {
    Image(
        painter = painterResource(R.drawable.purple_logo),
        contentDescription = "POKR",
        modifier = modifier
            .height(height)
            .widthIn(max = 120.dp),
        contentScale = ContentScale.Fit,
    )
}

@Composable
fun PokerChipShuffle(
    modifier: Modifier = Modifier,
    size: Dp = 48.dp,
) {
    Image(
        painter = painterResource(R.drawable.poker_chip_shuffle),
        contentDescription = null,
        modifier = modifier.height(size).widthIn(max = size),
        contentScale = ContentScale.Fit,
    )
}

/** Web `chips-stack.png` — bankroll mark. */
@Composable
fun ChipsStackIcon(
    modifier: Modifier = Modifier,
    height: Dp = 22.dp,
) {
    Image(
        painter = painterResource(R.drawable.chips_stack),
        contentDescription = null,
        modifier = modifier
            .height(height)
            .widthIn(max = height * 1.6f),
        contentScale = ContentScale.Fit,
    )
}

/** Web `currency.svg` — Whuffie mark. */
@Composable
fun WhuffieIcon(
    modifier: Modifier = Modifier,
    height: Dp = 16.dp,
) {
    Image(
        painter = painterResource(R.drawable.currency_whuffie),
        contentDescription = null,
        modifier = modifier
            .height(height)
            .widthIn(max = height * 1.2f),
        contentScale = ContentScale.Fit,
    )
}
