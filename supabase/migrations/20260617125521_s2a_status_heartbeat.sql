create table public.devices (
  device_id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users (id) on delete set null,
  display_name text,
  platform text,
  app_version text,
  is_active boolean not null default true,
  last_seen_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint devices_display_name_length check (display_name is null or char_length(display_name) <= 120),
  constraint devices_platform_length check (platform is null or char_length(platform) <= 40),
  constraint devices_app_version_length check (app_version is null or char_length(app_version) <= 80)
);

comment on table public.devices is
  'Sanitized desktop device identities for A.L.I.L.O.S. monitoring/recovery. Do not store staff identity, credentials, cookies, tokens, or machine-personal identifiers.';
comment on column public.devices.device_id is
  'Stable generated non-personal device UUID. The desktop agent stores this locally and reuses it across restarts.';

create table public.heartbeats (
  device_id uuid primary key references public.devices (device_id) on delete cascade,
  app_status text not null default 'unknown',
  network_status text not null default 'unknown',
  perakam_page_status text not null default 'unknown',
  telegram_status text not null default 'unknown',
  last_seen_at timestamp with time zone not null default now(),
  status_text text,
  last_error_text text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint heartbeats_app_status_length check (char_length(app_status) <= 80),
  constraint heartbeats_network_status_length check (char_length(network_status) <= 120),
  constraint heartbeats_perakam_page_status_length check (char_length(perakam_page_status) <= 120),
  constraint heartbeats_telegram_status_length check (char_length(telegram_status) <= 120),
  constraint heartbeats_status_text_length check (status_text is null or char_length(status_text) <= 500),
  constraint heartbeats_last_error_text_length check (last_error_text is null or char_length(last_error_text) <= 500)
);

comment on table public.heartbeats is
  'Latest sanitized heartbeat per device for status-only monitoring. Upsert by device_id; this is not an append-only event stream.';
comment on column public.heartbeats.status_text is
  'Short sanitized status text only. No raw HTML, screenshots, cookies, staff identity, credentials, tokenized URLs, or opaque query strings.';
comment on column public.heartbeats.last_error_text is
  'Short sanitized error text only. No raw HTML, screenshots, cookies, staff identity, credentials, tokenized URLs, or opaque query strings.';

alter table public.devices enable row level security;
alter table public.heartbeats enable row level security;

revoke all on table public.devices from anon, authenticated;
revoke all on table public.heartbeats from anon, authenticated;
