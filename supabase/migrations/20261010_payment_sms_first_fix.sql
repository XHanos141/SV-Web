-- bKash verification hardening. Tested on staging (31/31 lifecycle checks); NOT yet applied to live.
-- 1) Case-insensitive TrxID matching (customer "trx123" vs SMS "TRX123").
-- 2) SMS-first: submit_order_payment / submit_payment_trxid trigger the trusted verification after storing the ref.
-- 3) Per-TrxID advisory lock (taken first everywhere) serialises SMS ingest vs customer submit: no deadlock, no double confirm.
-- 4) submit_payment_trxid never overwrites a different existing ref; unique-violation returns a friendly error.
-- 5) Customer-facing responses no longer expose internal verification reasons (state: paid | submitted).
-- 6) _ingest rejects empty TrxID / non-positive amount / missing sender or receiver (stored nowhere).
-- Relay still only supplies evidence; _confirm_order_payment_core stays reachable only via _verify (service_role/definer).

create or replace function public._norm_trx(p text) returns text language sql immutable set search_path to 'public' as $$ select upper(btrim(coalesce(p, ''))) $$;

CREATE OR REPLACE FUNCTION public._verify_bkash_transaction(p_transaction_id text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  trx text := public._norm_trx(p_transaction_id);
  tx public.payment_transactions; ord public.orders; pi public.payment_intents;
begin
  perform pg_advisory_xact_lock(hashtext('bkash_trx:' || trx));
  select * into tx from public.payment_transactions where transaction_id = trx for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'transaction_not_found'); end if;
  if tx.verification_status in ('verified', 'rejected') then
    return jsonb_build_object('ok', tx.verification_status = 'verified', 'reason', tx.verification_status);
  end if;
  select * into ord from public.orders o
   where o.payment_method = 'bkash' and upper(btrim(o.payment_ref)) = trx and o.status = 'pending'
   order by o.created_at asc, o.id limit 1 for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_matching_order_yet'); end if;
  select * into pi from public.payment_intents where order_id = ord.id for update;
  if not found then
    update public.payment_transactions set verification_status = 'manual_review' where id = tx.id;
    return jsonb_build_object('ok', false, 'reason', 'no_payment_intent_for_order');
  end if;
  if tx.payment_intent_id is not null and tx.payment_intent_id <> pi.id then
    update public.payment_transactions set verification_status = 'rejected' where id = tx.id;
    return jsonb_build_object('ok', false, 'reason', 'transaction_already_used');
  end if;
  if pi.status <> 'pending' then return jsonb_build_object('ok', false, 'reason', 'intent_not_pending'); end if;
  if now() > pi.expires_at then
    update public.payment_intents set status = 'expired' where id = pi.id;
    update public.payment_transactions set verification_status = 'manual_review' where id = tx.id;
    return jsonb_build_object('ok', false, 'reason', 'intent_expired');
  end if;
  if tx.receiver_account is distinct from pi.receiver_account then
    update public.payment_transactions set verification_status = 'manual_review' where id = tx.id;
    return jsonb_build_object('ok', false, 'reason', 'receiver_mismatch');
  end if;
  if pi.expected_sender_account is not null and tx.sender_account is distinct from pi.expected_sender_account then
    update public.payment_transactions set payment_intent_id = pi.id, verification_status = 'manual_review' where id = tx.id;
    return jsonb_build_object('ok', false, 'reason', 'sender_mismatch');
  end if;
  if tx.amount is distinct from pi.expected_amount then
    update public.payment_transactions set payment_intent_id = pi.id, verification_status = 'amount_mismatch' where id = tx.id;
    return jsonb_build_object('ok', false, 'reason', 'amount_mismatch');
  end if;
  begin
    perform public._confirm_order_payment_core(ord.id, 'bkash', tx.transaction_id);
  exception when others then
    update public.payment_transactions set verification_status = 'manual_review' where id = tx.id;
    return jsonb_build_object('ok', false, 'reason', 'confirm_failed', 'detail', sqlerrm);
  end;
  update public.payment_transactions set payment_intent_id = pi.id, verification_status = 'verified' where id = tx.id;
  update public.payment_intents set status = 'matched' where id = pi.id;
  return jsonb_build_object('ok', true, 'reason', 'verified', 'order_id', ord.id, 'order_number', ord.order_number);
end;
$function$;

