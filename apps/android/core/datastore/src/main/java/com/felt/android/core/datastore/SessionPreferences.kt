package com.felt.android.core.datastore

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import com.felt.android.core.model.SessionDto
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
        SessionDto(
            userId = userId,
            name = name,
            ticket = ticket,
            avatarId = prefs[KEY_AVATAR_ID] ?: 0,
        )
    }

    suspend fun getSession(): SessionDto? = sessionFlow.first()

    suspend fun saveSession(session: SessionDto) {
        dataStore.edit { prefs ->
            prefs[KEY_USER_ID] = session.userId
            prefs[KEY_NAME] = session.name
            prefs[KEY_TICKET] = session.ticket
            prefs[KEY_AVATAR_ID] = session.avatarId
        }
    }

    suspend fun getAvatarId(): Int = dataStore.data.first()[KEY_AVATAR_ID] ?: 0

    suspend fun saveAvatarId(avatarId: Int) {
        dataStore.edit { prefs ->
            prefs[KEY_AVATAR_ID] = avatarId.coerceIn(0, 7)
        }
    }

    suspend fun clear() {
        dataStore.edit { it.clear() }
    }

    companion object {
        private val KEY_USER_ID = stringPreferencesKey("user_id")
        private val KEY_NAME = stringPreferencesKey("name")
        private val KEY_TICKET = stringPreferencesKey("ticket")
        private val KEY_AVATAR_ID = intPreferencesKey("avatar_id")
    }
}
