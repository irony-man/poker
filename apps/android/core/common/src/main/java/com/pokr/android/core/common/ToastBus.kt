package com.pokr.android.core.common

import java.util.concurrent.atomic.AtomicLong
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

enum class ToastKind { Error, Success, Info }

data class ToastMessage(
    val id: Long,
    val kind: ToastKind,
    val text: String,
    val durationMs: Long,
    /** Bumped when a duplicate refreshes this toast (restarts its timer). */
    val shownAt: Long,
    val leaving: Boolean = false,
)

/**
 * App-wide notification toasts (mirrors web `@/lib/toast`). Safe to call from any thread;
 * rendered by `PokrToastHost` in core:designsystem.
 */
object ToastBus {
    const val DEFAULT_DURATION_MS = 5_000L
    const val EXIT_MS = 280L
    const val VISIBLE_CAP = 3

    private val nextId = AtomicLong(1)
    private val _toasts = MutableStateFlow<List<ToastMessage>>(emptyList())
    val toasts: StateFlow<List<ToastMessage>> = _toasts.asStateFlow()

    fun error(text: String, durationMs: Long = DEFAULT_DURATION_MS) =
        push(ToastKind.Error, text, durationMs)

    fun success(text: String, durationMs: Long = DEFAULT_DURATION_MS) =
        push(ToastKind.Success, text, durationMs)

    fun info(text: String, durationMs: Long = DEFAULT_DURATION_MS) =
        push(ToastKind.Info, text, durationMs)

    fun push(kind: ToastKind, text: String, durationMs: Long = DEFAULT_DURATION_MS) {
        val trimmed = text.trim()
        if (trimmed.isEmpty()) return
        val now = System.currentTimeMillis()
        _toasts.update { items ->
            val existing = items.firstOrNull { !it.leaving && it.kind == kind && it.text == trimmed }
            if (existing != null) {
                items.map {
                    if (it.id == existing.id) it.copy(shownAt = now, durationMs = durationMs) else it
                }
            } else {
                val next = items + ToastMessage(
                    id = nextId.getAndIncrement(),
                    kind = kind,
                    text = trimmed,
                    durationMs = durationMs,
                    shownAt = now,
                )
                next.takeLast(VISIBLE_CAP)
            }
        }
    }

    /** Starts the exit animation; the host calls [remove] once it finishes. */
    fun dismiss(id: Long) {
        _toasts.update { items -> items.map { if (it.id == id) it.copy(leaving = true) else it } }
    }

    fun remove(id: Long) {
        _toasts.update { items -> items.filterNot { it.id == id } }
    }

    fun clear() {
        _toasts.value = emptyList()
    }
}
