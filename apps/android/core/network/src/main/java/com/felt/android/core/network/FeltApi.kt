package com.felt.android.core.network

import com.felt.android.core.model.ContestListResponse
import com.felt.android.core.model.ContestResponse
import com.felt.android.core.model.CreateContestRequest
import com.felt.android.core.model.CreateTableRequest
import com.felt.android.core.model.CreateTableResponse
import com.felt.android.core.model.InviteResolveResponse
import com.felt.android.core.model.RegisterRequest
import com.felt.android.core.model.SessionDto
import com.felt.android.core.model.TicketRequest
import com.felt.android.core.model.UserIdBody
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.Path

interface FeltApi {
    @POST("api/register")
    suspend fun register(
        @Body body: RegisterRequest,
        @Header("Authorization") authorization: String? = null,
    ): SessionDto

    @POST("api/ticket")
    suspend fun refreshTicket(
        @Body body: TicketRequest,
        @Header("Authorization") authorization: String? = null,
    ): SessionDto

    @POST("api/tables")
    suspend fun createTable(
        @Body body: CreateTableRequest,
        @Header("Authorization") authorization: String? = null,
    ): CreateTableResponse

    @GET("api/tables/invite/{code}")
    suspend fun resolveInvite(@Path("code") code: String): InviteResolveResponse

    @POST("api/contests")
    suspend fun createContest(
        @Body body: CreateContestRequest,
        @Header("Authorization") authorization: String? = null,
    ): ContestResponse

    @GET("api/contests")
    suspend fun listContests(): ContestListResponse

    @GET("api/contests/invite/{code}")
    suspend fun resolveContestInvite(@Path("code") code: String): ContestResponse

    @GET("api/contests/{id}")
    suspend fun getContest(@Path("id") id: String): ContestResponse

    @POST("api/contests/{id}/register")
    suspend fun registerContest(
        @Path("id") id: String,
        @Body body: UserIdBody,
        @Header("Authorization") authorization: String? = null,
    ): ContestResponse

    @POST("api/contests/{id}/unregister")
    suspend fun unregisterContest(
        @Path("id") id: String,
        @Body body: UserIdBody,
        @Header("Authorization") authorization: String? = null,
    ): ContestResponse

    @POST("api/contests/{id}/start")
    suspend fun startContest(
        @Path("id") id: String,
        @Body body: UserIdBody,
        @Header("Authorization") authorization: String? = null,
    ): ContestResponse
}
