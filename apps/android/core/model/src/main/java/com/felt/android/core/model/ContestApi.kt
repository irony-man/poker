package com.felt.android.core.model

import kotlinx.serialization.Serializable

@Serializable
data class ContestEntrant(
    val userId: String,
    val name: String,
    val isBot: Boolean? = null,
    val registeredAt: Long = 0,
)

@Serializable
data class ContestPlacement(
    val userId: String,
    val name: String,
    val place: Int,
)

@Serializable
data class KnockoutMatchDto(
    val id: String,
    val round: Int,
    val index: Int,
    val playerA: String? = null,
    val playerB: String? = null,
    val winnerId: String? = null,
    val tableId: String? = null,
    val status: String,
)

@Serializable
data class ContestBlindInfo(
    val levelIndex: Int,
    val smallBlind: Int,
    val bigBlind: Int,
    val handsAtLevel: Int,
    val handsUntilNext: Int,
)

@Serializable
data class ContestPlayerAssignment(
    val userId: String,
    val tableId: String? = null,
    val matchId: String? = null,
    val eliminated: Boolean = false,
    val place: Int? = null,
)

@Serializable
data class ContestView(
    val id: String,
    val inviteCode: String,
    val name: String,
    val mode: String,
    val status: String,
    val hostUserId: String,
    val fieldSize: Int,
    val startingStack: Int,
    val smallBlind: Int,
    val bigBlind: Int,
    val turnTimeMs: Int,
    val isPrivate: Boolean = true,
    val entrants: List<ContestEntrant> = emptyList(),
    val placements: List<ContestPlacement> = emptyList(),
    val matches: List<KnockoutMatchDto> = emptyList(),
    val tableId: String? = null,
    val blinds: ContestBlindInfo? = null,
    val assignments: List<ContestPlayerAssignment> = emptyList(),
    val createdAt: Long = 0,
    val startedAt: Long? = null,
    val completedAt: Long? = null,
)

@Serializable
data class CreateContestRequest(
    val userId: String,
    val name: String = "Contest",
    val mode: String,
    val fieldSize: Int,
    val startingStack: Int = 1000,
    val smallBlind: Int = 5,
    val bigBlind: Int = 10,
    val turnTimeMs: Int = 20_000,
    val botCount: Int = 0,
    val isPrivate: Boolean = true,
    val inviteCode: String? = null,
    val autoStart: Boolean = true,
)

@Serializable
data class ContestResponse(
    val contest: ContestView,
)

@Serializable
data class ContestListResponse(
    val contests: List<ContestView> = emptyList(),
)
