package com.pokr.android.feature.lobby

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.pokr.android.core.designsystem.PokrChrome
import com.pokr.android.core.designsystem.PokrColors
import com.pokr.android.core.designsystem.PokrGhostButton
import com.pokr.android.core.designsystem.PokrPrimaryButton
import com.pokr.android.core.designsystem.HudPanel
import com.pokr.android.core.designsystem.LockPortraitOrientation
import com.pokr.android.core.designsystem.StatusChip

@Composable
fun ContestScreen(
    onBack: () -> Unit,
    onOpenTable: (tableId: String) -> Unit,
    modifier: Modifier = Modifier,
    viewModel: ContestViewModel = hiltViewModel(),
) {
    LockPortraitOrientation()
    val state by viewModel.uiState.collectAsState()
    val contest = state.contest
    val userId = state.userId

    LaunchedEffect(contest, userId) {
        val tableId = viewModel.assignedTableId()
        if (tableId != null && contest?.status == "running") {
            onOpenTable(tableId)
        }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(PokrColors.Mushroom)
            .statusBarsPadding()
            .navigationBarsPadding()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        PokrGhostButton(text = "← Lobby", onClick = onBack)

        if (contest == null) {
            Text(
                text = state.error ?: "Loading contest…",
                color = if (state.error != null) PokrColors.Danger else PokrColors.InkStrongMuted,
            )
            return@Column
        }

        StatusChip(
            text = "${if (contest.mode == "rounds") "Rounds" else "Knockout"} · ${contest.status}",
            chrome = PokrChrome.Lobby,
        )
        Text(
            text = contest.name,
            color = PokrColors.Sidebar,
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
        )
        Text(
            text = buildString {
                append("Code ${contest.inviteCode} · ${contest.entrants.size}/${contest.fieldSize} · stack ${contest.startingStack}")
                if (contest.mode == "rounds") {
                    val handLimit = contest.handLimit
                    if (handLimit != null) {
                        append(" · hand ${minOf(contest.handsPlayed, handLimit)}/$handLimit")
                    }
                }
            },
            color = PokrColors.InkStrongMuted,
            fontSize = 13.sp,
        )
        Text(
            text = if (contest.mode == "rounds") {
                "Fixed hands with top-ups. Chip leader wins when the session ends."
            } else {
                "Equal stacks, no top-ups. Last player standing wins."
            },
            color = PokrColors.InkStrongMuted.copy(alpha = 0.85f),
            fontSize = 12.sp,
        )

        val isHost = contest.hostUserId == userId
        val registered = contest.entrants.any { it.userId == userId }

        if (contest.status == "registering") {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                if (!registered) {
                    PokrPrimaryButton(
                        text = "Register",
                        onClick = viewModel::register,
                        enabled = !state.busy && userId != null,
                    )
                } else if (!isHost) {
                    PokrGhostButton(
                        text = "Unregister",
                        onClick = viewModel::unregister,
                        enabled = !state.busy,
                    )
                }
                if (isHost) {
                    PokrPrimaryButton(
                        text = "Start now",
                        onClick = viewModel::start,
                        enabled = !state.busy,
                    )
                }
            }
            if (isHost) {
                val exclude = (contest.entrants.map { it.userId } + contest.pendingInvites.map { it.userId }).toSet()
                FriendInvitePicker(
                    friends = state.friends,
                    groups = state.groups,
                    selectedIds = state.inviteFriendIds,
                    onChange = viewModel::onInviteFriendsChange,
                    excludeUserIds = exclude,
                    disabled = state.busy,
                    title = "Invite more friends",
                )
                if (state.inviteFriendIds.isNotEmpty()) {
                    PokrPrimaryButton(
                        text = "Send ${state.inviteFriendIds.size} invite${if (state.inviteFriendIds.size == 1) "" else "s"}",
                        onClick = viewModel::sendInvites,
                        enabled = !state.busy,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }
        }

        val assigned = contest.assignments.find { it.userId == userId }?.tableId
        if (assigned != null && contest.status == "running") {
            PokrPrimaryButton(
                text = "Go to table",
                onClick = { onOpenTable(assigned) },
                modifier = Modifier.fillMaxWidth(),
            )
        }

        val roundsHandLimit = contest.handLimit
        if (contest.status == "running" && contest.mode == "rounds" && roundsHandLimit != null) {
            HudPanel(modifier = Modifier.fillMaxWidth(), chrome = PokrChrome.Lobby) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("PROGRESS", color = PokrColors.InkStrongMuted, fontWeight = FontWeight.Bold)
                    Text(
                        "Hand ${minOf(contest.handsPlayed, roundsHandLimit)} of $roundsHandLimit",
                        color = PokrColors.InkStrong,
                        fontSize = 14.sp,
                    )
                }
            }
        }

        HudPanel(modifier = Modifier.fillMaxWidth(), chrome = PokrChrome.Lobby) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("ENTRANTS", color = PokrColors.InkStrongMuted, fontWeight = FontWeight.Bold)
                contest.entrants.forEach { e ->
                    val place = contest.placements.find { it.userId == e.userId }?.place
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = buildString {
                                append(e.name)
                                if (e.isBot == true) append(" · bot")
                                if (e.userId == contest.hostUserId) append(" · host")
                            },
                            color = PokrColors.InkStrong,
                            fontSize = 14.sp,
                        )
                        if (place != null) {
                            Text("#$place", color = PokrColors.Sidebar, fontSize = 13.sp)
                        }
                    }
                }
                contest.pendingInvites.forEach { inv ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = inv.name,
                            color = PokrColors.InkStrongMuted,
                            fontSize = 14.sp,
                        )
                        Text(
                            text = "Invited",
                            color = PokrColors.InkStrongMuted,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
            }
        }

        if (contest.placements.isNotEmpty()) {
            HudPanel(modifier = Modifier.fillMaxWidth(), chrome = PokrChrome.Lobby) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("STANDINGS", color = PokrColors.InkStrongMuted, fontWeight = FontWeight.Bold)
                    contest.placements.sortedBy { it.place }.forEach { p ->
                        val prize = p.prizeWuffies ?: 0
                        val prizeLabel = if (prize > 0) "  +$prize Wuffies" else ""
                        Text(
                            "#${p.place}  ${p.name}$prizeLabel",
                            color = PokrColors.InkStrong,
                            fontSize = 14.sp,
                        )
                    }
                }
            }
        }

        state.error?.let { StatusChip(text = it, accent = PokrColors.Danger) }
    }
}
