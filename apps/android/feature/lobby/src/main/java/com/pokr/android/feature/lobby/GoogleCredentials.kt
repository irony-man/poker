package com.pokr.android.feature.lobby

import android.content.Context
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException

/** User dismissed the Google account picker; not worth showing an error. */
class GoogleSignInCancelled : Exception("Google sign-in was cancelled")

/**
 * Ask Credential Manager for a Google ID token. [context] must be an Activity context.
 * [webClientId] is the OAuth *web* client id, so the server can verify the token's audience.
 */
suspend fun requestGoogleIdToken(context: Context, webClientId: String): Result<String> {
    val option = GetGoogleIdOption.Builder()
        .setServerClientId(webClientId)
        .setFilterByAuthorizedAccounts(false)
        .setAutoSelectEnabled(false)
        .build()
    val request = GetCredentialRequest.Builder().addCredentialOption(option).build()
    return try {
        val credential = CredentialManager.create(context).getCredential(context, request).credential
        if (
            credential is CustomCredential &&
            credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
        ) {
            Result.success(GoogleIdTokenCredential.createFrom(credential.data).idToken)
        } else {
            Result.failure(IllegalStateException("Unexpected credential from Google"))
        }
    } catch (e: GetCredentialCancellationException) {
        Result.failure(GoogleSignInCancelled())
    } catch (e: NoCredentialException) {
        Result.failure(IllegalStateException("No Google account on this device. Add one in Settings."))
    } catch (e: GetCredentialException) {
        Result.failure(IllegalStateException(e.message ?: "Google sign-in failed"))
    } catch (e: GoogleIdTokenParsingException) {
        Result.failure(IllegalStateException("Google sign-in failed"))
    }
}
