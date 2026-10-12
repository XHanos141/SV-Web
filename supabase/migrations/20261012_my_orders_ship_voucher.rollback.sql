do $$
declare d text;
begin
  d := pg_get_functiondef('public.my_orders'::regproc);
  d := replace(d, ' ''ship_voucher'', public.ship_voucher(o),', '');
  execute d;
end $$;
