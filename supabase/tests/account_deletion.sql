-- Run on STAGING only. Everything rolls back: the final RAISE carries the results.
do $$
declare res text[] := '{}'; a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); r jsonb; rows int; t text; n int;
begin
  insert into public.customers(id, customer_code, email, full_name, source, auth_id) values
    (a, 'CU-T1', 't1@example.com', 'Test One', 'web', gen_random_uuid()), (b, 'CU-T2', 't2@example.com', 'Test Two', 'web', gen_random_uuid());
  insert into public.orders(order_number, order_type, customer_id, status, total_amount, subtotal, discount, shipping, source, stock_deducted, discount_source, customer_name, customer_phone, address_text)
    values ('T-ACTIVE', 'internal', a, 'processing', 100, 100, 0, 0, 'web', false, 'none', 'Test One', '017', 'addr'),
           ('T-DONE', 'internal', a, 'delivered', 100, 100, 0, 0, 'web', false, 'none', 'Test One', '017', 'addr');
  insert into public.customer_addresses(customer_id, label, recipient_name) values (a, 'Home', 'Test One');

  -- 1 blockers (triggers renumber order_number and customer_code, so tests key on ids)
  res := res || ('1 blockers only active: ' || (cardinality(public.sv_del_blockers(a)) = 1)::text);
  -- 2 issue + cooldown
  r := public.sv_del_issue_otp(a, 'h1'); res := res || ('2a issue ok: ' || (r->>'ok'));
  r := public.sv_del_issue_otp(a, 'h2'); res := res || ('2b immediate resend -> cooldown: ' || (r->>'error'));
  -- 3 wrong attempts then lock (even the right code after lock fails)
  for n in 1..5 loop r := public.sv_del_verify_otp(a, 'bad'); end loop;
  res := res || ('3a 5th wrong attempts_left=0: ' || (r->>'attempts_left'));
  r := public.sv_del_verify_otp(a, 'h1'); res := res || ('3b right code after lock -> ' || (r->>'error'));
  -- 4 blocked on verify, then success after order delivered
  update public.account_deletion_otps set last_sent_at = now() - interval '2 minutes' where customer_id = a;
  r := public.sv_del_issue_otp(a, 'h3'); res := res || ('4a reissue resets attempts: ' || (r->>'ok'));
  r := public.sv_del_verify_otp(a, 'h3'); res := res || ('4b correct code but active order -> ' || (r->>'error'));
  update public.orders set status = 'delivered' where customer_id = a;
  r := public.sv_del_verify_otp(a, 'h3'); res := res || ('4c success: ' || (r->>'ok'));
  select (deletion_purge_at is not null and deletion_purge_at > now() + interval '6 days 23 hours') into t from public.customers where id = a;
  res := res || ('4d purge_at ~7d: ' || t);
  r := public.sv_del_verify_otp(a, 'h3'); res := res || ('4e code is single use -> ' || (r->>'error'));
  -- 5 expiry
  insert into public.account_deletion_otps(customer_id, code_hash, expires_at) values (b, 'x', now() - interval '1 minute');
  r := public.sv_del_verify_otp(b, 'x'); res := res || ('5 expired -> ' || (r->>'error'));
  -- 6 hourly cap: 4 sends allowed, 5th rate_limited
  delete from public.account_deletion_otps where customer_id = b;
  for n in 1..4 loop
    r := public.sv_del_issue_otp(b, 'k' || n);
    update public.account_deletion_otps set last_sent_at = now() - interval '2 minutes' where customer_id = b;
  end loop;
  r := public.sv_del_issue_otp(b, 'k5'); res := res || ('6 5th send in an hour -> ' || (r->>'error'));
  -- 7 purge not yet due: nothing happens to a
  select count(*) into rows from public.sv_del_purge_due(180) where customer_id = a;
  res := res || ('7 not due yet -> not purged: ' || (rows = 0)::text);
  -- 8 purge due, but a new order appeared in grace -> postponed
  update public.customers set deletion_purge_at = now() - interval '1 minute' where id = a;
  insert into public.orders(order_number, order_type, customer_id, status, total_amount, subtotal, discount, shipping, source, stock_deducted, discount_source)
    values ('T-NEW', 'internal', a, 'processing', 50, 50, 0, 0, 'web', false, 'none');
  select count(*) into rows from public.sv_del_purge_due(180) where customer_id = a;
  select (anonymized_at is null and deletion_purge_at > now()) into t from public.customers where id = a;
  res := res || ('8 new active order postpones purge: ' || (rows = 0 and t::boolean)::text);
  -- 9 purge happens
  update public.orders set status = 'delivered' where customer_id = a;
  update public.customers set deletion_purge_at = now() - interval '1 minute' where id = a;
  select count(*) into rows from public.sv_del_purge_due(180) where customer_id = a;
  select (email = 'deleted+' || lower(customer_code) || '@deleted.invalid' and phone is null and full_name = 'Deleted customer' and anonymized_at is not null) into t from public.customers where id = a;
  res := res || ('9a anonymized + returned for auth deletion: ' || (rows = 1 and t::boolean)::text);
  select count(*) into rows from public.customer_addresses where customer_id = a;
  res := res || ('9b addresses deleted: ' || (rows = 0)::text);
  select count(*) into rows from public.orders where customer_id = a and customer_name = 'Test One';
  res := res || ('9c orders keep delivery snapshot inside retention: ' || (rows = 2)::text);
  select count(*) into rows from public.sv_del_purge_due(180) where customer_id = a;
  res := res || ('9d retried until finalized: ' || (rows = 1)::text);
  perform public.sv_del_finalize(array[a]);
  select count(*) into rows from public.sv_del_purge_due(180) where customer_id = a;
  res := res || ('9e finalized -> no longer returned: ' || (rows = 0)::text);
  -- 10 retention scrub (0 days)
  perform public.sv_del_purge_due(0);
  select count(*) into rows from public.orders where customer_id = a and customer_name = 'Deleted customer' and customer_phone is null and address_text is null;
  res := res || ('10 aged orders with PII scrubbed, rows kept: ' || (rows = 2 and (select count(*) from public.orders where customer_id = a) = 3)::text);
  -- 11 restore only inside grace (not testable w/o auth.uid(); verify function exists + not callable by anon)
  res := res || ('11 anon cannot call sv_del_verify_otp: ' || (not has_function_privilege('anon', 'public.sv_del_verify_otp(uuid,text)', 'execute'))::text);
  res := res || ('11b authenticated cannot call purge: ' || (not has_function_privilege('authenticated', 'public.sv_del_purge_due(int)', 'execute'))::text);
  res := res || ('11c authenticated can restore: ' || has_function_privilege('authenticated', 'public.restore_my_account()', 'execute')::text);
  res := res || ('11d anon cannot read otp table: ' || (not has_table_privilege('anon', 'public.account_deletion_otps', 'select'))::text);
  raise exception E'RESULTS\n%', array_to_string(res, E'\n');
end $$;
