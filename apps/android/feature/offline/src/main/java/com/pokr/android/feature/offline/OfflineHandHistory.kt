package com.pokr.android.feature.offline

import com.pokr.android.core.model.ChatMessage
import com.pokr.android.core.model.UploadChatLine
import com.pokr.android.core.model.UploadHandRequest
import com.pokr.android.engine.Card
import com.pokr.android.engine.EngineEvent
import com.pokr.android.engine.HandState
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.util.UUID

internal fun newOfflineTableId(userId: String?): String {
    val who = userId?.takeIf { it.isNotBlank() && it != "offline-human" } ?: "anon"
    return "offline-$who-${UUID.randomUUID().toString().take(8)}"
}

internal fun cardJson(card: Card): JsonObject = buildJsonObject {
    put("rank", card.rank)
    put("suit", card.suit.char.toString())
}

internal fun engineEventJson(event: EngineEvent, at: Long): JsonObject = buildJsonObject {
    put("at", at)
    when (event) {
        is EngineEvent.HandStarted -> {
            put("type", "hand_started")
            put("handId", event.handId)
        }
        is EngineEvent.BlindsPosted -> {
            put("type", "blinds_posted")
            put("sb", event.sb)
            put("bb", event.bb)
            put("sbSeat", event.sbSeat)
            put("bbSeat", event.bbSeat)
        }
        EngineEvent.DealtHole -> put("type", "dealt_hole")
        is EngineEvent.StreetAdvanced -> {
            put("type", "street")
            put("street", event.street.name.lowercase())
            put(
                "cards",
                buildJsonArray {
                    event.cards.forEach { add(cardJson(it)) }
                },
            )
        }
        is EngineEvent.ActionApplied -> {
            put("type", "action")
            put("seat", event.seat)
            put("action", event.action.name.lowercase())
            put("amount", event.amount)
        }
        is EngineEvent.Turn -> {
            put("type", "turn")
            put("seat", event.seat)
        }
        is EngineEvent.HandEnded -> {
            put("type", "hand_ended")
            put(
                "winners",
                buildJsonArray {
                    event.winners.forEach { w ->
                        add(
                            buildJsonObject {
                                put("seat", w.seat)
                                put("amount", w.amount)
                                w.handName?.let { put("handName", it) }
                            },
                        )
                    }
                },
            )
        }
        is EngineEvent.Error -> {
            put("type", "error")
            put("message", event.message)
        }
    }
}

internal fun buildOfflineHandRequest(
    tableId: String,
    state: HandState,
    startedAt: Long,
    actions: List<JsonObject>,
    chat: List<ChatMessage>,
): UploadHandRequest {
    val result = buildJsonObject {
        put(
            "winners",
            buildJsonArray {
                state.winners.forEach { w ->
                    add(
                        buildJsonObject {
                            put("seat", w.seat)
                            put("amount", w.amount)
                            w.handName?.let { put("handName", it) }
                        },
                    )
                }
            },
        )
        put(
            "community",
            buildJsonArray { state.community.forEach { add(cardJson(it)) } },
        )
        put(
            "players",
            buildJsonArray {
                state.players.forEach { p ->
                    add(
                        buildJsonObject {
                            put("seat", p.seat)
                            if (p.userId != null) put("userId", p.userId!!) else put("userId", JsonNull)
                            if (p.name != null) put("name", p.name!!) else put("name", JsonNull)
                            put("stack", p.stack)
                            put("revealed", p.revealed)
                            val holes = p.holeCards
                            if (holes != null) {
                                put(
                                    "holeCards",
                                    buildJsonArray {
                                        add(cardJson(holes.first))
                                        add(cardJson(holes.second))
                                    },
                                )
                            } else {
                                put("holeCards", JsonNull)
                            }
                        },
                    )
                }
            },
        )
        put("actions", JsonArray(actions))
        put(
            "chat",
            buildJsonArray {
                chat.forEach { line ->
                    add(
                        buildJsonObject {
                            put("at", line.at)
                            put("userId", line.userId)
                            put("name", line.name)
                            put("text", line.text)
                        },
                    )
                }
            },
        )
    }
    return UploadHandRequest(
        tableId = tableId,
        handId = state.handId,
        startedAt = startedAt,
        endedAt = System.currentTimeMillis(),
        source = "offline",
        result = result,
        chat = chat.map { UploadChatLine(it.at, it.userId, it.name, it.text) },
    )
}
