package com.pokr.android.feature.lobby

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pokr.android.core.datastore.SessionPreferences
import com.pokr.android.core.model.ContestView
import com.pokr.android.core.model.MeProfile
import com.pokr.android.core.model.UpdateMeBody
import com.pokr.android.core.network.EmptyBody
import com.pokr.android.core.network.PokrApi
import com.pokr.android.core.network.SessionTokenHolder
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class ProfileUiState(
    val tab: String = "overview",
    val profile: MeProfile? = null,
    val contests: List<ContestView> = emptyList(),
    val loading: Boolean = true,
    val saving: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val api: PokrApi,
    private val sessionPreferences: SessionPreferences,
    private val tokenHolder: SessionTokenHolder,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ProfileUiState())
    val uiState: StateFlow<ProfileUiState> = _uiState.asStateFlow()

    init {
        refresh()
    }

    fun onTabChange(tab: String) = _uiState.update { it.copy(tab = tab) }

    fun refresh() {
        viewModelScope.launch {
            _uiState.update { it.copy(loading = true, error = null) }
            runCatching {
                val me = api.getMe()
                val contests = runCatching { api.listMyContests().contests }.getOrDefault(emptyList())
                me to contests
            }.onSuccess { (me, contests) ->
                sessionPreferences.saveTableColorId(me.tableColorId)
                sessionPreferences.saveUiTheme(me.uiTheme)
                sessionPreferences.saveTableLayout(me.tableLayout)
                sessionPreferences.saveSfxMuted(me.sfxMuted)
                _uiState.update {
                    it.copy(profile = me, contests = contests, loading = false)
                }
            }.onFailure { err ->
                _uiState.update {
                    it.copy(loading = false, error = err.message ?: "Couldn't load profile")
                }
            }
        }
    }

    fun saveTableColor(id: Int) {
        viewModelScope.launch {
            _uiState.update { it.copy(saving = true, error = null) }
            runCatching { api.patchMe(UpdateMeBody(tableColorId = id.coerceIn(0, 8))) }
                .onSuccess { me ->
                    sessionPreferences.saveTableColorId(me.tableColorId)
                    _uiState.update { it.copy(profile = me, saving = false) }
                }
                .onFailure { err ->
                    _uiState.update {
                        it.copy(saving = false, error = err.message ?: "Couldn't save theme")
                    }
                }
        }
    }

    fun saveUiTheme(theme: String) {
        val next = if (theme == "v2") "v2" else "v1"
        viewModelScope.launch {
            _uiState.update { it.copy(saving = true, error = null) }
            sessionPreferences.saveUiTheme(next)
            runCatching { api.patchMe(UpdateMeBody(uiTheme = next)) }
                .onSuccess { me ->
                    sessionPreferences.saveUiTheme(me.uiTheme)
                    _uiState.update { it.copy(profile = me, saving = false) }
                }
                .onFailure { err ->
                    _uiState.update {
                        it.copy(saving = false, error = err.message ?: "Couldn't save look")
                    }
                }
        }
    }

    fun saveTableLayout(layout: String) {
        val next = if (layout == "v2") "v2" else "v1"
        viewModelScope.launch {
            _uiState.update { it.copy(saving = true, error = null) }
            sessionPreferences.saveTableLayout(next)
            runCatching { api.patchMe(UpdateMeBody(tableLayout = next)) }
                .onSuccess { me ->
                    sessionPreferences.saveTableLayout(me.tableLayout)
                    _uiState.update { it.copy(profile = me, saving = false) }
                }
                .onFailure { err ->
                    _uiState.update {
                        it.copy(saving = false, error = err.message ?: "Couldn't save table layout")
                    }
                }
        }
    }

    fun saveSfxMuted(muted: Boolean) {
        viewModelScope.launch {
            _uiState.update { it.copy(saving = true, error = null) }
            sessionPreferences.saveSfxMuted(muted)
            runCatching { api.patchMe(UpdateMeBody(sfxMuted = muted)) }
                .onSuccess { me ->
                    sessionPreferences.saveSfxMuted(me.sfxMuted)
                    _uiState.update { it.copy(profile = me, saving = false) }
                }
                .onFailure { err ->
                    _uiState.update {
                        it.copy(saving = false, error = err.message ?: "Couldn't save sounds")
                    }
                }
        }
    }

    fun signOut(onDone: () -> Unit) {
        viewModelScope.launch {
            runCatching { api.logout(EmptyBody()) }
            tokenHolder.clear()
            sessionPreferences.clear()
            onDone()
        }
    }
}
