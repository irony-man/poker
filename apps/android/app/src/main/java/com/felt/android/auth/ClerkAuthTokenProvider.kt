package com.felt.android.auth

import com.clerk.api.Clerk
import com.clerk.api.network.serialization.successOrNull
import com.felt.android.core.network.AuthTokenProvider
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.first

@Singleton
class ClerkAuthTokenProvider @Inject constructor() : AuthTokenProvider {
    override suspend fun bearerToken(): String? {
        Clerk.isInitialized.first { it }
        if (Clerk.user == null) return null
        return Clerk.auth.getToken().successOrNull()
    }
}
