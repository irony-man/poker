package com.pokr.android.core.network

import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import retrofit2.HttpException

/** `error` field from a server `{ "error": "..." }` body, or null. */
internal fun parseApiErrorBody(body: String?): String? {
    if (body.isNullOrBlank()) return null
    return runCatching {
        PokrJson.parseToJsonElement(body).jsonObject["error"]?.jsonPrimitive?.content
    }.getOrNull()?.takeIf { it.isNotBlank() }
}

/** Server `{ "error": "..." }` message for HTTP failures, else the throwable's message or [fallback]. */
fun Throwable.apiErrorMessage(fallback: String): String {
    if (this is HttpException) {
        val body = runCatching { response()?.errorBody()?.string() }.getOrNull()
        return parseApiErrorBody(body) ?: fallback
    }
    return message?.takeIf { it.isNotBlank() } ?: fallback
}
