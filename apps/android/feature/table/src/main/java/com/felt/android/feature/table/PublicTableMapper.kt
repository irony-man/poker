package com.felt.android.feature.table

import com.felt.android.core.designsystem.TablePlayerUi
import com.felt.android.core.designsystem.TableUiState
import com.felt.android.core.model.PublicTable

object PublicTableMapper {
    fun PublicTable.toTableUi(): TableUiState {
        val winnerSeats = winners.map { it.seat }.toSet()
        val winningCards = if (street == "payout" || street == "showdown") {
            showdownHands
                .filter { it.seat in winnerSeats }
                .flatMap { it.cards }
                .toSet()
        } else {
            emptySet()
        }
        return TableUiState(
            handId = handId,
            street = street,
            community = community,
            pot = pot,
            maxSeats = config.maxSeats,
            dealerButton = dealerButton,
            toAct = toAct,
            actionSeq = actionSeq,
            bigBlind = config.bigBlind,
            winningCards = winningCards,
            handNameBySeat = if (street == "payout" || street == "showdown") {
                buildMap {
                    showdownHands.forEach { put(it.seat, it.handName) }
                    winners.forEach { w ->
                        w.handName?.let { put(w.seat, it) }
                    }
                }
            } else {
                emptyMap()
            },
            winAmountBySeat = if (street == "payout" || street == "showdown") {
                winners.groupBy { it.seat }.mapValues { (_, list) -> list.sumOf { it.amount } }
            } else {
                emptyMap()
            },
            turnEndsAt = turnEndsAt,
            turnTimeMs = config.turnTimeMs.toLong(),
            players = players.map {
                TablePlayerUi(
                    seat = it.seat,
                    userId = it.userId,
                    name = it.name,
                    stack = it.stack,
                    bet = it.bet,
                    status = it.status,
                    hasCards = it.hasCards,
                    holeCards = it.holeCards,
                    avatarId = it.avatarId,
                    avatarUrl = it.avatarUrl,
                )
            },
        )
    }
}
