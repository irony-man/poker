package com.pokr.android.feature.snakes

/** Classic teleports — keep in sync with packages/snakes-engine TELEPORTS. */
object SnakesLayout {
    val TELEPORTS: Map<Int, Int> = mapOf(
        4 to 14, 9 to 31, 20 to 38, 28 to 84, 40 to 59, 51 to 67, 63 to 81, 71 to 91,
        17 to 7, 54 to 34, 62 to 19, 64 to 60, 87 to 24, 93 to 73, 95 to 75, 99 to 78,
    )

    /** Row-major zigzag 1–100 → (col, row) on a 10×10 board, bottom-left start. */
    fun cellFor(position: Int): Pair<Int, Int> {
        if (position <= 0) return -1 to -1
        val n = position.coerceIn(1, 100) - 1
        val rowFromBottom = n / 10
        val colInRow = n % 10
        val row = 9 - rowFromBottom
        val col = if (rowFromBottom % 2 == 0) colInRow else 9 - colInRow
        return col to row
    }
}
