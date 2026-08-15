package com.felt.android.core.model

import kotlinx.serialization.Serializable

@Serializable
data class MeProfile(
    val id: String,
    val username: String = "",
    val name: String = "",
    val avatarId: Int = 0,
    val avatarUrl: String? = null,
    val tableColorId: Int = 0,
    val handsPlayed: Int = 0,
    val friendCount: Int = 0,
    val isAdmin: Boolean = false,
)

@Serializable
data class MyHandRow(
    val id: String,
    val tableId: String,
    val handId: String,
    val contestId: String? = null,
    val source: String = "online",
    val startedAt: String = "",
    val endedAt: String? = null,
    val resultJson: String = "{}",
)

@Serializable
data class MyHandsResponse(
    val hands: List<MyHandRow> = emptyList(),
)
