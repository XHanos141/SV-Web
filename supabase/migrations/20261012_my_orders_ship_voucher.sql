-- Expose orders.ship_voucher (voucher.discount_type = 'shipping') through my_orders so the web order card can
-- render discount/shipping exactly like the dashboard's svDiscShipRows(). Additive: one extra key, idempotent.
do $$
declare d text;
begin
  d := pg_get_functiondef('public.my_orders'::regproc);
  if position('ship_voucher' in d) > 0 then return; end if;
  d := replace(d, '''voucher_code'', o.voucher_code,', '''voucher_code'', o.voucher_code, ''ship_voucher'', public.ship_voucher(o),');
  if position('ship_voucher' in d) = 0 then raise exception 'my_orders patch point not found'; end if;
  execute d;
end $$;
