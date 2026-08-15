package com.pokr.android.feature.table

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.pokr.android.core.designsystem.PokrColors
import com.pokr.android.core.designsystem.PokrGhostButton
import com.pokr.android.core.designsystem.StatusChip
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

fun buildTableJoinLink(webBaseUrl: String, tableId: String, inviteCode: String): String {
    val base = webBaseUrl.trimEnd('/')
    return "$base/table/$tableId?invite=${Uri.encode(inviteCode)}"
}

fun buildTableJoinShareText(webBaseUrl: String, tableId: String, inviteCode: String): String {
    val link = buildTableJoinLink(webBaseUrl, tableId, inviteCode)
    return "Join my Pokr poker table\nCode: $inviteCode\n$link"
}

@Composable
fun TableInviteShare(
    tableId: String,
    inviteCode: String,
    webBaseUrl: String,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var copied by remember { mutableStateOf(false) }
    val link = remember(tableId, inviteCode, webBaseUrl) {
        buildTableJoinLink(webBaseUrl, tableId, inviteCode)
    }

    fun copy(text: String) {
        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        clipboard.setPrimaryClip(ClipData.newPlainText("Pokr table invite", text))
        copied = true
        scope.launch {
            delay(2000)
            copied = false
        }
    }

    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        StatusChip(
            text = inviteCode,
            accent = PokrColors.Gold,
        )
        PokrGhostButton(
            text = if (copied) "Copied!" else "Copy link",
            onClick = { copy(link) },
        )
        PokrGhostButton(
            text = "Share",
            onClick = {
                val shareText = buildTableJoinShareText(webBaseUrl, tableId, inviteCode)
                val intent = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_SUBJECT, "Join my poker table")
                    putExtra(Intent.EXTRA_TEXT, shareText)
                }
                context.startActivity(Intent.createChooser(intent, "Share table link"))
            },
        )
    }
}
