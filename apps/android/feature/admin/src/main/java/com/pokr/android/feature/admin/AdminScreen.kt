package com.pokr.android.feature.admin

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Checkbox
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pokr.android.core.designsystem.HudPanel
import com.pokr.android.core.designsystem.LockPortraitOrientation
import com.pokr.android.core.designsystem.PokrChrome
import com.pokr.android.core.designsystem.PokrColors
import com.pokr.android.core.designsystem.PokrFonts
import com.pokr.android.core.designsystem.PokrGhostButton
import com.pokr.android.core.designsystem.PokrPrimaryButton
import com.pokr.android.core.designsystem.PokerChipShuffle
import com.pokr.android.core.designsystem.pokrPageGround
import com.pokr.android.core.model.HomeLandingFeature
import com.pokr.android.core.model.SiteEconomy

private val ADMIN_TABS = listOf(
    "overview" to "Overview",
    "users" to "Users",
    "banner" to "Banner",
    "games" to "Games",
    "hands" to "Hands",
    "bots" to "Bots",
    "economy" to "Economy",
    "home" to "Home",
    "pages" to "Pages",
    "sounds" to "Sounds",
)

@Composable
fun AdminScreen(
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: AdminViewModel = hiltViewModel(),
) {
    LockPortraitOrientation()
    val state by viewModel.uiState.collectAsStateWithLifecycle()

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
            PokrGhostButton(text = "← Profile", onClick = onBack)
            Text(
                "Admin",
                color = PokrColors.Sidebar,
                fontFamily = PokrFonts.Display,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 18.sp,
            )
            Box {}
        }

        when {
            state.loading -> {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    PokerChipShuffle(size = 48.dp)
                }
            }
            !state.allowed -> {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("Admin only", color = PokrColors.InkStrongMuted)
                }
            }
            else -> {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState())
                        .padding(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    ADMIN_TABS.forEach { (id, label) ->
                        if (state.tab == id) {
                            PokrPrimaryButton(text = label, onClick = { viewModel.onTab(id) })
                        } else {
                            PokrGhostButton(text = label, onClick = { viewModel.onTab(id) })
                        }
                    }
                }
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState())
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    state.error?.let { Text(it, color = PokrColors.Danger, fontSize = 13.sp) }
                    state.message?.let { Text(it, color = PokrColors.Positive, fontSize = 13.sp) }
                    when (state.tab) {
                        "overview" -> OverviewPane(state)
                        "users" -> UsersPane(state, viewModel)
                        "banner" -> BannerPane(state, viewModel)
                        "games" -> GamesPane(state)
                        "hands" -> HandsPane(state)
                        "bots" -> BotsPane(state, viewModel)
                        "economy" -> EconomyPane(state, viewModel)
                        "home" -> HomePane(state, viewModel)
                        "pages" -> PagesPane(state, viewModel)
                        "sounds" -> SoundsPane(state, viewModel)
                    }
                }
            }
        }
    }
}

@Composable
private fun OverviewPane(state: AdminUiState) {
    val overview = state.overview ?: return
    HudPanel(modifier = Modifier.fillMaxWidth(), chrome = PokrChrome.Lobby) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Stat("Users", overview.userCount.toString())
            Stat("Live tables", overview.liveTables.toString())
            Stat("Live contests", overview.liveContests.toString())
            Stat("Starting chips", overview.economy.startingChipGrant.toString())
            if (overview.announcement.enabled) {
                Text(overview.announcement.text, color = PokrColors.InkStrong, fontSize = 14.sp)
            }
        }
    }
}

