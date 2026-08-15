package com.pokr.android.feature.lobby

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

@Composable
fun LobbyScreen(
    onHosted: (tableId: String, invite: String) -> Unit,
    onJoined: (tableId: String, invite: String, spectate: Boolean) -> Unit,
    onOffline: (seats: Int, bots: Int, name: String) -> Unit,
    onContest: (contestId: String) -> Unit,
    onProfile: () -> Unit,
    modifier: Modifier = Modifier,
) {
    LobbyShell(
        onHosted = onHosted,
        onJoined = onJoined,
        onOffline = onOffline,
        onContest = onContest,
        onProfile = onProfile,
        modifier = modifier,
    )
}
