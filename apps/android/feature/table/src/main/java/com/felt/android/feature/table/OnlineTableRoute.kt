package com.felt.android.feature.table

import kotlinx.serialization.Serializable

@Serializable
data class OnlineTableRoute(
    val tableId: String,
    val invite: String? = null,
    val spectate: Boolean = false,
)