@Composable
private fun UsersPane(state: AdminUiState, viewModel: AdminViewModel) {
    OutlinedTextField(
        value = state.userQuery,
        onValueChange = viewModel::onUserQuery,
        label = { Text("Search") },
        modifier = Modifier.fillMaxWidth(),
        singleLine = true,
    )
    OutlinedTextField(
        value = state.creditAmount,
        onValueChange = viewModel::onCreditAmount,
        label = { Text("Credit amount") },
        modifier = Modifier.fillMaxWidth(),
        singleLine = true,
    )
    PokrPrimaryButton(text = "Search", onClick = viewModel::searchUsers, modifier = Modifier.fillMaxWidth())
    state.users.forEach { user ->
        HudPanel(modifier = Modifier.fillMaxWidth(), chrome = PokrChrome.Lobby) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    "${user.name.ifBlank { user.username }} @${user.username}",
                    fontFamily = PokrFonts.Display,
                    fontWeight = FontWeight.Bold,
                    color = PokrColors.Sidebar,
                )
                Text("chips ${user.chipBalance} · whuffies ${user.whuffieBalance}", fontSize = 13.sp)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    PokrGhostButton(text = "Chips+", onClick = { viewModel.creditChips(user.id) })
                    PokrGhostButton(text = "Whuff+", onClick = { viewModel.creditWhuffies(user.id) })
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    PokrGhostButton(text = "Reset chips", onClick = { viewModel.resetChips(user.id) })
                    PokrGhostButton(text = "Delete", onClick = { viewModel.deleteUser(user.id) })
                }
            }
        }
    }
}

@Composable
private fun BannerPane(state: AdminUiState, viewModel: AdminViewModel) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Checkbox(
            checked = state.announcement.enabled,
            onCheckedChange = viewModel::onAnnouncementEnabled,
        )
        Text("Show banner")
    }
    OutlinedTextField(
        value = state.announcement.text,
        onValueChange = viewModel::onAnnouncementText,
        label = { Text("Announcement") },
        modifier = Modifier.fillMaxWidth(),
        minLines = 3,
    )
    PokrPrimaryButton(text = "Save banner", onClick = viewModel::saveAnnouncement, modifier = Modifier.fillMaxWidth())
}

@Composable
private fun GamesPane(state: AdminUiState) {
    val games = state.games ?: return
    games.tables.forEach { table ->
        HudPanel(modifier = Modifier.fillMaxWidth(), chrome = PokrChrome.Lobby) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(table.name.ifBlank { table.tableId }, fontWeight = FontWeight.Bold, color = PokrColors.Sidebar)
                Text(
                    "${table.seatedCount}/${table.maxSeats} seated · ${table.street ?: "idle"}",
                    fontSize = 13.sp,
                    color = PokrColors.InkStrongMuted,
                )
                if (table.inviteCode.isNotBlank()) {
                    Text("code ${table.inviteCode}", fontSize = 12.sp)
                }
            }
        }
    }
    games.contests.forEach { contest ->
        HudPanel(modifier = Modifier.fillMaxWidth(), chrome = PokrChrome.Lobby) {
            Text(contest.name, fontWeight = FontWeight.Bold, color = PokrColors.Sidebar)
        }
    }
}

@Composable
private fun HandsPane(state: AdminUiState) {
    state.hands.forEach { hand ->
        HudPanel(modifier = Modifier.fillMaxWidth(), chrome = PokrChrome.Lobby) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(hand.handId.ifBlank { hand.id }, fontWeight = FontWeight.Bold, color = PokrColors.Sidebar)
                Text(hand.playerNames.joinToString(), fontSize = 13.sp)
                Text("${hand.source} · ${hand.startedAt}", fontSize = 12.sp, color = PokrColors.InkStrongMuted)
            }
        }
    }
}

