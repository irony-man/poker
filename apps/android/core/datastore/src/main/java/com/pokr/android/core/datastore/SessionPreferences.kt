package com.pokr.android.core.datastore

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import com.pokr.android.core.model.SessionDto
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SessionPreferences @Inject constructor(
    private val dataStore: DataStore<Preferences>,
) {
    val sessionFlow: Flow<SessionDto?> = dataStore.data.map { prefs ->
        val userId = prefs[KEY_USER_ID] ?: return@map null
        val name = prefs[KEY_NAME] ?: return@map null
        val ticket = prefs[KEY_TICKET] ?: return@map null
        val sessionToken = prefs[KEY_SESSION_TOKEN] ?: return@map null
        SessionDto(
            userId = userId,
            username = prefs[KEY_USERNAME] ?: name,
            name = name,
            ticket = ticket,
            sessionToken = sessionToken,
            avatarId = prefs[KEY_AVATAR_ID] ?: 0,
        )
    }

    suspend fun getSession(): SessionDto? = sessionFlow.first()

    suspend fun saveSession(session: SessionDto) {
        dataStore.edit { prefs ->
            prefs[KEY_USER_ID] = session.userId
            prefs[KEY_USERNAME] = session.username.ifBlank { session.name }
            prefs[KEY_NAME] = session.name
            prefs[KEY_TICKET] = session.ticket
            prefs[KEY_SESSION_TOKEN] = session.sessionToken
            prefs[KEY_AVATAR_ID] = session.avatarId
        }
    }

    suspend fun getAvatarId(): Int = dataStore.data.first()[KEY_AVATAR_ID] ?: 0

    suspend fun saveAvatarId(avatarId: Int) {
        dataStore.edit { prefs ->
            prefs[KEY_AVATAR_ID] = avatarId.coerceIn(0, 7)
        }
    }

    suspend fun getTableColorId(): Int = dataStore.data.first()[KEY_TABLE_COLOR_ID] ?: 0

    suspend fun saveTableColorId(id: Int) {
        dataStore.edit { prefs ->
            prefs[KEY_TABLE_COLOR_ID] = ((id % 9) + 9) % 9
        }
    }

    val uiThemeFlow: Flow<String> = dataStore.data.map { prefs ->
        if (prefs[KEY_UI_THEME] == "v2") "v2" else "v1"
    }

    suspend fun getUiTheme(): String = uiThemeFlow.first()

    suspend fun saveUiTheme(theme: String) {
        dataStore.edit { prefs ->
            prefs[KEY_UI_THEME] = if (theme == "v2") "v2" else "v1"
        }
    }

    suspend fun loadOfflineHandQueueJson(): String =
        dataStore.data.first()[KEY_OFFLINE_HANDS] ?: "[]"

    suspend fun saveOfflineHandQueueJson(json: String) {
        dataStore.edit { prefs ->
            prefs[KEY_OFFLINE_HANDS] = json
        }
    }

    suspend fun clear() {
        dataStore.edit { it.clear() }
    }

    companion object {
        private val KEY_USER_ID = stringPreferencesKey("user_id")
        private val KEY_USERNAME = stringPreferencesKey("username")
        private val KEY_NAME = stringPreferencesKey("name")
        private val KEY_TICKET = stringPreferencesKey("ticket")
        private val KEY_SESSION_TOKEN = stringPreferencesKey("session_token")
        private val KEY_AVATAR_ID = intPreferencesKey("avatar_id")
        private val KEY_TABLE_COLOR_ID = intPreferencesKey("table_color_id")
        private val KEY_UI_THEME = stringPreferencesKey("ui_theme")
        private val KEY_OFFLINE_HANDS = stringPreferencesKey("offline_hand_queue")
    }
}
