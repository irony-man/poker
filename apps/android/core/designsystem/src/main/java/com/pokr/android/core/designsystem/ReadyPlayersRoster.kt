package com.pokr.android.core.designsystem

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

data class ReadyRosterPlayer(
    val seat: Int,
    val name: String,
    val userId: String? = null,
    val avatarId: Int? = null,
    val avatarUrl: String? = null,
    val ready: Boolean,
    val isSelf: Boolean = false,
    val sittingOut: Boolean = false,
)

@Composable
fun ReadyPlayersRoster(
    players: List<ReadyRosterPlayer>,
    heading: String,
    readyCount: Int,
    readyTotal: Int,
    modifier: Modifier = Modifier,
) {
    if (players.isEmpty()) return
    val shape = RoundedCornerShape(PokrRadius.Md)
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(shape)
            .background(PokrColors.Mushroom.copy(alpha = 0.4f))
            .border(1.dp, PokrColors.Sidebar.copy(alpha = 0.1f), shape)
            .padding(horizontal = 10.dp, vertical = 8.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = heading.uppercase(),
                color = PokrColors.Sidebar.copy(alpha = 0.7f),
                fontFamily = PokrFonts.Display,
                fontWeight = FontWeight.Bold,
                fontSize = 9.sp,
                letterSpacing = 1.2.sp,
            )
            Text(
                text = "$readyCount/$readyTotal",
                color = PokrColors.Sidebar.copy(alpha = 0.65f),
                fontFamily = PokrFonts.Display,
                fontWeight = FontWeight.SemiBold,
                fontSize = 9.sp,
            )
        }
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 8.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.Bottom,
        ) {
            players.forEach { player ->
                ReadyRosterSeat(player = player, modifier = Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun ReadyRosterSeat(
    player: ReadyRosterPlayer,
    modifier: Modifier = Modifier,
) {
    val isReady = player.ready && !player.sittingOut
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Box(contentAlignment = Alignment.BottomEnd) {
            Box(
                modifier = Modifier
                    .padding(2.dp)
                    .then(
                        if (isReady) {
                            Modifier
                                .shadow(4.dp, CircleShape)
                                .border(2.dp, PokrColors.Sidebar, CircleShape)
                        } else {
                            Modifier.border(2.dp, PokrColors.Sidebar.copy(alpha = 0.1f), CircleShape)
                        },
                    )
                    .padding(2.dp),
            ) {
                PlayerAvatar(
                    avatarId = player.avatarId,
                    avatarUrl = player.avatarUrl,
                    userId = player.userId,
                    size = 36.dp,
                    muted = !isReady,
                )
            }
            Box(
                modifier = Modifier
                    .offset(x = 1.dp, y = 1.dp)
                    .size(14.dp)
                    .clip(CircleShape)
                    .background(
                        when {
                            isReady -> PokrColors.Sidebar
                            player.sittingOut -> PokrColors.BrassLight
                            else -> PokrColors.Mushroom
                        },
                    )
                    .border(2.dp, PokrColors.White, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                if (isReady) {
                    Text(
                        text = "✓",
                        color = PokrColors.Mushroom,
                        fontSize = 8.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
        }
        Text(
            text = if (player.isSelf) "You" else player.name,
            color = PokrColors.InkStrong,
            fontSize = 9.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}
