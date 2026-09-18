package com.pokr.android.core.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

@Serializable
data class AdminUserRow(
    val id: String,
    val username: String = "",
    val name: String = "",
    val avatarId: Int = 0,
    val chipBalance: Int = 0,
    val whuffieBalance: Int = 0,
    val createdAt: Long = 0,
)

@Serializable
data class AdminUsersResponse(
    val users: List<AdminUserRow> = emptyList(),
)

@Serializable
data class AdminCreditBody(
    val amount: Int,
)

@Serializable
data class AdminCreditResponse(
    val ok: Boolean = true,
    val userId: String = "",
    val username: String = "",
    val balance: Int = 0,
    val credited: Int = 0,
)

@Serializable
data class AdminResetResponse(
    val ok: Boolean = true,
    val userId: String = "",
    val username: String = "",
    val balance: Int = 0,
    val previousBalance: Int = 0,
    val resetTo: Int = 0,
)

@Serializable
data class AdminDeleteUserResponse(
    val ok: Boolean = true,
    val userId: String = "",
    val username: String = "",
)

@Serializable
data class AdminTableRow(
    val tableId: String,
    val inviteCode: String = "",
    val name: String = "",
    val isPrivate: Boolean = false,
    val stakeId: String? = null,
    val seatedCount: Int = 0,
    val maxSeats: Int = 0,
    val hostUserId: String = "",
    val handInProgress: Boolean = false,
    val street: String? = null,
    val idle: Boolean = false,
    val playMoney: Boolean = true,
    val contestId: String? = null,
    val contestFrozen: Boolean? = null,
    val createdAt: Long = 0,
)

@Serializable
data class AdminGamesResponse(
    val tables: List<AdminTableRow> = emptyList(),
    val contests: List<ContestView> = emptyList(),
)

@Serializable
data class AdminRoomSettings(
    val inactivityMinutes: Int = 30,
)

@Serializable
data class AdminOverviewResponse(
    val userCount: Int = 0,
    val economy: SiteEconomy = SiteEconomy(),
    val announcement: SiteAnnouncement = SiteAnnouncement(),
    val liveTables: Int = 0,
    val liveContests: Int = 0,
)

@Serializable
data class SiteEconomy(
    val startingChipGrant: Int = 0,
    val refillThreshold: Int = 0,
    val refillGrant: Int = 0,
    val startingWhuffieGrant: Int = 0,
)

@Serializable
data class HomeLandingFeature(
    val title: String = "",
    val body: String = "",
    val cta: String = "",
    val href: String = "",
    val image: String = "",
    val imageAlt: String = "",
    val imageFirst: Boolean = false,
)

@Serializable
data class AdminHomeFeaturesResponse(
    val features: List<HomeLandingFeature> = emptyList(),
)

@Serializable
data class PatchHomeFeaturesBody(
    val features: List<HomeLandingFeature> = emptyList(),
    val theme: String = "v1",
)

@Serializable
data class PageCopy(
    val title: String = "",
    val subtitle: String = "",
    val image: String? = null,
    val imageAlt: String? = null,
)

@Serializable
data class PagesCopy(
    val host: PageCopy = PageCopy(),
    val join: PageCopy = PageCopy(),
    @SerialName("public")
    val publicPage: PageCopy = PageCopy(),
    val contests: PageCopy = PageCopy(),
    val friends: PageCopy = PageCopy(),
    val solo: PageCopy = PageCopy(),
    val arcade: PageCopy = PageCopy(),
    val ludo: PageCopy = PageCopy(),
    val snakes: PageCopy = PageCopy(),
    val memory: PageCopy = PageCopy(),
    val courtpiece: PageCopy = PageCopy(),
    val signIn: PageCopy = PageCopy(),
    val signUp: PageCopy = PageCopy(),
    val homeAuthFooter: PageCopy = PageCopy(),
)

@Serializable
data class AdminPagesResponse(
    val pages: PagesCopy = PagesCopy(),
)

@Serializable
data class PatchPagesBody(
    val pages: PagesCopy = PagesCopy(),
    val theme: String = "v1",
)

@Serializable
data class BotGroup(
    val id: String,
    val name: String = "",
    val names: List<String> = emptyList(),
    val isDefault: Boolean = false,
    val defaultPersonality: String? = null,
    val namePersonalities: Map<String, String> = emptyMap(),
)

@Serializable
data class AdminBotGroupsResponse(
    val groups: List<BotGroup> = emptyList(),
)

@Serializable
data class PatchBotGroupsBody(
    val groups: List<BotGroup> = emptyList(),
)

@Serializable
data class TableSoundsConfig(
    val enabled: Boolean = true,
    val urls: Map<String, String> = emptyMap(),
)

@Serializable
data class AdminUploadUrlBody(
    val kind: String? = null,
    val purpose: String? = null,
    val contentType: String,
    val contentLength: Long,
)

@Serializable
data class AdminUploadUrlResponse(
    val uploadUrl: String = "",
    val publicUrl: String = "",
    val expiresIn: Int = 0,
)

@Serializable
data class AdminHandWinner(
    val seat: Int,
    val amount: Int = 0,
    val name: String? = null,
    val handName: String? = null,
)

@Serializable
data class AdminHandSummary(
    val id: String,
    val tableId: String = "",
    val handId: String = "",
    val contestId: String? = null,
    val source: String = "online",
    val startedAt: String = "",
    val endedAt: String? = null,
    val playerNames: List<String> = emptyList(),
    val winners: List<AdminHandWinner> = emptyList(),
)

@Serializable
data class AdminHandsPage(
    val items: List<AdminHandSummary> = emptyList(),
    val total: Int = 0,
    val page: Int = 1,
    val pageSize: Int = 20,
)

@Serializable
data class AdminHandDetailPayload(
    val id: String = "",
    val tableId: String = "",
    val handId: String = "",
    val contestId: String? = null,
    val source: String = "online",
    val startedAt: String = "",
    val endedAt: String? = null,
    val playerNames: List<String> = emptyList(),
    val winners: List<AdminHandWinner> = emptyList(),
    val resultJson: String? = null,
    val result: JsonElement? = null,
)

@Serializable
data class AdminHandDetail(
    val hand: AdminHandDetailPayload = AdminHandDetailPayload(),
)
