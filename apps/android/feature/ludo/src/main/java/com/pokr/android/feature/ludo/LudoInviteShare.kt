package com.pokr.android.feature.ludo

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri

fun buildLudoJoinLink(webBaseUrl: String, ludoId: String, inviteCode: String): String {
    val base = webBaseUrl.trimEnd('/')
    return "$base/ludo/$ludoId?invite=${Uri.encode(inviteCode)}"
}

fun buildLudoJoinShareText(webBaseUrl: String, ludoId: String, inviteCode: String): String {
    val link = buildLudoJoinLink(webBaseUrl, ludoId, inviteCode)
    return "Join my Pokr Ludo board\nCode: $inviteCode\n$link"
}

fun copyLudoInvite(context: Context, webBaseUrl: String, ludoId: String, inviteCode: String) {
    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    clipboard.setPrimaryClip(
        ClipData.newPlainText(
            "Pokr Ludo invite",
            buildLudoJoinShareText(webBaseUrl, ludoId, inviteCode),
        ),
    )
}

fun shareLudoInvite(context: Context, webBaseUrl: String, ludoId: String, inviteCode: String) {
    val shareText = buildLudoJoinShareText(webBaseUrl, ludoId, inviteCode)
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_SUBJECT, "Join my Ludo board")
        putExtra(Intent.EXTRA_TEXT, shareText)
    }
    context.startActivity(Intent.createChooser(intent, "Share Ludo invite"))
}
