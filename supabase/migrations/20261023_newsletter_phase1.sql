-- Newsletter phase 1+2: confirm/unsubscribe tokens, topics, campaign tables
alter table public.newsletter_subscribers
  add column if not exists token uuid not null default gen_random_uuid(),
  add column if not exists topics text[] not null default array['news','offers','shipment','announcements'],
  add column if not exists confirm_sent_at timestamptz,
  add column if not exists last_sent_at timestamptz,
  add column if not exists bounced_at timestamptz,
  add column if not exists complaint_at timestamptz;

create unique index if not exists newsletter_subscribers_token_key on public.newsletter_subscribers (token);

create table if not exists public.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  body text not null,
  topic text not null default 'news' check (topic in ('news','offers','shipment','announcements')),
  button_label text,
  button_url text,
  status text not null default 'draft' check (status in ('draft','sending','sent','failed')),
  total_count int not null default 0,
  sent_count int not null default 0,
  failed_count int not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table if not exists public.email_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.email_campaigns(id) on delete cascade,
  subscriber_id uuid not null references public.newsletter_subscribers(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','sent','failed','bounced')),
  provider_id text,
  error text,
  sent_at timestamptz,
  unique (campaign_id, subscriber_id)
);
create index if not exists email_sends_campaign_idx on public.email_sends (campaign_id, status);

alter table public.email_campaigns enable row level security;
alter table public.email_sends enable row level security;

create or replace function public.newsletter_confirm(p_token uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare r public.newsletter_subscribers;
begin
  select * into r from public.newsletter_subscribers where token = p_token;
  if not found then return jsonb_build_object('result','invalid'); end if;
  if r.status = 'subscribed' then return jsonb_build_object('result','already'); end if;
  if r.status <> 'pending' then return jsonb_build_object('result','invalid'); end if;
  update public.newsletter_subscribers set status='subscribed', confirmed_at=now() where id = r.id;
  return jsonb_build_object('result','confirmed');
end $$;

create or replace function public.newsletter_unsubscribe(p_token uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare r public.newsletter_subscribers;
begin
  select * into r from public.newsletter_subscribers where token = p_token;
  if not found then return jsonb_build_object('result','invalid'); end if;
  if r.status = 'unsubscribed' then return jsonb_build_object('result','already'); end if;
  update public.newsletter_subscribers set status='unsubscribed', unsubscribed_at=now() where id = r.id;
  return jsonb_build_object('result','unsubscribed');
end $$;

grant execute on function public.newsletter_confirm(uuid) to anon, authenticated;
grant execute on function public.newsletter_unsubscribe(uuid) to anon, authenticated;