CREATE OR REPLACE FUNCTION public._ingest_bkash_transaction(p_transaction_id text, p_amount numeric, p_sender text, p_receiver text, p_transaction_time timestamp with time zone, p_raw_payload jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare trx text := public._norm_trx(p_transaction_id);
begin
  if trx = '' or p_amount is null or p_amount <= 0
     or nullif(btrim(coalesce(p_sender, '')), '') is null or nullif(btrim(coalesce(p_receiver, '')), '') is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_evidence');
  end if;
  perform pg_advisory_xact_lock(hashtext('bkash_trx:' || trx));
  insert into public.payment_transactions (transaction_id, amount, sender_account, receiver_account, transaction_time, raw_payload)
  values (trx, p_amount, p_sender, p_receiver, p_transaction_time, p_raw_payload)
  on conflict (transaction_id) do nothing;
  return public._verify_bkash_transaction(trx);
end;
$function$;

CREATE OR REPLACE FUNCTION public.submit_order_payment(p_order_id uuid, p_ref text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  ref text := nullif(btrim(coalesce(p_ref, '')), ''); o public.orders; pm text; v jsonb; st text := 'submitted';
begin
  perform public._store_rate_check('store_pay', 10, interval '10 minutes', 300);
  if ref is null or char_length(ref) < 4 then return jsonb_build_object('ok', false, 'error', 'Please enter your transaction ID'); end if;
  if char_length(ref) > 120 then return jsonb_build_object('ok', false, 'error', 'Transaction ID is too long'); end if;
  select payment_method into pm from public.orders where id = p_order_id and source = 'web';
  if pm = 'bkash' then
    ref := public._norm_trx(ref);
    perform pg_advisory_xact_lock(hashtext('bkash_trx:' || ref));
  end if;
  select * into o from public.orders where id = p_order_id and source = 'web' for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'Order not found'); end if;
  if o.status = 'cancelled' then return jsonb_build_object('ok', false, 'error', 'This order was cancelled. Please place a new order.'); end if;
  if o.status <> 'pending' or coalesce(o.payment_method, '') = 'cod' then return jsonb_build_object('ok', false, 'error', 'This order is not waiting for payment'); end if;
  if nullif(btrim(coalesce(o.payment_ref, '')), '') is not null then return jsonb_build_object('ok', false, 'error', 'Payment details were already submitted for this order'); end if;
  begin
    perform set_config('sv.server_write', '1', true);
    update public.orders set payment_ref = ref, updated_at = now() where id = o.id;
    perform set_config('sv.server_write', '', true);
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'This transaction ID has already been used for another order');
  end;
  if o.payment_method = 'bkash' then
    begin
      v := public._verify_bkash_transaction(ref);
      if (v->>'ok')::boolean then st := 'paid'; end if;
    exception when others then
      st := 'submitted';
    end;
  end if;
  return jsonb_build_object('ok', true, 'order_id', o.id, 'order_number', o.order_number, 'state', st);
end;
$function$;

CREATE OR REPLACE FUNCTION public.submit_payment_trxid(p_order_number text, p_customer_phone text, p_trxid text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  ord public.orders; ph text := public.norm_bd_phone(p_customer_phone); trx text := public._norm_trx(p_trxid); v jsonb; st text := 'submitted';
begin
  perform public._store_rate_check('submit_trxid', 8, interval '10 minutes', 100);
  if trx = '' or char_length(trx) > 20 then return jsonb_build_object('ok', false, 'error', 'Please enter a valid Transaction ID'); end if;
  if ph is null then return jsonb_build_object('ok', false, 'error', 'Phone number not recognized'); end if;
  perform pg_advisory_xact_lock(hashtext('bkash_trx:' || trx));
  select * into ord from public.orders
   where order_number = p_order_number and public.norm_bd_phone(customer_phone) = ph and payment_method = 'bkash' and status = 'pending'
   for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'Order not found or already paid'); end if;
  if nullif(btrim(coalesce(ord.payment_ref, '')), '') is not null and public._norm_trx(ord.payment_ref) <> trx then
    return jsonb_build_object('ok', false, 'error', 'Payment details were already submitted for this order');
  end if;
  if nullif(btrim(coalesce(ord.payment_ref, '')), '') is null then
    begin
      perform set_config('sv.server_write', '1', true);
      update public.orders set payment_ref = trx, updated_at = now() where id = ord.id;
      perform set_config('sv.server_write', '', true);
    exception when unique_violation then
      return jsonb_build_object('ok', false, 'error', 'This transaction ID has already been used for another order');
    end;
  end if;
  begin
    v := public._verify_bkash_transaction(trx);
    if (v->>'ok')::boolean then st := 'paid'; end if;
  exception when others then
    st := 'submitted';
  end;
  return jsonb_build_object('ok', true, 'order_number', ord.order_number, 'state', st);
end;
$function$;

revoke execute on function public._verify_bkash_transaction(text), public._ingest_bkash_transaction(text,numeric,text,text,timestamptz,jsonb), public._confirm_order_payment_core(uuid,text,text) from public, anon, authenticated;
grant execute on function public._verify_bkash_transaction(text), public._ingest_bkash_transaction(text,numeric,text,text,timestamptz,jsonb), public._confirm_order_payment_core(uuid,text,text) to service_role;
