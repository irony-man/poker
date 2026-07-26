package com.felt.android.di

import com.felt.android.BuildConfig
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Named
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    @Named("api_base")
    fun provideApiBaseUrl(): String = BuildConfig.FELT_API_URL

    @Provides
    @Singleton
    @Named("ws_url")
    fun provideWsUrl(): String = BuildConfig.FELT_WS_URL
}
