package com.pokr.android.feature.lobby

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

@Composable
fun LobbyScreen(
    onHosted: (tableId: String, invite: String) -> Unit,
    onJoined: (tableId: String, invite: String, spectate: Boolean) -> Unit,
    onOffline: (seats: Int, bots: Int, name: String) -> Unit,
    onContest: (contestId: String) -> Unit,
    onLudo: (ludoId: String, invite: String, spectate: Boolean) -> Unit,
    onSnakes: (snakesId: String, invite: String, spectate: Boolean) -> Unit,
    onMemory: (memoryId: String, invite: String, spectate: Boolean) -> Unit,
    onProfile: () -> Unit,
    modifier: Modifier = Modifier,
) {
    LobbyShell(
        onHosted = onHosted,
        onJoined = onJoined,
        onOffline = onOffline,
        onContest = onContest,
        onLudo = onLudo,
        onSnakes = onSnakes,
        onMemory = onMemory,
        onProfile = onProfile,
        modifier = modifier,
    )
}
