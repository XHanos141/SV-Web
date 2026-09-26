package bd.suppverse.bkashrelay

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import bd.suppverse.bkashrelay.data.AppDatabase
import bd.suppverse.bkashrelay.data.QueuedTransaction
import bd.suppverse.bkashrelay.data.UploadStatus
import bd.suppverse.bkashrelay.parser.BkashSmsParser
import bd.suppverse.bkashrelay.work.UploadWorker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * Server-side backstop mirrors the Edge Function's own comment: we filter to
 * bKash's sender ID here too, so unrelated SMS never even reach the parser
 * or get written to the queue.
 *
 * IMPORTANT: change this to bKash's real sender ID as it appears on Hasan's
 * device (varies by operator — often "bKash" or a numeric shortcode). Check
 * an existing bKash SMS in the Messages app to confirm the exact string.
 */
private const val BKASH_SENDER_ID = "bKash"

class SmsReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return
        val fullBody = messages.joinToString("") { it.messageBody ?: "" }
        val sender = messages.firstOrNull()?.originatingAddress ?: ""

        if (!sender.contains(BKASH_SENDER_ID, ignoreCase = true)) return

        // Do the minimum here (Room insert), then hand off to WorkManager.
        // BroadcastReceiver.onReceive has a short execution budget — no
        // network calls belong in this function.
        val pendingResult = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val parsed = BkashSmsParser.parse(fullBody)
                val dao = AppDatabase.get(context).queueDao()

                val row = if (parsed != null) {
                    QueuedTransaction(
                        rawSms = fullBody,
                        transactionId = parsed.transactionId,
                        amount = parsed.amount,
                        sender = parsed.sender,
                        transactionTimeIso = parsed.transactionTimeIso,
                        receivedAtEpochMs = System.currentTimeMillis(),
                        status = UploadStatus.PENDING,
                    )
                } else {
                    // Unparseable — still queued and still uploaded, flagged
                    // so the Relay's 422 path can route it to manual review
                    // instead of it vanishing silently.
                    QueuedTransaction(
                        rawSms = fullBody,
                        transactionId = null,
                        amount = null,
                        sender = null,
                        transactionTimeIso = null,
                        receivedAtEpochMs = System.currentTimeMillis(),
                        status = UploadStatus.PENDING,
                    )
                }

                val rowId = dao.insert(row)

                val work = OneTimeWorkRequestBuilder<UploadWorker>()
                    .setInputData(UploadWorker.inputFor(rowId))
                    .build()

                WorkManager.getInstance(context).enqueueUniqueWork(
                    "upload_$rowId",
                    ExistingWorkPolicy.KEEP,
                    work,
                )
            } finally {
                pendingResult.finish()
            }
        }
    }
}
