package com.pokr.android.core.model

import kotlinx.serialization.Serializable

@Serializable
data class PublicLobbyTable(
    val tableId: String,
    val inviteCode: String,
    val name: String = "",
    val stakeId: String,
    val seatedCount: Int = 0,
    val maxSeats: Int = 6,
    val config: TableConfig? = null,
)

@Serializable
data class PublicTablesResponse(
    val tables: List<PublicLobbyTable> = emptyList(),
)
