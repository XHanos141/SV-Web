-- BFM payment: store delivery address on the proxy order when payment starts.
drop function if exists public.proxy_start_payment(uuid, text, text);

create or replace function public.proxy_start_payment(
  p_order_id uuid, p_method text, p_sender text default null,
  p_name text default null, p_phone text default null, p_address text default null,
  p_district text default null, p_zip text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare c public.customers; o public.orders;
  meth text := lower(btrim(coalesce(p_method, '')));
  sender text := public.norm_bd_phone(p_sender);
  a_name text := nullif(btrim(coalesce(p_name, '')), '');
  a_phone text := public.norm_bd_phone(p_phone);
  a_addr text := nullif(btrim(coalesce(p_address, '')), '');
  a_city text := nullif(btrim(coalesce(p_district, '')), '');
  a_zip text := nullif(btrim(coalesce(p_zip, '')), '');
  has_addr boolean := (p_name is not null or p_phone is not null or p_address is not null);
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
  if has_addr and (a_name is null or a_phone is null or a_addr is null or length(a_addr) > 300 or length(a_name) > 120) then
    return jsonb_build_object('ok', false, 'error', 'Please enter a valid delivery address');
  end if;
  select * into o from public.orders where id = p_order_id and order_type = 'proxy' and customer_id = c.id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'Order not found'); end if;
  if o.status <> 'pending' then return jsonb_build_object('ok', false, 'error', 'This order is not waiting for payment'); end if;
  if nullif(btrim(coalesce(o.payment_ref, '')), '') is not null then
    return jsonb_build_object('ok', false, 'error', 'Payment details were already submitted for this order');
  end if;
  perform set_config('sv.server_write', '1', true);
  update public.orders set payment_method = meth, updated_at = now() where id = o.id;
  if has_addr then
    update public.orders
       set customer_name = a_name, customer_phone = a_phone, address_text = a_addr, district = a_city,
           delivery_address = jsonb_build_object('name', a_name, 'phone', a_phone, 'address', a_addr, 'district', a_city, 'zip', a_zip)
     where id = o.id;
  end if;
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

revoke all on function public.proxy_start_payment(uuid, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.proxy_start_payment(uuid, text, text, text, text, text, text, text) to authenticated;
