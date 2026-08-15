package com.pokr.android.feature.progress

const val CHAPTER_SIZE = 10
const val NODE_SPACING = 108f
const val TOP_PAD = 150f
const val BOTTOM_PAD = 240f
const val NODE_SIZE_DP = 86f

enum class NodeStatus {
    Completed,
    Current,
    Locked,
}

enum class NodeBadgeKind {
    Chip,
    Spade,
    Heart,
    Plus,
}

data class ChapterProgress(
    val level: Int,
    val nextMilestone: Int,
    val fill: Float,
    val inChapter: Int,
)

data class NodeWindow(
    val start: Int,
    val end: Int,
)

data class NodePos(
    val level: Int,
    val x: Float,
    val y: Float,
)

fun chapterProgress(handsPlayed: Int): ChapterProgress {
    val level = handsPlayed.coerceAtLeast(0)
    val inChapter = level % CHAPTER_SIZE
    val nextMilestone = level + 1
    val fill = (inChapter.toFloat() / CHAPTER_SIZE) * 100f
    return ChapterProgress(level, nextMilestone, fill, inChapter)
}

fun nodeWindow(level: Int): NodeWindow {
    val current = level.coerceAtLeast(1)
    val start = (current - 12).coerceAtLeast(1)
    val end = maxOf(start + 15, current + 4)
    return NodeWindow(start, end)
}

fun nodeStatus(nodeLevel: Int, handsPlayed: Int): NodeStatus {
    if (handsPlayed <= 0) {
        return if (nodeLevel == 1) NodeStatus.Current else NodeStatus.Locked
    }
    return when {
        nodeLevel < handsPlayed -> NodeStatus.Completed
        nodeLevel == handsPlayed -> NodeStatus.Current
        else -> NodeStatus.Locked
    }
}

fun badgeForNode(nodeLevel: Int, handsPlayed: Int, status: NodeStatus): NodeBadgeKind? {
    if (status == NodeStatus.Locked) return null
    if (status == NodeStatus.Current) return NodeBadgeKind.Chip
    val behind = handsPlayed - nodeLevel
    return when (behind) {
        1 -> NodeBadgeKind.Spade
        2 -> NodeBadgeKind.Heart
        3 -> NodeBadgeKind.Plus
        else -> null
    }
}

fun mapHeight(nodeCount: Int): Float =
    TOP_PAD + (nodeCount - 1).coerceAtLeast(0) * NODE_SPACING + BOTTOM_PAD

/** Zigzag from top-center toward the bottom-right, then back left. */
fun zigzagPositions(startLevel: Int, endLevel: Int, width: Float): List<NodePos> {
    val center = width / 2f
    val amp = (width * 0.3f).coerceIn(72f, 118f)
    val positions = ArrayList<NodePos>(endLevel - startLevel + 1)
    for (level in startLevel..endLevel) {
        val i = level - startLevel
        val wave = kotlin.math.sin(i * 0.82 + 0.55).toFloat()
        positions.add(
            NodePos(
                level = level,
                x = center + wave * amp,
                y = TOP_PAD + i * NODE_SPACING,
            ),
        )
    }
    return positions
}
