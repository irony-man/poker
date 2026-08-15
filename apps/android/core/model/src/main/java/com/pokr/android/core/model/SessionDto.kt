package com.pokr.android.core.model

import kotlinx.serialization.Serializable

@Serializable
data class SessionDto(
    val userId: String,
    val username: String = "",
    val name: String,
    val ticket: String,
    val sessionToken: String = "",
    val avatarId: Int = 0,
    val avatarUrl: String? = null,
)

@Serializable
data class SignupRequest(
    val username: String,
    val password: String,
    val avatarId: Int? = null,
)

@Serializable
data class LoginRequest(
    val username: String,
    val password: String,
)

@Serializable
data class RegisterRequest(
    val name: String,
    val avatarId: Int? = null,
    val userId: String? = null,
)

@Serializable
data class TicketRequest(
    val userId: String? = null,
)
