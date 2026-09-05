package com.pokr.android.feature.lobby

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pokr.android.core.designsystem.LockPortraitOrientation
import com.pokr.android.core.designsystem.PokrChrome
import com.pokr.android.core.designsystem.PokrColors
import com.pokr.android.core.designsystem.StatusChip
import com.pokr.android.core.designsystem.pokrPageGround

@Composable
fun LobbyShell(
    onHosted: (tableId: String, invite: String) -> Unit,
    onJoined: (tableId: String, invite: String, spectate: Boolean) -> Unit,
    onOffline: (seats: Int, bots: Int, name: String) -> Unit,
    onContest: (contestId: String) -> Unit,
    onLudo: (ludoId: String, invite: String, spectate: Boolean) -> Unit,
    onProfile: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: LobbyViewModel = hiltViewModel(),
) {
    LockPortraitOrientation()

    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val friendsBadge by viewModel.pendingInviteCount.collectAsStateWithLifecycle()
    var tab by remember { mutableStateOf(LobbyTab.Home) }

    LaunchedEffect(viewModel) {
        viewModel.openFriends.collect { tab = LobbyTab.Friends }
    }
    var playMode by remember { mutableStateOf("host") }
    var playMenuOpen by remember { mutableStateOf(false) }

    fun goHome() {
        playMenuOpen = false
        tab = LobbyTab.Home
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .pokrPageGround(),
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            LobbyTopBar(
                avatarId = state.avatarId,
                avatarUrl = state.avatarUrl,
                onAvatarClick = {
                    playMenuOpen = false
                    onProfile()
                },
            )
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
            ) {
                when (tab) {
                    LobbyTab.Home -> HomeTab(
                        state = state,
                        viewModel = viewModel,
                        onOffline = onOffline,
                    )
                    LobbyTab.Play -> if (!state.signedIn) {
                        LobbyScrollColumn { SignInGate(onGoHome = ::goHome) }
                    } else if (playMode == "join") {
                        JoinTab(
                            state = state,
                            viewModel = viewModel,
                            playMode = playMode,
                            onPlayMode = { playMode = it },
                            onJoined = onJoined,
                            onContest = onContest,
                            onLudo = onLudo,
                        )
                    } else {
                        HostTab(
                            state = state,
                            viewModel = viewModel,
                            playMode = playMode,
                            onPlayMode = { playMode = it },
                            onHosted = onHosted,
                        )
                    }
                    LobbyTab.Public -> if (!state.signedIn) {
                        LobbyScrollColumn { SignInGate(onGoHome = ::goHome) }
                    } else {
                        PublicTab(onJoined = onJoined)
                    }
                    LobbyTab.Contests -> if (!state.signedIn) {
                        LobbyScrollColumn { SignInGate(onGoHome = ::goHome) }
                    } else {
                        ContestsTab(
                            state = state,
                            viewModel = viewModel,
                            onContest = onContest,
                            onProfile = onProfile,
                        )
                    }
                    LobbyTab.Friends -> if (!state.signedIn) {
                        LobbyScrollColumn { SignInGate(onGoHome = ::goHome) }
                    } else {
                        FriendsTab(
                            onOpenTable = { tableId, invite -> onJoined(tableId, invite, false) },
                            onOpenContest = onContest,
                            onOpenLudo = { ludoId, invite -> onLudo(ludoId, invite, false) },
                        )
                    }
                    LobbyTab.Ludo -> if (!state.signedIn) {
                        LobbyScrollColumn { SignInGate(onGoHome = ::goHome) }
                    } else {
                        LudoTab(
                            state = state,
                            viewModel = viewModel,
                            onLudo = { id, invite -> onLudo(id, invite, false) },
                        )
                    }
                    LobbyTab.Offline -> OfflineTab(
                        state = state,
                        viewModel = viewModel,
                        onOffline = onOffline,
                    )
                }
            }
            state.error?.let { err ->
                StatusChip(
                    text = err,
                    accent = PokrColors.Danger,
                    chrome = PokrChrome.Play,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp),
                )
            }
            LobbyBottomNav(
                selected = tab,
                friendsBadge = friendsBadge,
                onSelect = { next ->
                    playMenuOpen = false
                    tab = next
                },
                onPlayClick = {
                    if (tab == LobbyTab.Play) {
                        playMenuOpen = !playMenuOpen
                    } else {
                        tab = LobbyTab.Play
                        playMenuOpen = false
                    }
                },
            )
        }

        if (playMenuOpen) {
            Row(
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .fillMaxWidth()
                    .navigationBarsPadding()
                    .padding(bottom = 84.dp),
            ) {
                Spacer(modifier = Modifier.weight(1f))
                Box(
                    modifier = Modifier.weight(1f),
                    contentAlignment = Alignment.BottomCenter,
                ) {
                    PlayHostJoinMenu(
                        onHost = {
                            playMode = "host"
                            tab = LobbyTab.Play
                            playMenuOpen = false
                        },
                        onJoin = {
                            playMode = "join"
                            tab = LobbyTab.Play
                            playMenuOpen = false
                        },
                    )
                }
                Spacer(modifier = Modifier.weight(4f))
            }
        }
    }
}
