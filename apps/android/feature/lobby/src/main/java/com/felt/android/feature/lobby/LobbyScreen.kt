package com.felt.android.feature.lobby

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
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
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.ImeAction
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
    onContest: (contestId: String) -> Unit,
    onHands: () -> Unit = {},
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
            text = if (state.signedIn) {
                "Host a private table, join with a code, or play offline vs bots."
            } else {
                "Sign in with username and password to play online."
            },
            color = FeltColors.Cream.copy(alpha = 0.72f),
            fontSize = 15.sp,
            lineHeight = 22.sp,
        )

        if (!state.signedIn) {
            HudPanel(modifier = Modifier.fillMaxWidth()) {
                Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        FeltChoiceChip(
                            text = "Sign in",
                            selected = state.authMode == "login",
                            onClick = { viewModel.onAuthModeChange("login") },
                        )
                        FeltChoiceChip(
                            text = "Sign up",
                            selected = state.authMode == "signup",
                            onClick = { viewModel.onAuthModeChange("signup") },
                        )
                    }
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        FeltLabel("Username")
                        LobbyTextField(
                            value = state.username,
                            onValueChange = viewModel::onUsernameChange,
                            placeholder = "letters, numbers, _",
                        )
                    }
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        FeltLabel("Password")
                        LobbyTextField(
                            value = state.password,
                            onValueChange = viewModel::onPasswordChange,
                            placeholder = "min 6 characters",
                            password = true,
                        )
                    }
                    if (state.authMode == "signup") {
                        AvatarPicker(
                            value = state.avatarId,
                            onChange = viewModel::onAvatarChange,
                        )
                    }
                    FeltPrimaryButton(
                        text = if (state.authMode == "signup") "Create account" else "Sign in",
                        onClick = viewModel::submitAuth,
                        enabled = !state.busy,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }
            HudPanel(modifier = Modifier.fillMaxWidth()) {
                Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    Text("OFFLINE ARENA", color = FeltColors.Gold, fontWeight = FontWeight.Bold)
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        FeltLabel("Display name")
                        LobbyTextField(value = state.name, onValueChange = viewModel::onNameChange)
                    }
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
        } else {
            HudPanel(modifier = Modifier.fillMaxWidth()) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(modifier = Modifier.weight(1f).padding(end = 8.dp)) {
                        FeltLabel("Signed in as")
                        Text(
                            state.name,
                            color = FeltColors.Gold,
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp,
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        FeltGhostButton(
                            text = "Hands",
                            onClick = onHands,
                        )
                        FeltGhostButton(
                            text = "Sign out",
                            onClick = viewModel::signOut,
                        )
                    }
                }
            }

            HudPanel(modifier = Modifier.fillMaxWidth()) {
                Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(modifier = Modifier.weight(1f).padding(end = 8.dp)) {
                            Text("HANDS", color = FeltColors.Gold, fontWeight = FontWeight.Bold)
                            Text(
                                "Career path · hole cards you've played",
                                color = FeltColors.Cream.copy(alpha = 0.5f),
                                style = MaterialTheme.typography.bodySmall,
                                modifier = Modifier.padding(top = 4.dp),
                            )
                        }
                        StatusChip(text = "Progress", accent = FeltColors.Cyan)
                    }
                    FeltPrimaryButton(
                        text = "Open hands map",
                        onClick = onHands,
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
                        Text("HOST", color = FeltColors.Gold, fontWeight = FontWeight.Bold)
                        StatusChip(text = "Online", accent = FeltColors.Cyan)
                    }
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
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        FeltLabel("Room code (optional)")
                        LobbyTextField(
                            value = state.customRoomCode,
                            onValueChange = viewModel::onCustomRoomCodeChange,
                            placeholder = "Auto · or 4–8 digits",
                            numeric = true,
                        )
                    }
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
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        FeltLabel("Invite code")
                        LobbyTextField(
                            value = state.inviteCode,
                            onValueChange = viewModel::onInviteChange,
                            placeholder = "Room code",
                            numeric = true,
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
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text("CONTESTS", color = FeltColors.Gold, fontWeight = FontWeight.Bold)
                        StatusChip(text = "Tournament", accent = FeltColors.Cyan)
                    }
                    Text(
                        "Knockout freezeout · rounds with top-ups",
                        color = FeltColors.Cream.copy(alpha = 0.5f),
                        style = MaterialTheme.typography.bodySmall,
                    )
                    val contestSizes = (2..9).toList()
                    ChoiceRowString(
                        label = "Mode",
                        selected = state.contestMode,
                        options = listOf("chips", "rounds"),
                        onSelect = viewModel::onContestModeChange,
                    ) { if (it == "rounds") "Rounds" else "Knockout" }
                    ChoiceRow(
                        label = "Players",
                        selected = state.contestFieldSize,
                        options = contestSizes,
                        onSelect = viewModel::onContestFieldSizeChange,
                    )
                    if (state.contestMode == "rounds") {
                        ChoiceRow(
                            label = "Hands",
                            selected = state.contestHandLimit,
                            options = listOf(10, 15, 20, 30, 50),
                            onSelect = viewModel::onContestHandLimitChange,
                        )
                    }
                    FeltPrimaryButton(
                        text = "Create contest",
                        onClick = { viewModel.createContest(onContest) },
                        enabled = !state.busy,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        FeltLabel("Contest code")
                        LobbyTextField(
                            value = state.contestInvite,
                            onValueChange = viewModel::onContestInviteChange,
                            placeholder = "4–8 digit code",
                            numeric = true,
                        )
                    }
                    FeltGhostButton(
                        text = "Join contest",
                        onClick = { viewModel.joinContest(onContest) },
                        enabled = !state.busy && state.contestInvite.isNotBlank(),
                        modifier = Modifier.fillMaxWidth(),
                    )
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
        }

        state.error?.let { err ->
            StatusChip(text = err, accent = FeltColors.Danger)
        }

        Spacer(modifier = Modifier.height(20.dp))
    }
}

@Composable
private fun LobbyTextField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String? = null,
    numeric: Boolean = false,
    password: Boolean = false,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = Modifier.fillMaxWidth(),
        singleLine = true,
        visualTransformation = if (password) PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
        placeholder = placeholder?.let { { Text(it, color = FeltColors.Cream.copy(alpha = 0.35f)) } },
        keyboardOptions = KeyboardOptions(
            keyboardType = when {
                password -> KeyboardType.Password
                numeric -> KeyboardType.Number
                else -> KeyboardType.Text
            },
            imeAction = ImeAction.Done,
        ),
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
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            options.chunked(4).forEach { chunk ->
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    chunk.forEach { option ->
                        FeltChoiceChip(
                            text = format(option),
                            selected = option == selected,
                            onClick = { onSelect(option) },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ChoiceRowString(
    label: String,
    selected: String,
    options: List<String>,
    onSelect: (String) -> Unit,
    format: (String) -> String = { it },
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        FeltLabel(label)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
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
