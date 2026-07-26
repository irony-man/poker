package com.felt.android.feature.lobby

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.felt.android.core.designsystem.AvatarPicker
import com.felt.android.core.designsystem.FeltChoiceChip
import com.felt.android.core.designsystem.FeltColors
import com.felt.android.core.designsystem.FeltGhostButton
import com.felt.android.core.designsystem.FeltLabel
import com.felt.android.core.designsystem.FeltPrimaryButton
import com.felt.android.core.designsystem.HudPanel
import com.felt.android.core.designsystem.LockPortraitOrientation
import com.felt.android.core.designsystem.StatusChip

@Composable
fun LobbyScreen(
    onHosted: (tableId: String, invite: String) -> Unit,
    onJoined: (tableId: String, invite: String, spectate: Boolean) -> Unit,
    onOffline: (seats: Int, bots: Int, name: String) -> Unit,
    modifier: Modifier = Modifier,
    viewModel: LobbyViewModel = hiltViewModel(),
) {
    LockPortraitOrientation()

    val state by viewModel.uiState.collectAsState()
    val scroll = rememberScrollState()
    val maxBots = (state.maxSeats - 1).coerceAtLeast(0)

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(FeltColors.Ink)
            .statusBarsPadding()
            .navigationBarsPadding()
            .verticalScroll(scroll)
            .padding(horizontal = 20.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        StatusChip(text = "Casino night · private tables", accent = FeltColors.Gold)
        Text(
            text = "FELT",
            style = MaterialTheme.typography.headlineLarge,
            fontWeight = FontWeight.ExtraBold,
            color = FeltColors.Gold,
        )
        Text(
            text = "Host a private table, join or spectate with a code, or play offline vs bots.",
            color = FeltColors.Cream.copy(alpha = 0.72f),
            fontSize = 15.sp,
            lineHeight = 22.sp,
        )

        HudPanel(modifier = Modifier.fillMaxWidth()) {
            AvatarPicker(
                value = state.avatarId,
                onChange = viewModel::onAvatarChange,
            )
        }

        HudPanel(modifier = Modifier.fillMaxWidth()) {
            Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("HOST", color = FeltColors.Gold, fontWeight = FontWeight.Bold)
                    StatusChip(text = "Online", accent = FeltColors.Cyan)
                }
                NameField(state.name, viewModel::onNameChange)
                ChoiceRow(
                    label = "Seats",
                    selected = state.maxSeats,
                    options = (2..9).toList(),
                    onSelect = viewModel::onMaxSeatsChange,
                )
                ChoiceRow(
                    label = "Starting bots",
                    selected = state.botCount.coerceAtMost(maxBots),
                    options = (0..maxBots).toList(),
                    onSelect = viewModel::onBotCountChange,
                ) { if (it == 0) "None" else "$it" }
                FeltPrimaryButton(
                    text = "Create private table",
                    onClick = { viewModel.host(onHosted) },
                    enabled = !state.busy,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }

        HudPanel(modifier = Modifier.fillMaxWidth()) {
            Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("JOIN", color = FeltColors.Gold, fontWeight = FontWeight.Bold)
                    StatusChip(text = "Invite", accent = FeltColors.Cyan)
                }
                NameField(state.name, viewModel::onNameChange)
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    FeltLabel("Invite code")
                    LobbyTextField(
                        value = state.inviteCode,
                        onValueChange = viewModel::onInviteChange,
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    FeltGhostButton(
                        text = "Enter table",
                        onClick = { viewModel.join { id, invite -> onJoined(id, invite, false) } },
                        enabled = !state.busy,
                        modifier = Modifier.weight(1f),
                    )
                    FeltGhostButton(
                        text = "Spectate",
                        onClick = { viewModel.join { id, invite -> onJoined(id, invite, true) } },
                        enabled = !state.busy && state.inviteCode.isNotBlank(),
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }

        HudPanel(modifier = Modifier.fillMaxWidth()) {
            Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Top,
                ) {
                    Column(modifier = Modifier.weight(1f).padding(end = 8.dp)) {
                        Text("OFFLINE ARENA", color = FeltColors.Gold, fontWeight = FontWeight.Bold)
                        Text(
                            "Local bots · no server",
                            color = FeltColors.Cream.copy(alpha = 0.5f),
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.padding(top = 4.dp),
                        )
                    }
                    StatusChip(text = "Solo mode", accent = FeltColors.Neon)
                }
                NameField(state.name, viewModel::onNameChange)
                ChoiceRow(
                    label = "Seats",
                    selected = state.offlineSeats,
                    options = (2..9).toList(),
                    onSelect = viewModel::onOfflineSeatsChange,
                ) { seats ->
                    "$seats · ${seats - 1} bots"
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

        Spacer(modifier = Modifier.height(20.dp))
    }
}

@Composable
private fun NameField(value: String, onChange: (String) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        FeltLabel("Callsign")
        LobbyTextField(value = value, onValueChange = onChange)
    }
}

@Composable
private fun LobbyTextField(
    value: String,
    onValueChange: (String) -> Unit,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = Modifier.fillMaxWidth(),
        singleLine = true,
        colors = OutlinedTextFieldDefaults.colors(
            focusedTextColor = FeltColors.Cream,
            unfocusedTextColor = FeltColors.Cream,
            focusedBorderColor = FeltColors.Gold.copy(alpha = 0.7f),
            unfocusedBorderColor = FeltColors.Cream.copy(alpha = 0.22f),
            cursorColor = FeltColors.Gold,
            focusedContainerColor = FeltColors.Ink.copy(alpha = 0.55f),
            unfocusedContainerColor = FeltColors.Ink.copy(alpha = 0.45f),
        ),
    )
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ChoiceRow(
    label: String,
    selected: Int,
    options: List<Int>,
    onSelect: (Int) -> Unit,
    format: (Int) -> String = { it.toString() },
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        FeltLabel(label)
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            options.forEach { option ->
                FeltChoiceChip(
                    text = format(option),
                    selected = option == selected,
                    onClick = { onSelect(option) },
                )
            }
        }
    }
}
