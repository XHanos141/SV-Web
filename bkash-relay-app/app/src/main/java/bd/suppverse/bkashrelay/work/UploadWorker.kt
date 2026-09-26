package bd.suppverse.bkashrelay.work

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.Data
import androidx.work.WorkerParameters
import bd.suppverse.bkashrelay.data.AppDatabase
import bd.suppverse.bkashrelay.data.RelaySettings
import bd.suppverse.bkashrelay.data.UploadStatus
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Talks to the EXISTING bkash-relay Edge Function — no backend changes
 * required. Sends exactly the shape it already expects:
 *   POST { "sms": "<raw sms body>" }
 *   Header: X-Relay-Token: <shared secret>
 *
 * The Relay itself re-parses and re-validates the SMS server-side (its own
 * "backstop" per its code comment) — this worker's job ends at "delivered
 * the raw text," nothing more. Same boundary rule as the rest of the
 * pipeline: this app never decides payment success.
 */
class UploadWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val rowId = inputData.getLong(KEY_ROW_ID, -1L)
        if (rowId < 0) return@withContext Result.failure()

        val dao = AppDatabase.get(applicationContext).queueDao()
        val settings = RelaySettings(applicationContext)

        if (!settings.isConfigured) {
            // Nothing we can do until the user sets Relay URL + token in
            // the app. Retry later rather than failing permanently — they
            // might configure it minutes from now.
            return@withContext Result.retry()
        }

        val row = dao.getPending().find { it.id == rowId }
            ?: return@withContext Result.success() // already handled/removed

        val body = JSONObject().put("sms", row.rawSms).toString()
            .toRequestBody("application/json".toMediaType())

        val request = Request.Builder()
            .url(settings.relayUrl!!)
            .addHeader("X-Relay-Token", settings.relayToken!!)
            .post(body)
            .build()

        try {
            client.newCall(request).execute().use { response ->
                when {
                    response.isSuccessful -> {
                        dao.markResult(rowId, UploadStatus.UPLOADED, System.currentTimeMillis(), null)
                        Result.success()
                    }
                    response.code == 422 -> {
                        // Relay itself couldn't parse it — mark as such
                        // locally too, but this is not a worker failure;
                        // the SMS was still delivered for manual review.
                        dao.markResult(rowId, UploadStatus.FAILED_UNPARSEABLE, System.currentTimeMillis(), "relay_422_unparseable")
                        Result.success()
                    }
                    response.code == 401 -> {
                        // Bad token — retrying won't help until it's fixed.
                        dao.markResult(rowId, UploadStatus.FAILED_UNPARSEABLE, null, "relay_401_unauthorized_check_token")
                        Result.failure()
                    }
                    else -> {
                        dao.markResult(rowId, UploadStatus.FAILED_UNPARSEABLE, null, "relay_http_${response.code}")
                        Result.retry()
                    }
                }
            }
        } catch (e: Exception) {
            dao.markResult(rowId, UploadStatus.FAILED_UNPARSEABLE, null, "network_error_${e.javaClass.simpleName}")
            Result.retry()
        }
    }

    companion object {
        private const val KEY_ROW_ID = "row_id"
        fun inputFor(rowId: Long): Data = Data.Builder().putLong(KEY_ROW_ID, rowId).build()
    }
}
