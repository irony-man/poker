package com.felt.android.core.designsystem

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

data class WinLineUi(
    val seat: Int,
    val name: String,
    val amount: Int,
    val handName: String? = null,
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
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(FeltColors.Ink.copy(alpha = 0.75f)),
        contentAlignment = Alignment.Center,
    ) {
        HudPanel(modifier = Modifier.padding(24.dp).fillMaxWidth(0.9f)) {
            Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Text(
                    text = "HAND COMPLETE",
                    color = FeltColors.Gold.copy(alpha = 0.7f),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 2.sp,
                )
                Text(
                    text = if (youWon) "You won" else "Winner",
                    color = FeltColors.Gold,
                    fontSize = 26.sp,
                    fontWeight = FontWeight.ExtraBold,
                )
                winners.forEach { w ->
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(
                                if (w.isSelf) FeltColors.Gold.copy(alpha = 0.15f)
                                else FeltColors.Ink.copy(alpha = 0.45f),
                            )
                            .padding(12.dp),
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
                        if (!w.handName.isNullOrBlank() && w.handName != "Uncontested") {
                            Text(
                                text = w.handName,
                                color = FeltColors.Cream.copy(alpha = 0.55f),
                                fontSize = 13.sp,
                                modifier = Modifier.padding(top = 4.dp),
                            )
                        }
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (canStartNext) {
                        FeltPrimaryButton(
                            text = "Next hand",
                            onClick = onNextHand,
                            modifier = Modifier.weight(1f),
                        )
                    }
                    FeltGhostButton(
                        text = "Close",
                        onClick = onDismiss,
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }
    }
}
