package com.pokr.android.core.designsystem

import android.content.Context
import android.media.AudioAttributes
import android.media.SoundPool

enum class TableSoundKind {
    Fold,
    Check,
    Call,
    Bet,
    Raise,
    AllIn,
    Deal,
    Flop,
    Turn,
    River,
    Win,
}

/** Table SFX — same MP3s as web `public/sounds`. */
class TableSoundPlayer(context: Context) {
    @Volatile
    var enabled: Boolean = true

    private val appContext = context.applicationContext

    private val pool: SoundPool = SoundPool.Builder()
        .setMaxStreams(4)
        .setAudioAttributes(
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_GAME)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build(),
        )
        .build()

    private val soundIds: Map<TableSoundKind, Int> = TableSoundKind.entries.associateWith { kind ->
        pool.load(appContext, rawRes(kind), 1)
    }

    fun play(kind: TableSoundKind) {
        if (!enabled) return
        val id = soundIds[kind] ?: return
        pool.play(id, 1f, 1f, 1, 0, 1f)
    }

    fun playAction(action: String?) {
        val kind = actionToSound(action) ?: return
        play(kind)
    }

    fun onTableTransition(
        prevStreet: String?,
        prevHandId: String?,
        street: String,
        handId: String,
    ) {
        if (prevStreet == null && prevHandId == null) return
        val streetChanged = prevStreet != null && prevStreet != street
        val handChanged = prevHandId != null && prevHandId != handId
        when {
            street == "payout" && prevStreet != "payout" -> play(TableSoundKind.Win)
            streetChanged && street == "flop" -> play(TableSoundKind.Flop)
            streetChanged && street == "turn" -> play(TableSoundKind.Turn)
            streetChanged && street == "river" -> play(TableSoundKind.River)
            (handChanged || (streetChanged && street == "preflop")) && street == "preflop" ->
                play(TableSoundKind.Deal)
        }
    }

    fun release() {
        pool.release()
    }

    companion object {
        fun actionToSound(action: String?): TableSoundKind? {
            if (action.isNullOrBlank()) return null
            return when (action.lowercase().trim()) {
                "fold" -> TableSoundKind.Fold
                "check" -> TableSoundKind.Check
                "call" -> TableSoundKind.Call
                "bet" -> TableSoundKind.Bet
                "raise" -> TableSoundKind.Raise
                "allin", "all-in", "all_in" -> TableSoundKind.AllIn
                else -> null
            }
        }

        private fun rawRes(kind: TableSoundKind): Int = when (kind) {
            TableSoundKind.Fold -> R.raw.fold
            TableSoundKind.Check -> R.raw.check
            TableSoundKind.Call -> R.raw.call
            TableSoundKind.Bet -> R.raw.bet
            TableSoundKind.Raise -> R.raw.raise
            TableSoundKind.AllIn -> R.raw.allin
            TableSoundKind.Deal -> R.raw.deal
            TableSoundKind.Flop -> R.raw.flop
            TableSoundKind.Turn -> R.raw.turn
            TableSoundKind.River -> R.raw.river
            TableSoundKind.Win -> R.raw.win
        }
    }
}
