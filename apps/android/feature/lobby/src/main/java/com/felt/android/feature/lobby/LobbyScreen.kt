package com.felt.android.feature.lobby

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.felt.android.core.designsystem.FeltColors
import com.felt.android.core.designsystem.FeltGhostButton
import com.felt.android.core.designsystem.FeltLabel
import com.felt.android.core.designsystem.FeltPrimaryButton
import com.felt.android.core.designsystem.HudPanel
import com.felt.android.core.designsystem.StatusChip

@Composable
fun LobbyScreen(
    onHosted: (tableId: String, invite: String) -> Unit,
    onJoined: (tableId: String, invite: String) -> Unit,
    onOffline: (seats: Int, bots: Int, name: String) -> Unit,
    modifier: Modifier = Modifier,
    viewModel: LobbyViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsState()
    val scroll = rememberScrollState()
    val maxBots = (state.maxSeats - 1).coerceAtLeast(0)
    val maxOfflineBots = (state.offlineSeats - 1).coerceAtLeast(1)

    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(scroll)
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        StatusChip(text = "Casino night · private tables", accent = FeltColors.Gold)
        Text(
            text = "FELT",
            style = MaterialTheme.typography.headlineLarge,
            fontWeight = FontWeight.ExtraBold,
        )
        Text(
            text = "Host a private table, join with a code, or play offline vs bots.",
            color = FeltColors.Cream.copy(alpha = 0.65f),
        )

        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            HudPanel(modifier = Modifier.weight(1f)) {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(
                        modifier = FillMaxWidth,
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text("HOST", color = FeltColors.Gold, fontWeight = FontWeight.Bold)
                        StatusChip(text = "Online", accent = FeltColors.Cyan)
                    }
                    NameField(state.name, viewModel::onNameChange)
                    SeatDropdown("Seats", state.maxSeats, (2..9).toList(), viewModel::onMaxSeatsChange)
                    SeatDropdown(
                        "Starting bots",
                        state.botCount.coerceAtMost(maxBots),
                        (0..maxBots).toList(),
                        viewModel::onBotCountChange,
                    ) { if (it == 0) "None" else "$it bot${if (it == 1) "" else "s"}" }
                    FeltPrimaryButton(
                        text = "Create private table",
                        onClick = { viewModel.host(onHosted) },
                        enabled = !state.busy,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }

            HudPanel(modifier = Modifier.weight(1f)) {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(
                        modifier = FillMaxWidth,
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text("JOIN", color = FeltColors.Gold, fontWeight = FontWeight.Bold)
                        StatusChip(text = "Invite", accent = FeltColors.Cyan)
                    }
                    NameField(state.name, viewModel::onNameChange)
                    Column {
                        FeltLabel("Invite code")
                        OutlinedTextField(
                            value = state.inviteCode,
                            onValueChange = viewModel::onInviteChange,
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true,
                        )
                    }
                    FeltGhostButton(
                        text = "Enter table",
                        onClick = { viewModel.join(onJoined) },
                        enabled = !state.busy,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }
        }

        HudPanel {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(
                    modifier = FillMaxWidth,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Column {
                        Text("OFFLINE ARENA", color = FeltColors.Gold, fontWeight = FontWeight.Bold)
                        Text(
                            "Local bots · no server",
                            color = FeltColors.Cream.copy(alpha = 0.45f),
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                    StatusChip(text = "Solo mode", accent = FeltColors.Neon)
                }
                NameField(state.name, viewModel::onNameChange)
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    SeatDropdown(
                        "Seats",
                        state.offlineSeats,
                        (2..9).toList(),
                        viewModel::onOfflineSeatsChange,
                        modifier = Modifier.weight(1f),
                    ) { "$it seats" }
                    SeatDropdown(
                        "Bots",
                        state.offlineBots.coerceIn(1, maxOfflineBots),
                        (1..maxOfflineBots).toList(),
                        viewModel::onOfflineBotsChange,
                        modifier = Modifier.weight(1f),
                    ) { "$it bot${if (it == 1) "" else "s"}" }
                }
                FeltGhostButton(
                    text = "Launch offline game",
                    onClick = { viewModel.offline(onOffline) },
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }

        state.error?.let { err ->
            StatusChip(text = err, accent = FeltColors.Danger)
        }

        Spacer(modifier = Modifier.height(24.dp))
    }
}

private val FillMaxWidth = Modifier.fillMaxWidth()

@Composable
private fun NameField(value: String, onChange: (String) -> Unit) {
    Column {
        FeltLabel("Callsign")
        OutlinedTextField(
            value = value,
            onValueChange = onChange,
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
        )
    }
}

@Composable
private fun SeatDropdown(
    label: String,
    selected: Int,
    options: List<Int>,
    onSelect: (Int) -> Unit,
    modifier: Modifier = Modifier,
    format: (Int) -> String = { it.toString() },
) {
    Column(modifier = modifier) {
        FeltLabel(label)
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            options.take(5).forEach { option ->
                FeltGhostButton(
                    text = format(option),
                    onClick = { onSelect(option) },
                    enabled = option != selected,
                )
            }
        }
        if (options.size > 5) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                options.drop(5).forEach { option ->
                    FeltGhostButton(
                        text = format(option),
                        onClick = { onSelect(option) },
                        enabled = option != selected,
                    )
                }
            }
        }
    }
}
