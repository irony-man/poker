package com.pokr.android.feature.table

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.pokr.android.core.designsystem.PokrChrome
import com.pokr.android.core.designsystem.PokrColors
import com.pokr.android.core.designsystem.PokrGhostButton
import com.pokr.android.core.designsystem.PokrPrimaryButton

@Composable
fun VoiceCallBar(
    voiceState: String,
    muted: Boolean,
    peerCount: Int,
    error: String?,
    onJoin: () -> Unit,
    onLeave: () -> Unit,
    onToggleMute: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val permission = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (granted) onJoin()
    }

    val inVoice = voiceState == "connected" || voiceState == "joining"
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = when {
                error != null -> error
                inVoice -> "Voice · $peerCount"
                else -> "Voice"
            },
            color = if (error != null) PokrColors.Danger else PokrColors.OnChrome,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.weight(1f),
        )
        if (inVoice) {
            PokrGhostButton(
                text = if (muted) "Unmute" else "Mute",
                onClick = onToggleMute,
                chrome = PokrChrome.Play,
            )
            PokrGhostButton(
                text = "Leave",
                onClick = onLeave,
                chrome = PokrChrome.Play,
            )
        } else {
            PokrPrimaryButton(
                text = if (voiceState == "joining") "Joining…" else "Join voice",
                onClick = {
                    val granted = ContextCompat.checkSelfPermission(
                        context,
                        Manifest.permission.RECORD_AUDIO,
                    ) == PackageManager.PERMISSION_GRANTED
                    if (granted) onJoin() else permission.launch(Manifest.permission.RECORD_AUDIO)
                },
                enabled = voiceState != "joining",
            )
        }
    }
}
