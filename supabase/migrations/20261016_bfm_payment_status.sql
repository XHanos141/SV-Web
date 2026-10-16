-- Buy For Me: proxy payment + status engine
alter table public.proxy_requests
  add column if not exists store_order_no text,
  add column if not exists intl_tracking_no text,
  add column if not exists cancel_reason text,
  add column if not exists paid_at timestamptz;

-- 1) unpaid-expiry job never touches proxy orders (admin decides)
create or replace function public._expire_unpaid_orders()
returns integer language plpgsql security definer set search_path to 'public' as $$
declare n integer;
begin
  perform set_config('sv.server_write', '1', true);
  with c as (
    update public.orders
       set status = 'cancelled', cancelled_at = now(), cancel_reason = 'Not paid in time', updated_at = now()
     where source = 'web' and order_type = 'internal' and status = 'pending'
       and coalesce(payment_method, '') <> 'cod'
       and nullif(btrim(coalesce(payment_ref, '')), '') is null
       and created_at < now() - interval '5 hours'
    returning id
  ), i as (
    update public.payment_intents pi set status = 'expired'
     where pi.order_id in (select id from c) and pi.status = 'pending'
    returning 1
  )
  select count(*) into n from c;
  perform set_config('sv.server_write', '', true);
  return n;
end;
$$;

-- 2) store order list excludes proxy orders (they live in proxy_requests)
do $$
declare d text; d2 text;
begin
  select pg_get_functiondef('public.my_orders()'::regprocedure) into d;
  d2 := replace(d, E'where o.source = ''web'' and (o.customer_id', E'where o.source = ''web'' and o.order_type = ''internal'' and (o.customer_id');
  if d2 = d then raise exception 'my_orders patch target not found'; end if;
  execute d2;
end $$;

-- 3) customer: load own proxy order for the payment page
create or replace function public.my_proxy_order(p_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare c public.customers; o public.orders; r public.proxy_requests;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'login_required'); end if;
  select * into c from public.customers where auth_id = auth.uid() order by created_at asc limit 1;
  if not found then return jsonb_build_object('ok', false, 'error', 'Order not found'); end if;
  select * into o from public.orders where id = p_id and order_type = 'proxy' and customer_id = c.id;
  if not found then return jsonb_build_object('ok', false, 'error', 'Order not found'); end if;
  select * into r from public.proxy_requests where order_id = o.id;
  return jsonb_build_object('ok', true, 'order_id', o.id, 'order_number', o.order_number,
    'request_no', r.request_no, 'total', o.total_amount, 'status', o.status, 'req_status', r.status,
    'payment_method', o.payment_method,
    'submitted', nullif(btrim(coalesce(o.payment_ref, '')), '') is not null,
    'paid_at', o.paid_at);
end;
$$;

-- 4) customer: choose method / (re)create bKash intent for an unpaid proxy order
create or replace function public.proxy_start_payment(p_order_id uuid, p_method text, p_sender text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare c public.customers; o public.orders;
  meth text := lower(btrim(coalesce(p_method, '')));
  sender text := public.norm_bd_phone(p_sender);
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'Please log in'); end if;
  select * into c from public.customers where auth_id = auth.uid() order by created_at asc limit 1;
  if not found then return jsonb_build_object('ok', false, 'error', 'Order not found'); end if;
  if meth not in ('bkash','nagad','upay','rocket','cellfin','bank','card','crypto') then
    return jsonb_build_object('ok', false, 'error', 'Please choose a payment method');
  end if;
  if meth = 'bkash' and sender is null then
    return jsonb_build_object('ok', false, 'error', 'Please confirm the bKash number you are sending from');
  end if;
  select * into o from public.orders where id = p_order_id and order_type = 'proxy' and customer_id = c.id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'Order not found'); end if;
  if o.status <> 'pending' then return jsonb_build_object('ok', false, 'error', 'This order is not waiting for payment'); end if;
  if nullif(btrim(coalesce(o.payment_ref, '')), '') is not null then
    return jsonb_build_object('ok', false, 'error', 'Payment details were already submitted for this order');
  end if;
  perform set_config('sv.server_write', '1', true);
  update public.orders set payment_method = meth, updated_at = now() where id = o.id;
  if meth = 'bkash' then
    if exists (select 1 from public.payment_intents where order_id = o.id) then
      update public.payment_intents
         set method = 'bkash', expected_amount = o.total_amount, receiver_account = '01725492479',
             expected_sender_account = sender, status = 'pending', expires_at = now() + interval '3 days'
       where order_id = o.id;
    else
      insert into public.payment_intents(order_id, method, expected_amount, receiver_account, expected_sender_account, expires_at)
      values (o.id, 'bkash', o.total_amount, '01725492479', sender, now() + interval '3 days');
    end if;
  else
    update public.payment_intents set status = 'expired' where order_id = o.id and status = 'pending';
  end if;
  perform set_config('sv.server_write', '', true);
  return jsonb_build_object('ok', true, 'order_id', o.id, 'order_number', o.order_number, 'total', o.total_amount);
end;
$$;

