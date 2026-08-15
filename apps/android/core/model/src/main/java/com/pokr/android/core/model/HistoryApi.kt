package com.pokr.android.core.model

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

@Serializable
data class UploadChatLine(
    val at: Long,
    val userId: String,
    val name: String,
    val text: String,
    val kind: String? = null,
)

@Serializable
data class UploadHandRequest(
    val tableId: String,
    val handId: String,
    val startedAt: Long,
    val endedAt: Long,
    val source: String = "offline",
    val result: JsonElement,
    val chat: List<UploadChatLine> = emptyList(),
)

@Serializable
data class UploadHandResponse(
    val ok: Boolean = true,
    val inserted: Boolean = true,
)
