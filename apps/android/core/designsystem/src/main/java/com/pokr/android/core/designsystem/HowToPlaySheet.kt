package com.pokr.android.core.designsystem

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog

private data class HowToTip(val title: String, val body: String)
private data class RankingCard(val code: String, val dimmed: Boolean = false)
private data class HandRanking(val name: String, val desc: String, val cards: List<RankingCard>)

private val TIPS = listOf(
    HowToTip(
        "Goal",
        "Make the best 5-card hand using your 2 hole cards and the community cards. Last non-folder or best showdown hand wins the pot.",
    ),
    HowToTip(
        "Hands & streets",
        "Each hand posts blinds, deals 2 cards, then runs preflop → flop (3 cards) → turn → river. Act when the timer and action buttons light up for your seat.",
    ),
    HowToTip(
        "Actions",
        "Fold gives up the hand. Check passes with no bet to call. Call matches the current bet. Bet / raise add money to the pot. All-in commits your stack.",
    ),
    HowToTip(
        "Table tools",
        "Between hands: Ready starts the next deal. Sit out skips hands; sit in when you want the next hand. Mid-hand you can request “Sit out next hand” and still finish this one. Chat sits in the toolbar. Broke stacks can Top up between hands from your bankroll.",
    ),
)

private val HAND_RANKINGS = listOf(
    HandRanking("Royal flush", "A, K, Q, J, 10, all of the same suit", listOf(
        RankingCard("As"), RankingCard("Ks"), RankingCard("Qs"), RankingCard("Js"), RankingCard("Ts"),
    )),
    HandRanking("Straight flush", "5 cards of the same suit in sequence", listOf(
        RankingCard("Th"), RankingCard("9h"), RankingCard("8h"), RankingCard("7h"), RankingCard("6h"),
    )),
    HandRanking("Four of a kind", "4 cards of equal value", listOf(
        RankingCard("Qh"), RankingCard("Qs"), RankingCard("Qd"), RankingCard("Qc"), RankingCard("5d", dimmed = true),
    )),
    HandRanking("Full house", "Three of a kind with a pair", listOf(
        RankingCard("Ad"), RankingCard("As"), RankingCard("Ah"), RankingCard("7c"), RankingCard("7d"),
    )),
    HandRanking("Flush", "Any 5 cards of the same suit", listOf(
        RankingCard("Ad"), RankingCard("Jd"), RankingCard("8d"), RankingCard("5d"), RankingCard("7d"),
    )),
    HandRanking("Straight", "5 cards in a sequence", listOf(
        RankingCard("Th"), RankingCard("9s"), RankingCard("8d"), RankingCard("7d"), RankingCard("6s"),
    )),
    HandRanking("Three of a kind", "3 cards of the same value", listOf(
        RankingCard("Qh"), RankingCard("Qs"), RankingCard("Qd"), RankingCard("7c", dimmed = true), RankingCard("6s", dimmed = true),
    )),
    HandRanking("Two pair", "2 different pairs", listOf(
        RankingCard("Jh"), RankingCard("Jc"), RankingCard("9d"), RankingCard("9c"), RankingCard("2d", dimmed = true),
    )),
    HandRanking("One pair", "2 cards of the same value", listOf(
        RankingCard("Qs"), RankingCard("Qh"), RankingCard("6d", dimmed = true), RankingCard("9c", dimmed = true), RankingCard("2d", dimmed = true),
    )),
    HandRanking("High card", "No pair — highest card plays", listOf(
        RankingCard("Ah"), RankingCard("Qs", dimmed = true), RankingCard("6s", dimmed = true), RankingCard("5d", dimmed = true), RankingCard("Ts", dimmed = true),
    )),
)

@Composable
fun HowToPlayHelp(modifier: Modifier = Modifier) {
    var open by remember { mutableStateOf(false) }
    PlayChromeIconButton(
        label = "?",
        contentDescription = "How to play",
        onClick = { open = true },
        modifier = modifier,
    )
    if (open) {
        HowToPlaySheet(onDismiss = { open = false })
    }
}