@Composable
private fun BotsPane(state: AdminUiState, viewModel: AdminViewModel) {
    state.botGroups.forEachIndexed { index, group ->
        HudPanel(modifier = Modifier.fillMaxWidth(), chrome = PokrChrome.Lobby) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(group.name.ifBlank { group.id }, fontWeight = FontWeight.Bold, color = PokrColors.Sidebar)
                OutlinedTextField(
                    value = group.names.joinToString(", "),
                    onValueChange = { viewModel.onBotGroupsJsonNames(index, it) },
                    label = { Text("Names") },
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }
    PokrPrimaryButton(text = "Save bots", onClick = viewModel::saveBots, modifier = Modifier.fillMaxWidth())
}

@Composable
private fun EconomyPane(state: AdminUiState, viewModel: AdminViewModel) {
    val eco = state.economy
    fun patch(block: SiteEconomy.() -> SiteEconomy) = viewModel.onEconomy(eco.block())
    NumberField("Starting chips", eco.startingChipGrant) { patch { copy(startingChipGrant = it) } }
    NumberField("Refill threshold", eco.refillThreshold) { patch { copy(refillThreshold = it) } }
    NumberField("Refill grant", eco.refillGrant) { patch { copy(refillGrant = it) } }
    NumberField("Starting whuffies", eco.startingWhuffieGrant) { patch { copy(startingWhuffieGrant = it) } }
    PokrPrimaryButton(text = "Save economy", onClick = viewModel::saveEconomy, modifier = Modifier.fillMaxWidth())
}

@Composable
private fun HomePane(state: AdminUiState, viewModel: AdminViewModel) {
    var pendingIndex by remember { mutableStateOf<Int?>(null) }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        val index = pendingIndex
        if (uri != null && index != null) viewModel.uploadHomeImage(index, uri)
        pendingIndex = null
    }
    state.homeFeatures.forEachIndexed { index, feature ->
        HudPanel(modifier = Modifier.fillMaxWidth(), chrome = PokrChrome.Lobby) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = feature.title,
                    onValueChange = { viewModel.onHomeFeature(index, feature.copy(title = it)) },
                    label = { Text("Title") },
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = feature.body,
                    onValueChange = { viewModel.onHomeFeature(index, feature.copy(body = it)) },
                    label = { Text("Body") },
                    modifier = Modifier.fillMaxWidth(),
                )
                PokrGhostButton(
                    text = if (state.uploading) "Uploading…" else "Upload image",
                    onClick = {
                        pendingIndex = index
                        picker.launch("image/*")
                    },
                    enabled = !state.uploading,
                )
            }
        }
    }
    PokrPrimaryButton(text = "Save home", onClick = viewModel::saveHome, modifier = Modifier.fillMaxWidth())
}

@Composable
private fun PagesPane(state: AdminUiState, viewModel: AdminViewModel) {
    state.pages.pageEntries().forEach { (key, page) ->
        HudPanel(modifier = Modifier.fillMaxWidth(), chrome = PokrChrome.Lobby) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(key, fontWeight = FontWeight.Bold, color = PokrColors.Sidebar)
                OutlinedTextField(
                    value = page.title,
                    onValueChange = { viewModel.onPageTitle(key, it) },
                    label = { Text("Title") },
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = page.subtitle,
                    onValueChange = { viewModel.onPageSubtitle(key, it) },
                    label = { Text("Subtitle") },
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }
    PokrPrimaryButton(text = "Save pages", onClick = viewModel::savePages, modifier = Modifier.fillMaxWidth())
}

@Composable
private fun SoundsPane(state: AdminUiState, viewModel: AdminViewModel) {
    var pendingKind by remember { mutableStateOf<String?>(null) }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        val kind = pendingKind
        if (uri != null && kind != null) viewModel.uploadSound(kind, uri)
        pendingKind = null
    }
    Row(verticalAlignment = Alignment.CenterVertically) {
        Checkbox(checked = state.sounds.enabled, onCheckedChange = viewModel::onSoundsEnabled)
        Text("Enable table sounds")
    }
    state.sounds.urls.keys.sorted().forEach { kind ->
        HudPanel(modifier = Modifier.fillMaxWidth(), chrome = PokrChrome.Lobby) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(kind, fontWeight = FontWeight.Bold, color = PokrColors.Sidebar)
                OutlinedTextField(
                    value = state.sounds.urls[kind].orEmpty(),
                    onValueChange = { viewModel.onSoundUrl(kind, it) },
                    label = { Text("URL") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                )
                PokrGhostButton(
                    text = if (state.uploading) "Uploading…" else "Upload MP3",
                    onClick = {
                        pendingKind = kind
                        picker.launch("audio/*")
                    },
                    enabled = !state.uploading,
                )
            }
        }
    }
    PokrPrimaryButton(text = "Save sounds", onClick = viewModel::saveSounds, modifier = Modifier.fillMaxWidth())
}

@Composable
private fun Stat(label: String, value: String) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, color = PokrColors.InkStrongMuted)
        Text(value, fontFamily = PokrFonts.Display, fontWeight = FontWeight.Bold, color = PokrColors.Sidebar)
    }
}

@Composable
private fun NumberField(label: String, value: Int, onChange: (Int) -> Unit) {
    OutlinedTextField(
        value = value.toString(),
        onValueChange = { raw -> raw.toIntOrNull()?.let(onChange) },
        label = { Text(label) },
        modifier = Modifier.fillMaxWidth(),
        singleLine = true,
    )
}
