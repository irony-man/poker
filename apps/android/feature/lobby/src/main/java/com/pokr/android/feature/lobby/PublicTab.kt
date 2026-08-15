package com.pokr.android.feature.lobby

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pokr.android.core.designsystem.PokrChrome
import com.pokr.android.core.designsystem.PokrColors
import com.pokr.android.core.designsystem.PokrFonts
import com.pokr.android.core.designsystem.PokrPrimaryButton
import com.pokr.android.core.designsystem.PokrRadius
import com.pokr.android.core.designsystem.PokerChipShuffle
import com.pokr.android.core.designsystem.StatusChip
import com.pokr.android.core.model.STAKE_PRESETS

@Composable
fun PublicTab(
    onJoined: (tableId: String, invite: String, spectate: Boolean) -> Unit,
    viewModel: PublicTablesViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val byStake = state.tables.associateBy { it.stakeId }

    LobbyScrollColumn {
        LobbyPageHeader(
            title = "Public tables",
            subtitle = "Open Hold'em at the stakes you choose; sit down when a seat is free or spectate if you would rather watch.",
        )
        LobbySplitCard(imageRes = LobbyIllustrations.publicTables, imageAlt = "Open public ring games") {
            FieldHelp("Select the table size and sit down to play")
            state.error?.let { err ->
                StatusChip(text = err, accent = PokrColors.Danger, chrome = PokrChrome.Play)
            }
            if (state.loading && state.tables.isEmpty()) {
                PokerChipShuffle(size = 40.dp)
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    STAKE_PRESETS.chunked(2).forEach { row ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                        ) {
                            row.forEach { stake ->
                                val table = byStake[stake.id]
                                val seated = table?.seatedCount ?: 0
                                val max = table?.maxSeats ?: 6
                                val full = table != null && seated >= max
                                val canJoin = table != null && !full
                                val joining = state.joiningStakeId == stake.id
                                Column(
                                    modifier = Modifier
                                        .weight(1f)
                                        .clip(RoundedCornerShape(PokrRadius.Md))
                                        .background(PokrColors.White)
                                        .border(
                                            1.dp,
                                            PokrColors.Sidebar.copy(alpha = 0.12f),
                                            RoundedCornerShape(PokrRadius.Md),
                                        )
                                        .padding(12.dp),
                                    verticalArrangement = Arrangement.spacedBy(8.dp),
                                ) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.Top,
                                    ) {
                                        Column {
                                            Text(
                                                text = stake.label.uppercase(),
                                                color = PokrColors.Sidebar,
                                                fontFamily = PokrFonts.Display,
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 16.sp,
                                                letterSpacing = 0.8.sp,
                                            )
                                            Text(
                                                text = "Blinds ${stake.smallBlind}/${stake.bigBlind}",
                                                color = PokrColors.InkStrongMuted,
                                                fontSize = 12.sp,
                                            )
                                        }
                                        Text(
                                            text = if (state.loading) "…" else "$seated/$max",
                                            color = PokrColors.InkStrongMuted,
                                            fontFamily = PokrFonts.Display,
                                            fontSize = 10.sp,
                                        )
                                    }
                                    Text(
                                        text = "Buy-in ${stake.buyIn}",
                                        color = PokrColors.InkStrongMuted,
                                        fontSize = 13.sp,
                                    )
                                    PokrPrimaryButton(
                                        text = when {
                                            joining -> "Joining…"
                                            state.loading -> "Loading…"
                                            full -> "Full"
                                            table == null -> "Unavailable"
                                            else -> "Sit down"
                                        },
                                        onClick = {
                                            viewModel.sitDown(stake.id) { id, invite ->
                                                onJoined(id, invite, false)
                                            }
                                        },
                                        enabled = canJoin && !joining,
                                        modifier = Modifier.fillMaxWidth(),
                                    )
                                }
                            }
                            if (row.size == 1) {
                                androidx.compose.foundation.layout.Spacer(Modifier.weight(1f))
                            }
                        }
                    }
                }
            }
        }
    }
}
