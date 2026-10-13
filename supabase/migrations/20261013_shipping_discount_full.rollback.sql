do $$
declare r record; d text;
begin
  for r in select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname in ('_store_ship_fee', 'create_store_order') loop
    d := pg_get_functiondef(r.oid);
    d := replace(d, 'case when coalesce(cfg->>''shipping_discount'', ''none'') = ''full'' or sub >= thr then 0 else flat end;', 'case when sub >= thr then 0 else flat end;');
    execute d;
  end loop;
end $$;
