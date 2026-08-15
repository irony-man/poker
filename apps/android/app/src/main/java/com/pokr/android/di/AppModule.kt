package com.pokr.android.di

import android.content.Context
import com.pokr.android.BuildConfig
import com.pokr.android.core.designsystem.TableSoundPlayer
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Named
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    @Named("api_base")
    fun provideApiBaseUrl(): String = BuildConfig.POKR_API_URL

    @Provides
    @Singleton
    @Named("ws_url")
    fun provideWsUrl(): String = BuildConfig.POKR_WS_URL

    @Provides
    @Singleton
    fun provideTableSoundPlayer(
        @ApplicationContext context: Context,
    ): TableSoundPlayer = TableSoundPlayer(context)
}
