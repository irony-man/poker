package com.pokr.android.feature.lobby

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pokr.android.core.datastore.SessionPreferences
import com.pokr.android.core.model.ContestView
import com.pokr.android.core.model.GoogleLinkRequest
import com.pokr.android.core.model.MeProfile
import com.pokr.android.core.model.SetEmailRequest
import com.pokr.android.core.model.UpdateMeBody
import com.pokr.android.core.network.EmptyBody
import com.pokr.android.core.network.PokrApi
import com.pokr.android.core.network.SessionTokenHolder
import com.pokr.android.core.network.apiErrorMessage
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import javax.inject.Named
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
    val googleClientId: String? = null,
    val emailDraft: String = "",
    val accountNotice: String? = null,
)

@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val api: PokrApi,
    private val sessionPreferences: SessionPreferences,
    private val tokenHolder: SessionTokenHolder,
    @Named("google_web_client_id") private val bakedGoogleClientId: String,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ProfileUiState())
    val uiState: StateFlow<ProfileUiState> = _uiState.asStateFlow()

    init {
        _uiState.update { it.copy(googleClientId = bakedGoogleClientId.ifBlank { null }) }
        refresh()
    }

    fun onEmailDraftChange(value: String) =
        _uiState.update { it.copy(emailDraft = value.take(254), accountNotice = null) }

    fun saveEmail() {
        val email = _uiState.value.emailDraft.trim()
        if (!android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
            _uiState.update { it.copy(error = "Enter a valid email address") }
            return
        }
        accountAction(
            failure = "Couldn't save email",
            notice = "We sent a confirmation link to $email. Open it to finish setting up recovery.",
        ) { api.setEmail(SetEmailRequest(email)) }
    }

    fun resendVerification() {
        val email = _uiState.value.profile?.email ?: return
        accountAction(failure = "Couldn't resend email", notice = "Sent a new confirmation link to $email.") {
            api.resendVerificationEmail()
        }
    }

    fun linkGoogle(idToken: String) =
        accountAction(failure = "Couldn't connect Google", notice = "Google connected.") {
            api.linkGoogle(GoogleLinkRequest(idToken))
        }

    fun unlinkGoogle() =
        accountAction(failure = "Couldn't disconnect Google", notice = "Google disconnected.") {
            api.unlinkGoogle()
        }

    fun onGoogleError(err: Throwable) {
        if (err is GoogleSignInCancelled) return
        _uiState.update { it.copy(error = err.message ?: "Google sign-in failed") }
    }

    private fun accountAction(failure: String, notice: String, call: suspend () -> MeProfile) {
        viewModelScope.launch {
            _uiState.update { it.copy(saving = true, error = null, accountNotice = null) }
            runCatching { call() }
                .onSuccess { me ->
                    _uiState.update {
                        it.copy(
                            profile = me,
                            saving = false,
                            emailDraft = me.email.orEmpty(),
                            accountNotice = notice,
                        )
                    }
                }
                .onFailure { err ->
                    _uiState.update { it.copy(saving = false, error = err.apiErrorMessage(failure)) }
                }
        }
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
                    it.copy(
                        profile = me,
                        contests = contests,
                        loading = false,
                        emailDraft = it.emailDraft.ifBlank { me.email.orEmpty() },
                    )
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
