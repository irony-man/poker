package com.felt.android

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toArgb
import androidx.lifecycle.lifecycleScope
import com.clerk.api.Clerk
import com.felt.android.core.designsystem.FeltColors
import com.felt.android.core.designsystem.FeltTheme
import com.felt.android.navigation.FeltNavHost
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        handleClerkDeepLink(intent)
        val ink = FeltColors.Ink.toArgb()
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(ink),
            navigationBarStyle = SystemBarStyle.dark(ink),
        )
        setContent {
            FeltTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = FeltColors.Ink,
                    contentColor = FeltColors.Cream,
                ) {
                    FeltNavHost(modifier = Modifier.fillMaxSize())
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleClerkDeepLink(intent)
    }

    private fun handleClerkDeepLink(intent: Intent?) {
        val uri = intent?.data ?: return
        lifecycleScope.launch {
            Clerk.auth.handle(uri)
        }
    }
}
