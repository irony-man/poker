package com.pokr.android.core.model

import kotlinx.serialization.EncodeDefault
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.Serializable

@Serializable
data class MeProfile(
    val id: String,
    val username: String = "",
    val name: String = "",
    val avatarId: Int = 0,
    val avatarUrl: String? = null,
    val tableColorId: Int = 0,
    val uiTheme: String = "v1",
    val tableLayout: String = "v1",
    val sfxMuted: Boolean = false,
    val createdAt: Long = 0,
    val chipBalance: Int = 0,
    val whuffieBalance: Int = 0,
    val handsPlayed: Int = 0,
    val friendCount: Int = 0,
    val isAdmin: Boolean = false,
)

@OptIn(ExperimentalSerializationApi::class)
@Serializable
data class UpdateMeBody(
    @EncodeDefault(EncodeDefault.Mode.NEVER)
    val avatarId: Int? = null,
    @EncodeDefault(EncodeDefault.Mode.NEVER)
    val tableColorId: Int? = null,
    @EncodeDefault(EncodeDefault.Mode.NEVER)
    val uiTheme: String? = null,
    @EncodeDefault(EncodeDefault.Mode.NEVER)
    val tableLayout: String? = null,
    @EncodeDefault(EncodeDefault.Mode.NEVER)
    val sfxMuted: Boolean? = null,
)

@Serializable
data class MyHandRow(
    val id: String,
    val tableId: String,
    val handId: String,
    val contestId: String? = null,
    val source: String = "online",
    val startedAt: String = "",
    val endedAt: String? = null,
    val resultJson: String = "{}",
)

@Serializable
data class MyHandsResponse(
    val hands: List<MyHandRow> = emptyList(),
)
