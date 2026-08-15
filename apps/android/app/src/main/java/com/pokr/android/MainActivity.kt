package com.pokr.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toArgb
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pokr.android.core.datastore.SessionPreferences
import com.pokr.android.core.designsystem.PokrColors
import com.pokr.android.core.designsystem.PokrPalette
import com.pokr.android.core.designsystem.PokrTheme
import com.pokr.android.core.designsystem.PokrUiTheme
import com.pokr.android.navigation.PokrNavHost
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    @Inject lateinit var sessionPreferences: SessionPreferences

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val ink = PokrPalette.Classic.ink.toArgb()
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(ink),
            navigationBarStyle = SystemBarStyle.dark(ink),
        )
        setContent {
            val uiThemeRaw by sessionPreferences.uiThemeFlow.collectAsStateWithLifecycle("v1")
            val uiTheme = PokrUiTheme.fromApi(uiThemeRaw)
            PokrTheme(uiTheme) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = PokrColors.Ink,
                    contentColor = PokrColors.Cream,
                ) {
                    PokrNavHost(modifier = Modifier.fillMaxSize())
                }
            }
        }
    }
}
