package com.felt.android.core.designsystem

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

/** Bold flat face — matches web PlayingCard rank-over-suit layout. */
private val CardFace = Color(0xFFFFFFFF)
private val SuitRed = Color(0xFFE31C23)
private val SuitBlack = Color(0xFF111111)

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
    /** Stagger for one-shot deal-in; remount (via key) to replay. */
    dealDelayMs: Int = 0,
    animateDeal: Boolean = true,
) {
    val shape = RoundedCornerShape(8.dp)
    val faceAlpha = if (dimmed && !highlight) 0.4f else 1f

    val progress = remember { Animatable(if (animateDeal) 0f else 1f) }
    LaunchedEffect(Unit) {
        if (!animateDeal) {
            progress.snapTo(1f)
            return@LaunchedEffect
        }
        if (dealDelayMs > 0) delay(dealDelayMs.toLong())
        progress.animateTo(
            1f,
            animationSpec = spring(
                dampingRatio = Spring.DampingRatioMediumBouncy,
                stiffness = Spring.StiffnessMediumLow,
            ),
        )
    }

    val t = progress.value
    val dealOffsetY = if (faceDown || code == null) 0f else (1f - t) * -36f
    val dealRotZ = if (faceDown || code == null) 0f else (1f - t) * -8f
    val dealRotY = if (faceDown || code == null) (1f - t) * 88f else 0f
    val dealScale = if (faceDown || code == null) 0.9f + 0.1f * t else 1f

    Box(
        modifier = modifier
            .width(width)
            .height(height)
            .graphicsLayer {
                this.alpha = t.coerceIn(0f, 1f)
                translationY = dealOffsetY
                rotationZ = dealRotZ
                rotationY = dealRotY
                scaleX = dealScale
                scaleY = dealScale
                cameraDistance = 16f * density
            }
            .shadow(if (highlight) 10.dp else 5.dp, shape)
            .clip(shape)
            .then(
                if (highlight) Modifier.border(2.dp, FeltColors.Brass, shape)
                else Modifier.border(1.5.dp, Color.Black, shape),
            )
            .background(
                if (faceDown || code == null) {
                    Brush.linearGradient(
                        listOf(Color(0xFF2A1F12), Color(0xFF0F0C08)),
                    )
                } else {
                    CardFace
                },
            ),
        contentAlignment = Alignment.Center,
    ) {
        if (faceDown || code == null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(3.dp)
                    .clip(RoundedCornerShape(5.dp))
                    .border(1.dp, FeltColors.Brass.copy(alpha = 0.45f), RoundedCornerShape(5.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = "F",
                    color = FeltColors.BrassLight.copy(alpha = 0.9f),
                    fontSize = 14.sp,
                    fontFamily = FeltFonts.Serif,
                )
            }
        } else {
            val parsed = parseCardCode(code)
            if (parsed == null) {
                Text(
                    text = code,
                    color = FeltColors.Ink.copy(alpha = faceAlpha),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                )
            } else {
                val ink = (if (parsed.isRed) SuitRed else SuitBlack).copy(alpha = faceAlpha)
                val isTen = parsed.rank == "10"
                val rankSp = (height.value * if (isTen) 0.36f else 0.42f).sp
                val suitSp = (height.value * 0.36f).sp

                Column(modifier = Modifier.fillMaxSize()) {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth(),
                        contentAlignment = Alignment.BottomCenter,
                    ) {
                        Text(
                            text = parsed.rank,
                            color = ink,
                            fontSize = rankSp,
                            fontWeight = FontWeight.Black,
                            fontFamily = FontFamily.SansSerif,
                            lineHeight = rankSp,
                            letterSpacing = if (isTen) (-1).sp else 0.sp,
                        )
                    }
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth(),
                        contentAlignment = Alignment.TopCenter,
                    ) {
                        Text(
                            text = parsed.suit,
                            color = ink,
                            fontSize = suitSp,
                            lineHeight = suitSp,
                        )
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
                            listOf(Color.Transparent, FeltColors.Brass.copy(alpha = 0.28f)),
                        ),
                    ),
            )
        }
    }
}
