package com.pokr.android.core.network

import com.pokr.android.core.model.AdminBotGroupsResponse
import com.pokr.android.core.model.AdminCreditBody
import com.pokr.android.core.model.AdminCreditResponse
import com.pokr.android.core.model.AdminDeleteUserResponse
import com.pokr.android.core.model.AdminGamesResponse
import com.pokr.android.core.model.AdminHandDetail
import com.pokr.android.core.model.AdminHandsPage
import com.pokr.android.core.model.AdminHomeFeaturesResponse
import com.pokr.android.core.model.AdminOverviewResponse
import com.pokr.android.core.model.AdminPagesResponse
import com.pokr.android.core.model.AdminResetResponse
import com.pokr.android.core.model.AdminRoomSettings
import com.pokr.android.core.model.AdminUploadUrlBody
import com.pokr.android.core.model.AdminUploadUrlResponse
import com.pokr.android.core.model.AdminUsersResponse
import com.pokr.android.core.model.ChallengeCreateResponse
import com.pokr.android.core.model.ChallengeFriendBody
import com.pokr.android.core.model.ContestListResponse
import com.pokr.android.core.model.ContestResponse
import com.pokr.android.core.model.CreateContestRequest
import com.pokr.android.core.model.CreateCourtpieceRequest
import com.pokr.android.core.model.CreateCourtpieceResponse
import com.pokr.android.core.model.CreateFriendGroupBody
import com.pokr.android.core.model.CreateLudoRequest
import com.pokr.android.core.model.CreateLudoResponse
import com.pokr.android.core.model.CreateMemoryRequest
import com.pokr.android.core.model.CreateMemoryResponse
import com.pokr.android.core.model.CreateSnakesRequest
import com.pokr.android.core.model.CreateSnakesResponse
import com.pokr.android.core.model.CreateTableRequest
import com.pokr.android.core.model.CreateTableResponse
import com.pokr.android.core.model.CourtpieceChatListResponse
import com.pokr.android.core.model.CourtpieceInviteResolveResponse
import com.pokr.android.core.model.FriendGroupResponse
import com.pokr.android.core.model.FriendRequestBody
import com.pokr.android.core.model.FriendRespondBody
import com.pokr.android.core.model.FriendSearchResponse
import com.pokr.android.core.model.FriendsSnapshot
import com.pokr.android.core.model.HandsTogetherResponse
import com.pokr.android.core.model.InviteFriendGroupBody
import com.pokr.android.core.model.InviteFriendGroupResponse
import com.pokr.android.core.model.InviteFriendsBody
import com.pokr.android.core.model.InviteFriendsResponse
import com.pokr.android.core.model.InviteResolveResponse
import com.pokr.android.core.model.LudoChatListResponse
import com.pokr.android.core.model.LudoInviteResolveResponse
import com.pokr.android.core.model.LoginRequest
import com.pokr.android.core.model.MeProfile
import com.pokr.android.core.model.MemoryChatListResponse
import com.pokr.android.core.model.MemoryInviteResolveResponse
import com.pokr.android.core.model.MyHandsResponse
import com.pokr.android.core.model.OkResponse
import com.pokr.android.core.model.PatchBotGroupsBody
import com.pokr.android.core.model.PatchHomeFeaturesBody
import com.pokr.android.core.model.PatchPagesBody
import com.pokr.android.core.model.PublicProfile
import com.pokr.android.core.model.PublicTablesResponse
import com.pokr.android.core.model.SessionDto
import com.pokr.android.core.model.SignupRequest
import com.pokr.android.core.model.SiteAnnouncement
import com.pokr.android.core.model.SiteEconomy
import com.pokr.android.core.model.SitePublicResponse
import com.pokr.android.core.model.SnakesChatListResponse
import com.pokr.android.core.model.SnakesInviteResolveResponse
import com.pokr.android.core.model.TableSoundsConfig
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

    @DELETE("api/friends/requests/{id}")
    suspend fun cancelFriendRequest(@Path("id") id: String): EmptyBody

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

    @POST("api/friends/challenges/{id}/cancel")
    suspend fun cancelFriendChallenge(
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

    @GET("api/users/{username}")
    suspend fun getPublicProfile(@Path("username") username: String): PublicProfile

    @GET("api/users/{username}/hands-together")
    suspend fun getHandsTogether(
        @Path("username") username: String,
        @Query("limit") limit: Int = 50,
    ): HandsTogetherResponse

    @POST("api/ludo")
    suspend fun createLudo(@Body body: CreateLudoRequest): CreateLudoResponse

    @GET("api/ludo/invite/{code}")
    suspend fun resolveLudoInvite(@Path("code") code: String): LudoInviteResolveResponse

    @GET("api/ludo/{id}/chat")
    suspend fun getLudoChat(
        @Path("id") id: String,
        @Query("limit") limit: Int = 80,
    ): LudoChatListResponse

    @POST("api/snakes")
    suspend fun createSnakes(@Body body: CreateSnakesRequest): CreateSnakesResponse

    @GET("api/snakes/invite/{code}")
    suspend fun resolveSnakesInvite(@Path("code") code: String): SnakesInviteResolveResponse

    @GET("api/snakes/{id}/chat")
    suspend fun getSnakesChat(
        @Path("id") id: String,
        @Query("limit") limit: Int = 80,
    ): SnakesChatListResponse

    @POST("api/memory")
    suspend fun createMemory(@Body body: CreateMemoryRequest): CreateMemoryResponse

    @GET("api/memory/invite/{code}")
    suspend fun resolveMemoryInvite(@Path("code") code: String): MemoryInviteResolveResponse

    @GET("api/memory/{id}/chat")
    suspend fun getMemoryChat(
        @Path("id") id: String,
        @Query("limit") limit: Int = 80,
    ): MemoryChatListResponse

    @POST("api/courtpiece")
    suspend fun createCourtpiece(@Body body: CreateCourtpieceRequest): CreateCourtpieceResponse

    @GET("api/courtpiece/invite/{code}")
    suspend fun resolveCourtpieceInvite(@Path("code") code: String): CourtpieceInviteResolveResponse

    @GET("api/courtpiece/{id}/chat")
    suspend fun getCourtpieceChat(
        @Path("id") id: String,
        @Query("limit") limit: Int = 80,
    ): CourtpieceChatListResponse

    @GET("api/admin/overview")
    suspend fun getAdminOverview(): AdminOverviewResponse

    @GET("api/admin/announcement")
    suspend fun getAdminAnnouncement(): SiteAnnouncement

    @PATCH("api/admin/announcement")
    suspend fun patchAdminAnnouncement(@Body body: SiteAnnouncement): SiteAnnouncement

    @GET("api/admin/economy")
    suspend fun getAdminEconomy(): SiteEconomy

    @PATCH("api/admin/economy")
    suspend fun patchAdminEconomy(@Body body: SiteEconomy): SiteEconomy

    @GET("api/admin/room-settings")
    suspend fun getAdminRoomSettings(): AdminRoomSettings

    @PATCH("api/admin/room-settings")
    suspend fun patchAdminRoomSettings(@Body body: AdminRoomSettings): AdminRoomSettings

    @GET("api/admin/users")
    suspend fun getAdminUsers(@Query("q") q: String? = null): AdminUsersResponse

    @POST("api/admin/users/{userId}/credit")
    suspend fun creditAdminUser(
        @Path("userId") userId: String,
        @Body body: AdminCreditBody,
    ): AdminCreditResponse

    @POST("api/admin/users/{userId}/credit-whuffies")
    suspend fun creditAdminUserWhuffies(
        @Path("userId") userId: String,
        @Body body: AdminCreditBody,
    ): AdminCreditResponse

    @POST("api/admin/users/{userId}/reset-chips")
    suspend fun resetAdminUserChips(
        @Path("userId") userId: String,
        @Body body: EmptyBody = EmptyBody(),
    ): AdminResetResponse

    @POST("api/admin/users/{userId}/reset-whuffies")
    suspend fun resetAdminUserWhuffies(
        @Path("userId") userId: String,
        @Body body: EmptyBody = EmptyBody(),
    ): AdminResetResponse

    @DELETE("api/admin/users/{userId}")
    suspend fun deleteAdminUser(@Path("userId") userId: String): AdminDeleteUserResponse

    @GET("api/admin/games")
    suspend fun getAdminGames(): AdminGamesResponse

    @GET("api/admin/hands")
    suspend fun getAdminHands(
        @Query("page") page: Int? = null,
        @Query("pageSize") pageSize: Int? = null,
        @Query("source") source: String? = null,
        @Query("tableId") tableId: String? = null,
        @Query("q") q: String? = null,
    ): AdminHandsPage

    @GET("api/admin/hands/{id}")
    suspend fun getAdminHand(@Path("id") id: String): AdminHandDetail

    @GET("api/admin/bot-groups")
    suspend fun getAdminBotGroups(): AdminBotGroupsResponse

    @PATCH("api/admin/bot-groups")
    suspend fun patchAdminBotGroups(@Body body: PatchBotGroupsBody): AdminBotGroupsResponse

    @GET("api/admin/home-features")
    suspend fun getAdminHomeFeatures(): AdminHomeFeaturesResponse

    @PATCH("api/admin/home-features")
    suspend fun patchAdminHomeFeatures(@Body body: PatchHomeFeaturesBody): AdminHomeFeaturesResponse

    @GET("api/admin/pages")
    suspend fun getAdminPages(): AdminPagesResponse

    @PATCH("api/admin/pages")
    suspend fun patchAdminPages(@Body body: PatchPagesBody): AdminPagesResponse

    @GET("api/admin/sounds")
    suspend fun getAdminSounds(): TableSoundsConfig

    @PATCH("api/admin/sounds")
    suspend fun patchAdminSounds(@Body body: TableSoundsConfig): TableSoundsConfig

    @POST("api/admin/sounds/upload-url")
    suspend fun requestAdminSoundUploadUrl(@Body body: AdminUploadUrlBody): AdminUploadUrlResponse

    @POST("api/admin/images/upload-url")
    suspend fun requestAdminImageUploadUrl(@Body body: AdminUploadUrlBody): AdminUploadUrlResponse
}
