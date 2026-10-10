-- Read-only. Returns one row per violation; PASS = zero rows.
with expect_denied(fn) as (values
  ('public._confirm_order_payment_core(uuid,text,text)'),
  ('public._ingest_bkash_transaction(text,numeric,text,text,timestamptz,jsonb)'),
  ('public._verify_bkash_transaction(text)')
), roles(r) as (values ('anon'), ('authenticated'))
select 'FAIL: ' || r || ' can execute ' || fn as violation
from expect_denied, roles
where has_function_privilege(r, fn::regprocedure, 'EXECUTE')
union all
select 'FAIL: service_role cannot execute ' || fn
from expect_denied
where not has_function_privilege('service_role', fn::regprocedure, 'EXECUTE')
union all
-- public flows must stay callable
select 'FAIL: anon cannot execute ' || fn
from (values ('public.create_store_order(jsonb)'),
             ('public.submit_order_payment(uuid,text)'),
             ('public.store_validate_voucher(text,jsonb,text)')) t(fn)
where not has_function_privilege('anon', fn::regprocedure, 'EXECUTE')
union all
select 'FAIL: authenticated cannot execute public.confirm_order_payment'
where not has_function_privilege('authenticated', 'public.confirm_order_payment(uuid,text,text)'::regprocedure, 'EXECUTE');
