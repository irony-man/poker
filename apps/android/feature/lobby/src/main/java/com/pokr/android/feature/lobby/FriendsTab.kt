package com.pokr.android.feature.lobby

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pokr.android.core.designsystem.PokrChrome
import com.pokr.android.core.designsystem.PokrColors
import com.pokr.android.core.designsystem.PokrGhostButton
import com.pokr.android.core.designsystem.PokrLabel
import com.pokr.android.core.designsystem.PokrPrimaryButton
import com.pokr.android.core.designsystem.HudPanel
import com.pokr.android.core.designsystem.PlayerAvatar
import com.pokr.android.core.designsystem.PokerChipShuffle
import com.pokr.android.core.designsystem.StatusChip
import com.pokr.android.core.model.FriendGroupView
import com.pokr.android.core.model.FriendProfile
import com.pokr.android.core.model.FriendSearchUser
import com.pokr.android.core.model.PendingChallenge
import com.pokr.android.core.model.PendingRequestView

@Composable
fun FriendsTab(
    onOpenTable: (tableId: String, invite: String) -> Unit,
    onOpenContest: (contestId: String) -> Unit = {},
    viewModel: FriendsViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    FriendsContent(
        state = state,
        viewModel = viewModel,
        onOpenTable = onOpenTable,
        onOpenContest = onOpenContest,
    )
}

