package com.felt.android.core.designsystem

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

data class WinLineUi(
    val seat: Int,
    val name: String,
    val amount: Int,
    val handName: String? = null,
    val cards: List<String> = emptyList(),
    val isSelf: Boolean = false,
)

@Composable
fun WinHandDialog(
    winners: List<WinLineUi>,
    youWon: Boolean,
    canStartNext: Boolean,
    onNextHand: () -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val primaryType = winners.firstOrNull()?.handName
        ?.takeIf { it.isNotBlank() && it != "Uncontested" }
        ?: if (winners.size > 1) "Split pot" else "Won the pot"

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(FeltColors.Ink.copy(alpha = 0.78f)),
        contentAlignment = Alignment.Center,
    ) {
        HudPanel(modifier = Modifier.padding(20.dp).fillMaxWidth(0.92f)) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    text = "HAND COMPLETE",
                    color = FeltColors.Gold.copy(alpha = 0.7f),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 2.sp,
                    modifier = Modifier.fillMaxWidth(),
                    textAlign = TextAlign.Center,
                )
                Text(
                    text = if (youWon) "You won" else "Winner",
                    color = FeltColors.Gold,
                    fontSize = 28.sp,
                    fontWeight = FontWeight.ExtraBold,
                    modifier = Modifier.fillMaxWidth(),
                    textAlign = TextAlign.Center,
                )
                Text(
                    text = primaryType,
                    color = FeltColors.Gold,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier
                        .align(Alignment.CenterHorizontally)
                        .clip(RoundedCornerShape(999.dp))
                        .border(1.dp, FeltColors.Gold.copy(alpha = 0.4f), RoundedCornerShape(999.dp))
                        .background(FeltColors.Ink.copy(alpha = 0.55f))
                        .padding(horizontal = 12.dp, vertical = 6.dp),
                )

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 340.dp)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    winners.forEach { w ->
                        val type = w.handName?.takeIf { it.isNotBlank() && it != "Uncontested" }
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(
                                    if (w.isSelf) FeltColors.Gold.copy(alpha = 0.16f)
                                    else FeltColors.Ink.copy(alpha = 0.5f),
                                )
                                .border(
                                    1.dp,
                                    if (w.isSelf) FeltColors.Gold.copy(alpha = 0.45f)
                                    else FeltColors.Cream.copy(alpha = 0.1f),
                                    RoundedCornerShape(12.dp),
                                )
                                .padding(12.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                            ) {
                                Text(
                                    text = if (w.isSelf) "${w.name} · you" else w.name,
                                    color = if (w.isSelf) FeltColors.Gold else FeltColors.Cream,
                                    fontWeight = FontWeight.Bold,
                                )
                                Text(
                                    text = "+${formatChips(w.amount)}",
                                    color = FeltColors.Neon,
                                    fontWeight = FontWeight.Bold,
                                )
                            }
                            if (type != null) {
                                Text(
                                    text = type.uppercase(),
                                    color = FeltColors.Gold.copy(alpha = 0.9f),
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    letterSpacing = 1.sp,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(top = 6.dp),
                                )
                            }
                            if (w.cards.isNotEmpty()) {
                                Row(
                                    horizontalArrangement = Arrangement.spacedBy(5.dp),
                                    modifier = Modifier.padding(top = 10.dp),
                                ) {
                                    w.cards.forEachIndexed { index, code ->
                                        PlayingCard(
                                            code = code,
                                            highlight = true,
                                            width = 40.dp,
                                            height = 56.dp,
                                            dealDelayMs = index * 60,
                                        )
                                    }
                                }
                            } else {
                                Text(
                                    text = "Won without showdown",
                                    color = FeltColors.Cream.copy(alpha = 0.4f),
                                    fontSize = 11.sp,
                                    modifier = Modifier.padding(top = 8.dp),
                                )
                            }
                        }
                    }
                }

                if (canStartNext) {
                    FeltPrimaryButton(
                        text = "Next Hand",
                        onClick = onNextHand,
                        modifier = Modifier.fillMaxWidth(),
                    )
                } else {
                    Text(
                        text = "Waiting for the next hand…",
                        color = FeltColors.Cream.copy(alpha = 0.45f),
                        fontSize = 12.sp,
                        modifier = Modifier.fillMaxWidth(),
                        textAlign = TextAlign.Center,
                    )
                }
                FeltGhostButton(
                    text = "Close",
                    onClick = onDismiss,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }
}
