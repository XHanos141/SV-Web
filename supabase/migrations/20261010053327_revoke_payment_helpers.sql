-- Internal payment helpers must only run server-side (service_role Edge Function
-- or SECURITY DEFINER wrappers owned by postgres). Closes anon/authenticated
-- direct execution of payment confirmation + evidence ingestion.
-- Callers verified: confirm_order_payment, submit_payment_trxid (both definer),
-- bkash-relay Edge Function (service_role). No frontend calls these.

revoke execute on function public._confirm_order_payment_core(uuid, text, text)
  from public, anon, authenticated;
revoke execute on function public._ingest_bkash_transaction(text, numeric, text, text, timestamptz, jsonb)
  from public, anon, authenticated;
revoke execute on function public._verify_bkash_transaction(text)
  from public, anon, authenticated;

grant execute on function public._confirm_order_payment_core(uuid, text, text) to service_role;
grant execute on function public._ingest_bkash_transaction(text, numeric, text, text, timestamptz, jsonb) to service_role;
grant execute on function public._verify_bkash_transaction(text) to service_role;
