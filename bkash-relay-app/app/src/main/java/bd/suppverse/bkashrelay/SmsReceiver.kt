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
 * Kept as a loose secondary signal only. In practice, Android's Messages app
 * often shows a resolved *business name* like "bKash" for the sender, but
 * the raw originatingAddress in the SMS_RECEIVED broadcast is typically the
 * underlying numeric shortcode instead — so this string rarely appears in
 * the raw address. Confirmed on device: the real bKash SMS body doesn't
 * contain the word "bKash" at all, and sender.contains(BKASH_SENDER_ID)
 * never matched, silently dropping every real transaction.
 *
 * Primary filter is now: does the message structurally parse as a bKash
 * transaction (BkashSmsParser)? That pattern ("...Fee Tk...Balance
 * Tk...TrxID...") is specific enough that only real bKash messages match
 * it, regardless of which shortcode sent it. This sender string is only
 * used as a fallback so an unparseable-but-clearly-bKash message (e.g. if
 * bKash changes their SMS wording) still gets queued for manual review
 * instead of silently ignored.
 */
private const val BKASH_SENDER_ID = "bKash"

class SmsReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return
        val fullBody = messages.joinToString("") { it.messageBody ?: "" }
        val sender = messages.firstOrNull()?.originatingAddress ?: ""

        val parsesAsBkash = BkashSmsParser.parse(fullBody) != null
        val looksLikeBkashSender = sender.contains(BKASH_SENDER_ID, ignoreCase = true)

        // Ignore anything that neither parses as a bKash transaction nor
        // comes from a sender address that literally mentions bKash —
        // avoids queuing random unrelated SMS (spam, OTPs, personal texts).
        if (!parsesAsBkash && !looksLikeBkashSender) return

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
