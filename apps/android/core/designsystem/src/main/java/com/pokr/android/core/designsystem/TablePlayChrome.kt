package com.pokr.android.core.designsystem

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

val TABLE_QUICK_EMOJIS = listOf(
    "🔥", "😂", "👏", "😮", "💀", "😎", "👀", "🤙", "🤠", "🃏",
    "👍", "👎", "❤️", "💯", "🎉", "😤", "😭", "💪", "🙏", "🏆",
)

val TABLE_MORE_EMOJIS = listOf(
    "🙌", "🤝", "🤣", "😅", "😏", "😬", "😱", "😈", "👻",
    "💰", "💵", "💸", "♠️", "♥️", "♦️", "♣️", "🎲", "⚡", "💥", "✨",
    "🫡", "🫠", "🥴", "🤔", "☠️",
)

enum class TableOverflowTone { Default, Danger, Accent, Gold }

data class TableOverflowItem(
    val id: String,
    val label: String,
    val onClick: () -> Unit,
    val tone: TableOverflowTone = TableOverflowTone.Default,
    val enabled: Boolean = true,
)

@Composable
fun PlayChromeIconButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    contentDescription: String? = null,
) {
    val shape = RoundedCornerShape(PokrRadius.Md)
    Box(
        modifier = modifier
            .size(36.dp)
            .clip(shape)
            .background(PokrColors.White)
            .border(1.dp, PokrColors.Sidebar.copy(alpha = 0.15f), shape)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = label,
            color = PokrColors.Sidebar,
            fontFamily = PokrFonts.Display,
            fontWeight = FontWeight.Bold,
            fontSize = 14.sp,
        )
    }
}

@Composable
fun PlayChromeStatusPill(
    text: String,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(PokrRadius.Md)
    Text(
        text = text.uppercase(),
        color = PokrColors.Sidebar.copy(alpha = 0.7f),
        fontFamily = PokrFonts.Display,
        fontWeight = FontWeight.SemiBold,
        fontSize = 10.sp,
        letterSpacing = 0.8.sp,
        modifier = modifier
            .clip(shape)
            .background(PokrColors.White)
            .border(1.dp, PokrColors.Sidebar.copy(alpha = 0.15f), shape)
            .padding(horizontal = 10.dp, vertical = 8.dp),
    )
}

@Composable
fun TablePlayHeader(
    overflowItems: List<TableOverflowItem>,
    modifier: Modifier = Modifier,
    statusPill: String? = null,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PurpleLogo(height = 28.dp)
            if (!statusPill.isNullOrBlank()) {
                PlayChromeStatusPill(text = statusPill)
            }
        }
        Row(
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            HowToPlayHelp()
            TableOverflowMenu(items = overflowItems)
        }
    }
}

@Composable
fun TableOverflowMenu(
    items: List<TableOverflowItem>,
    modifier: Modifier = Modifier,
) {
    var open by remember { mutableStateOf(false) }
    val primary = items.filter { it.tone != TableOverflowTone.Danger }
    val destructive = items.filter { it.tone == TableOverflowTone.Danger }
    Box(modifier = modifier) {
        PlayChromeIconButton(
            label = "⋯",
            contentDescription = "More",
            onClick = { open = true },
        )
        DropdownMenu(
            expanded = open,
            onDismissRequest = { open = false },
            containerColor = PokrColors.White,
            shape = RoundedCornerShape(PokrRadius.Lg),
            shadowElevation = 12.dp,
        ) {
            primary.forEach { item ->
                OverflowRow(item) { open = false }
            }
            if (primary.isNotEmpty() && destructive.isNotEmpty()) {
                HorizontalDivider(color = PokrColors.Sidebar.copy(alpha = 0.1f))
            }
            destructive.forEach { item ->
                OverflowRow(item) { open = false }
            }
        }
    }
}

