package com.felt.android.core.network

import com.felt.android.core.model.CreateTableRequest
import com.felt.android.core.model.CreateTableResponse
import com.felt.android.core.model.InviteResolveResponse
import com.felt.android.core.model.RegisterRequest
import com.felt.android.core.model.SessionDto
import com.felt.android.core.model.TicketRequest
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

interface FeltApi {
    @POST("api/register")
    suspend fun register(@Body body: RegisterRequest): SessionDto

    @POST("api/ticket")
    suspend fun refreshTicket(@Body body: TicketRequest): SessionDto

    @POST("api/tables")
    suspend fun createTable(@Body body: CreateTableRequest): CreateTableResponse

    @GET("api/tables/invite/{code}")
    suspend fun resolveInvite(@Path("code") code: String): InviteResolveResponse
}
