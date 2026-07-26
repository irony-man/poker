package com.felt.android.feature.table

import com.felt.android.core.designsystem.TablePlayerUi
import com.felt.android.core.designsystem.TableUiState
import com.felt.android.core.model.PublicTable

object PublicTableMapper {
    fun PublicTable.toTableUi(): TableUiState = TableUiState(
        street = street,
        community = community,
        pot = pot,
        maxSeats = config.maxSeats,
        dealerButton = dealerButton,
        toAct = toAct,
        actionSeq = actionSeq,
        bigBlind = config.bigBlind,
        players = players.map {
            TablePlayerUi(
                seat = it.seat,
                userId = it.userId,
                name = it.name,
                stack = it.stack,
                bet = it.bet,
                status = it.status,
            )
        },
    )
}