@Composable
private fun OverflowRow(item: TableOverflowItem, onDone: () -> Unit) {
    val color = when (item.tone) {
        TableOverflowTone.Danger -> PokrColors.Danger
        TableOverflowTone.Gold -> PokrColors.BrassDim
        else -> PokrColors.InkStrong
    }
    Text(
        text = item.label,
        color = color.copy(alpha = if (item.enabled) 1f else 0.4f),
        fontSize = 14.sp,
        fontWeight = if (item.tone == TableOverflowTone.Danger) FontWeight.SemiBold else FontWeight.Medium,
        modifier = Modifier
            .fillMaxWidth()
            .clickable(enabled = item.enabled) {
                item.onClick()
                onDone()
            }
            .padding(horizontal = 14.dp, vertical = 10.dp),
    )
}

@Composable
fun TableEmojiStrip(
    onEmoji: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    var moreOpen by remember { mutableStateOf(false) }
    val moreList = remember { (TABLE_QUICK_EMOJIS + TABLE_MORE_EMOJIS).distinct() }
    val pillShape = RoundedCornerShape(999.dp)
    val panelShape = RoundedCornerShape(PokrRadius.Lg)

    Column(modifier = modifier.fillMaxWidth().padding(horizontal = 6.dp, vertical = 4.dp)) {
        if (moreOpen) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 6.dp)
                    .heightIn(max = 220.dp)
                    .shadow(12.dp, panelShape)
                    .clip(panelShape)
                    .background(PokrColors.White)
                    .border(1.dp, PokrColors.Sidebar.copy(alpha = 0.15f), panelShape),
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = "REACT",
                        color = PokrColors.Sidebar.copy(alpha = 0.7f),
                        fontFamily = PokrFonts.Display,
                        fontWeight = FontWeight.Bold,
                        fontSize = 10.sp,
                        letterSpacing = 1.sp,
                    )
                    Text(
                        text = "Close",
                        color = PokrColors.InkStrongMuted,
                        fontFamily = PokrFonts.Display,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 10.sp,
                        modifier = Modifier.clickable { moreOpen = false },
                    )
                }
                val scroll = rememberScrollState()
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 180.dp)
                        .verticalScroll(scroll)
                        .padding(horizontal = 8.dp, vertical = 4.dp),
                ) {
                    moreList.chunked(6).forEach { row ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceEvenly,
                        ) {
                            row.forEach { emoji ->
                                Box(
                                    modifier = Modifier
                                        .size(44.dp)
                                        .clip(RoundedCornerShape(8.dp))
                                        .clickable {
                                            onEmoji(emoji)
                                            moreOpen = false
                                        },
                                    contentAlignment = Alignment.Center,
                                ) {
                                    Text(text = emoji, fontSize = 22.sp)
                                }
                            }
                            repeat(6 - row.size) {
                                Box(Modifier.size(44.dp))
                            }
                        }
                    }
                }
            }
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(pillShape)
                .background(PokrColors.White.copy(alpha = 0.9f))
                .border(
                    1.dp,
                    PokrColors.Sidebar.copy(alpha = if (moreOpen) 0.3f else 0.15f),
                    pillShape,
                )
                .padding(start = 6.dp, end = 4.dp, top = 4.dp, bottom = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Row(
                modifier = Modifier
                    .weight(1f)
                    .horizontalScroll(rememberScrollState()),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                TABLE_QUICK_EMOJIS.take(10).forEach { emoji ->
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .clickable { onEmoji(emoji) },
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(text = emoji, fontSize = 20.sp)
                    }
                }
            }
            val moreShape = RoundedCornerShape(999.dp)
            Text(
                text = if (moreOpen) "DONE" else "MORE",
                color = if (moreOpen) PokrColors.Mushroom else PokrColors.Sidebar,
                fontFamily = PokrFonts.Display,
                fontWeight = FontWeight.Bold,
                fontSize = 10.sp,
                letterSpacing = 0.8.sp,
                modifier = Modifier
                    .clip(moreShape)
                    .background(if (moreOpen) PokrColors.Sidebar else PokrColors.Sidebar.copy(alpha = 0.08f))
                    .clickable { moreOpen = !moreOpen }
                    .padding(horizontal = 10.dp, vertical = 8.dp),
            )
        }
    }
}
