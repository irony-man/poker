package com.felt.android.core.model

import kotlinx.serialization.Serializable

@Serializable
data class SessionDto(
    val userId: String,
    val name: String,
    val ticket: String,
)

@Serializable
data class RegisterRequest(
    val name: String,
)

@Serializable
data class TicketRequest(
    val userId: String,
)
