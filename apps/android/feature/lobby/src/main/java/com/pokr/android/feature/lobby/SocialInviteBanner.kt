package com.pokr.android.feature.lobby

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pokr.android.core.designsystem.PlayerAvatar
import com.pokr.android.core.designsystem.PokrColors
import com.pokr.android.core.designsystem.PokrFonts
import com.pokr.android.core.designsystem.PokrGhostButton
import com.pokr.android.core.designsystem.PokrPrimaryButton
import com.pokr.android.core.model.PendingChallenge

@Composable
fun SocialInviteBanner(
    onOpenTable: (tableId: String, invite: String) -> Unit,
    onOpenContest: (contestId: String) -> Unit,
    onOpenFriends: () -> Unit,
    compact: Boolean = false,
    modifier: Modifier = Modifier,
    viewModel: SocialInviteViewModel = hiltViewModel(),
) {
    val snap by viewModel.uiState.collectAsStateWithLifecycle()
    val actions by viewModel.actionState.collectAsStateWithLifecycle()
    val challenge = snap.challenge
    val request = snap.request
    if (challenge == null && request == null) return

    val busy = actions.busyKey
    val pad = if (compact) 8.dp else 12.dp
    val gap = if (compact) 6.dp else 8.dp

    Column(
        modifier = modifier
            .statusBarsPadding()
            .padding(horizontal = 12.dp, vertical = 8.dp)
            .widthIn(max = 340.dp),
        verticalArrangement = Arrangement.spacedBy(gap),
        horizontalAlignment = Alignment.End,
    ) {
        if (challenge != null) {
            InviteCard(
                title = challengeTitle(challenge),
                subtitle = challengeSubtitle(challenge),
                avatarId = challenge.challenger.avatarId,
                avatarUrl = challenge.challenger.avatarUrl,
                userId = challenge.challenger.userId,
                primaryLabel = "Join",
                busy = busy == "join-${challenge.id}" || busy == "decline-${challenge.id}",
                compact = compact,
                pad = pad,
                onPrimary = {
                    viewModel.joinChallenge(challenge, onOpenTable, onOpenContest)
                },
                onSecondary = { viewModel.declineChallenge(challenge.id) },
            )
        }
        if (request != null) {
            InviteCard(
                title = "Friend request",
                subtitle = "${request.from.name} wants to add you",
                avatarId = request.from.avatarId,
                avatarUrl = request.from.avatarUrl,
                userId = request.from.userId,
                primaryLabel = "Accept",
                busy = busy == request.id,
                compact = compact,
                pad = pad,
                onPrimary = { viewModel.respond(request.id, true) },
                onSecondary = { viewModel.respond(request.id, false) },
            )
        }
        if (snap.extraCount > 0) {
            Text(
                text = "+${snap.extraCount} more on Friends",
                color = PokrColors.Sidebar,
                fontFamily = PokrFonts.Display,
                fontWeight = FontWeight.Bold,
                fontSize = 11.sp,
                modifier = Modifier
                    .clip(RoundedCornerShape(12.dp))
                    .background(PokrColors.White.copy(alpha = 0.97f))
                    .border(1.dp, PokrColors.Sidebar.copy(alpha = 0.15f), RoundedCornerShape(12.dp))
                    .clickable {
                        viewModel.requestOpenFriends()
                        onOpenFriends()
                    }
                    .padding(horizontal = 12.dp, vertical = 8.dp),
            )
        }
        actions.error?.let { err ->
            Text(
                text = err,
                color = PokrColors.Danger,
                fontSize = 11.sp,
                fontWeight = FontWeight.Medium,
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(PokrColors.Danger.copy(alpha = 0.12f))
                    .padding(horizontal = 10.dp, vertical = 6.dp),
            )
        }
    }
}

@Composable
private fun InviteCard(
    title: String,
    subtitle: String,
    avatarId: Int,
    avatarUrl: String?,
    userId: String,
    primaryLabel: String,
    busy: Boolean,
    compact: Boolean,
    pad: androidx.compose.ui.unit.Dp,
    onPrimary: () -> Unit,
    onSecondary: () -> Unit,
) {
    val shape = RoundedCornerShape(14.dp)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .shadow(10.dp, shape, ambientColor = PokrColors.Sidebar.copy(alpha = 0.22f))
            .clip(shape)
            .background(PokrColors.White.copy(alpha = 0.97f))
            .border(1.dp, PokrColors.Sidebar.copy(alpha = 0.16f), shape)
            .padding(pad),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.Top,
    ) {
        PlayerAvatar(
            avatarId = avatarId,
            avatarUrl = avatarUrl,
            userId = userId,
            size = if (compact) 32.dp else 36.dp,
        )
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                text = title.uppercase(),
                color = PokrColors.Sidebar.copy(alpha = 0.7f),
                fontFamily = PokrFonts.Display,
                fontWeight = FontWeight.Bold,
                fontSize = 10.sp,
                letterSpacing = 0.8.sp,
            )
            Text(
                text = subtitle,
                color = PokrColors.InkStrong,
                fontWeight = FontWeight.SemiBold,
                fontSize = if (compact) 12.sp else 13.sp,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                PokrPrimaryButton(
                    text = if (busy) "…" else primaryLabel,
                    onClick = onPrimary,
                    enabled = !busy,
                    modifier = Modifier.weight(1f),
                )
                PokrGhostButton(
                    text = "Decline",
                    onClick = onSecondary,
                    enabled = !busy,
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

private fun challengeTitle(c: PendingChallenge): String {
    val group = c.groupName?.takeIf { it.isNotBlank() }
    return when {
        group != null -> group
        c.kind == "contest" || !c.contestId.isNullOrBlank() -> "Contest invite"
        else -> "Table invite"
    }
}

private fun challengeSubtitle(c: PendingChallenge): String =
    if (c.kind == "contest" || !c.contestId.isNullOrBlank()) {
        "${c.challenger.name} invited you to a contest"
    } else {
        "${c.challenger.name} wants to play"
    }
