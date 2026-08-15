package com.pokr.android.navigation

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.pokr.android.BuildConfig
import com.pokr.android.feature.lobby.ContestRoute
import com.pokr.android.feature.lobby.ContestScreen
import com.pokr.android.feature.lobby.LobbyRoute
import com.pokr.android.feature.lobby.LobbyScreen
import com.pokr.android.feature.lobby.ProfileRoute
import com.pokr.android.feature.lobby.ProfileScreen
import com.pokr.android.feature.lobby.SocialInviteBanner
import com.pokr.android.feature.offline.OfflineTableRoute
import com.pokr.android.feature.offline.OfflineTableScreen
import com.pokr.android.feature.progress.HandsRoute
import com.pokr.android.feature.progress.HandsScreen
import com.pokr.android.feature.table.OnlineTableRoute
import com.pokr.android.feature.table.TableScreen

@Composable
fun PokrNavHost(modifier: Modifier = Modifier) {
    val navController = rememberNavController()
    val entry by navController.currentBackStackEntryAsState()
    val compact = entry?.destination?.route?.contains("OnlineTable", ignoreCase = true) == true

    Box(modifier = modifier.fillMaxSize()) {
    NavHost(
        navController = navController,
        startDestination = LobbyRoute,
        modifier = Modifier.fillMaxSize(),
    ) {
        composable<LobbyRoute> {
            LobbyScreen(
                onHosted = { tableId, invite ->
                    navController.navigate(OnlineTableRoute(tableId = tableId, invite = invite))
                },
                onJoined = { tableId, invite, spectate ->
                    navController.navigate(
                        OnlineTableRoute(tableId = tableId, invite = invite, spectate = spectate),
                    )
                },
                onOffline = { seats, bots, name ->
                    navController.navigate(OfflineTableRoute(seats = seats, bots = bots, name = name))
                },
                onContest = { contestId ->
                    navController.navigate(ContestRoute(contestId = contestId))
                },
                onProfile = {
                    navController.navigate(ProfileRoute)
                },
            )
        }
        composable<ProfileRoute> {
            ProfileScreen(
                onBack = {
                    navController.popBackStack(LobbyRoute, inclusive = false)
                },
                onSignedOut = {
                    navController.popBackStack(LobbyRoute, inclusive = false)
                },
                onContest = { contestId ->
                    navController.navigate(ContestRoute(contestId = contestId))
                },
                onPlay = {
                    navController.popBackStack(LobbyRoute, inclusive = false)
                },
                onOpenTable = { tableId, invite ->
                    navController.navigate(OnlineTableRoute(tableId = tableId, invite = invite))
                },
            )
        }
        composable<ContestRoute> {
            ContestScreen(
                onBack = {
                    navController.popBackStack(LobbyRoute, inclusive = false)
                },
                onOpenTable = { tableId ->
                    navController.navigate(OnlineTableRoute(tableId = tableId))
                },
            )
        }
        composable<HandsRoute> {
            HandsScreen(
                onBack = {
                    navController.popBackStack(LobbyRoute, inclusive = false)
                },
                onPlay = {
                    navController.popBackStack(LobbyRoute, inclusive = false)
                },
            )
        }
        composable<OnlineTableRoute> {
            TableScreen(
                webBaseUrl = BuildConfig.POKR_WEB_URL,
                onBack = {
                    navController.popBackStack(LobbyRoute, inclusive = false)
                },
            )
        }
        composable<OfflineTableRoute> {
            OfflineTableScreen(
                onBack = {
                    navController.popBackStack(LobbyRoute, inclusive = false)
                },
            )
        }
    }

        SocialInviteBanner(
            compact = compact,
            onOpenTable = { tableId, invite ->
                navController.navigate(OnlineTableRoute(tableId = tableId, invite = invite))
            },
            onOpenContest = { contestId ->
                navController.navigate(ContestRoute(contestId = contestId))
            },
            onOpenFriends = {
                navController.popBackStack(LobbyRoute, inclusive = false)
            },
            modifier = Modifier.align(Alignment.TopEnd),
        )
    }
}
