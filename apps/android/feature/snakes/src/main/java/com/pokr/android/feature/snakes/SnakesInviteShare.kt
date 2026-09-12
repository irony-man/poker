package com.pokr.android.feature.snakes

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri

fun buildSnakesJoinLink(webBaseUrl: String, snakesId: String, inviteCode: String): String {
    val base = webBaseUrl.trimEnd('/')
    return "$base/snakes/$snakesId?invite=${Uri.encode(inviteCode)}"
}

fun buildSnakesJoinShareText(webBaseUrl: String, snakesId: String, inviteCode: String): String {
    val link = buildSnakesJoinLink(webBaseUrl, snakesId, inviteCode)
    return "Join my Pokr Snakes & Ladders board\nCode: $inviteCode\n$link"
}

fun copySnakesInvite(context: Context, webBaseUrl: String, snakesId: String, inviteCode: String) {
    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    clipboard.setPrimaryClip(
        ClipData.newPlainText(
            "Pokr Snakes invite",
            buildSnakesJoinShareText(webBaseUrl, snakesId, inviteCode),
        ),
    )
}

fun shareSnakesInvite(context: Context, webBaseUrl: String, snakesId: String, inviteCode: String) {
    val shareText = buildSnakesJoinShareText(webBaseUrl, snakesId, inviteCode)
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_SUBJECT, "Join my Snakes & Ladders board")
        putExtra(Intent.EXTRA_TEXT, shareText)
    }
    context.startActivity(Intent.createChooser(intent, "Share Snakes invite"))
}
