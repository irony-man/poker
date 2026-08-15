package com.pokr.android.core.datastore

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.preferencesDataStore

internal val Context.sessionDataStore: DataStore<Preferences> by preferencesDataStore(
    name = "pokr_session",
)
