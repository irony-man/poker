package com.pokr.android.feature.ludo

import com.pokr.android.core.model.LudoTokenPos

/**
 * Shared 15×15 Ludo coordinates — keep in sync with apps/web/lib/ludoBoard.ts.
 * Seats clockwise: 0 red (NW), 1 green (NE), 2 yellow (SE), 3 blue (SW).
 * Main-track starts match the engine: 0, 13, 26, 39.
 */
object LudoLayout {
    const val GRID = 15
    const val TRACK_LEN = 52
    val START_SQUARES = intArrayOf(0, 13, 26, 39)
    val SAFE_SQUARES = setOf(0, 8, 13, 21, 26, 34, 39, 47)

    /** Main-track cells clockwise from red start, (row, col). */
    val TRACK: List<Pair<Int, Int>> = listOf(
        6 to 1, 6 to 2, 6 to 3, 6 to 4, 6 to 5,
        5 to 6, 4 to 6, 3 to 6, 2 to 6, 1 to 6, 0 to 6,
        0 to 7, 0 to 8,
        1 to 8, 2 to 8, 3 to 8, 4 to 8, 5 to 8,
        6 to 9, 6 to 10, 6 to 11, 6 to 12, 6 to 13, 6 to 14,
        7 to 14, 8 to 14,
        8 to 13, 8 to 12, 8 to 11, 8 to 10, 8 to 9,
        9 to 8, 10 to 8, 11 to 8, 12 to 8, 13 to 8, 14 to 8,
        14 to 7, 14 to 6,
        13 to 6, 12 to 6, 11 to 6, 10 to 6, 9 to 6,
        8 to 5, 8 to 4, 8 to 3, 8 to 2, 8 to 1, 8 to 0,
        7 to 0, 6 to 0,
    )

    /** Home stretch cells toward center, index 0–4. */
    val STRETCH: List<List<Pair<Int, Int>>> = listOf(
        listOf(7 to 1, 7 to 2, 7 to 3, 7 to 4, 7 to 5),
        listOf(1 to 7, 2 to 7, 3 to 7, 4 to 7, 5 to 7),
        listOf(7 to 13, 7 to 12, 7 to 11, 7 to 10, 7 to 9),
        listOf(13 to 7, 12 to 7, 11 to 7, 10 to 7, 9 to 7),
    )

    /** Finished-token rest cell for each seat (colored wedge of the center). */
    val HOME_CELLS: List<Pair<Int, Int>> = listOf(
        7 to 6,
        6 to 7,
        7 to 8,
        8 to 7,
    )

    val HUB = 7 to 7

    /** 2×2 yard parking slots, token index 0–3. */
    val YARD_TOKEN: List<List<Pair<Int, Int>>> = listOf(
        listOf(1 to 1, 1 to 4, 4 to 1, 4 to 4),
        listOf(1 to 10, 1 to 13, 4 to 10, 4 to 13),
        listOf(10 to 10, 10 to 13, 13 to 10, 13 to 13),
        listOf(10 to 1, 10 to 4, 13 to 1, 13 to 4),
    )

    val YARD_BOUNDS: List<IntRange> = listOf(
        0..5, 0..5, 9..14, 9..14,
    )
    val YARD_COL_BOUNDS: List<IntRange> = listOf(
        0..5, 9..14, 9..14, 0..5,
    )

    fun cellFor(seat: Int, pos: LudoTokenPos, tokenIndex: Int): Pair<Int, Int> {
        val safeSeat = seat.coerceIn(0, 3)
        val safeToken = tokenIndex.coerceIn(0, 3)
        return when (pos) {
            LudoTokenPos.Yard -> YARD_TOKEN[safeSeat][safeToken]
            is LudoTokenPos.Track -> TRACK.getOrElse(pos.index.mod(TRACK_LEN)) { HUB }
            is LudoTokenPos.Stretch -> STRETCH[safeSeat].getOrElse(pos.index.coerceIn(0, 4)) { HUB }
            LudoTokenPos.Home -> HOME_CELLS[safeSeat]
        }
    }

    fun yardSeat(row: Int, col: Int): Int? {
        for (seat in 0..3) {
            if (row in YARD_BOUNDS[seat] && col in YARD_COL_BOUNDS[seat]) return seat
        }
        return null
    }

    fun stretchSeat(row: Int, col: Int): Int? {
        STRETCH.forEachIndexed { seat, cells ->
            if (cells.any { it.first == row && it.second == col }) return seat
        }
        return null
    }

    fun homeSeat(row: Int, col: Int): Int? {
        HOME_CELLS.forEachIndexed { seat, cell ->
            if (cell.first == row && cell.second == col) return seat
        }
        return null
    }
}
