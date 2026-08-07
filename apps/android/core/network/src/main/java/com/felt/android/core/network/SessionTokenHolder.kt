package com.felt.android.core.network

import java.util.concurrent.atomic.AtomicReference
import javax.inject.Inject
import javax.inject.Singleton

/** Holds the current Bearer session token for OkHttp. */
@Singleton
class SessionTokenHolder @Inject constructor() {
    private val token = AtomicReference<String?>(null)

    fun get(): String? = token.get()

    fun set(value: String?) {
        token.set(value)
    }

    fun clear() {
        token.set(null)
    }
}
