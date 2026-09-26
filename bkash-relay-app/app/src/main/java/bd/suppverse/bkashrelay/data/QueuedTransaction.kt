package bd.suppverse.bkashrelay.data

import androidx.room.Entity
import androidx.room.PrimaryKey

enum class UploadStatus { PENDING, UPLOADED, FAILED_UNPARSEABLE }

/**
 * One row per SMS the receiver saw — whether or not it parsed cleanly.
 * Unparseable messages are kept (rawSms populated, transactionId null) so
 * nothing is silently dropped; they still get forwarded to the Relay, which
 * has its own 422 "unparseable_sms" handling for manual review.
 */
@Entity(tableName = "queued_transactions")
data class QueuedTransaction(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val rawSms: String,
    val transactionId: String?,
    val amount: Double?,
    val sender: String?,
    val transactionTimeIso: String?,
    val receivedAtEpochMs: Long,
    val status: UploadStatus = UploadStatus.PENDING,
    val lastError: String? = null,
    val uploadedAtEpochMs: Long? = null,
)
