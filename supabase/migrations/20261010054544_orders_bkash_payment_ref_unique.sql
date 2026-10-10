-- One bKash TrxID may back at most one live (non-cancelled) order.
-- Normalised (upper/trim) because customers type refs in any case and bKash IDs are upper-case.
-- Cancelled orders are excluded so a stranded TrxID can be reused on a replacement order.
-- Preflight aborts the migration (no change) if duplicates already exist.
do $$
begin
  if exists (
    select 1 from public.orders
     where payment_method = 'bkash' and status <> 'cancelled'
       and nullif(btrim(payment_ref), '') is not null
     group by upper(btrim(payment_ref)) having count(*) > 1
  ) then
    raise exception 'duplicate live bKash payment_ref values exist; resolve before creating unique index';
  end if;
end $$;

create unique index if not exists uq_orders_bkash_payment_ref
  on public.orders (upper(btrim(payment_ref)))
  where payment_method = 'bkash'
    and status <> 'cancelled'
    and nullif(btrim(payment_ref), '') is not null;
