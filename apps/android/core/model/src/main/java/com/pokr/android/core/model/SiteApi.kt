package com.pokr.android.core.model

import kotlinx.serialization.Serializable

@Serializable
data class PublicBotGroup(
    val id: String,
    val name: String = "",
    val isDefault: Boolean = false,
    val nameCount: Int = 0,
)

@Serializable
data class SitePublicResponse(
    val botGroups: List<PublicBotGroup> = emptyList(),
)
