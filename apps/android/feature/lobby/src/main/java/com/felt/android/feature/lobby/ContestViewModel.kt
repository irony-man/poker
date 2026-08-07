package com.felt.android.feature.lobby

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.toRoute
import com.felt.android.core.datastore.SessionPreferences
import com.felt.android.core.model.ContestView
import com.felt.android.core.network.FeltApi
import com.felt.android.core.network.SessionTokenHolder
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

data class ContestUiState(
    val contest: ContestView? = null,
    val userId: String? = null,
    val busy: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class ContestViewModel @Inject constructor(
    private val feltApi: FeltApi,
    private val sessionPreferences: SessionPreferences,
    private val tokenHolder: SessionTokenHolder,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val contestId = savedStateHandle.toRoute<ContestRoute>().contestId

    private val _uiState = MutableStateFlow(ContestUiState())
    val uiState: StateFlow<ContestUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            val session = sessionPreferences.getSession()
            if (session != null) {
                tokenHolder.set(session.sessionToken)
            }
            _uiState.update { it.copy(userId = session?.userId) }
            while (isActive) {
                refresh()
                delay(2500)
            }
        }
    }

    private suspend fun refresh() {
        runCatching { feltApi.getContest(contestId).contest }
            .onSuccess { c -> _uiState.update { it.copy(contest = c, error = null) } }
            .onFailure { err ->
                if (_uiState.value.contest == null) {
                    _uiState.update { it.copy(error = err.message ?: "Not found") }
                }
            }
    }

    fun register() {
        if (_uiState.value.userId == null) return
        viewModelScope.launch {
            _uiState.update { it.copy(busy = true, error = null) }
            runCatching { feltApi.registerContest(contestId).contest }
                .onSuccess { c -> _uiState.update { it.copy(busy = false, contest = c) } }
                .onFailure { err ->
                    _uiState.update { it.copy(busy = false, error = err.message ?: "Failed") }
                }
        }
    }

    fun unregister() {
        if (_uiState.value.userId == null) return
        viewModelScope.launch {
            _uiState.update { it.copy(busy = true, error = null) }
            runCatching { feltApi.unregisterContest(contestId).contest }
                .onSuccess { c -> _uiState.update { it.copy(busy = false, contest = c) } }
                .onFailure { err ->
                    _uiState.update { it.copy(busy = false, error = err.message ?: "Failed") }
                }
        }
    }

    fun start() {
        if (_uiState.value.userId == null) return
        viewModelScope.launch {
            _uiState.update { it.copy(busy = true, error = null) }
            runCatching { feltApi.startContest(contestId).contest }
                .onSuccess { c -> _uiState.update { it.copy(busy = false, contest = c) } }
                .onFailure { err ->
                    _uiState.update { it.copy(busy = false, error = err.message ?: "Failed") }
                }
        }
    }

    fun assignedTableId(): String? {
        val state = _uiState.value
        val userId = state.userId ?: return null
        return state.contest?.assignments?.find { it.userId == userId }?.tableId
    }
}
