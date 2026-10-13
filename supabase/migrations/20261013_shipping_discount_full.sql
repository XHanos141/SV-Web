-- Admin "Shipping Discount = Full": site_content(store/shipping).shipping_discount = 'full' makes the shipping fee 0 for every
-- order, whatever the amount. Patches the two places that price shipping server-side (voucher preview + real order).
-- Idempotent; anything other than 'full' keeps the existing flat / free-over-threshold behaviour.
do $$
declare r record; d text; d2 text;
begin
  for r in select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname in ('_store_ship_fee', 'create_store_order') loop
    d := pg_get_functiondef(r.oid);
    continue when position('shipping_discount' in d) > 0;
    d2 := replace(d, 'ship := case when sub >= thr then 0 else flat end;',
      'ship := case when coalesce(cfg->>''shipping_discount'', ''none'') = ''full'' or sub >= thr then 0 else flat end;');
    d2 := replace(d2, 'return case when sub >= thr then 0 else flat end;',
      'return case when coalesce(cfg->>''shipping_discount'', ''none'') = ''full'' or sub >= thr then 0 else flat end;');
    if d2 = d then raise exception 'shipping patch point not found in %', r.proname; end if;
    execute d2;
  end loop;
end $$;
