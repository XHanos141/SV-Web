-- Admin "Shipping Discount = Flat": site_content(store/shipping).flat_discount (tk) is taken off the flat shipping fee
-- (never below 0). 'full' still wins (fee 0). Same two server pricing functions as the Full migration. Idempotent.
do $$
declare r record; d text; d2 text;
begin
  for r in select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname in ('_store_ship_fee', 'create_store_order') loop
    d := pg_get_functiondef(r.oid);
    continue when position('flat_discount' in d) > 0;
    d2 := replace(d, 'then 0 else flat end;',
      'then 0 else greatest(0, flat - coalesce((cfg->>''flat_discount'')::numeric, 0)) end;');
    if d2 = d then raise exception 'flat discount patch point not found in %', r.proname; end if;
    execute d2;
  end loop;
end $$;
