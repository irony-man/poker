package com.pokr.android.feature.lobby

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pokr.android.core.model.PublicLobbyTable
import com.pokr.android.core.network.PokrApi
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class PublicTablesUiState(
    val tables: List<PublicLobbyTable> = emptyList(),
    val loading: Boolean = true,
    val error: String? = null,
    val joiningStakeId: String? = null,
)

@HiltViewModel
class PublicTablesViewModel @Inject constructor(
    private val api: PokrApi,
) : ViewModel() {

    private val _uiState = MutableStateFlow(PublicTablesUiState())
    val uiState: StateFlow<PublicTablesUiState> = _uiState.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.update { it.copy(loading = true, error = null) }
            runCatching { api.getTables().tables }
                .onSuccess { tables ->
                    _uiState.update { it.copy(tables = tables, loading = false) }
                }
                .onFailure { err ->
                    _uiState.update {
                        it.copy(loading = false, error = err.message ?: "Can't reach the server")
                    }
                }
        }
    }

    fun sitDown(
        stakeId: String,
        onJoined: (tableId: String, invite: String) -> Unit,
    ) {
        val table = _uiState.value.tables.find { it.stakeId == stakeId } ?: return
        if (table.seatedCount >= table.maxSeats) {
            _uiState.update { it.copy(error = "This table is full") }
            return
        }
        _uiState.update { it.copy(joiningStakeId = stakeId, error = null) }
        onJoined(table.tableId, table.inviteCode)
        _uiState.update { it.copy(joiningStakeId = null) }
    }
}