@Composable
fun FriendsContent(
    state: FriendsUiState,
    viewModel: FriendsViewModel,
    onOpenTable: (tableId: String, invite: String) -> Unit,
    onOpenContest: (contestId: String) -> Unit = {},
) {
    LobbyScrollColumn {
        LobbyPageHeader(
            title = "Community and Social",
            subtitle = "Find people by username, build groups for the tables you play together, invite a group to sit down, or challenge a friend to heads-up.",
        )
        HudPanel(modifier = Modifier.fillMaxWidth(), chrome = PokrChrome.Lobby) {
            Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    PokrLabel("Find a username")
                    LobbyTextField(
                        value = state.query,
                        onValueChange = viewModel::onQueryChange,
                        placeholder = "Search players",
                    )
                }
                if (state.searching) {
                    PokerChipShuffle(size = 32.dp)
                }
                state.results.forEach { user ->
                    SearchRow(user = user, onAdd = { viewModel.sendRequest(user.userId) })
                }
                SegmentedChoice(
                    selected = state.pane,
                    options = listOf("friends", "groups"),
                    onSelect = viewModel::onPaneChange,
                    style = ChoiceStyle.Segmented,
                ) { if (it == "groups") "Groups" else "Friends" }
                state.error?.let { err ->
                    StatusChip(text = err, accent = PokrColors.Danger, chrome = PokrChrome.Play)
                }
                if (state.loading) {
                    PokerChipShuffle(size = 40.dp)
                } else if (state.pane == "groups") {
                    GroupsPane(
                        state = state,
                        viewModel = viewModel,
                        onOpenTable = onOpenTable,
                    )
                } else {
                    if (state.pendingChallenges.isNotEmpty()) {
                        PokrLabel("Challenges")
                        state.pendingChallenges.forEach { challenge ->
                            ChallengeRow(
                                challenge = challenge,
                                busy = state.busyKey != null,
                                joining = state.busyKey == "join-${challenge.id}",
                                onJoin = {
                                    viewModel.joinChallenge(
                                        challenge = challenge,
                                        onTable = onOpenTable,
                                        onContest = onOpenContest,
                                    )
                                },
                                onDecline = { viewModel.declineChallenge(challenge.id) },
                            )
                        }
                    }
                    if (state.incoming.isNotEmpty()) {
                        PokrLabel("Requests")
                        state.incoming.forEach { req ->
                            IncomingRow(
                                request = req,
                                onAccept = { viewModel.respond(req.id, true) },
                                onDecline = { viewModel.respond(req.id, false) },
                            )
                        }
                    }
                    if (state.friends.isEmpty()) {
                        FieldHelp("No friends yet. Search a username to send a request.")
                    } else {
                        state.friends.forEach { friend ->
                            FriendRow(
                                friend = friend,
                                busy = state.busyKey == "challenge-${friend.userId}",
                                enabled = state.busyKey == null,
                                onChallenge = {
                                    viewModel.challenge(friend.userId, onOpenTable)
                                },
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SearchRow(user: FriendSearchUser, onAdd: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PlayerAvatar(avatarId = user.avatarId, avatarUrl = user.avatarUrl, userId = user.userId, size = 36.dp)
        Column(modifier = Modifier.weight(1f)) {
            Text(user.name, color = PokrColors.Sidebar, fontWeight = FontWeight.Bold, fontSize = 15.sp)
            if (user.username.isNotBlank()) {
                Text("@${user.username}", color = PokrColors.InkStrongMuted, fontSize = 12.sp)
            }
        }
        PokrGhostButton(text = "Add", onClick = onAdd)
    }
}

@Composable
private fun FriendRow(
    friend: FriendProfile,
    busy: Boolean,
    enabled: Boolean,
    onChallenge: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PlayerAvatar(avatarId = friend.avatarId, avatarUrl = friend.avatarUrl, userId = friend.userId, size = 36.dp)
        Column(modifier = Modifier.weight(1f)) {
            Text(friend.name, color = PokrColors.Sidebar, fontWeight = FontWeight.Bold, fontSize = 15.sp)
            Text(
                if (friend.online) "Online" else "Offline",
                color = if (friend.online) PokrColors.Positive else PokrColors.InkStrongMuted,
                fontSize = 12.sp,
            )
        }
        PokrPrimaryButton(
            text = if (busy) "…" else "Challenge",
            onClick = onChallenge,
            enabled = enabled && !busy,
        )
    }
}

@Composable
private fun ChallengeRow(
    challenge: PendingChallenge,
    busy: Boolean,
    joining: Boolean,
    onJoin: () -> Unit,
    onDecline: () -> Unit,
) {
    val isContest = challenge.kind == "contest" || !challenge.contestId.isNullOrBlank()
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PlayerAvatar(
            avatarId = challenge.challenger.avatarId,
            avatarUrl = challenge.challenger.avatarUrl,
            userId = challenge.challenger.userId,
            size = 36.dp,
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                challenge.challenger.name,
                color = PokrColors.Sidebar,
                fontWeight = FontWeight.Bold,
                fontSize = 15.sp,
            )
            Text(
                if (isContest) "Contest challenge" else "Heads-up challenge",
                color = PokrColors.InkStrongMuted,
                fontSize = 12.sp,
            )
        }
        PokrPrimaryButton(
            text = if (joining) "…" else "Join",
            onClick = onJoin,
            enabled = !busy,
        )
        PokrGhostButton(
            text = "Decline",
            onClick = onDecline,
            enabled = !busy,
        )
    }
}

@Composable
private fun IncomingRow(
    request: PendingRequestView,
    onAccept: () -> Unit,
    onDecline: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PlayerAvatar(
            avatarId = request.from.avatarId,
            avatarUrl = request.from.avatarUrl,
            userId = request.from.userId,
            size = 36.dp,
        )
        Text(
            request.from.name,
            color = PokrColors.Sidebar,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.weight(1f),
        )
        PokrGhostButton(text = "Accept", onClick = onAccept)
        PokrGhostButton(text = "Decline", onClick = onDecline)
    }
}

@Composable
private fun GroupsPane(
    state: FriendsUiState,
    viewModel: FriendsViewModel,
    onOpenTable: (tableId: String, invite: String) -> Unit,
) {
    val busy = state.busyKey != null
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PokrLabel("Groups")
        if (state.friends.isNotEmpty()) {
            PokrGhostButton(
                text = if (state.showCreateGroup) "Cancel" else "New group",
                onClick = viewModel::toggleCreateGroup,
                enabled = !busy,
            )
        }
    }
    if (state.showCreateGroup) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            PokrLabel("Name")
            LobbyTextField(
                value = state.newGroupName,
                onValueChange = viewModel::onNewGroupName,
                placeholder = "e.g. Friday night",
            )
            PokrLabel("Friends to include · ${state.createMemberIds.size}/8")
            state.friends.forEach { friend ->
                FriendToggleRow(
                    friend = friend,
                    selected = friend.userId in state.createMemberIds,
                    onToggle = { viewModel.toggleCreateMember(friend.userId) },
                    enabled = !busy,
                )
            }
            PokrPrimaryButton(
                text = if (state.busyKey == "create-group") "Creating…" else "Create group",
                onClick = viewModel::createGroup,
                enabled = !busy && state.newGroupName.isNotBlank(),
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
    if (state.groups.isEmpty() && !state.showCreateGroup) {
        FieldHelp("Make a crew of friends, then start a private table for everyone in one tap.")
        if (state.friends.isNotEmpty()) {
            PokrPrimaryButton(
                text = "Create your first group",
                onClick = viewModel::toggleCreateGroup,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    } else {
        state.groups.forEach { group ->
            GroupCard(
                group = group,
                state = state,
                viewModel = viewModel,
                onOpenTable = onOpenTable,
            )
        }
    }
}

@Composable
private fun GroupCard(
    group: FriendGroupView,
    state: FriendsUiState,
    viewModel: FriendsViewModel,
    onOpenTable: (tableId: String, invite: String) -> Unit,
) {
    val busy = state.busyKey != null
    val friendIds = state.friends.map { it.userId }.toSet()
    val playable = group.members.filter { it.userId != state.userId && it.userId in friendIds }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(group.name, color = PokrColors.Sidebar, fontWeight = FontWeight.Bold, fontSize = 15.sp)
        Text(
            "${group.members.size} member${if (group.members.size == 1) "" else "s"}${if (group.isOwner) "" else " · shared with you"}",
            color = PokrColors.InkStrongMuted,
            fontSize = 12.sp,
        )
        if (state.editingGroupId == group.id) {
            PokrLabel("Friends · ${state.editMemberIds.size}/8")
            state.friends.forEach { friend ->
                FriendToggleRow(
                    friend = friend,
                    selected = friend.userId in state.editMemberIds,
                    onToggle = { viewModel.toggleEditMember(friend.userId) },
                    enabled = !busy,
                )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                PokrGhostButton(text = "Cancel", onClick = viewModel::closeEditor, enabled = !busy)
                PokrPrimaryButton(
                    text = if (state.busyKey == "edit-${group.id}") "Saving…" else "Save",
                    onClick = { viewModel.saveMembers(group.id) },
                    enabled = !busy,
                )
            }
        } else {
            PokrPrimaryButton(
                text = if (state.busyKey == "invite-${group.id}") "Opening…" else "Invite to table",
                onClick = { viewModel.inviteGroup(group.id, onOpenTable) },
                enabled = !busy && playable.isNotEmpty(),
                modifier = Modifier.fillMaxWidth(),
            )
            if (group.isOwner) {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    if (state.friends.isNotEmpty()) {
                        PokrGhostButton(
                            text = "Manage",
                            onClick = { viewModel.openManage(group) },
                            enabled = !busy,
                        )
                    }
                    if (state.confirmDeleteId == group.id) {
                        PokrGhostButton(text = "Yes, delete", onClick = { viewModel.deleteGroup(group.id) }, enabled = !busy)
                        PokrGhostButton(text = "Keep", onClick = viewModel::cancelDelete)
                    } else {
                        PokrGhostButton(text = "Delete", onClick = { viewModel.confirmDelete(group.id) }, enabled = !busy)
                    }
                }
            }
        }
    }
}
