package com.felt.android.core.network

import kotlinx.serialization.json.Json

val FeltJson = Json {
    ignoreUnknownKeys = true
    classDiscriminator = "type"
    encodeDefaults = true
    isLenient = true
}