@Composable
private fun HowToPlaySheet(onDismiss: () -> Unit) {
    var tab by remember { mutableStateOf("rankings") }
    val shape = RoundedCornerShape(PokrRadius.Lg)
    Dialog(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .shadow(16.dp, shape)
                .clip(shape)
                .background(PokrColors.White)
                .border(1.dp, PokrColors.Sidebar.copy(alpha = 0.12f), shape),
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "HOW TO PLAY",
                    color = PokrColors.Sidebar,
                    fontFamily = PokrFonts.Display,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    letterSpacing = 0.8.sp,
                )
                Text(
                    text = "Close",
                    color = PokrColors.InkStrongMuted,
                    fontSize = 12.sp,
                    modifier = Modifier.clickable(onClick = onDismiss),
                )
            }
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                listOf("rankings" to "Hand rankings", "basics" to "Basics").forEach { (id, label) ->
                    val selected = tab == id
                    Text(
                        text = label.uppercase(),
                        color = if (selected) PokrColors.Mushroom else PokrColors.InkStrongMuted,
                        fontFamily = PokrFonts.Display,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 10.sp,
                        letterSpacing = 0.6.sp,
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(if (selected) PokrColors.Sidebar else Color.Transparent)
                            .clickable { tab = id }
                            .padding(horizontal = 10.dp, vertical = 6.dp),
                    )
                }
            }
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(420.dp)
                    .verticalScroll(rememberScrollState()),
            ) {
                if (tab == "basics") {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        TIPS.forEach { tip ->
                            Column {
                                Text(
                                    text = tip.title.uppercase(),
                                    color = PokrColors.Sidebar.copy(alpha = 0.7f),
                                    fontFamily = PokrFonts.Display,
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 11.sp,
                                    letterSpacing = 0.8.sp,
                                )
                                Text(
                                    text = tip.body,
                                    color = PokrColors.InkStrongMuted,
                                    fontSize = 12.sp,
                                    lineHeight = 16.sp,
                                    modifier = Modifier.padding(top = 2.dp),
                                )
                            }
                        }
                        Text(
                            text = "Texas Hold'em · highest hand wins · use your two cards + five community cards",
                            color = PokrColors.InkStrongMuted,
                            fontSize = 10.sp,
                            modifier = Modifier.padding(top = 8.dp),
                        )
                    }
                } else {
                    Text(
                        text = "Strongest at the top. Dimmed cards are kickers (not part of the core hand).",
                        color = PokrColors.InkStrongMuted,
                        fontSize = 11.sp,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
                    )
                    HAND_RANKINGS.forEachIndexed { index, hand ->
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(PokrColors.Mushroom.copy(alpha = 0.4f))
                                .padding(horizontal = 16.dp, vertical = 10.dp),
                        ) {
                            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                Box(
                                    modifier = Modifier
                                        .size(20.dp)
                                        .clip(CircleShape)
                                        .background(PokrColors.Sidebar),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    Text(
                                        text = "${index + 1}",
                                        color = PokrColors.Mushroom,
                                        fontFamily = PokrFonts.Display,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 9.sp,
                                    )
                                }
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = hand.name.uppercase(),
                                        color = PokrColors.Sidebar,
                                        fontFamily = PokrFonts.Display,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 11.sp,
                                        letterSpacing = 0.6.sp,
                                    )
                                    Text(
                                        text = hand.desc,
                                        color = PokrColors.InkStrongMuted,
                                        fontSize = 11.sp,
                                        modifier = Modifier.padding(top = 2.dp),
                                    )
                                    Row(
                                        modifier = Modifier.padding(top = 8.dp),
                                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                                    ) {
                                        hand.cards.forEach { card ->
                                            PlayingCard(
                                                code = card.code,
                                                dimmed = card.dimmed,
                                                width = 36.dp,
                                                height = 50.dp,
                                                animateDeal = false,
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                    Text(
                        text = "Texas Hold'em · best 5-card hand from 2 hole cards + board",
                        color = PokrColors.InkStrongMuted,
                        fontSize = 10.sp,
                        modifier = Modifier.padding(16.dp),
                    )
                }
            }
        }
    }
}
