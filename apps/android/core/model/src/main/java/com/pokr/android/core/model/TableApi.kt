package com.pokr.android.core.model

import kotlinx.serialization.Serializable

@Serializable
data class TableConfig(
    val maxSeats: Int,
    val smallBlind: Int,
    val bigBlind: Int,
    val buyIn: Int,
    val turnTimeMs: Int,
)

@Serializable
data class CreateTableRequest(
    val userId: String,
    val name: String = "Home Game",
    val smallBlind: Int = 5,
    val bigBlind: Int = 10,
    val buyIn: Int = 1000,
    val turnTimeMs: Int = 20_000,
    val maxSeats: Int = 6,
    val botCount: Int = 0,
    val botGroupId: String? = null,
    val isPrivate: Boolean = true,
    /** Optional custom numerical invite / room code (4–8 digits). */
    val inviteCode: String? = null,
    /** Friend user ids to notify when the table is created. */
    val inviteFriendIds: List<String> = emptyList(),
)

@Serializable
data class CreateTableResponse(
    val tableId: String,
    val inviteCode: String,
    val name: String,
    val config: TableConfig,
    val botsAdded: Int = 0,
    val inviteCount: Int = 0,
)

@Serializable
data class InviteResolveResponse(
    val tableId: String,
    val inviteCode: String,
    val name: String,
    val config: TableConfig,
)
