-- Read-only. PASS = zero rows.
select 'FAIL: unique index missing or not unique/partial' as violation
where not exists (
  select 1 from pg_index i join pg_class c on c.oid = i.indexrelid
   where c.relname = 'uq_orders_bkash_payment_ref' and i.indisunique and i.indpred is not null and i.indisvalid)
union all
select 'FAIL: live duplicate bKash ref ' || upper(btrim(payment_ref))
from public.orders
where payment_method = 'bkash' and status <> 'cancelled' and nullif(btrim(payment_ref), '') is not null
group by upper(btrim(payment_ref)) having count(*) > 1;
