package com.pokr.android.core.model

import kotlinx.serialization.EncodeDefault
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.Serializable

@OptIn(ExperimentalSerializationApi::class)
@Serializable
data class GoogleAuthRequest(
    val idToken: String,
    @EncodeDefault(EncodeDefault.Mode.NEVER)
    val username: String? = null,
    @EncodeDefault(EncodeDefault.Mode.NEVER)
    val avatarId: Int? = null,
)

/** `POST /api/auth/google` replies with either a session or `needsUsername` for new users. */
@Serializable
data class GoogleAuthResponse(
    val needsUsername: Boolean = false,
    val suggestedUsername: String? = null,
    val email: String? = null,
    val userId: String? = null,
    val username: String = "",
    val name: String? = null,
    val ticket: String? = null,
    val sessionToken: String = "",
    val avatarId: Int = 0,
    val avatarUrl: String? = null,
) {
    fun toSessionOrNull(): SessionDto? {
        if (needsUsername || userId == null || ticket == null) return null
        return SessionDto(
            userId = userId,
            username = username,
            name = name ?: username,
            ticket = ticket,
            sessionToken = sessionToken,
            avatarId = avatarId,
            avatarUrl = avatarUrl,
        )
    }
}

@Serializable
data class GoogleLinkRequest(
    val idToken: String,
)

@Serializable
data class ForgotPasswordRequest(
    val identifier: String,
)

@Serializable
data class SetEmailRequest(
    val email: String,
)
