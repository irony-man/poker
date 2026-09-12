package com.pokr.android.feature.memory

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pokr.android.core.designsystem.PokrColors
import com.pokr.android.core.designsystem.PokrFonts
import com.pokr.android.core.model.MemoryCardView
import kotlin.math.sqrt

private val PAIR_GLYPHS = listOf(
    "♠", "♥", "♦", "♣", "★", "●", "▲", "■",
    "◆", "☀", "☾", "☁", "⚡", "♫", "✿", "❄",
    "◎", "▣",
)

@Composable
fun MemoryBoard(
    cards: List<MemoryCardView>,
    gridSize: Int,
    canFlip: Boolean,
    onFlip: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    val cols = sqrt(gridSize.toDouble()).toInt().coerceAtLeast(4)
    BoxWithConstraints(modifier = modifier.fillMaxWidth()) {
        LazyVerticalGrid(
            columns = GridCells.Fixed(cols),
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
            userScrollEnabled = false,
        ) {
            items(cards, key = { it.index }) { card ->
                MemoryCardTile(
                    card = card,
                    enabled = canFlip && !card.matched && !card.faceUp,
                    onClick = { onFlip(card.index) },
                )
            }
        }
    }
}

@Composable
private fun MemoryCardTile(
    card: MemoryCardView,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(10.dp)
    val revealed = card.matched || card.faceUp
    val glyph = card.pairId?.let { PAIR_GLYPHS.getOrElse(it % PAIR_GLYPHS.size) { "?" } } ?: "?"
    Box(
        modifier = Modifier
            .aspectRatio(1f)
            .clip(shape)
            .background(
                when {
                    card.matched -> PokrColors.Patina.copy(alpha = 0.35f)
                    revealed -> PokrColors.White
                    else -> PokrColors.Sidebar
                },
            )
            .border(
                1.5.dp,
                when {
                    card.matched -> PokrColors.Patina
                    revealed -> PokrColors.Sidebar.copy(alpha = 0.25f)
                    else -> PokrColors.OnChrome.copy(alpha = 0.2f)
                },
                shape,
            )
            .then(if (enabled) Modifier.clickable(onClick = onClick) else Modifier)
            .padding(4.dp),
        contentAlignment = Alignment.Center,
    ) {
        if (revealed) {
            Text(
                text = glyph,
                color = if (card.matched) PokrColors.Patina else PokrColors.Sidebar,
                fontFamily = PokrFonts.Display,
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp,
            )
        } else {
            Text(
                text = "?",
                color = PokrColors.OnChrome.copy(alpha = 0.55f),
                fontFamily = PokrFonts.Display,
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp,
            )
        }
    }
}
