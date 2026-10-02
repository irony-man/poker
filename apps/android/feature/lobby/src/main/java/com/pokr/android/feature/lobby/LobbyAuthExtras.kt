package com.pokr.android.feature.lobby

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pokr.android.core.designsystem.AvatarPicker
import com.pokr.android.core.designsystem.HudPanel
import com.pokr.android.core.designsystem.PokrChrome
import com.pokr.android.core.designsystem.PokrColors
import com.pokr.android.core.designsystem.PokrGhostButton
import com.pokr.android.core.designsystem.PokrLabel
import com.pokr.android.core.designsystem.PokrPrimaryButton
import kotlinx.coroutines.launch

/** "Continue with Google" via Credential Manager; hands the ID token to [onIdToken]. */
@Composable
fun GoogleSignInRow(
    clientId: String,
    enabled: Boolean,
    onIdToken: (String) -> Unit,
    onError: (Throwable) -> Unit,
    text: String = "Continue with Google",
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    PokrGhostButton(
        text = text,
        enabled = enabled,
        modifier = Modifier.fillMaxWidth(),
        onClick = {
            scope.launch {
                requestGoogleIdToken(context, clientId)
                    .onSuccess(onIdToken)
                    .onFailure(onError)
            }
        },
    )
}

@Composable
fun OrDividerRow() {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(Modifier.weight(1f).height(1.dp).background(PokrColors.Sidebar.copy(alpha = 0.15f)))
        Text("OR", color = PokrColors.InkStrongMuted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        Box(Modifier.weight(1f).height(1.dp).background(PokrColors.Sidebar.copy(alpha = 0.15f)))
    }
}

/** One-time username step for a brand-new Google account. */
@Composable
fun GoogleUsernamePanel(state: LobbyUiState, viewModel: LobbyViewModel) {
    LobbyPageHeader(
        title = "Pick a username",
        subtitle = state.googlePendingEmail?.let {
            "Signed in with Google as $it. This is the name other players see."
        } ?: "This is the name other players see at the table.",
    )
    HudPanel(modifier = Modifier.fillMaxWidth(), chrome = PokrChrome.Lobby) {
        Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                PokrLabel("Username")
                LobbyTextField(
                    value = state.googleUsername,
                    onValueChange = viewModel::onGoogleUsernameChange,
                    placeholder = "letters, numbers, _",
                )
            }
            AvatarPicker(value = state.avatarId, onChange = viewModel::onAvatarChange)
            PokrPrimaryButton(
                text = if (state.busy) "Creating…" else "Create account",
                onClick = viewModel::submitGoogleUsername,
                enabled = !state.busy,
                modifier = Modifier.fillMaxWidth(),
            )
            PokrGhostButton(
                text = "Back",
                onClick = viewModel::cancelGoogleUsername,
                enabled = !state.busy,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

/** Requests a reset email; the link opens the web reset page. */
@Composable
fun ForgotPasswordDialog(state: LobbyUiState, viewModel: LobbyViewModel) {
    AlertDialog(
        onDismissRequest = viewModel::dismissForgotPassword,
        title = { Text("Forgot password") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                if (state.forgotSent) {
                    Text(
                        "If that account has a confirmed recovery email, a reset link is on its way. " +
                            "It expires in 1 hour.",
                        color = PokrColors.InkStrong,
                        fontSize = 14.sp,
                    )
                } else {
                    Text(
                        "Enter your username or recovery email. Accounts need a confirmed recovery " +
                            "email to be reset.",
                        color = PokrColors.InkStrongMuted,
                        fontSize = 14.sp,
                    )
                    LobbyTextField(
                        value = state.forgotIdentifier,
                        onValueChange = viewModel::onForgotIdentifierChange,
                        placeholder = "username or email",
                    )
                    state.error?.let { Text(it, color = PokrColors.Danger, fontSize = 13.sp) }
                }
            }
        },
        confirmButton = {
            if (state.forgotSent) {
                TextButton(onClick = viewModel::dismissForgotPassword) { Text("Done") }
            } else {
                TextButton(onClick = viewModel::submitForgotPassword, enabled = !state.busy) {
                    Text(if (state.busy) "Sending…" else "Send reset link")
                }
            }
        },
        dismissButton = {
            if (!state.forgotSent) {
                TextButton(onClick = viewModel::dismissForgotPassword) { Text("Cancel") }
            }
        },
    )
}
