package com.pokr.android.feature.progress

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pokr.android.core.datastore.SessionPreferences
import com.pokr.android.core.model.PlayedHandLevel
import com.pokr.android.core.model.handsByLevel
import com.pokr.android.core.model.parsePlayedHand
import com.pokr.android.core.network.PokrApi
import com.pokr.android.core.network.SessionTokenHolder
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class HandsUiState(
    val loading: Boolean = true,
    val userId: String = "",
    val handsPlayed: Int = 0,
    val tableColorId: Int = 0,
    val hands: List<PlayedHandLevel> = emptyList(),
    val byLevel: Map<Int, PlayedHandLevel> = emptyMap(),
    val listOpen: Boolean = false,
    val selectedLevel: Int? = null,
)

@HiltViewModel
class HandsViewModel @Inject constructor(
    private val api: PokrApi,
    private val sessionPreferences: SessionPreferences,
    private val tokenHolder: SessionTokenHolder,
) : ViewModel() {

    private val _uiState = MutableStateFlow(HandsUiState())
    val uiState: StateFlow<HandsUiState> = _uiState.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.update { it.copy(loading = true) }
            val session = sessionPreferences.getSession()
            if (session == null || session.sessionToken.isBlank()) {
                _uiState.update {
                    HandsUiState(loading = false)
                }
                return@launch
            }
            tokenHolder.set(session.sessionToken)
            val me = runCatching { api.getMe() }.getOrNull()
            val handsPlayed = me?.handsPlayed?.coerceAtLeast(0) ?: 0
            val userId = me?.id ?: session.userId
            val tableColorId = me?.tableColorId ?: sessionPreferences.getTableColorId()
            sessionPreferences.saveTableColorId(tableColorId)
            val rows = runCatching { api.getMyHands(limit = 50).hands }.getOrElse { emptyList() }
            val parsed = rows.map { parsePlayedHand(it, userId) }
            _uiState.update {
                it.copy(
                    loading = false,
                    userId = userId,
                    handsPlayed = handsPlayed,
                    tableColorId = tableColorId,
                    hands = parsed,
                    byLevel = handsByLevel(parsed, handsPlayed),
                    selectedLevel = null,
                )
            }
        }
    }

    fun toggleList() {
        _uiState.update { it.copy(listOpen = !it.listOpen, selectedLevel = null) }
    }

    fun setListOpen(open: Boolean) {
        _uiState.update { it.copy(listOpen = open, selectedLevel = if (open) null else it.selectedLevel) }
    }

    fun selectLevel(level: Int?) {
        _uiState.update { it.copy(selectedLevel = level) }
    }
}
