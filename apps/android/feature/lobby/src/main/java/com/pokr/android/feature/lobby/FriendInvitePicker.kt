package com.pokr.android.feature.lobby

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pokr.android.core.designsystem.PokrColors
import com.pokr.android.core.designsystem.PokrGhostButton
import com.pokr.android.core.designsystem.PokrLabel
import com.pokr.android.core.designsystem.PokrRadius
import com.pokr.android.core.designsystem.PlayerAvatar
import com.pokr.android.core.model.FriendGroupView
import com.pokr.android.core.model.FriendProfile

@Composable
fun FriendInvitePicker(
    friends: List<FriendProfile>,
    groups: List<FriendGroupView>,
    selectedIds: List<String>,
    onChange: (List<String>) -> Unit,
    modifier: Modifier = Modifier,
    title: String = "Invite friends",
    help: String = "Selected friends get a notification to join. Optional — you can also share the code.",
    maxSelect: Int = 8,
    excludeUserIds: Set<String> = emptySet(),
    disabled: Boolean = false,
) {
    var onlineOnly by remember { mutableStateOf(false) }
    val selected = selectedIds.toSet()
    val visible = remember(friends, excludeUserIds, onlineOnly) {
        friends
            .filter { it.userId !in excludeUserIds }
            .filter { !onlineOnly || it.online }
            .sortedWith(compareByDescending<FriendProfile> { it.online }.thenBy { it.name })
    }
    val onlineFriends = friends.filter { it.userId !in excludeUserIds && it.online }

    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        PokrLabel(title)
        FieldHelp(help)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            PokrGhostButton(
                text = if (onlineOnly) "All friends" else "Online only${if (onlineFriends.isNotEmpty()) " · ${onlineFriends.size}" else ""}",
                onClick = { onlineOnly = !onlineOnly },
                enabled = !disabled,
            )
            if (onlineFriends.isNotEmpty()) {
                PokrGhostButton(
                    text = "Select online",
                    onClick = {
                        val next = selectedIds.toMutableSet()
                        for (f in onlineFriends) {
                            if (next.size >= maxSelect) break
                            next.add(f.userId)
                        }
                        onChange(next.toList())
                    },
                    enabled = !disabled && selectedIds.size < maxSelect,
                )
            }
        }
        if (groups.isNotEmpty() && !onlineOnly) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                groups.forEach { group ->
                    PokrGhostButton(
                        text = group.name,
                        onClick = {
                            val memberIds = group.members
                                .map { it.userId }
                                .filter { id -> friends.any { it.userId == id } && id !in excludeUserIds }
                            val next = selectedIds.toMutableSet()
                            for (id in memberIds) {
                                if (next.size >= maxSelect) break
                                next.add(id)
                            }
                            onChange(next.toList())
                        },
                        enabled = !disabled,
                    )
                }
            }
        }
        if (visible.isEmpty()) {
            FieldHelp(
                when {
                    friends.isEmpty() -> "No friends yet. Add people from Friends, then invite them here."
                    onlineOnly -> "No online friends right now."
                    else -> "Everyone on your list already joined."
                },
            )
        } else {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 220.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                visible.forEach { friend ->
                    val on = friend.userId in selected
                    val atCap = !on && selectedIds.size >= maxSelect
                    FriendToggleRow(
                        friend = friend,
                        selected = on,
                        enabled = !disabled && !atCap,
                        onToggle = {
                            val next = selectedIds.toMutableList()
                            if (on) next.remove(friend.userId)
                            else if (next.size < maxSelect) next.add(friend.userId)
                            onChange(next)
                        },
                    )
                }
            }
        }
    }
}

@Composable
fun FriendToggleRow(
    friend: FriendProfile,
    selected: Boolean,
    onToggle: () -> Unit,
    enabled: Boolean = true,
    showOnline: Boolean = true,
) {
    val shape = RoundedCornerShape(PokrRadius.Md)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(
                if (selected) PokrColors.Sidebar.copy(alpha = 0.1f)
                else PokrColors.Mushroom.copy(alpha = 0.5f),
            )
            .border(
                1.dp,
                if (selected) PokrColors.Sidebar else PokrColors.Sidebar.copy(alpha = 0.12f),
                shape,
            )
            .clickable(enabled = enabled, onClick = onToggle)
            .padding(horizontal = 10.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PlayerAvatar(
            avatarId = friend.avatarId,
            avatarUrl = friend.avatarUrl,
            userId = friend.userId,
            size = 32.dp,
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(friend.name, color = PokrColors.Sidebar, fontWeight = FontWeight.Bold, fontSize = 14.sp)
            if (showOnline) {
                Text(
                    if (friend.online) "Online" else "Offline",
                    color = if (friend.online) PokrColors.Positive else PokrColors.InkStrongMuted,
                    fontSize = 11.sp,
                )
            }
        }
        Text(
            if (selected) "On" else "Off",
            color = if (selected) PokrColors.Sidebar else PokrColors.InkStrongMuted,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
        )
    }
}
