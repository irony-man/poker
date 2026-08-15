package com.pokr.android.core.designsystem

import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ColorMatrix
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage

const val AVATAR_PRESET_COUNT = 8

fun avatarIdFromUserId(userId: String?): Int {
    if (userId.isNullOrBlank()) return 0
    var h = -2128831035 // FNV offset basis as signed Int
    for (ch in userId) {
        h = h xor ch.code
        h *= 16777619
    }
    return (h ushr 1) % AVATAR_PRESET_COUNT
}

fun resolveAvatarId(userId: String?, preferred: Int?): Int {
    if (preferred != null && preferred in 0 until AVATAR_PRESET_COUNT) return preferred
    return avatarIdFromUserId(userId)
}

private fun avatarDrawable(id: Int): Int = when (id.coerceIn(0, AVATAR_PRESET_COUNT - 1)) {
    0 -> R.drawable.avatar_0
    1 -> R.drawable.avatar_1
    2 -> R.drawable.avatar_2
    3 -> R.drawable.avatar_3
    4 -> R.drawable.avatar_4
    5 -> R.drawable.avatar_5
    6 -> R.drawable.avatar_6
    else -> R.drawable.avatar_7
}

@Composable
fun PlayerAvatar(
    avatarId: Int? = null,
    avatarUrl: String? = null,
    userId: String? = null,
    size: Dp = 44.dp,
    modifier: Modifier = Modifier,
    selected: Boolean = false,
    muted: Boolean = false,
) {
    val url = avatarUrl?.takeIf { it.isNotBlank() }
    val borderMod = if (selected) Modifier.border(2.dp, PokrColors.Sidebar, CircleShape) else Modifier
    val gray = remember(muted) {
        if (muted) ColorFilter.colorMatrix(ColorMatrix().apply { setToSaturation(0.65f) }) else null
    }
    Box(
        modifier = modifier
            .size(size)
            .clip(CircleShape)
            .then(borderMod)
            .then(if (muted) Modifier.graphicsLayer { alpha = 0.55f } else Modifier),
    ) {
        if (url != null) {
            AsyncImage(
                model = url,
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop,
                colorFilter = gray,
            )
        } else {
            val id = resolveAvatarId(userId, avatarId)
            AsyncImage(
                model = avatarDrawable(id),
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop,
                colorFilter = gray,
            )
        }
    }
}

@Composable
fun AvatarPicker(
    value: Int,
    onChange: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        PokrLabel("Profile picture")
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            for (rowStart in 0 until AVATAR_PRESET_COUNT step 4) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    for (id in rowStart until minOf(rowStart + 4, AVATAR_PRESET_COUNT)) {
                        PlayerAvatar(
                            avatarId = id,
                            size = 40.dp,
                            selected = value == id,
                            modifier = Modifier
                                .clickable { onChange(id) }
                                .padding(1.dp),
                        )
                    }
                }
            }
        }
    }
}
