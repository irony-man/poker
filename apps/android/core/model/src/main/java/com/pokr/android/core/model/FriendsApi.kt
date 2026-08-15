package com.pokr.android.core.model

import kotlinx.serialization.Serializable

@Serializable
data class FriendProfile(
    val userId: String,
    val name: String = "",
    val avatarId: Int = 0,
    val avatarUrl: String? = null,
    val online: Boolean = false,
)

@Serializable
data class PendingRequestView(
    val id: String,
    val from: FriendProfile,
    val createdAt: Long = 0,
)

@Serializable
data class PendingChallenge(
    val id: String,
    val challenger: FriendProfile,
    /** Omitted on older payloads; treat as table. */
    val kind: String? = null,
    val tableId: String? = null,
    val contestId: String? = null,
    val inviteCode: String = "",
    val createdAt: Long = 0,
    val groupId: String? = null,
    val groupName: String? = null,
)

@Serializable
data class FriendGroupView(
    val id: String,
    val name: String = "",
    val ownerUserId: String = "",
    val isOwner: Boolean = false,
    val members: List<FriendProfile> = emptyList(),
    val createdAt: Long = 0,
)

@Serializable
data class FriendsSnapshot(
    val friends: List<FriendProfile> = emptyList(),
    val incoming: List<PendingRequestView> = emptyList(),
    val pendingChallenges: List<PendingChallenge> = emptyList(),
    val groups: List<FriendGroupView> = emptyList(),
)

@Serializable
data class FriendSearchUser(
    val userId: String,
    val name: String = "",
    val username: String = "",
    val avatarId: Int = 0,
    val avatarUrl: String? = null,
)

@Serializable
data class FriendSearchResponse(
    val users: List<FriendSearchUser> = emptyList(),
)

@Serializable
data class FriendRequestBody(
    val targetUserId: String,
)

@Serializable
data class FriendRespondBody(
    val accept: Boolean,
)

@Serializable
data class ChallengeFriendBody(
    val friendUserId: String,
)

@Serializable
data class ChallengeCreateResponse(
    val tableId: String,
    val inviteCode: String,
    val challengeId: String,
)

@Serializable
data class CreateFriendGroupBody(
    val name: String,
    val memberUserIds: List<String> = emptyList(),
)

@Serializable
data class UpdateFriendGroupBody(
    val memberUserIds: List<String> = emptyList(),
)

@Serializable
data class FriendGroupResponse(
    val group: FriendGroupView,
)

@Serializable
data class InviteFriendGroupBody(
    val memberUserIds: List<String>? = null,
    val maxSeats: Int? = null,
    val smallBlind: Int? = null,
    val bigBlind: Int? = null,
    val buyIn: Int? = null,
)

@Serializable
data class InviteFriendGroupResponse(
    val tableId: String,
    val inviteCode: String,
    val inviteCount: Int = 0,
    val challengeIds: List<String> = emptyList(),
)

@Serializable
data class InviteFriendsBody(
    val friendUserIds: List<String> = emptyList(),
)

@Serializable
data class InviteFriendsResponse(
    val inviteCount: Int = 0,
    val challengeIds: List<String> = emptyList(),
    val contest: ContestView? = null,
)

@Serializable
data class OkResponse(
    val ok: Boolean = true,
)
