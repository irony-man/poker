package com.felt.android.feature.lobby

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.clerk.api.Clerk
import com.clerk.api.user.User
import com.clerk.ui.auth.AuthMode
import com.clerk.ui.auth.AuthView
import com.clerk.ui.userbutton.UserButton
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
    val clerkReady by Clerk.isInitialized.collectAsStateWithLifecycle()
    val user by Clerk.userFlow.collectAsStateWithLifecycle()
    val scroll = rememberScrollState()
    val maxBots = (state.maxSeats - 1).coerceAtLeast(0)
    var authMode by remember { mutableStateOf<AuthMode?>(null) }
    val signedIn = user != null
    val onlineLocked = clerkReady && !signedIn

    LaunchedEffect(user?.id) {
        if (user != null) {
            viewModel.prefillNameIfBlank(clerkDisplayName(user))
        }
    }

    if (!clerkReady) {
        Box(
            modifier = modifier
                .fillMaxSize()
                .background(FeltColors.Ink),
            contentAlignment = Alignment.Center,
        ) {
            CircularProgressIndicator(color = FeltColors.Gold)
        }
        return
    }

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
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            StatusChip(text = "Casino night · private tables", accent = FeltColors.Gold)
            if (signedIn) {
                UserButton()
            }
        }
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

        if (onlineLocked) {
            HudPanel(modifier = Modifier.fillMaxWidth()) {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        text = "Sign in with Clerk to host or join online tables. Offline play stays open to everyone.",
                        color = FeltColors.Cream.copy(alpha = 0.72f),
                        fontSize = 14.sp,
                        lineHeight = 20.sp,
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        FeltGhostButton(
                            text = "Sign in",
                            onClick = { authMode = AuthMode.SignIn },
                            modifier = Modifier.weight(1f),
                        )
                        FeltPrimaryButton(
                            text = "Sign up",
                            onClick = { authMode = AuthMode.SignUp },
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }
        }

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
                    text = if (onlineLocked) "Sign in to host" else "Create private table",
                    onClick = {
                        if (onlineLocked) authMode = AuthMode.SignInOrUp
                        else viewModel.host(onHosted)
                    },
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
                        text = if (onlineLocked) "Sign in to join" else "Enter table",
                        onClick = {
                            if (onlineLocked) authMode = AuthMode.SignInOrUp
                            else viewModel.join { id, invite -> onJoined(id, invite, false) }
                        },
                        enabled = !state.busy,
                        modifier = Modifier.weight(1f),
                    )
                    FeltGhostButton(
                        text = "Spectate",
                        onClick = {
                            if (onlineLocked) authMode = AuthMode.SignInOrUp
                            else viewModel.join { id, invite -> onJoined(id, invite, true) }
                        },
                        enabled = !state.busy && (onlineLocked || state.inviteCode.isNotBlank()),
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

    authMode?.let { mode ->
        Dialog(
            onDismissRequest = { authMode = null },
            properties = DialogProperties(
                usePlatformDefaultWidth = false,
                decorFitsSystemWindows = false,
            ),
        ) {
            Surface(
                modifier = Modifier.fillMaxSize(),
                color = FeltColors.Ink,
            ) {
                AuthView(
                    modifier = Modifier.fillMaxSize(),
                    mode = mode,
                    isDismissible = true,
                    onDismiss = { authMode = null },
                    onAuthComplete = { authMode = null },
                )
            }
        }
    }
}

private fun clerkDisplayName(user: User?): String {
    if (user == null) return "Player"
    val fromNames = listOfNotNull(user.firstName, user.lastName)
        .joinToString(" ")
        .trim()
        .ifBlank { null }
    val fromProfile =
        fromNames
            ?: user.username?.trim()?.ifBlank { null }
            ?: user.primaryEmailAddress?.emailAddress?.substringBefore('@')
    return (fromProfile ?: "Player").take(32)
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
