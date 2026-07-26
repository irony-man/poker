package com.felt.android.core.model

import kotlinx.serialization.Serializable

@Serializable
data class SessionDto(
    val userId: String,
    val name: String,
    val ticket: String,
    val avatarId: Int = 0,
)

@Serializable
data class RegisterRequest(
    val name: String,
    val avatarId: Int? = null,
    val userId: String? = null,
)

@Serializable
data class TicketRequest(
    val userId: String,
)
