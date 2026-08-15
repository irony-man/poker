package com.pokr.android.core.network

import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import java.util.concurrent.TimeUnit
import javax.inject.Named
import javax.inject.Singleton
import kotlinx.serialization.json.Json
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideJson(): Json = PokrJson

    @Provides
    @Singleton
    fun provideAuthInterceptor(tokenHolder: SessionTokenHolder): Interceptor {
        return Interceptor { chain ->
            val request = chain.request()
            val token = tokenHolder.get()
            val next = if (!token.isNullOrBlank()) {
                request.newBuilder()
                    .header("Authorization", "Bearer $token")
                    .build()
            } else {
                request
            }
            chain.proceed(next)
        }
    }

    @Provides
    @Singleton
    fun provideOkHttpClient(authInterceptor: Interceptor): OkHttpClient {
        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BASIC
        }
        return OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .addInterceptor(logging)
            .pingInterval(20, TimeUnit.SECONDS)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(
        @Named("api_base") baseUrl: String,
        okHttpClient: OkHttpClient,
        json: Json,
    ): Retrofit {
        val contentType = "application/json".toMediaType()
        return Retrofit.Builder()
            .baseUrl(ensureTrailingSlash(baseUrl))
            .client(okHttpClient)
            .addConverterFactory(json.asConverterFactory(contentType))
            .build()
    }

    @Provides
    @Singleton
    fun providePokrApi(retrofit: Retrofit): PokrApi = retrofit.create(PokrApi::class.java)

    @Provides
    @Singleton
    fun providePokerWebSocketClient(
        okHttpClient: OkHttpClient,
        json: Json,
        @Named("ws_url") wsUrl: String,
    ): PokerWebSocketClient = PokerWebSocketClient(okHttpClient, json, wsUrl)

    private fun ensureTrailingSlash(url: String): String =
        if (url.endsWith('/')) url else "$url/"
}
