package com.pokr.android.feature.courtpiece

import kotlinx.serialization.Serializable

@Serializable
data class CourtpieceBoardRoute(
    val id: String,
    val invite: String? = null,
    val spectate: Boolean = false,
)
