package com.felt.android.feature.offline

import kotlinx.serialization.Serializable

@Serializable
data class OfflineTableRoute(
    val seats: Int,
    val bots: Int,
    val name: String,
)
