package com.pokr.android.core.network

import kotlinx.serialization.json.Json

val PokrJson = Json {
    ignoreUnknownKeys = true
    classDiscriminator = "type"
    encodeDefaults = true
    isLenient = true
}
