package com.pokr.android.feature.admin

import android.content.Context
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pokr.android.core.model.AdminCreditBody
import com.pokr.android.core.model.AdminGamesResponse
import com.pokr.android.core.model.AdminHandSummary
import com.pokr.android.core.model.AdminOverviewResponse
import com.pokr.android.core.model.AdminUploadUrlBody
import com.pokr.android.core.model.AdminUserRow
import com.pokr.android.core.model.BotGroup
import com.pokr.android.core.model.HomeLandingFeature
import com.pokr.android.core.model.PageCopy
import com.pokr.android.core.model.PagesCopy
import com.pokr.android.core.model.PatchBotGroupsBody
import com.pokr.android.core.model.PatchHomeFeaturesBody
import com.pokr.android.core.model.PatchPagesBody
import com.pokr.android.core.model.SiteAnnouncement
import com.pokr.android.core.model.SiteEconomy
import com.pokr.android.core.model.TableSoundsConfig
import com.pokr.android.core.network.PokrApi
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

data class AdminUiState(
    val allowed: Boolean = false,
    val loading: Boolean = true,
    val tab: String = "overview",
    val error: String? = null,
    val message: String? = null,
    val overview: AdminOverviewResponse? = null,
    val users: List<AdminUserRow> = emptyList(),
    val userQuery: String = "",
    val creditAmount: String = "1000",
    val announcement: SiteAnnouncement = SiteAnnouncement(),
    val games: AdminGamesResponse? = null,
    val hands: List<AdminHandSummary> = emptyList(),
    val botGroups: List<BotGroup> = emptyList(),
    val economy: SiteEconomy = SiteEconomy(),
    val pages: PagesCopy = PagesCopy(),
    val homeFeatures: List<HomeLandingFeature> = emptyList(),
    val sounds: TableSoundsConfig = TableSoundsConfig(),
    val uploading: Boolean = false,
)

private val SOUND_KINDS = listOf(
    "fold", "check", "call", "bet", "raise", "allin",
    "deal", "flop", "turn", "river", "win",
)

