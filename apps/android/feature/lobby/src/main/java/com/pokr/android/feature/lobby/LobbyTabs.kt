package com.pokr.android.feature.lobby

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pokr.android.core.designsystem.AvatarPicker
import com.pokr.android.core.designsystem.ChipsStackIcon
import com.pokr.android.core.designsystem.PokrChrome
import com.pokr.android.core.designsystem.PokrColors
import com.pokr.android.core.designsystem.PokrFonts
import com.pokr.android.core.designsystem.PokrGhostButton
import com.pokr.android.core.designsystem.PokrLabel
import com.pokr.android.core.designsystem.PokrPrimaryButton
import com.pokr.android.core.designsystem.HudPanel
import com.pokr.android.core.designsystem.LocalPokrUiTheme
import com.pokr.android.core.designsystem.PokrUiTheme
import com.pokr.android.core.designsystem.formatChips
import com.pokr.android.core.designsystem.pokrChoiceForeground
import com.pokr.android.core.model.STAKE_PRESETS
import com.pokr.android.core.model.stakeById

@Composable
fun HomeTab(
    state: LobbyUiState,
    viewModel: LobbyViewModel,
    onOffline: (seats: Int, bots: Int, name: String) -> Unit,
) {
    LobbyScrollColumn {
        if (!state.signedIn) {
            LobbyPageHeader(
                title = if (state.authMode == "signup") "Create account" else "Sign in",
                subtitle = if (state.authMode == "signup") {
                    "Create a username and password"
                } else {
                    "Sign in with your username"
                },
            )
            HudPanel(modifier = Modifier.fillMaxWidth(), chrome = PokrChrome.Lobby) {
                Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    SegmentedChoice(
                        selected = state.authMode,
                        options = listOf("login", "signup"),
                        onSelect = viewModel::onAuthModeChange,
                        style = ChoiceStyle.Segmented,
                    ) { if (it == "signup") "Sign up" else "Sign in" }
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        PokrLabel("Username")
                        LobbyTextField(
                            value = state.username,
                            onValueChange = viewModel::onUsernameChange,
                            placeholder = "letters, numbers, _",
                        )
                    }
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        PokrLabel("Password")
                        LobbyTextField(
                            value = state.password,
                            onValueChange = viewModel::onPasswordChange,
                            placeholder = "min 6 characters",
                            password = true,
                        )
                    }
                    if (state.authMode == "signup") {
                        AvatarPicker(value = state.avatarId, onChange = viewModel::onAvatarChange)
                    }
                    PokrPrimaryButton(
                        text = if (state.authMode == "signup") "Create account" else "Sign in",
                        onClick = viewModel::submitAuth,
                        enabled = !state.busy,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }
            LobbyPageHeader(
                title = "Offline Arena",
                subtitle = "Train against bots on this device — no account needed.",
            )
            OfflineSetupCard(state = state, viewModel = viewModel, onOffline = onOffline)
        } else {
            LobbyPageHeader(
                title = "Ready to play?",
                subtitle = "Host a private table, sit at public stakes, or train offline.",
            )
            LobbySplitCard(
                imageRes = LobbyIllustrations.host,
                imageAlt = "Host a private table",
            ) {
                Text(
                    "Private tables and public rings use the same Hold'em rules.",
                    color = PokrColors.InkStrongMuted,
                    fontSize = 14.sp,
                    lineHeight = 20.sp,
                )
            }
        }
    }
}

