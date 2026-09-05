package com.pokr.android.feature.lobby

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pokr.android.core.designsystem.ChipsStackIcon
import com.pokr.android.core.designsystem.PokrChrome
import com.pokr.android.core.designsystem.PokrColors
import com.pokr.android.core.designsystem.PokrFonts
import com.pokr.android.core.designsystem.PokrGhostButton
import com.pokr.android.core.designsystem.PokrRadius
import com.pokr.android.core.designsystem.TABLE_COLOR_PRESETS
import com.pokr.android.core.designsystem.HudPanel
import com.pokr.android.core.designsystem.LockPortraitOrientation
import com.pokr.android.core.designsystem.PlayerAvatar
import com.pokr.android.core.designsystem.PokerChipShuffle
import com.pokr.android.core.designsystem.PokrPalette
import com.pokr.android.core.designsystem.WhuffieIcon
import com.pokr.android.core.designsystem.formatChips
import com.pokr.android.core.designsystem.pokrPageGround
import com.pokr.android.core.model.ContestView
import com.pokr.android.core.model.MeProfile
import com.pokr.android.feature.progress.HandsScreen

@Composable
fun ProfileScreen(
    onBack: () -> Unit,
    onSignedOut: () -> Unit,
    onContest: (contestId: String) -> Unit,
    onPlay: () -> Unit,
    onOpenTable: (tableId: String, invite: String) -> Unit = { _, _ -> },
    onOpenLudo: (ludoId: String, invite: String) -> Unit = { _, _ -> },
    modifier: Modifier = Modifier,
    viewModel: ProfileViewModel = hiltViewModel(),
    friendsViewModel: FriendsViewModel = hiltViewModel(),
) {
    LockPortraitOrientation()
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val friendsState by friendsViewModel.uiState.collectAsStateWithLifecycle()

    Column(
        modifier = modifier
            .fillMaxSize()
            .pokrPageGround()
            .statusBarsPadding()
            .navigationBarsPadding(),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PokrGhostButton(text = "← Lobby", onClick = onBack)
            Text(
                "Profile",
                color = PokrColors.Sidebar,
                fontFamily = PokrFonts.Display,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 18.sp,
            )
            Box(Modifier.size(72.dp))
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            listOf("overview", "hands", "theme", "contests", "friends").forEach { tab ->
                ProfileTabChip(
                    text = tab.replaceFirstChar { it.uppercase() },
                    selected = state.tab == tab,
                    onClick = { viewModel.onTabChange(tab) },
                )
            }
        }

        Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
            when {
                state.loading && state.profile == null -> {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        PokerChipShuffle(size = 48.dp)
                    }
                }
                state.tab == "hands" -> {
                    HandsScreen(
                        onBack = onBack,
                        onPlay = onPlay,
                        embedded = true,
                    )
                }
                state.tab == "friends" -> {
                    FriendsContent(
                        state = friendsState,
                        viewModel = friendsViewModel,
                        onOpenTable = onOpenTable,
                        onOpenContest = onContest,
                        onOpenLudo = onOpenLudo,
                    )
                }
                else -> {
                    LobbyScrollColumn {
                        state.error?.let { FieldHelp(it) }
                        when (state.tab) {
                            "theme" -> ThemePane(
                                selectedColor = state.profile?.tableColorId ?: 0,
                                selectedLook = state.profile?.uiTheme ?: "v1",
                                selectedLayout = state.profile?.tableLayout ?: "v1",
                                sfxMuted = state.profile?.sfxMuted == true,
                                saving = state.saving,
                                onSelectColor = viewModel::saveTableColor,
                                onSelectLook = viewModel::saveUiTheme,
                                onSelectLayout = viewModel::saveTableLayout,
                                onSelectSfxMuted = viewModel::saveSfxMuted,
                            )
                            "contests" -> ContestsPane(
                                contests = state.contests,
                                onOpen = onContest,
                            )
                            else -> state.profile?.let { OverviewPane(it) }
                        }
                        PokrGhostButton(
                            text = "Sign out",
                            onClick = { viewModel.signOut(onSignedOut) },
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ProfileTabChip(
    text: String,
    selected: Boolean,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(PokrRadius.Md)
    Text(
        text = text,
        modifier = Modifier
            .clip(shape)
            .background(
                if (selected) PokrColors.Sidebar.copy(alpha = 0.1f)
                else PokrColors.Mushroom.copy(alpha = 0.5f),
            )
            .border(
                width = if (selected) 2.dp else 1.dp,
                color = if (selected) PokrColors.Sidebar else PokrColors.Sidebar.copy(alpha = 0.14f),
                shape = shape,
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 8.dp),
        color = if (selected) PokrColors.Sidebar else PokrColors.InkStrong.copy(alpha = 0.85f),
        fontFamily = PokrFonts.Display,
        fontWeight = if (selected) FontWeight.Bold else FontWeight.SemiBold,
        fontSize = 13.sp,
    )
}

@Composable
private fun OverviewPane(profile: MeProfile) {
    HudPanel(modifier = Modifier.fillMaxWidth(), chrome = PokrChrome.Lobby) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier.fillMaxWidth(),
        ) {
            PlayerAvatar(
                avatarId = profile.avatarId,
                avatarUrl = profile.avatarUrl,
                userId = profile.id,
                size = 88.dp,
            )
            Text(
                profile.name.ifBlank { profile.username },
                color = PokrColors.Sidebar,
                fontFamily = PokrFonts.Display,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 24.sp,
            )
            if (profile.username.isNotBlank()) {
                Text("@${profile.username}", color = PokrColors.InkStrongMuted, fontSize = 14.sp)
            }
            Row(
                horizontalArrangement = Arrangement.spacedBy(28.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    ChipsStackIcon(height = 22.dp)
                    Text(
                        formatChips(profile.chipBalance),
                        color = PokrColors.Sidebar,
                        fontFamily = PokrFonts.Display,
                        fontWeight = FontWeight.Bold,
                        fontSize = 20.sp,
                    )
                }
                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        formatChips(profile.whuffieBalance),
                        color = PokrColors.Sidebar,
                        fontFamily = PokrFonts.Display,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 18.sp,
                    )
                    WhuffieIcon(height = 16.dp)
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(28.dp)) {
                BalanceChip("Hands", profile.handsPlayed)
                BalanceChip("Friends", profile.friendCount)
            }
        }
    }
}

@Composable
private fun BalanceChip(label: String, value: Int) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            value.toString(),
            color = PokrColors.Sidebar,
            fontFamily = PokrFonts.Display,
            fontWeight = FontWeight.Bold,
            fontSize = 18.sp,
        )
        Text(label, color = PokrColors.InkStrongMuted, fontSize = 12.sp)
    }
}

