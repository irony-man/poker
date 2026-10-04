package com.pokr.android.core.network

import com.pokr.android.core.common.ToastBus
import java.io.IOException
import okhttp3.Interceptor
import okhttp3.Response

/**
 * Surfaces failed HTTP calls as global toasts (mirrors web `apiFetch`).
 * Requests carrying [SILENT_HEADER] stay quiet; 401s are left to session expiry flows.
 */
class ApiErrorToastInterceptor : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        val silent = original.header(SILENT_HEADER) != null
        val request = if (silent) {
            original.newBuilder().removeHeader(SILENT_HEADER).build()
        } else {
            original
        }

        val response = try {
            chain.proceed(request)
        } catch (e: IOException) {
            if (!silent && !chain.call().isCanceled()) {
                ToastBus.error("Network error — check your connection and try again.")
            }
            throw e
        }

        if (!silent && !response.isSuccessful && response.code != 401) {
            val body = runCatching { response.peekBody(MAX_ERROR_BODY_BYTES).string() }.getOrNull()
            ToastBus.error(parseApiErrorBody(body) ?: "Request failed")
        }
        return response
    }

    companion object {
        const val SILENT_HEADER = "X-Pokr-Silent"
        const val SILENT = "$SILENT_HEADER: 1"
        private const val MAX_ERROR_BODY_BYTES = 64L * 1024
    }
}