@HiltViewModel
class AdminViewModel @Inject constructor(
    @ApplicationContext private val appContext: Context,
    private val api: PokrApi,
    private val okHttp: OkHttpClient,
) : ViewModel() {

    private val _uiState = MutableStateFlow(AdminUiState())
    val uiState: StateFlow<AdminUiState> = _uiState.asStateFlow()

    init {
        refreshGate()
    }

    fun onTab(tab: String) {
        _uiState.update { it.copy(tab = tab, error = null, message = null) }
        loadTab(tab)
    }

    fun onUserQuery(value: String) = _uiState.update { it.copy(userQuery = value) }

    fun onCreditAmount(value: String) = _uiState.update { it.copy(creditAmount = value) }

    fun onAnnouncementEnabled(enabled: Boolean) =
        _uiState.update { it.copy(announcement = it.announcement.copy(enabled = enabled)) }

    fun onAnnouncementText(text: String) =
        _uiState.update { it.copy(announcement = it.announcement.copy(text = text)) }

    fun onEconomy(patch: SiteEconomy) = _uiState.update { it.copy(economy = patch) }

    fun onSoundsEnabled(enabled: Boolean) =
        _uiState.update { it.copy(sounds = it.sounds.copy(enabled = enabled)) }

    fun onSoundUrl(kind: String, url: String) {
        _uiState.update {
            it.copy(sounds = it.sounds.copy(urls = it.sounds.urls + (kind to url)))
        }
    }

    fun onBotGroupsJsonNames(index: Int, namesCsv: String) {
        _uiState.update { state ->
            val next = state.botGroups.toMutableList()
            if (index in next.indices) {
                next[index] = next[index].copy(
                    names = namesCsv.split(',').map { it.trim() }.filter { it.isNotEmpty() },
                )
            }
            state.copy(botGroups = next)
        }
    }

    fun onPageTitle(key: String, title: String) {
        _uiState.update { it.copy(pages = it.pages.withTitle(key, title)) }
    }

    fun onPageSubtitle(key: String, subtitle: String) {
        _uiState.update { it.copy(pages = it.pages.withSubtitle(key, subtitle)) }
    }

    fun onHomeFeature(index: Int, feature: HomeLandingFeature) {
        _uiState.update { state ->
            val next = state.homeFeatures.toMutableList()
            if (index in next.indices) next[index] = feature
            state.copy(homeFeatures = next)
        }
    }

    fun searchUsers() {
        viewModelScope.launch {
            runAdmin {
                val res = api.getAdminUsers(_uiState.value.userQuery.ifBlank { null })
                _uiState.update { it.copy(users = res.users) }
            }
        }
    }

    fun creditChips(userId: String) {
        val amount = _uiState.value.creditAmount.toIntOrNull() ?: return
        viewModelScope.launch {
            runAdmin {
                api.creditAdminUser(userId, AdminCreditBody(amount))
                _uiState.update { it.copy(message = "Credited $amount chips") }
                searchUsers()
            }
        }
    }

    fun creditWhuffies(userId: String) {
        val amount = _uiState.value.creditAmount.toIntOrNull() ?: return
        viewModelScope.launch {
            runAdmin {
                api.creditAdminUserWhuffies(userId, AdminCreditBody(amount))
                _uiState.update { it.copy(message = "Credited $amount whuffies") }
                searchUsers()
            }
        }
    }

    fun resetChips(userId: String) {
        viewModelScope.launch {
            runAdmin {
                api.resetAdminUserChips(userId)
                _uiState.update { it.copy(message = "Reset chips") }
                searchUsers()
            }
        }
    }

    fun deleteUser(userId: String) {
        viewModelScope.launch {
            runAdmin {
                api.deleteAdminUser(userId)
                _uiState.update { it.copy(message = "User deleted") }
                searchUsers()
            }
        }
    }

    fun saveAnnouncement() {
        viewModelScope.launch {
            runAdmin {
                val saved = api.patchAdminAnnouncement(_uiState.value.announcement)
                _uiState.update { it.copy(announcement = saved, message = "Banner saved") }
            }
        }
    }

    fun saveEconomy() {
        viewModelScope.launch {
            runAdmin {
                val saved = api.patchAdminEconomy(_uiState.value.economy)
                _uiState.update { it.copy(economy = saved, message = "Economy saved") }
            }
        }
    }

    fun saveBots() {
        viewModelScope.launch {
            runAdmin {
                val saved = api.patchAdminBotGroups(PatchBotGroupsBody(_uiState.value.botGroups))
                _uiState.update { it.copy(botGroups = saved.groups, message = "Bot groups saved") }
            }
        }
    }

    fun savePages() {
        viewModelScope.launch {
            runAdmin {
                val saved = api.patchAdminPages(PatchPagesBody(pages = _uiState.value.pages))
                _uiState.update { it.copy(pages = saved.pages, message = "Pages saved") }
            }
        }
    }

    fun saveHome() {
        viewModelScope.launch {
            runAdmin {
                val saved = api.patchAdminHomeFeatures(
                    PatchHomeFeaturesBody(features = _uiState.value.homeFeatures),
                )
                _uiState.update { it.copy(homeFeatures = saved.features, message = "Home saved") }
            }
        }
    }

    fun saveSounds() {
        viewModelScope.launch {
            runAdmin {
                val saved = api.patchAdminSounds(_uiState.value.sounds)
                _uiState.update { it.copy(sounds = saved, message = "Sounds saved") }
            }
        }
    }

    fun uploadSound(kind: String, uri: Uri) {
        viewModelScope.launch {
            putUpload(
                uri = uri,
                purpose = "sound",
                kind = kind,
            ) { publicUrl ->
                onSoundUrl(kind, publicUrl)
                saveSounds()
            }
        }
    }

    fun uploadHomeImage(index: Int, uri: Uri) {
        viewModelScope.launch {
            putUpload(uri = uri, purpose = "image", kind = "home") { publicUrl ->
                val current = _uiState.value.homeFeatures.getOrNull(index) ?: return@putUpload
                onHomeFeature(index, current.copy(image = publicUrl))
                saveHome()
            }
        }
    }

    private fun refreshGate() {
        viewModelScope.launch {
            _uiState.update { it.copy(loading = true, error = null) }
            val me = runCatching { api.getMe() }.getOrNull()
            val allowed = me?.isAdmin == true
            _uiState.update { it.copy(allowed = allowed, loading = false) }
            if (allowed) loadTab(_uiState.value.tab)
        }
    }

    private fun loadTab(tab: String) {
        viewModelScope.launch {
            runAdmin {
                when (tab) {
                    "overview" -> {
                        val overview = api.getAdminOverview()
                        _uiState.update { it.copy(overview = overview) }
                    }
                    "users" -> {
                        val res = api.getAdminUsers(_uiState.value.userQuery.ifBlank { null })
                        _uiState.update { it.copy(users = res.users) }
                    }
                    "banner" -> {
                        val banner = api.getAdminAnnouncement()
                        _uiState.update { it.copy(announcement = banner) }
                    }
                    "games" -> {
                        val games = api.getAdminGames()
                        _uiState.update { it.copy(games = games) }
                    }
                    "hands" -> {
                        val page = api.getAdminHands(page = 1, pageSize = 30)
                        _uiState.update { it.copy(hands = page.items) }
                    }
                    "bots" -> {
                        val groups = api.getAdminBotGroups()
                        _uiState.update { it.copy(botGroups = groups.groups) }
                    }
                    "economy" -> {
                        val economy = api.getAdminEconomy()
                        _uiState.update { it.copy(economy = economy) }
                    }
                    "pages" -> {
                        val pages = api.getAdminPages()
                        _uiState.update { it.copy(pages = pages.pages) }
                    }
                    "home" -> {
                        val home = api.getAdminHomeFeatures()
                        _uiState.update { it.copy(homeFeatures = home.features) }
                    }
                    "sounds" -> {
                        val sounds = api.getAdminSounds()
                        val urls = SOUND_KINDS.associateWith { sounds.urls[it].orEmpty() } + sounds.urls
                        _uiState.update { it.copy(sounds = sounds.copy(urls = urls)) }
                    }
                }
            }
        }
    }

    private suspend fun putUpload(
        uri: Uri,
        purpose: String,
        kind: String,
        onPublicUrl: (String) -> Unit,
    ) {
        _uiState.update { it.copy(uploading = true, error = null) }
        runCatching {
            val bytes = withContext(Dispatchers.IO) {
                appContext.contentResolver.openInputStream(uri)?.use { it.readBytes() }
            } ?: error("Could not read file")
            val contentType = appContext.contentResolver.getType(uri)
                ?: if (purpose == "sound") "audio/mpeg" else "image/jpeg"
            val signed = if (purpose == "sound") {
                api.requestAdminSoundUploadUrl(
                    AdminUploadUrlBody(
                        kind = kind,
                        purpose = purpose,
                        contentType = contentType,
                        contentLength = bytes.size.toLong(),
                    ),
                )
            } else {
                api.requestAdminImageUploadUrl(
                    AdminUploadUrlBody(
                        kind = kind,
                        purpose = purpose,
                        contentType = contentType,
                        contentLength = bytes.size.toLong(),
                    ),
                )
            }
            withContext(Dispatchers.IO) {
                val req = Request.Builder()
                    .url(signed.uploadUrl)
                    .put(bytes.toRequestBody(contentType.toMediaType()))
                    .build()
                okHttp.newCall(req).execute().use { resp ->
                    if (!resp.isSuccessful) error("Upload failed (${resp.code})")
                }
            }
            onPublicUrl(signed.publicUrl)
            _uiState.update { it.copy(message = "Uploaded") }
        }.onFailure { err ->
            _uiState.update { it.copy(error = err.message ?: "Upload failed") }
        }
        _uiState.update { it.copy(uploading = false) }
    }

    private suspend fun runAdmin(block: suspend () -> Unit) {
        _uiState.update { it.copy(error = null) }
        runCatching { block() }.onFailure { err ->
            _uiState.update { it.copy(error = err.message ?: "Request failed") }
        }
    }
}

