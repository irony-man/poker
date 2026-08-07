package com.felt.android.core.network

import com.felt.android.core.model.ContestListResponse
import com.felt.android.core.model.ContestResponse
import com.felt.android.core.model.CreateContestRequest
import com.felt.android.core.model.CreateTableRequest
import com.felt.android.core.model.CreateTableResponse
import com.felt.android.core.model.InviteResolveResponse
import com.felt.android.core.model.LoginRequest
import com.felt.android.core.model.SessionDto
import com.felt.android.core.model.SignupRequest
import kotlinx.serialization.Serializable
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

@Serializable
class EmptyBody

interface FeltApi {
    @POST("api/signup")
    suspend fun signup(@Body body: SignupRequest): SessionDto

    @POST("api/login")
    suspend fun login(@Body body: LoginRequest): SessionDto

    @POST("api/logout")
    suspend fun logout(@Body body: EmptyBody = EmptyBody()): Unit

    @POST("api/ticket")
    suspend fun refreshTicket(@Body body: EmptyBody = EmptyBody()): SessionDto

    @POST("api/tables")
    suspend fun createTable(@Body body: CreateTableRequest): CreateTableResponse

    @GET("api/tables/invite/{code}")
    suspend fun resolveInvite(@Path("code") code: String): InviteResolveResponse

    @POST("api/contests")
    suspend fun createContest(@Body body: CreateContestRequest): ContestResponse

    @GET("api/contests")
    suspend fun listContests(): ContestListResponse

    @GET("api/contests/invite/{code}")
    suspend fun resolveContestInvite(@Path("code") code: String): ContestResponse

    @GET("api/contests/{id}")
    suspend fun getContest(@Path("id") id: String): ContestResponse

    @POST("api/contests/{id}/register")
    suspend fun registerContest(
        @Path("id") id: String,
        @Body body: EmptyBody = EmptyBody(),
    ): ContestResponse

    @POST("api/contests/{id}/unregister")
    suspend fun unregisterContest(
        @Path("id") id: String,
        @Body body: EmptyBody = EmptyBody(),
    ): ContestResponse

    @POST("api/contests/{id}/start")
    suspend fun startContest(
        @Path("id") id: String,
        @Body body: EmptyBody = EmptyBody(),
    ): ContestResponse
}
