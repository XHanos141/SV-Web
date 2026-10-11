-- Daily account purge (03:00 Bangladesh time = 21:00 UTC). Run once per project AFTER:
--   1) the account_deletion migrations are applied, 2) the account-delete function is deployed,
--   3) pg_cron + pg_net + supabase_vault extensions are enabled, 4) the Vault secret exists:
--        select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'account_purge_cron_secret');
-- Replace <PROJECT_REF> and <ANON_KEY> (the PUBLIC anon/publishable JWT; the real auth is the x-cron-secret header).
select cron.schedule('account-purge-daily', '0 21 * * *', $job$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/account-delete',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <ANON_KEY>',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'account_purge_cron_secret')),
    body := '{"action":"purge"}'::jsonb,
    timeout_milliseconds := 30000);
$job$);
-- Remove: select cron.unschedule('account-purge-daily');