internal fun PagesCopy.pageEntries(): List<Pair<String, PageCopy>> = listOf(
    "host" to host,
    "join" to join,
    "public" to publicPage,
    "contests" to contests,
    "friends" to friends,
    "solo" to solo,
    "arcade" to arcade,
    "ludo" to ludo,
    "snakes" to snakes,
    "memory" to memory,
    "courtpiece" to courtpiece,
    "signIn" to signIn,
    "signUp" to signUp,
    "homeAuthFooter" to homeAuthFooter,
)

private fun PagesCopy.withTitle(key: String, title: String): PagesCopy = when (key) {
    "host" -> copy(host = host.copy(title = title))
    "join" -> copy(join = join.copy(title = title))
    "public" -> copy(publicPage = publicPage.copy(title = title))
    "contests" -> copy(contests = contests.copy(title = title))
    "friends" -> copy(friends = friends.copy(title = title))
    "solo" -> copy(solo = solo.copy(title = title))
    "arcade" -> copy(arcade = arcade.copy(title = title))
    "ludo" -> copy(ludo = ludo.copy(title = title))
    "snakes" -> copy(snakes = snakes.copy(title = title))
    "memory" -> copy(memory = memory.copy(title = title))
    "courtpiece" -> copy(courtpiece = courtpiece.copy(title = title))
    "signIn" -> copy(signIn = signIn.copy(title = title))
    "signUp" -> copy(signUp = signUp.copy(title = title))
    "homeAuthFooter" -> copy(homeAuthFooter = homeAuthFooter.copy(title = title))
    else -> this
}

private fun PagesCopy.withSubtitle(key: String, subtitle: String): PagesCopy = when (key) {
    "host" -> copy(host = host.copy(subtitle = subtitle))
    "join" -> copy(join = join.copy(subtitle = subtitle))
    "public" -> copy(publicPage = publicPage.copy(subtitle = subtitle))
    "contests" -> copy(contests = contests.copy(subtitle = subtitle))
    "friends" -> copy(friends = friends.copy(subtitle = subtitle))
    "solo" -> copy(solo = solo.copy(subtitle = subtitle))
    "arcade" -> copy(arcade = arcade.copy(subtitle = subtitle))
    "ludo" -> copy(ludo = ludo.copy(subtitle = subtitle))
    "snakes" -> copy(snakes = snakes.copy(subtitle = subtitle))
    "memory" -> copy(memory = memory.copy(subtitle = subtitle))
    "courtpiece" -> copy(courtpiece = courtpiece.copy(subtitle = subtitle))
    "signIn" -> copy(signIn = signIn.copy(subtitle = subtitle))
    "signUp" -> copy(signUp = signUp.copy(subtitle = subtitle))
    "homeAuthFooter" -> copy(homeAuthFooter = homeAuthFooter.copy(subtitle = subtitle))
    else -> this
}
