package com.pokr.android.feature.memory

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri

fun buildMemoryJoinLink(webBaseUrl: String, memoryId: String, inviteCode: String): String {
    val base = webBaseUrl.trimEnd('/')
    return "$base/memory/$memoryId?invite=${Uri.encode(inviteCode)}"
}

fun buildMemoryJoinShareText(webBaseUrl: String, memoryId: String, inviteCode: String): String {
    val link = buildMemoryJoinLink(webBaseUrl, memoryId, inviteCode)
    return "Join my Pokr Memory Match\nCode: $inviteCode\n$link"
}

fun copyMemoryInvite(context: Context, webBaseUrl: String, memoryId: String, inviteCode: String) {
    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    clipboard.setPrimaryClip(
        ClipData.newPlainText(
            "Pokr Memory invite",
            buildMemoryJoinShareText(webBaseUrl, memoryId, inviteCode),
        ),
    )
}

fun shareMemoryInvite(context: Context, webBaseUrl: String, memoryId: String, inviteCode: String) {
    val shareText = buildMemoryJoinShareText(webBaseUrl, memoryId, inviteCode)
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_SUBJECT, "Join my Memory Match")
        putExtra(Intent.EXTRA_TEXT, shareText)
    }
    context.startActivity(Intent.createChooser(intent, "Share Memory invite"))
}
