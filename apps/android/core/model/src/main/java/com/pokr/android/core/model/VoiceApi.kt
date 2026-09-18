package com.pokr.android.core.model

import kotlinx.serialization.Serializable

@Serializable
data class VoiceIceCandidate(
    val candidate: String? = null,
    val sdpMid: String? = null,
    val sdpMLineIndex: Int? = null,
    val usernameFragment: String? = null,
)

@Serializable
data class VoiceSignalPayload(
    val type: String,
    val sdp: String? = null,
    val candidate: VoiceIceCandidate? = null,
)

@Serializable
data class VoicePeer(
    val userId: String,
    val name: String = "",
)
