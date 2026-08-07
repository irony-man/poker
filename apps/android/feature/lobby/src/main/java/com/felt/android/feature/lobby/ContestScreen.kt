package com.felt.android.feature.lobby

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
import com.felt.android.core.designsystem.FeltColors
import com.felt.android.core.designsystem.FeltGhostButton
import com.felt.android.core.designsystem.FeltPrimaryButton
import com.felt.android.core.designsystem.HudPanel
import com.felt.android.core.designsystem.LockPortraitOrientation
import com.felt.android.core.designsystem.StatusChip

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
            .background(FeltColors.Ink)
            .statusBarsPadding()
            .navigationBarsPadding()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        FeltGhostButton(text = "← Lobby", onClick = onBack)

        if (contest == null) {
            Text(
                text = state.error ?: "Loading contest…",
                color = if (state.error != null) FeltColors.Danger else FeltColors.Cream.copy(0.5f),
            )
            return@Column
        }

        StatusChip(
            text = "${if (contest.mode == "knockout") "Knockout" else "Table match"} · ${contest.status}",
            accent = FeltColors.Gold,
        )
        Text(
            text = contest.name,
            color = FeltColors.Gold,
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
        )
        Text(
            text = "Code ${contest.inviteCode} · ${contest.entrants.size}/${contest.fieldSize} · stack ${contest.startingStack}",
            color = FeltColors.Cream.copy(0.55f),
            fontSize = 13.sp,
        )

        val isHost = contest.hostUserId == userId
        val registered = contest.entrants.any { it.userId == userId }

        if (contest.status == "registering") {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                if (!registered) {
                    FeltPrimaryButton(
                        text = "Register",
                        onClick = viewModel::register,
                        enabled = !state.busy && userId != null,
                    )
                } else if (!isHost) {
                    FeltGhostButton(
                        text = "Unregister",
                        onClick = viewModel::unregister,
                        enabled = !state.busy,
                    )
                }
                if (isHost) {
                    FeltPrimaryButton(
                        text = "Start now",
                        onClick = viewModel::start,
                        enabled = !state.busy,
                    )
                }
            }
        }

        val assigned = contest.assignments.find { it.userId == userId }?.tableId
        if (assigned != null && contest.status == "running") {
            FeltPrimaryButton(
                text = "Go to table",
                onClick = { onOpenTable(assigned) },
                modifier = Modifier.fillMaxWidth(),
            )
        }

        HudPanel(modifier = Modifier.fillMaxWidth()) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("ENTRANTS", color = FeltColors.Cream.copy(0.7f), fontWeight = FontWeight.Bold)
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
                            color = FeltColors.Cream,
                            fontSize = 14.sp,
                        )
                        if (place != null) {
                            Text("#$place", color = FeltColors.Gold, fontSize = 13.sp)
                        }
                    }
                }
            }
        }

        if (contest.mode == "knockout" && contest.matches.isNotEmpty()) {
            HudPanel(modifier = Modifier.fillMaxWidth()) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("BRACKET", color = FeltColors.Cream.copy(0.7f), fontWeight = FontWeight.Bold)
                    contest.matches
                        .groupBy { it.round }
                        .toSortedMap()
                        .forEach { (round, matches) ->
                            Text(
                                "Round ${round + 1}",
                                color = FeltColors.Cyan.copy(0.7f),
                                fontSize = 11.sp,
                            )
                            matches.sortedBy { it.index }.forEach { m ->
                                val a = contest.entrants.find { it.userId == m.playerA }?.name ?: "—"
                                val b = contest.entrants.find { it.userId == m.playerB }?.name ?: "—"
                                val winner = contest.entrants.find { it.userId == m.winnerId }?.name
                                Text(
                                    "$a vs $b · ${m.status}${if (winner != null) " · $winner" else ""}",
                                    color = FeltColors.Cream.copy(0.85f),
                                    fontSize = 13.sp,
                                )
                            }
                        }
                }
            }
        }

        if (contest.placements.isNotEmpty()) {
            HudPanel(modifier = Modifier.fillMaxWidth()) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("STANDINGS", color = FeltColors.Cream.copy(0.7f), fontWeight = FontWeight.Bold)
                    contest.placements.sortedBy { it.place }.forEach { p ->
                        Text("#${p.place}  ${p.name}", color = FeltColors.Cream, fontSize = 14.sp)
                    }
                }
            }
        }

        state.error?.let { StatusChip(text = it, accent = FeltColors.Danger) }
    }
}
