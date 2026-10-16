drop trigger if exists trg_proxy_sync_paid on public.orders;
drop function if exists public.proxy_sync_order_paid();
drop function if exists public.my_proxy_order(uuid);
drop function if exists public.proxy_start_payment(uuid, text, text);
drop function if exists public.admin_set_proxy_status(uuid, text, text, text);
drop function if exists public.admin_set_proxy_tracking(uuid, text, text);
drop function if exists public.admin_close_proxy(uuid, text, boolean, boolean);
-- _expire_unpaid_orders / my_orders: restore from git history of earlier definitions if needed
