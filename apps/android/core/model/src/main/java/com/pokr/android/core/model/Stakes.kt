package com.pokr.android.core.model

data class StakePreset(
    val id: String,
    val label: String,
    val smallBlind: Int,
    val bigBlind: Int,
    val buyIn: Int,
)

val STAKE_PRESETS: List<StakePreset> = listOf(
    StakePreset("micro", "Micro", 2, 5, 500),
    StakePreset("low", "Low", 5, 10, 1000),
    StakePreset("mid", "Mid", 10, 25, 2500),
    StakePreset("high", "High", 25, 50, 5000),
)

const val DEFAULT_STAKE_ID = "low"

fun stakeById(id: String): StakePreset =
    STAKE_PRESETS.find { it.id == id } ?: STAKE_PRESETS[1]
