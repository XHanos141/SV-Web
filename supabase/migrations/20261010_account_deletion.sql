-- Account deletion: anonymize-and-close with email OTP + 7-day grace period.
-- Everything here is service-role only except restore_my_account / my_deletion_status.

alter table public.customers
  add column if not exists deletion_requested_at timestamptz,
  add column if not exists deletion_purge_at timestamptz,
  add column if not exists anonymized_at timestamptz;

create table if not exists public.account_deletion_otps (
  customer_id uuid primary key references public.customers(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  last_sent_at timestamptz not null default now(),
  window_started_at timestamptz not null default now(),
  window_sent int not null default 1,
  consumed_at timestamptz
);
alter table public.account_deletion_otps enable row level security;
revoke all on public.account_deletion_otps from anon, authenticated;

-- Orders / Buy-for-Me requests that still block deletion
create or replace function public.sv_del_blockers(p_customer uuid) returns text[]
language plpgsql security definer set search_path = public, pg_temp as $$
declare r text[]; px text[];
begin
  select coalesce(array_agg(order_number order by created_at), '{}') into r
  from public.orders where customer_id = p_customer
    and status not in ('delivered','cancelled','completed','refunded');
  if to_regclass('public.proxy_requests') is not null then
    execute $q$select coalesce(array_agg(coalesce(o.order_number, pr.request_no, 'Request')), '{}')
      from public.proxy_requests pr left join public.orders o on o.id = pr.order_id
      where pr.customer_id = $1 and pr.status in ('approved','paid','purchasing','ordered','shipped_intl','arrived_bd')$q$
      into px using p_customer;
    r := r || px;
  end if;
  return array(select distinct unnest(r));
end $$;

-- Store a new code (hash only). 60s gap between sends, max 4 sends per hour.
create or replace function public.sv_del_issue_otp(p_customer uuid, p_code_hash text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare o public.account_deletion_otps; n timestamptz := now(); wait int;
begin
  select * into o from public.account_deletion_otps where customer_id = p_customer for update;
  if not found then
    insert into public.account_deletion_otps(customer_id, code_hash, expires_at) values (p_customer, p_code_hash, n + interval '10 minutes');
  else
    if n - o.last_sent_at < interval '60 seconds' then
      wait := ceil(extract(epoch from (o.last_sent_at + interval '60 seconds' - n)))::int;
      return jsonb_build_object('ok', false, 'error', 'cooldown', 'retry_in', wait);
    end if;
    if n - o.window_started_at < interval '1 hour' then
      if o.window_sent >= 4 then
        wait := ceil(extract(epoch from (o.window_started_at + interval '1 hour' - n)))::int;
        return jsonb_build_object('ok', false, 'error', 'rate_limited', 'retry_in', wait);
      end if;
      update public.account_deletion_otps set code_hash = p_code_hash, expires_at = n + interval '10 minutes', attempts = 0,
        consumed_at = null, last_sent_at = n, window_sent = window_sent + 1 where customer_id = p_customer;
    else
      update public.account_deletion_otps set code_hash = p_code_hash, expires_at = n + interval '10 minutes', attempts = 0,
        consumed_at = null, last_sent_at = n, window_started_at = n, window_sent = 1 where customer_id = p_customer;
    end if;
  end if;
  return jsonb_build_object('ok', true, 'expires_in', 600, 'resend_in', 60);
end $$;

-- Single-use, 5 attempts. On success: re-check blockers, then deactivate + schedule purge in 7 days.
create or replace function public.sv_del_verify_otp(p_customer uuid, p_code_hash text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare o public.account_deletion_otps; b text[]; purge timestamptz := now() + interval '7 days';
begin
  select * into o from public.account_deletion_otps where customer_id = p_customer for update;
  if not found or o.consumed_at is not null or o.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;
  if o.attempts >= 5 then return jsonb_build_object('ok', false, 'error', 'locked'); end if;
  if o.code_hash <> p_code_hash then
    update public.account_deletion_otps set attempts = attempts + 1 where customer_id = p_customer;
    return jsonb_build_object('ok', false, 'error', 'invalid', 'attempts_left', greatest(0, 4 - o.attempts));
  end if;
  b := public.sv_del_blockers(p_customer);
  if cardinality(b) > 0 then return jsonb_build_object('ok', false, 'error', 'blocked', 'blocking', to_jsonb(b)); end if;
  update public.account_deletion_otps set consumed_at = now() where customer_id = p_customer;
  update public.customers set deletion_requested_at = now(), deletion_purge_at = purge
    where id = p_customer and anonymized_at is null;
  return jsonb_build_object('ok', true, 'purge_at', purge);
end $$;

-- Logged-in customer: is deletion pending, and cancel it (called on login)
create or replace function public.my_deletion_status() returns jsonb
language sql security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('pending', c.deletion_purge_at is not null and c.anonymized_at is null, 'purge_at', c.deletion_purge_at)
  from public.customers c where c.auth_id = auth.uid() limit 1
$$;
create or replace function public.restore_my_account() returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare n int;
begin
  update public.customers set deletion_requested_at = null, deletion_purge_at = null
   where auth_id = auth.uid() and anonymized_at is null and deletion_purge_at is not null and deletion_purge_at > now()
     and coalesce(to_timestamp(nullif(auth.jwt() ->> 'iat', '')::bigint), now()) > deletion_requested_at;  -- only a login made AFTER the request restores; the old session's token must not
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- Daily purge: anonymize due customers (idempotent; retries auth deletion), scrub aged order PII.
create or replace function public.sv_del_purge_due(p_retention_days int default 180)
returns table(customer_id uuid, auth_id uuid, avatar_url text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare rec record;
begin
  for rec in
    select c.id, c.auth_id as aid, c.avatar_url as av, c.customer_code, c.anonymized_at
    from public.customers c
    where (c.deletion_purge_at <= now() and c.anonymized_at is null) or (c.anonymized_at is not null and c.auth_id is not null)
    for update skip locked
  loop
    if rec.anonymized_at is null then
      if cardinality(public.sv_del_blockers(rec.id)) > 0 then
        update public.customers set deletion_purge_at = now() + interval '1 day' where id = rec.id;  -- new order placed during grace: postpone
        continue;
      end if;
      if to_regclass('public.customer_addresses') is not null then
        execute 'delete from public.customer_addresses where customer_id = $1' using rec.id;
      end if;
      delete from public.account_deletion_otps where account_deletion_otps.customer_id = rec.id;
      update public.customers set email = 'deleted+' || lower(rec.customer_code) || '@deleted.invalid', phone = null,
        full_name = 'Deleted customer', avatar_url = null, avatar_is_custom = false, address_text = null, district = null,
        notes = null, anonymized_at = now() where id = rec.id;
    end if;
    customer_id := rec.id; auth_id := rec.aid; avatar_url := rec.av; return next;
  end loop;
  update public.orders o set customer_name = 'Deleted customer', customer_phone = null, address_text = null, delivery_address = null
   from public.customers c
   where o.customer_id = c.id and c.anonymized_at is not null and c.anonymized_at <= now() - make_interval(days => p_retention_days)
     and (o.customer_phone is not null or o.address_text is not null or o.delivery_address is not null or o.customer_name <> 'Deleted customer');
end $$;

create or replace function public.sv_del_finalize(p_ids uuid[]) returns void
language sql security definer set search_path = public, pg_temp as $$
  update public.customers set auth_id = null where id = any(p_ids) and anonymized_at is not null
$$;

revoke execute on function public.sv_del_blockers(uuid), public.sv_del_issue_otp(uuid, text), public.sv_del_verify_otp(uuid, text),
  public.sv_del_purge_due(int), public.sv_del_finalize(uuid[]), public.my_deletion_status(), public.restore_my_account() from public, anon, authenticated;
grant execute on function public.sv_del_blockers(uuid), public.sv_del_issue_otp(uuid, text), public.sv_del_verify_otp(uuid, text),
  public.sv_del_purge_due(int), public.sv_del_finalize(uuid[]) to service_role;
grant execute on function public.my_deletion_status(), public.restore_my_account() to authenticated;