-- 5) order paid -> request paid
create or replace function public.proxy_sync_order_paid()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.order_type = 'proxy' and new.status = 'paid' and old.status is distinct from 'paid' then
    update public.proxy_requests set status = 'paid', paid_at = now(), updated_at = now()
     where order_id = new.id and status = 'approved';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_proxy_sync_paid on public.orders;
create trigger trg_proxy_sync_paid after update of status on public.orders
  for each row execute function public.proxy_sync_order_paid();

-- 6) admin: next step (sequential only)
create or replace function public.admin_set_proxy_status(p_id uuid, p_status text, p_store_order_no text default null, p_tracking_no text default null)
returns public.proxy_requests language plpgsql security definer set search_path to 'public' as $$
declare r public.proxy_requests; ok boolean;
begin
  if not coalesce(is_active_admin(auth.uid()), false) then raise exception 'forbidden'; end if;
  select * into r from public.proxy_requests where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  ok := case r.status
    when 'paid' then p_status = 'purchasing'
    when 'purchasing' then p_status = 'ordered'
    when 'ordered' then p_status = 'shipped_intl'
    when 'shipped_intl' then p_status = 'arrived_bd'
    when 'arrived_bd' then p_status = 'delivered'
    else false end;
  if not ok then raise exception 'invalid_transition: % -> %', r.status, p_status; end if;
  update public.proxy_requests
     set status = p_status,
         store_order_no = coalesce(nullif(btrim(p_store_order_no), ''), store_order_no),
         intl_tracking_no = coalesce(nullif(btrim(p_tracking_no), ''), intl_tracking_no),
         updated_at = now()
   where id = p_id returning * into r;
  if p_status = 'delivered' and r.order_id is not null then
    perform set_config('sv.server_write', '1', true);
    update public.orders set delivered_at = coalesce(delivered_at, now()), updated_at = now() where id = r.order_id;
    perform set_config('sv.server_write', '', true);
  end if;
  return r;
end;
$$;

-- 7) admin: edit store order no / tracking without changing status
create or replace function public.admin_set_proxy_tracking(p_id uuid, p_store_order_no text default null, p_tracking_no text default null)
returns public.proxy_requests language plpgsql security definer set search_path to 'public' as $$
declare r public.proxy_requests;
begin
  if not coalesce(is_active_admin(auth.uid()), false) then raise exception 'forbidden'; end if;
  update public.proxy_requests
     set store_order_no = nullif(btrim(coalesce(p_store_order_no, store_order_no, '')), ''),
         intl_tracking_no = nullif(btrim(coalesce(p_tracking_no, intl_tracking_no, '')), ''),
         updated_at = now()
   where id = p_id returning * into r;
  if r.id is null then raise exception 'not_found'; end if;
  return r;
end;
$$;

-- 8) admin: cancel / reject (never after payment is confirmed)
create or replace function public.admin_close_proxy(p_id uuid, p_reason text default null, p_reject boolean default false, p_force boolean default false)
returns public.proxy_requests language plpgsql security definer set search_path to 'public' as $$
declare r public.proxy_requests; o public.orders;
begin
  if not coalesce(is_active_admin(auth.uid()), false) then raise exception 'forbidden'; end if;
  select * into r from public.proxy_requests where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if r.status not in ('pending_quote','quoted','approved') then raise exception 'paid_order_use_returns'; end if;
  if r.order_id is not null then
    select * into o from public.orders where id = r.order_id for update;
    if o.status = 'paid' then raise exception 'paid_order_use_returns'; end if;
    if nullif(btrim(coalesce(o.payment_ref, '')), '') is not null and not p_force then
      raise exception 'payment_submitted';
    end if;
    if o.status <> 'cancelled' then
      perform public._cancel_web_order_core(o.id, coalesce(nullif(btrim(p_reason), ''), 'Cancelled by admin'));
    end if;
  end if;
  update public.proxy_requests
     set status = case when p_reject and r.status in ('pending_quote','quoted') then 'rejected' else 'cancelled' end,
         cancel_reason = nullif(btrim(coalesce(p_reason, '')), ''), updated_at = now()
   where id = p_id returning * into r;
  return r;
end;
$$;

revoke all on function public.my_proxy_order(uuid) from public, anon;
revoke all on function public.proxy_start_payment(uuid, text, text) from public, anon;
revoke all on function public.proxy_sync_order_paid() from public, anon, authenticated;
revoke all on function public.admin_set_proxy_status(uuid, text, text, text) from public, anon;
revoke all on function public.admin_set_proxy_tracking(uuid, text, text) from public, anon;
revoke all on function public.admin_close_proxy(uuid, text, boolean, boolean) from public, anon;
grant execute on function public.my_proxy_order(uuid) to authenticated;
grant execute on function public.proxy_start_payment(uuid, text, text) to authenticated;
grant execute on function public.admin_set_proxy_status(uuid, text, text, text) to authenticated;
grant execute on function public.admin_set_proxy_tracking(uuid, text, text) to authenticated;
grant execute on function public.admin_close_proxy(uuid, text, boolean, boolean) to authenticated;
