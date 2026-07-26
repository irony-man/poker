package com.felt.android.core.model

import kotlinx.serialization.Serializable

@Serializable
data class TableConfig(
    val maxSeats: Int,
    val smallBlind: Int,
    val bigBlind: Int,
    val minBuyIn: Int,
    val maxBuyIn: Int,
    val turnTimeMs: Int,
)

@Serializable
data class CreateTableRequest(
    val userId: String,
    val name: String = "Home Game",
    val smallBlind: Int = 5,
    val bigBlind: Int = 10,
    val minBuyIn: Int = 200,
    val maxBuyIn: Int = 1000,
    val turnTimeMs: Int = 20_000,
    val maxSeats: Int = 6,
    val botCount: Int = 0,
    val isPrivate: Boolean = true,
)

@Serializable
data class CreateTableResponse(
    val tableId: String,
    val inviteCode: String,
    val name: String,
    val config: TableConfig,
    val botsAdded: Int = 0,
)

@Serializable
data class InviteResolveResponse(
    val tableId: String,
    val inviteCode: String,
    val name: String,
    val config: TableConfig,
)
