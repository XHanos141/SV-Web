# bKash Relay — standalone SMS reader (MacroDroid replacement)

Replaces MacroDroid at the **input** of your existing pipeline only.
Nothing in Supabase (Edge Function, RPCs, tables) changes — this app just
becomes a new caller of the same `bkash-relay` endpoint, sending the exact
same `{ "sms": "..." }` + `X-Relay-Token` shape MacroDroid already sends.

```
bKash SMS on Hasan's phone
        ↓
SmsReceiver (this app)
        ↓
Room queue (queued_transactions table)
        ↓
UploadWorker (WorkManager: retry + backoff, survives reboot)
        ↓
POST https://<project>.supabase.co/functions/v1/bkash-relay
        ↓
(existing, unchanged) _ingest_bkash_transaction → _verify_bkash_transaction
```

## Before building

1. **Confirm bKash's real sender ID on Hasan's device.** Open an existing
   bKash SMS in the stock Messages app and check the sender name/number
   shown. Update `BKASH_SENDER_ID` in `SmsReceiver.kt` to match exactly —
   it currently defaults to `"bKash"`, which may not match the operator's
   actual sender ID.
2. **Get the bkash-relay Edge Function's real URL and the `BKASH_RELAY_TOKEN`
   secret value** — these go into the app's Settings screen at runtime, not
   into source code, so nothing sensitive is committed to Git.

## First run on device

1. Grant SMS permissions when prompted (or via the button on the main screen).
2. Tap "Exempt from battery optimization" — without this, Android will
   eventually stop the receiver from firing reliably in the background.
3. Enter the Relay URL + token in the Settings fields and tap Save.
4. Send yourself (or wait for) a real bKash SMS and confirm it shows up in
   the log with status "✅ uploaded".

## Rollout plan (matches your phased approach)

- Install this app **alongside** MacroDroid first — both will receive the
  same broadcast (the manifest's receiver does not abort it), so you can
  compare their outputs for a day or two.
- Once this app's log consistently shows the same TrxIDs MacroDroid also
  forwarded, uninstall MacroDroid.
- If a message ever shows "Unparsed SMS," it's still forwarded to the Relay
  raw (matching the Relay's own `422 unparseable_sms` handling) — check
  `payment_transactions`/`verification_status` for anything stuck in
  `manual_review` from that.

## Deliberately left out of this first build (say if you want them added)

- No in-app editing/deleting of queue rows — it's read-only history for now.
- No notification badge/alert on failed uploads — currently only visible by
  opening the app.
- No unit tests yet for `BkashSmsParser` — worth adding once you confirm the
  real bKash SMS wording matches the regex exactly on a live message.
