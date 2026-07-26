package com.felt.android

import android.app.Application
import com.clerk.api.Clerk
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class FeltApp : Application() {
    override fun onCreate() {
        super.onCreate()
        Clerk.initialize(
            this,
            publishableKey = BuildConfig.CLERK_PUBLISHABLE_KEY,
        )
    }
}
