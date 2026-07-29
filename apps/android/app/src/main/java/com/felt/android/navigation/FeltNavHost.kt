package com.felt.android.navigation

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.felt.android.feature.lobby.LobbyRoute
import com.felt.android.feature.lobby.LobbyScreen
import com.felt.android.feature.offline.OfflineTableRoute
import com.felt.android.feature.offline.OfflineTableScreen
import com.felt.android.feature.table.OnlineTableRoute
import com.felt.android.BuildConfig
import com.felt.android.feature.table.TableScreen

@Composable
fun FeltNavHost(modifier: Modifier = Modifier) {
    val navController = rememberNavController()

    NavHost(
        navController = navController,
        startDestination = LobbyRoute,
        modifier = modifier.fillMaxSize(),
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
            )
        }
        composable<OnlineTableRoute> {
            TableScreen(
                webBaseUrl = BuildConfig.FELT_WEB_URL,
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
}
