-- Customer-side "remove from Orders tab" (soft hide). Orders are never deleted or altered:
-- admin dashboard, invoices and reports ignore this table entirely.
-- Separate table (not an orders column) so customers never get a write path onto orders.
create table if not exists public.order_user_state (
  customer_id uuid not null references public.customers(id) on delete cascade,
  order_id    uuid not null references public.orders(id)    on delete cascade,
  hidden_at   timestamptz not null default now(),
  primary key (customer_id, order_id)
);
alter table public.order_user_state enable row level security;   -- no policies: RPC-only access
revoke all on public.order_user_state from anon, authenticated;

-- Hide / unhide one of the caller's own FINAL orders (delivered or cancelled). Same ownership rule as my_orders().
create or replace function public.hide_order(p_id uuid, p_hide boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c public.customers;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'login_required'); end if;
  select * into c from public.customers where auth_id = uid order by created_at asc limit 1;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if not exists (
    select 1 from public.orders o
     where o.id = p_id and o.source = 'web'
       and (o.customer_id = c.id or public.norm_bd_phone(o.customer_phone) = public.norm_bd_phone(c.phone))
       and (o.status = 'cancelled' or o.delivered_at is not null)
  ) then return jsonb_build_object('ok', false, 'error', 'not_allowed'); end if;
  if p_hide then
    insert into public.order_user_state (customer_id, order_id) values (c.id, p_id)
    on conflict (customer_id, order_id) do update set hidden_at = now();
  else
    delete from public.order_user_state where customer_id = c.id and order_id = p_id;
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.my_hidden_orders()
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare uid uuid := auth.uid(); c public.customers;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'login_required'); end if;
  select * into c from public.customers where auth_id = uid order by created_at asc limit 1;
  if not found then return jsonb_build_object('ok', true, 'ids', '[]'::jsonb); end if;
  return jsonb_build_object('ok', true, 'ids',
    coalesce((select jsonb_agg(order_id) from public.order_user_state where customer_id = c.id), '[]'::jsonb));
end $$;

revoke all on function public.hide_order(uuid, boolean) from public, anon;
revoke all on function public.my_hidden_orders()        from public, anon;
grant execute on function public.hide_order(uuid, boolean) to authenticated;
grant execute on function public.my_hidden_orders()        to authenticated;
