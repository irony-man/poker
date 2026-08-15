package com.pokr.android.core.designsystem

import androidx.compose.ui.graphics.Color

const val TABLE_COLOR_PRESET_COUNT = 9

data class TableColorPreset(
    val id: Int,
    val label: String,
    val swatch: Color,
    val felt: Color,
    val feltDeep: Color,
    val feltMid: Color,
    val feltEdge: Color,
    val feltRim: Color,
    val feltRimEdge: Color,
)

private fun rgb(r: Int, g: Int, b: Int) = Color(r, g, b)

val TABLE_COLOR_PRESETS: List<TableColorPreset> = listOf(
    TableColorPreset(0, "Purple", Color(0xFF1D0432), rgb(29, 4, 50), rgb(18, 2, 32), rgb(52, 18, 82), Color(0xFF0A0414), rgb(18, 2, 32), rgb(168, 140, 162)),
    TableColorPreset(1, "Indigo", Color(0xFF1A2550), rgb(26, 40, 88), rgb(14, 22, 52), rgb(40, 56, 112), Color(0xFF0A1028), rgb(28, 32, 48), rgb(160, 168, 196)),
    TableColorPreset(2, "Royal blue", Color(0xFF123060), rgb(18, 48, 96), rgb(10, 28, 58), rgb(28, 64, 120), Color(0xFF061428), rgb(28, 36, 52), rgb(150, 170, 200)),
    TableColorPreset(3, "Plum", Color(0xFF3A1840), rgb(58, 28, 64), rgb(36, 16, 42), rgb(78, 40, 88), Color(0xFF140818), rgb(40, 24, 36), rgb(176, 148, 168)),
    TableColorPreset(4, "Charcoal", Color(0xFF24262A), rgb(36, 38, 42), rgb(20, 22, 26), rgb(48, 50, 56), Color(0xFF0A0A0C), rgb(28, 24, 20), rgb(150, 140, 128)),
    TableColorPreset(5, "Emerald", Color(0xFF0E3A28), rgb(14, 58, 40), rgb(8, 36, 24), rgb(28, 78, 54), Color(0xFF04140C), rgb(24, 32, 22), rgb(156, 180, 148)),
    TableColorPreset(6, "Burgundy", Color(0xFF3A1420), rgb(58, 20, 32), rgb(36, 12, 20), rgb(80, 32, 48), Color(0xFF14060A), rgb(40, 22, 26), rgb(184, 144, 152)),
    TableColorPreset(7, "Teal", Color(0xFF0E3A40), rgb(14, 58, 64), rgb(8, 36, 42), rgb(26, 78, 86), Color(0xFF041416), rgb(24, 36, 40), rgb(148, 180, 184)),
    TableColorPreset(8, "Sand", Color(0xFF3A3020), rgb(58, 48, 32), rgb(36, 28, 18), rgb(78, 64, 42), Color(0xFF141008), rgb(40, 32, 22), rgb(176, 156, 124)),
)

fun clampTableColorId(id: Int): Int {
    val n = id % TABLE_COLOR_PRESET_COUNT
    return if (n < 0) n + TABLE_COLOR_PRESET_COUNT else n
}

fun tableColorPreset(id: Int): TableColorPreset =
    TABLE_COLOR_PRESETS[clampTableColorId(id)]
