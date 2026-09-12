package com.pokr.android.feature.memory

import kotlinx.serialization.Serializable

@Serializable
data class MemoryBoardRoute(
    val id: String,
    val invite: String? = null,
    val spectate: Boolean = false,
)
