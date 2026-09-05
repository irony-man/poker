package com.pokr.android.feature.ludo

import kotlinx.serialization.Serializable

@Serializable
data class LudoBoardRoute(
    val id: String,
    val invite: String? = null,
    val spectate: Boolean = false,
)
