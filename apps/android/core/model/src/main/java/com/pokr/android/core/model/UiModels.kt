package com.pokr.android.core.model

enum class ConnectionStatus {
    Idle,
    Connecting,
    Open,
    Closed,
}

data class EmojiBurst(
    val emoji: String,
    val name: String,
    val at: Long,
)