@Composable
fun HostTab(
    state: LobbyUiState,
    viewModel: LobbyViewModel,
    playMode: String,
    onPlayMode: (String) -> Unit,
    onHosted: (tableId: String, invite: String) -> Unit,
) {
    val maxBots = (state.maxSeats - 1).coerceAtLeast(0)
    val stake = stakeById(state.hostStakeId)
    LobbyScrollColumn {
        PlayModeSelect(playMode = playMode, onPlayMode = onPlayMode)
        LobbyPageHeader(
            title = "Create a table",
            subtitle = "Set stakes and seats, choose starting bots, and open a private Hold'em room with a code you pick or we generate.",
        )
        LobbySplitCard(imageRes = LobbyIllustrations.host, imageAlt = "Host a private table") {
            SegmentedChoice(
                label = "Stakes",
                selected = state.hostStakeId,
                options = STAKE_PRESETS.map { it.id },
                onSelect = viewModel::onHostStakeChange,
                content = { id, selected ->
                    val s = stakeById(id)
                    val arcade = LocalPokrUiTheme.current == PokrUiTheme.Arcade
                    Column(
                        verticalArrangement = Arrangement.spacedBy(4.dp),
                        horizontalAlignment = Alignment.Start,
                    ) {
                        Text(
                            s.label,
                            color = pokrChoiceForeground(selected = selected, arcade = arcade),
                            fontFamily = PokrFonts.Display,
                            fontWeight = if (selected) FontWeight.Bold else FontWeight.SemiBold,
                            fontSize = 13.sp,
                        )
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            ChipsStackIcon(height = 14.dp)
                            Text(
                                "${formatChips(s.buyIn)}  ${s.smallBlind}/${s.bigBlind}",
                                color = pokrChoiceForeground(selected = selected, arcade = arcade, muted = true),
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Medium,
                            )
                        }
                    }
                },
            )
            FieldHelp("Buy-in ${stake.buyIn} · blinds ${stake.smallBlind}/${stake.bigBlind}")
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
            if (state.botGroups.isNotEmpty() && state.botCount > 0) {
                ChoiceRowString(
                    label = "Bot group",
                    selected = state.hostBotGroupId ?: state.botGroups.first().id,
                    options = state.botGroups.map { it.id },
                    onSelect = viewModel::onHostBotGroupChange,
                ) { id -> state.botGroups.find { it.id == id }?.name ?: id }
            }
            if (state.signedIn) {
                FriendInvitePicker(
                    friends = state.friends,
                    groups = state.groups,
                    selectedIds = state.inviteFriendIds,
                    onChange = viewModel::onInviteFriendsChange,
                    disabled = state.busy,
                )
            }
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                PokrLabel("Room code (optional)")
                LobbyTextField(
                    value = state.customRoomCode,
                    onValueChange = viewModel::onCustomRoomCodeChange,
                    placeholder = "Auto · or 4–8 digits",
                    numeric = true,
                )
            }
            PokrPrimaryButton(
                text = "Create private table",
                onClick = { viewModel.host(onHosted) },
                enabled = !state.busy,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
fun JoinTab(
    state: LobbyUiState,
    viewModel: LobbyViewModel,
    playMode: String,
    onPlayMode: (String) -> Unit,
    onJoined: (tableId: String, invite: String, spectate: Boolean) -> Unit,
    onContest: (contestId: String) -> Unit,
) {
    LobbyScrollColumn {
        PlayModeSelect(playMode = playMode, onPlayMode = onPlayMode)
        LobbyPageHeader(
            title = "Join a Table",
            subtitle = "Enter the invite code you were sent to take a seat or watch the hand, whether it is a private table or a contest.",
        )
        LobbySplitCard(imageRes = LobbyIllustrations.join, imageAlt = "Enter a table with an invite code") {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                PokrLabel("Invite code")
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
                PokrPrimaryButton(
                    text = "Enter table",
                    onClick = {
                        viewModel.join(
                            onTable = { id, invite -> onJoined(id, invite, false) },
                            onContest = onContest,
                        )
                    },
                    enabled = !state.busy && state.inviteCode.isNotBlank(),
                    modifier = Modifier.weight(1f),
                )
                PokrGhostButton(
                    text = "Spectate",
                    onClick = {
                        viewModel.join(
                            onTable = { id, invite -> onJoined(id, invite, true) },
                        )
                    },
                    enabled = !state.busy && state.inviteCode.isNotBlank(),
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

@Composable
fun ContestsTab(
    state: LobbyUiState,
    viewModel: LobbyViewModel,
    onContest: (contestId: String) -> Unit,
    onProfile: () -> Unit,
) {
    LaunchedEffect(Unit) { viewModel.refreshPublicContests() }
    LobbyScrollColumn {
        LobbyPageHeader(
            title = "Host Contests",
            subtitle = "Host a room for friends in a Knockout freezeout or a fixed run of hands, set the max table size, invite people, and start when the seats look right.",
        )
        LobbySplitCard(imageRes = LobbyIllustrations.contests, imageAlt = "Host a knockout contest") {
            ChoiceRowString(
                label = "Contest format",
                selected = state.contestMode,
                options = listOf("chips", "rounds"),
                onSelect = viewModel::onContestModeChange,
                style = ChoiceStyle.Segmented,
            ) { if (it == "rounds") "Rounds" else "Knockout" }
            ChoiceRow(
                label = "Max table size",
                selected = state.contestFieldSize,
                options = (2..9).toList(),
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
            if (state.signedIn) {
                FriendInvitePicker(
                    friends = state.friends,
                    groups = state.groups,
                    selectedIds = state.inviteFriendIds,
                    onChange = viewModel::onInviteFriendsChange,
                    disabled = state.busy,
                )
            }
            PokrPrimaryButton(
                text = "Create contest",
                onClick = { viewModel.createContest(onContest) },
                enabled = !state.busy,
                modifier = Modifier.fillMaxWidth(),
            )
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                PokrLabel("Contest code")
                LobbyTextField(
                    value = state.contestInvite,
                    onValueChange = viewModel::onContestInviteChange,
                    placeholder = "4–8 digit code",
                    numeric = true,
                )
            }
            PokrGhostButton(
                text = "Join contest",
                onClick = { viewModel.joinContest(onContest) },
                enabled = !state.busy && state.contestInvite.isNotBlank(),
                modifier = Modifier.fillMaxWidth(),
            )
            if (state.publicContests.isNotEmpty()) {
                PokrLabel("Open now")
                state.publicContests.take(8).forEach { contest ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(contest.name, color = PokrColors.Sidebar, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                            Text(
                                "${if (contest.mode == "rounds") "Rounds" else "Knockout"} · ${contest.entrants.size}/${contest.fieldSize} · ${contest.status}",
                                color = PokrColors.InkStrongMuted,
                                fontSize = 12.sp,
                            )
                        }
                        PokrGhostButton(text = "Open", onClick = { onContest(contest.id) })
                    }
                }
            }
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("Your contests", color = PokrColors.InkStrongMuted, fontSize = 14.sp)
                PokrGhostButton(text = "Profile →", onClick = onProfile)
            }
        }
    }
}

@Composable
private fun PlayModeSelect(
    playMode: String,
    onPlayMode: (String) -> Unit,
) {
    SegmentedChoice(
        selected = playMode,
        options = listOf("host", "join"),
        onSelect = onPlayMode,
        style = ChoiceStyle.Segmented,
    ) { if (it == "join") "Join" else "Host" }
}

@Composable
fun OfflineTab(
    state: LobbyUiState,
    viewModel: LobbyViewModel,
    onOffline: (seats: Int, bots: Int, name: String) -> Unit,
) {
    LobbyScrollColumn {
        LobbyPageHeader(
            title = "Offline Arena",
            subtitle = "Train against bots on this device with the same Hold'em rules as live tables, no connection or lobby, and a seat count you choose before the first deal.",
        )
        OfflineSetupCard(state = state, viewModel = viewModel, onOffline = onOffline)
    }
}

@Composable
private fun OfflineSetupCard(
    state: LobbyUiState,
    viewModel: LobbyViewModel,
    onOffline: (seats: Int, bots: Int, name: String) -> Unit,
) {
    val bots = (state.offlineSeats - 1).coerceAtLeast(1)
    LobbySplitCard(imageRes = LobbyIllustrations.offline, imageAlt = "You versus a bot") {
        if (!state.signedIn) {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                PokrLabel("Display name")
                LobbyTextField(value = state.name, onValueChange = viewModel::onNameChange)
            }
        }
        ChoiceRow(
            label = "Table size",
            selected = state.offlineSeats,
            options = (2..9).toList(),
            onSelect = viewModel::onOfflineSeatsChange,
        )
        FieldHelp(
            if (state.offlineSeats == 2) {
                "Heads-up — you vs 1 bot"
            } else {
                "${state.offlineSeats}-handed · you + $bots bots"
            },
        )
        PokrPrimaryButton(
            text = if (state.offlineSeats == 2) "Start heads-up" else "Start ${state.offlineSeats}-handed",
            onClick = { viewModel.offline(onOffline) },
            modifier = Modifier.fillMaxWidth(),
        )
        FieldHelp("Opens instantly · progress stays on this device")
    }
}
