-- Emergency rollback: restores previous (insecure) grants. Do not use unless checkout breaks.
grant execute on function public._confirm_order_payment_core(uuid, text, text) to anon, authenticated;
grant execute on function public._ingest_bkash_transaction(text, numeric, text, text, timestamptz, jsonb) to anon, authenticated;
grant execute on function public._verify_bkash_transaction(text) to anon, authenticated;
