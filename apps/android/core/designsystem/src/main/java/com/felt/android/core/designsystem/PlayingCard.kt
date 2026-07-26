package com.felt.android.core.designsystem

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val CardFace = Color(0xFFF7F2E8)
private val CardBack = Color(0xFF1A3050)

data class ParsedCard(
    val rank: String,
    val suit: String,
    val isRed: Boolean,
)

fun parseCardCode(code: String): ParsedCard? {
    if (code.length < 2) return null
    val rankChar = code[0].uppercaseChar()
    val suitChar = code[1].lowercaseChar()
    val rank = when (rankChar) {
        'T' -> "10"
        'A', 'K', 'Q', 'J', '2', '3', '4', '5', '6', '7', '8', '9' -> rankChar.toString()
        else -> return null
    }
    val suit = when (suitChar) {
        's' -> "♠"
        'h' -> "♥"
        'd' -> "♦"
        'c' -> "♣"
        else -> return null
    }
    val isRed = suitChar == 'h' || suitChar == 'd'
    return ParsedCard(rank, suit, isRed)
}

@Composable
fun PlayingCard(
    code: String?,
    modifier: Modifier = Modifier,
    faceDown: Boolean = false,
    highlight: Boolean = false,
    dimmed: Boolean = false,
    width: Dp = 46.dp,
    height: Dp = 66.dp,
) {
    val shape = RoundedCornerShape(6.dp)
    val alpha = if (dimmed && !highlight) 0.4f else 1f
    Box(
        modifier = modifier
            .width(width)
            .height(height)
            .shadow(if (highlight) 10.dp else 4.dp, shape)
            .clip(shape)
            .then(
                if (highlight) Modifier.border(2.dp, FeltColors.Gold, shape)
                else Modifier.border(1.dp, Color.Black.copy(alpha = 0.2f), shape),
            )
            .background(if (faceDown || code == null) CardBack else CardFace),
        contentAlignment = Alignment.Center,
    ) {
        Box(modifier = Modifier.fillMaxSize().padding(1.dp), contentAlignment = Alignment.Center) {
            if (faceDown || code == null) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(4.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(
                            Brush.linearGradient(
                                listOf(
                                    FeltColors.Cyan.copy(alpha = 0.35f),
                                    FeltColors.Gold.copy(alpha = 0.25f),
                                    FeltColors.InkRaised,
                                ),
                            ),
                        )
                        .border(1.dp, FeltColors.Gold.copy(alpha = 0.4f), RoundedCornerShape(4.dp)),
                )
            } else {
                val parsed = parseCardCode(code)
                if (parsed == null) {
                    Text(
                        text = code,
                        color = FeltColors.Ink.copy(alpha = alpha),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                    )
                } else {
                    val ink = (if (parsed.isRed) Color(0xFFC62828) else Color(0xFF121212)).copy(alpha = alpha)
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(horizontal = 4.dp, vertical = 3.dp),
                        horizontalAlignment = Alignment.Start,
                    ) {
                        Text(
                            text = parsed.rank,
                            color = ink,
                            fontSize = if (parsed.rank == "10") 12.sp else 14.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.SansSerif,
                            lineHeight = 14.sp,
                        )
                        Text(
                            text = parsed.suit,
                            color = ink,
                            fontSize = 14.sp,
                            lineHeight = 14.sp,
                        )
                        Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.Center) {
                            Text(
                                text = parsed.suit,
                                color = ink.copy(alpha = 0.9f * alpha),
                                fontSize = 22.sp,
                            )
                        }
                    }
                }
            }
        }
                        if (highlight) {
            Box(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            listOf(Color.Transparent, FeltColors.Gold.copy(alpha = 0.28f)),
                        ),
                    ),
            )
        }
    }
}
