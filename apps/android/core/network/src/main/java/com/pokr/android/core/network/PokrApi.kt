package com.pokr.android.core.network

import com.pokr.android.core.model.ContestListResponse
import com.pokr.android.core.model.ContestResponse
import com.pokr.android.core.model.CreateContestRequest
import com.pokr.android.core.model.CreateFriendGroupBody
import com.pokr.android.core.model.CreateTableRequest
import com.pokr.android.core.model.CreateTableResponse
import com.pokr.android.core.model.ChallengeCreateResponse
import com.pokr.android.core.model.ChallengeFriendBody
import com.pokr.android.core.model.FriendGroupResponse
import com.pokr.android.core.model.FriendRequestBody
import com.pokr.android.core.model.FriendRespondBody
import com.pokr.android.core.model.FriendSearchResponse
import com.pokr.android.core.model.FriendsSnapshot
import com.pokr.android.core.model.InviteFriendGroupBody
import com.pokr.android.core.model.InviteFriendGroupResponse
import com.pokr.android.core.model.InviteFriendsBody
import com.pokr.android.core.model.InviteFriendsResponse
import com.pokr.android.core.model.InviteResolveResponse
import com.pokr.android.core.model.LoginRequest
import com.pokr.android.core.model.MeProfile
import com.pokr.android.core.model.MyHandsResponse
import com.pokr.android.core.model.OkResponse
import com.pokr.android.core.model.PublicTablesResponse
import com.pokr.android.core.model.SessionDto
import com.pokr.android.core.model.SignupRequest
import com.pokr.android.core.model.SitePublicResponse
import com.pokr.android.core.model.UpdateFriendGroupBody
import com.pokr.android.core.model.UpdateMeBody
import com.pokr.android.core.model.UploadHandRequest
import com.pokr.android.core.model.UploadHandResponse
import kotlinx.serialization.Serializable
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

@Serializable
class EmptyBody

interface PokrApi {
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

    @POST("api/history/hands")
    suspend fun uploadHand(@Body body: UploadHandRequest): UploadHandResponse

    @GET("api/me")
    suspend fun getMe(): MeProfile

    @PATCH("api/me")
    suspend fun patchMe(@Body body: UpdateMeBody): MeProfile

    @GET("api/me/hands")
    suspend fun getMyHands(@Query("limit") limit: Int = 50): MyHandsResponse

    @GET("api/tables")
    suspend fun getTables(): PublicTablesResponse

    @GET("api/contests/mine")
    suspend fun listMyContests(): ContestListResponse

    @GET("api/friends")
    suspend fun getFriends(): FriendsSnapshot

    @GET("api/friends/search")
    suspend fun searchFriends(@Query("q") q: String): FriendSearchResponse

    @POST("api/friends/requests")
    suspend fun sendFriendRequest(@Body body: FriendRequestBody): EmptyBody

    @POST("api/friends/requests/{id}/respond")
    suspend fun respondFriendRequest(
        @Path("id") id: String,
        @Body body: FriendRespondBody,
    ): EmptyBody

    @POST("api/friends/challenge")
    suspend fun challengeFriend(@Body body: ChallengeFriendBody): ChallengeCreateResponse

    @POST("api/friends/challenges/{id}/join")
    suspend fun joinFriendChallenge(
        @Path("id") id: String,
        @Body body: EmptyBody = EmptyBody(),
    ): EmptyBody

    @POST("api/friends/challenges/{id}/decline")
    suspend fun declineFriendChallenge(
        @Path("id") id: String,
        @Body body: EmptyBody = EmptyBody(),
    ): EmptyBody

    @POST("api/friends/groups")
    suspend fun createFriendGroup(@Body body: CreateFriendGroupBody): FriendGroupResponse

    @PATCH("api/friends/groups/{id}")
    suspend fun updateFriendGroup(
        @Path("id") id: String,
        @Body body: UpdateFriendGroupBody,
    ): FriendGroupResponse

    @DELETE("api/friends/groups/{id}")
    suspend fun deleteFriendGroup(@Path("id") id: String): OkResponse

    @POST("api/friends/groups/{id}/invite")
    suspend fun inviteFriendGroup(
        @Path("id") id: String,
        @Body body: InviteFriendGroupBody = InviteFriendGroupBody(),
    ): InviteFriendGroupResponse

    @POST("api/tables/{id}/invite-friends")
    suspend fun inviteTableFriends(
        @Path("id") id: String,
        @Body body: InviteFriendsBody,
    ): InviteFriendsResponse

    @POST("api/contests/{id}/invite-friends")
    suspend fun inviteContestFriends(
        @Path("id") id: String,
        @Body body: InviteFriendsBody,
    ): InviteFriendsResponse

    @GET("api/site")
    suspend fun getSite(): SitePublicResponse
}
