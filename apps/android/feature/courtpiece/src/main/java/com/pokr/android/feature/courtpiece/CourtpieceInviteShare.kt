package com.pokr.android.feature.courtpiece

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri

fun buildCourtpieceJoinLink(webBaseUrl: String, courtpieceId: String, inviteCode: String): String {
    val base = webBaseUrl.trimEnd('/')
    return "$base/courtpiece/$courtpieceId?invite=${Uri.encode(inviteCode)}"
}

fun buildCourtpieceJoinShareText(webBaseUrl: String, courtpieceId: String, inviteCode: String): String {
    val link = buildCourtpieceJoinLink(webBaseUrl, courtpieceId, inviteCode)
    return "Join my Pokr Court Piece table\nCode: $inviteCode\n$link"
}

fun copyCourtpieceInvite(context: Context, webBaseUrl: String, courtpieceId: String, inviteCode: String) {
    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    clipboard.setPrimaryClip(
        ClipData.newPlainText(
            "Pokr Court Piece invite",
            buildCourtpieceJoinShareText(webBaseUrl, courtpieceId, inviteCode),
        ),
    )
}

fun shareCourtpieceInvite(context: Context, webBaseUrl: String, courtpieceId: String, inviteCode: String) {
    val shareText = buildCourtpieceJoinShareText(webBaseUrl, courtpieceId, inviteCode)
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_SUBJECT, "Join my Court Piece table")
        putExtra(Intent.EXTRA_TEXT, shareText)
    }
    context.startActivity(Intent.createChooser(intent, "Share Court Piece invite"))
}
