drop function if exists public.newsletter_confirm(uuid);
drop function if exists public.newsletter_unsubscribe(uuid);
drop table if exists public.email_sends;
drop table if exists public.email_campaigns;
drop index if exists public.newsletter_subscribers_token_key;
alter table public.newsletter_subscribers
  drop column if exists token, drop column if exists topics, drop column if exists confirm_sent_at,
  drop column if exists last_sent_at, drop column if exists bounced_at, drop column if exists complaint_at;
