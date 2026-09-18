package com.pokr.android.feature.lobby

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pokr.android.core.designsystem.HudPanel
import com.pokr.android.core.designsystem.LockPortraitOrientation
import com.pokr.android.core.designsystem.PlayerAvatar
import com.pokr.android.core.designsystem.PlayingCard
import com.pokr.android.core.designsystem.PokerChipShuffle
import com.pokr.android.core.designsystem.PokrChrome
import com.pokr.android.core.designsystem.PokrColors
import com.pokr.android.core.designsystem.PokrFonts
import com.pokr.android.core.designsystem.PokrGhostButton
import com.pokr.android.core.designsystem.PokrPrimaryButton
import com.pokr.android.core.designsystem.formatChips
import com.pokr.android.core.designsystem.pokrPageGround
import com.pokr.android.core.model.formatHandWhen

@Composable
fun PublicProfileScreen(
    onBack: () -> Unit,
    onOpenSelf: () -> Unit,
    onOpenTable: (tableId: String, invite: String) -> Unit,
    modifier: Modifier = Modifier,
    viewModel: PublicProfileViewModel = hiltViewModel(),
) {
    LockPortraitOrientation()
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(state.self, state.profile) {
        if (state.self && state.profile != null) onOpenSelf()
    }
    LaunchedEffect(state.openedTable) {
        val opened = state.openedTable ?: return@LaunchedEffect
        onOpenTable(opened.first, opened.second)
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .pokrPageGround()
            .statusBarsPadding()
            .navigationBarsPadding()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        PokrGhostButton(text = "← Back", onClick = onBack)
        if (state.loading && state.profile == null) {
            PokerChipShuffle(size = 48.dp)
            return
        }
        state.error?.let { FieldHelp(it) }
        val profile = state.profile
        if (profile != null) {
            HudPanel(modifier = Modifier.fillMaxWidth(), chrome = PokrChrome.Lobby) {
                Column(
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    PlayerAvatar(
                        avatarId = profile.avatarId,
                        avatarUrl = profile.avatarUrl,
                        userId = profile.id,
                        size = 72.dp,
                    )
                    Text(
                        profile.name,
                        color = PokrColors.Sidebar,
                        fontFamily = PokrFonts.Display,
                        fontWeight = FontWeight.Bold,
                        fontSize = 22.sp,
                    )
                    if (profile.username.isNotBlank()) {
                        Text("@${profile.username}", color = PokrColors.InkStrongMuted, fontSize = 14.sp)
                    }
                    Text(
                        "${profile.handsPlayed} hands · ${profile.friendCount} friends · ${formatChips(profile.chipBalance)} chips",
                        color = PokrColors.InkStrongMuted,
                        fontSize = 13.sp,
                    )
                    when (profile.relationship) {
                        "friends" -> PokrPrimaryButton(
                            text = "Challenge",
                            onClick = { viewModel.challenge() },
                            modifier = Modifier.fillMaxWidth(),
                        )
                        "outgoing" -> FieldHelp("Friend request sent")
                        "incoming" -> Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            PokrPrimaryButton(
                                text = "Accept",
                                onClick = { viewModel.respondIncoming(true) },
                                enabled = !state.busy,
                                modifier = Modifier.weight(1f),
                            )
                            PokrGhostButton(
                                text = "Decline",
                                onClick = { viewModel.respondIncoming(false) },
                                enabled = !state.busy,
                                modifier = Modifier.weight(1f),
                            )
                        }
                        else -> PokrPrimaryButton(
                            text = if (state.busy) "…" else "Add friend",
                            onClick = { viewModel.addFriend() },
                            enabled = !state.busy,
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                }
            }
            if (state.hands.isNotEmpty()) {
                Text(
                    "Hands together",
                    color = PokrColors.Sidebar,
                    fontFamily = PokrFonts.Display,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                )
                state.hands.take(12).forEach { hand ->
                    HudPanel(modifier = Modifier.fillMaxWidth(), chrome = PokrChrome.Lobby) {
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text(
                                formatHandWhen(hand.startedAt).ifBlank { hand.handId },
                                color = PokrColors.InkStrongMuted,
                                fontSize = 12.sp,
                            )
                            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                hand.holeCards?.let { (a, b) ->
                                    PlayingCard(code = a, width = 32.dp, height = 46.dp, animateDeal = false)
                                    PlayingCard(code = b, width = 32.dp, height = 46.dp, animateDeal = false)
                                }
                                hand.community.take(5).forEach { code ->
                                    PlayingCard(code = code, width = 28.dp, height = 40.dp, animateDeal = false)
                                }
                            }
                            Text(
                                buildString {
                                    if (hand.won) append("Won") else append("Lost")
                                    hand.handName?.let { append(" · $it") }
                                },
                                color = if (hand.won) PokrColors.Positive else PokrColors.InkStrong,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 13.sp,
                            )
                        }
                    }
                }
            }
        }
    }
}
