package com.felt.android.core.network

/**
 * Supplies a Clerk session JWT for Felt HTTP APIs.
 * Returns null when the user is signed out or no token is available.
 */
fun interface AuthTokenProvider {
    suspend fun bearerToken(): String?
}
