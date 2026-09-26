package bd.suppverse.bkashrelay.data

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Holds the two things this app needs to talk to the existing bkash-relay
 * Edge Function: its URL and the shared X-Relay-Token secret. Stored via
 * EncryptedSharedPreferences (AES256-GCM, key in Android Keystore) rather
 * than plain SharedPreferences, since the token is a real secret.
 *
 * Set once from the in-app Settings screen — nothing is hardcoded/committed.
 */
class RelaySettings(context: Context) {

    private val prefs = EncryptedSharedPreferences.create(
        context,
        "relay_settings_secure",
        MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    var relayUrl: String?
        get() = prefs.getString(KEY_URL, null)
        set(value) = prefs.edit().putString(KEY_URL, value).apply()

    var relayToken: String?
        get() = prefs.getString(KEY_TOKEN, null)
        set(value) = prefs.edit().putString(KEY_TOKEN, value).apply()

    val isConfigured: Boolean
        get() = !relayUrl.isNullOrBlank() && !relayToken.isNullOrBlank()

    companion object {
        private const val KEY_URL = "relay_url"
        private const val KEY_TOKEN = "relay_token"
    }
}
