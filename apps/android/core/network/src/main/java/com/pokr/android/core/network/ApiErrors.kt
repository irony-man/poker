package com.pokr.android.core.network

import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import retrofit2.HttpException

/** Server `{ "error": "..." }` message for HTTP failures, else the throwable's message or [fallback]. */
fun Throwable.apiErrorMessage(fallback: String): String {
    if (this is HttpException) {
        val body = runCatching { response()?.errorBody()?.string() }.getOrNull()
        val parsed = body?.let {
            runCatching {
                PokrJson.parseToJsonElement(it).jsonObject["error"]?.jsonPrimitive?.content
            }.getOrNull()
        }
        if (!parsed.isNullOrBlank()) return parsed
        return fallback
    }
    return message?.takeIf { it.isNotBlank() } ?: fallback
}