@Composable
private fun ThemePane(
    selectedColor: Int,
    selectedLook: String,
    selectedLayout: String,
    sfxMuted: Boolean,
    saving: Boolean,
    onSelectColor: (Int) -> Unit,
    onSelectLook: (String) -> Unit,
    onSelectLayout: (String) -> Unit,
    onSelectSfxMuted: (Boolean) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        HudPanel(modifier = Modifier.fillMaxWidth(), chrome = PokrChrome.Lobby) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    "App look",
                    color = PokrColors.Sidebar,
                    fontFamily = PokrFonts.Display,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                )
                FieldHelp("Classic or Arcade. Only you see this. Gameplay stays the same.")
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    LookCard(
                        title = "Classic",
                        hint = "Purple / mushroom",
                        selected = selectedLook != "v2",
                        enabled = !saving,
                        swatch = PokrPalette.Classic.mushroom,
                        accent = PokrPalette.Classic.sidebar,
                        arcadeFrame = false,
                        onClick = { onSelectLook("v1") },
                        modifier = Modifier.weight(1f),
                    )
                    LookCard(
                        title = "Arcade",
                        hint = "Go Old School",
                        selected = selectedLook == "v2",
                        enabled = !saving,
                        swatch = PokrPalette.Arcade.mushroom,
                        accent = PokrPalette.Arcade.sidebar,
                        arcadeFrame = true,
                        onClick = { onSelectLook("v2") },
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }
        HudPanel(modifier = Modifier.fillMaxWidth(), chrome = PokrChrome.Lobby) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    "Table layout",
                    color = PokrColors.Sidebar,
                    fontFamily = PokrFonts.Display,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                )
                FieldHelp("Classic oval or stacked HUD. Stacked applies on web portrait. Only you see this.")
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    LookCard(
                        title = "Classic",
                        hint = "Oval table",
                        selected = selectedLayout != "v2",
                        enabled = !saving,
                        swatch = PokrColors.Mushroom,
                        accent = PokrColors.Sidebar,
                        arcadeFrame = false,
                        onClick = { onSelectLayout("v1") },
                        modifier = Modifier.weight(1f),
                    )
                    LookCard(
                        title = "Table v2",
                        hint = "Stacked HUD",
                        selected = selectedLayout == "v2",
                        enabled = !saving,
                        swatch = PokrColors.Sidebar,
                        accent = PokrColors.Mushroom,
                        arcadeFrame = false,
                        onClick = { onSelectLayout("v2") },
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }
        HudPanel(modifier = Modifier.fillMaxWidth(), chrome = PokrChrome.Lobby) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    "Table sounds",
                    color = PokrColors.Sidebar,
                    fontFamily = PokrFonts.Display,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                )
                FieldHelp("Mute deal, action, and win audio. Only you hear this.")
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    LookCard(
                        title = "On",
                        hint = "Play table audio",
                        selected = !sfxMuted,
                        enabled = !saving,
                        swatch = PokrColors.Mushroom,
                        accent = PokrColors.Sidebar,
                        arcadeFrame = false,
                        onClick = { onSelectSfxMuted(false) },
                        modifier = Modifier.weight(1f),
                    )
                    LookCard(
                        title = "Muted",
                        hint = "Silence table audio",
                        selected = sfxMuted,
                        enabled = !saving,
                        swatch = PokrColors.InkStrongMuted,
                        accent = PokrColors.Sidebar,
                        arcadeFrame = false,
                        onClick = { onSelectSfxMuted(true) },
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }
        HudPanel(modifier = Modifier.fillMaxWidth(), chrome = PokrChrome.Lobby) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    "Table color",
                    color = PokrColors.Sidebar,
                    fontFamily = PokrFonts.Display,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                )
                FieldHelp("Table theme for your tables. Saved to your account.")
                TABLE_COLOR_PRESETS.chunked(3).forEach { row ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        row.forEach { preset ->
                            Column(
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(PokrRadius.Md))
                                    .clickable(enabled = !saving) { onSelectColor(preset.id) }
                                    .border(
                                        if (preset.id == selectedColor) 2.dp else 1.dp,
                                        if (preset.id == selectedColor) PokrColors.Sidebar else PokrColors.Sidebar.copy(alpha = 0.14f),
                                        RoundedCornerShape(PokrRadius.Md),
                                    )
                                    .padding(10.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(8.dp),
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(36.dp)
                                        .clip(CircleShape)
                                        .background(preset.swatch),
                                )
                                Text(
                                    preset.label,
                                    color = PokrColors.Sidebar,
                                    fontSize = 11.sp,
                                    fontWeight = if (preset.id == selectedColor) FontWeight.Bold else FontWeight.Medium,
                                )
                            }
                        }
                        repeat(3 - row.size) {
                            Box(Modifier.weight(1f))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun LookCard(
    title: String,
    hint: String,
    selected: Boolean,
    enabled: Boolean,
    swatch: Color,
    accent: Color,
    arcadeFrame: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(PokrRadius.Lg))
            .clickable(enabled = enabled, onClick = onClick)
            .border(
                if (selected) 2.dp else 1.dp,
                if (selected) PokrColors.Sidebar else PokrColors.Sidebar.copy(alpha = 0.14f),
                RoundedCornerShape(PokrRadius.Lg),
            ),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp)
                .background(swatch)
                .then(if (arcadeFrame) Modifier.border(2.dp, Color.Black) else Modifier),
        ) {
            Box(
                modifier = Modifier
                    .padding(10.dp)
                    .size(width = 40.dp, height = 22.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(accent)
                    .then(
                        if (arcadeFrame) Modifier.border(2.dp, Color.Black, RoundedCornerShape(6.dp))
                        else Modifier,
                    ),
            )
        }
        Column(modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp)) {
            Text(title, color = PokrColors.Sidebar, fontWeight = FontWeight.Bold, fontSize = 14.sp)
            Text(hint, color = PokrColors.InkStrongMuted, fontSize = 11.sp)
        }
    }
}

@Composable
private fun ContestsPane(
    contests: List<ContestView>,
    onOpen: (String) -> Unit,
) {
    HudPanel(modifier = Modifier.fillMaxWidth(), chrome = PokrChrome.Lobby) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(
                "Your contests",
                color = PokrColors.Sidebar,
                fontFamily = PokrFonts.Display,
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp,
            )
            if (contests.isEmpty()) {
                FieldHelp("Contests you host or enter will show up here.")
            } else {
                contests.forEach { contest ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(modifier = Modifier.weight(1f).padding(end = 8.dp)) {
                            Text(contest.name, color = PokrColors.Sidebar, fontWeight = FontWeight.Bold)
                            Text(
                                "${if (contest.mode == "rounds") "Rounds" else "Knockout"} · ${contest.status}",
                                color = PokrColors.InkStrongMuted,
                                fontSize = 12.sp,
                            )
                        }
                        PokrGhostButton(text = "Open", onClick = { onOpen(contest.id) })
                    }
                }
            }
        }
    }
}
