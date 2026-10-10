-- Run on STAGING only (rolls back; RAISE carries the results).
do $$
declare a uuid := gen_random_uuid(); u uuid := gen_random_uuid(); res text[] := '{}'; ok boolean; st jsonb;
begin
  insert into public.customers(id, customer_code, email, full_name, source, auth_id, deletion_requested_at, deletion_purge_at)
    values (a, 'CU-R1', 'r1@example.com', 'R One', 'web', u, now(), now() + interval '7 days');
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'iat', extract(epoch from now() - interval '5 minutes')::bigint)::text, true);
  ok := public.restore_my_account(); res := res || ('old session cannot restore: ' || (not ok)::text);
  st := public.my_deletion_status(); res := res || ('still pending: ' || (st->>'pending'));
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'iat', extract(epoch from now() + interval '5 seconds')::bigint)::text, true);
  ok := public.restore_my_account(); res := res || ('fresh login restores: ' || ok::text);
  st := public.my_deletion_status(); res := res || ('no longer pending: ' || (not (st->>'pending')::boolean)::text);
  update public.customers set deletion_requested_at = now() - interval '8 days', deletion_purge_at = now() - interval '1 day' where id = a;
  ok := public.restore_my_account(); res := res || ('after purge date cannot restore: ' || (not ok)::text);
  raise exception E'RESULTS\n%', array_to_string(res, E'\n');
end $$;
