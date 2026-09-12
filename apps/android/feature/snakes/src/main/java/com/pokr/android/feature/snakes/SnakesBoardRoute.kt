package com.pokr.android.feature.snakes

import kotlinx.serialization.Serializable

@Serializable
data class SnakesBoardRoute(
    val id: String,
    val invite: String? = null,
    val spectate: Boolean = false,
)
