package com.pokr.android.core.model

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonPrimitive
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

private val RankChar = mapOf(
    14 to "A",
    13 to "K",
    12 to "Q",
    11 to "J",
    10 to "T",
    9 to "9",
    8 to "8",
    7 to "7",
    6 to "6",
    5 to "5",
    4 to "4",
    3 to "3",
    2 to "2",
)

private val LenientJson = Json {
    ignoreUnknownKeys = true
    isLenient = true
}

data class PlayedHandLevel(
    val id: String,
    val handId: String,
    val source: String,
    val startedAt: Long,
    val holeCards: Pair<String, String>?,
    val community: List<String>,
    val won: Boolean,
    val winnerName: String?,
    val handName: String?,
)

fun cardCode(raw: JsonElement?): String? {
    if (raw == null) return null
    when (raw) {
        is JsonPrimitive -> {
            val s = raw.contentOrNull ?: return null
            return if (s.length >= 2) s else null
        }
        is JsonObject -> {
            val suit = raw["suit"]?.jsonPrimitive?.contentOrNull ?: return null
            val rankEl = raw["rank"] ?: return null
            val rankPrim = rankEl.jsonPrimitive
            val rankNum = rankPrim.intOrNull
            if (rankNum != null) {
                val ch = RankChar[rankNum] ?: return null
                return "$ch$suit"
            }
            val rankStr = rankPrim.contentOrNull ?: return null
            return "$rankStr$suit"
        }
        else -> return null
    }
}

fun cardCodes(raw: JsonElement?): List<String> {
    val arr = raw as? JsonArray ?: return emptyList()
    return arr.mapNotNull { cardCode(it) }
}

fun parsePlayedHand(row: MyHandRow, userId: String): PlayedHandLevel {
    val result = parseResult(row.resultJson)
    val players = result?.get("players")?.jsonArrayOrNull().orEmpty()
    var seat: Int? = null
    var hole: List<String> = emptyList()
    for (p in players) {
        val rec = p as? JsonObject ?: continue
        if (rec["userId"]?.jsonPrimitive?.contentOrNull != userId) continue
        seat = rec["seat"]?.jsonPrimitive?.intOrNull
        hole = cardCodes(rec["holeCards"])
        break
    }
    val winnersRaw = result?.get("winners")?.jsonArrayOrNull().orEmpty()
    var won = false
    var winnerName: String? = null
    var handName: String? = null
    for (w in winnersRaw) {
        val rec = w as? JsonObject ?: continue
        val wSeat = rec["seat"]?.jsonPrimitive?.intOrNull
        if (wSeat != null && wSeat == seat) {
            won = true
            handName = rec["handName"]?.jsonPrimitive?.contentOrNull
        }
        if (winnerName == null) {
            winnerName = rec["name"]?.jsonPrimitive?.contentOrNull?.takeIf { it.isNotBlank() }
        }
    }
    val pair = if (hole.size >= 2) hole[0] to hole[1] else null
    return PlayedHandLevel(
        id = row.id,
        handId = row.handId,
        source = row.source.ifBlank { "online" },
        startedAt = startedAtMs(row.startedAt),
        holeCards = pair,
        community = cardCodes(result?.get("community")),
        won = won,
        winnerName = winnerName,
        handName = handName,
    )
}

/** Newest fetched hand maps to [handsPlayed], then count backward. */
fun handsByLevel(hands: List<PlayedHandLevel>, handsPlayed: Int): Map<Int, PlayedHandLevel> {
    val map = LinkedHashMap<Int, PlayedHandLevel>()
    hands.forEachIndexed { i, hand ->
        val level = handsPlayed - i
        if (level >= 1) map[level] = hand
    }
    return map
}

fun formatHandWhen(ms: Long): String {
    if (ms <= 0L) return ""
    return try {
        val fmt = SimpleDateFormat("MMM d, h:mm a", Locale.getDefault())
        fmt.timeZone = TimeZone.getDefault()
        fmt.format(Date(ms))
    } catch (_: Exception) {
        ""
    }
}

private fun parseResult(resultJson: String): JsonObject? {
    if (resultJson.isBlank()) return null
    return try {
        when (val parsed = LenientJson.parseToJsonElement(resultJson)) {
            is JsonObject -> parsed
            else -> null
        }
    } catch (_: Exception) {
        null
    }
}

private fun startedAtMs(raw: String): Long {
    if (raw.isBlank()) return 0L
    raw.toLongOrNull()?.let { return it }
    return try {
        // ISO-8601 from Nest / Postgres
        java.time.Instant.parse(raw).toEpochMilli()
    } catch (_: Exception) {
        try {
            val withMillis = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
                timeZone = TimeZone.getTimeZone("UTC")
            }
            withMillis.parse(raw)?.time ?: 0L
        } catch (_: Exception) {
            0L
        }
    }
}

private fun JsonElement.jsonArrayOrNull(): JsonArray? = this as? JsonArray
