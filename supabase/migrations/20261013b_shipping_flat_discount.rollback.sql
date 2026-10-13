do $$
declare r record; d text;
begin
  for r in select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname in ('_store_ship_fee', 'create_store_order') loop
    d := pg_get_functiondef(r.oid);
    d := replace(d, 'then 0 else greatest(0, flat - coalesce((cfg->>''flat_discount'')::numeric, 0)) end;', 'then 0 else flat end;');
    execute d;
  end loop;
end $$;
