package com.pokr.android.core.model

import kotlinx.serialization.Serializable

@Serializable
data class PublicProfile(
    val id: String,
    val username: String = "",
    val name: String = "",
    val avatarId: Int = 0,
    val avatarUrl: String? = null,
    val createdAt: Long = 0,
    val handsPlayed: Int = 0,
    val friendCount: Int = 0,
    val chipBalance: Int = 0,
    val whuffieBalance: Int = 0,
    val relationship: String? = null,
    val incomingRequestId: String? = null,
)

@Serializable
data class HandsTogetherResponse(
    val hands: List<MyHandRow> = emptyList(),
)
