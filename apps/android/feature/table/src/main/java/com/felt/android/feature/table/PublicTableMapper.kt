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
            street = street,
            community = community,
            pot = pot,
            maxSeats = config.maxSeats,
            dealerButton = dealerButton,
            toAct = toAct,
            actionSeq = actionSeq,
            bigBlind = config.bigBlind,
            winningCards = winningCards,
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
                    holeCards = it.holeCards,
                )
            },
        )
    }
}
