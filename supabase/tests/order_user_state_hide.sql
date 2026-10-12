-- Expect: anon cannot execute either RPC nor touch the table; authenticated can execute the RPCs but not the table.
select
  not has_function_privilege('anon','public.hide_order(uuid,boolean)','execute')          as anon_hide_blocked,
  not has_function_privilege('anon','public.my_hidden_orders()','execute')                as anon_list_blocked,
  has_function_privilege('authenticated','public.hide_order(uuid,boolean)','execute')     as auth_hide_ok,
  has_function_privilege('authenticated','public.my_hidden_orders()','execute')           as auth_list_ok,
  not has_table_privilege('authenticated','public.order_user_state','select')             as table_select_blocked,
  not has_table_privilege('authenticated','public.order_user_state','insert')             as table_write_blocked,
  (select relrowsecurity from pg_class where oid='public.order_user_state'::regclass)     as rls_on;
