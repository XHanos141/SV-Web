package bd.suppverse.bkashrelay.parser

import java.util.Locale

/**
 * Mirrors the SMS_PATTERN regex already deployed in the bkash-relay Supabase
 * Edge Function (index.ts). Kept identical on purpose: if bKash ever changes
 * their SMS wording, both places need the same fix, and testing this one
 * offline is a good signal the server-side regex needs the same update.
 *
 * This class does NOT decide whether a payment is valid — it only extracts
 * the raw fields. All matching/verification stays in Postgres
 * (_verify_bkash_transaction), same boundary rule as the rest of the pipeline.
 */
object BkashSmsParser {

    private val SMS_PATTERN = Regex(
        """You have received Tk\s+([\d,]+\.\d{2})\s+from\s+(01\d{9})(?:\.Ref\s+(.*?))?\.\s*Fee Tk\s+([\d,]+\.\d{2})\.\s*Balance Tk\s+([\d,]+\.\d{2})\.\s*TrxID\s+(\w+)\s+at\s+(\d{2})/(\d{2})/(\d{4})\s+(\d{2}):(\d{2})"""
    )

    data class ParsedTransaction(
        val transactionId: String,
        val amount: Double,
        val sender: String,
        val note: String?,
        val transactionTimeIso: String, // e.g. 2026-09-26T11:30:00+06:00 — matches the Edge Function's expected format
    )

    fun parse(body: String): ParsedTransaction? {
        val m = SMS_PATTERN.find(body) ?: return null
        val g = m.groupValues

        val amountStr = g[1].replace(",", "")
        val sender = g[2]
        val note = g[3].ifBlank { null }
        val trxId = g[6]
        val dd = g[7]; val mm = g[8]; val yyyy = g[9]
        val hh = g[10]; val min = g[11]

        val amount = amountStr.toDoubleOrNull() ?: return null

        // Bangladesh is UTC+6 year-round (no DST) — matches the Edge
        // Function's hardcoded "+06:00" suffix.
        val isoTime = String.format(
            Locale.US, "%s-%s-%sT%s:%s:00+06:00", yyyy, mm, dd, hh, min
        )

        return ParsedTransaction(
            transactionId = trxId,
            amount = amount,
            sender = sender,
            note = note,
            transactionTimeIso = isoTime,
        )
    }
}
