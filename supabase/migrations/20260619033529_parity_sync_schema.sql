create or replace function public.alilos_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.alilos_set_updated_at() is
  'Shared ALILOS updated_at trigger helper. No security definer and no privileged access assumptions.';

revoke all on function public.alilos_set_updated_at() from public;

create table public.skip_dates (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (device_id) on delete cascade,
  skip_date date not null,
  action_key text,
  action_key_normalized text generated always as (coalesce(action_key, '__all__')) stored,
  reason text,
  source text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint skip_dates_action_key_check check (action_key is null or action_key in ('clock-in', 'clock-out')),
  constraint skip_dates_action_key_normalized_check check (action_key_normalized in ('__all__', 'clock-in', 'clock-out')),
  constraint skip_dates_reason_length check (reason is null or char_length(reason) <= 500),
  constraint skip_dates_source_check check (source in ('desktop-local', 'webapp-command', 'manual-import')),
  constraint skip_dates_unique_action unique (device_id, skip_date, action_key_normalized)
);

comment on table public.skip_dates is
  'Supabase-backed skip dates for ALILOS desktop/webapp sync. Store only sanitized skip metadata.';
comment on column public.skip_dates.action_key is
  'Null means whole-day skip. Otherwise use a configured action key such as clock-in or clock-out.';
comment on column public.skip_dates.reason is
  'Short sanitized reason only. No credentials, cookies, raw HTML, screenshots, full URLs, tokenized query strings, or opaque link values.';

create table public.event_logs (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (device_id) on delete cascade,
  event_time timestamp with time zone not null default now(),
  event_type text not null,
  severity text not null,
  action_key text,
  schedule_date date,
  message text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  constraint event_logs_event_type_check check (
    event_type in (
      'startup',
      'shutdown',
      'desktop-status',
      'network-status',
      'configured-site-status',
      'captive-portal-status',
      'schedule',
      'skip',
      'command',
      'dry-run',
      'configured-action',
      'sync',
      'error'
    )
  ),
  constraint event_logs_severity_check check (severity in ('debug', 'info', 'warn', 'error')),
  constraint event_logs_action_key_check check (action_key is null or action_key in ('clock-in', 'clock-out')),
  constraint event_logs_message_length check (char_length(message) between 1 and 500),
  constraint event_logs_details_object check (jsonb_typeof(details) = 'object'),
  constraint event_logs_details_no_forbidden_keys check (
    not details ?| array[
      'credential',
      'credentials',
      'password',
      'cookie',
      'cookies',
      'html',
      'raw_html',
      'screenshot',
      'url',
      'urls',
      'full_url',
      'token',
      'tokens',
      'link',
      'magic',
      '4Tredir',
      'selector',
      'selectors',
      'script',
      'scripts',
      'form',
      'forms'
    ]
  )
);

comment on table public.event_logs is
  'Append-only sanitized event/status logs for ALILOS webapp monitoring.';
comment on column public.event_logs.message is
  'Short sanitized message only. Do not store credentials, cookies, raw HTML, screenshots, staff identity, full URLs, tokenized query strings, or opaque link values.';
comment on column public.event_logs.details is
  'Small sanitized JSON object only. No arbitrary selectors, scripts, URLs, forms, credentials, cookies, raw HTML, screenshots, or portal hidden values.';

create table public.command_requests (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (device_id) on delete cascade,
  command_type text not null,
  action_key text,
  schedule_date date,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  requested_by text,
  requested_at timestamp with time zone not null default now(),
  expires_at timestamp with time zone not null,
  claimed_at timestamp with time zone,
  completed_at timestamp with time zone,
  result_summary text,
  result_details jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint command_requests_command_type_check check (
    command_type in (
      'request-status-refresh',
      'request-dry-run',
      'request-confirmation',
      'cancel-confirmation',
      'perform-configured-action',
      'recalculate-today-schedule'
    )
  ),
  constraint command_requests_status_check check (
    status in ('pending', 'claimed', 'succeeded', 'failed', 'expired', 'rejected', 'cancelled')
  ),
  constraint command_requests_action_key_check check (action_key is null or action_key in ('clock-in', 'clock-out')),
  constraint command_requests_requested_by_length check (requested_by is null or char_length(requested_by) <= 120),
  constraint command_requests_result_summary_length check (result_summary is null or char_length(result_summary) <= 500),
  constraint command_requests_expires_after_requested check (expires_at > requested_at),
  constraint command_requests_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint command_requests_result_details_object check (jsonb_typeof(result_details) = 'object'),
  constraint command_requests_payload_no_forbidden_keys check (
    not payload ?| array[
      'credential',
      'credentials',
      'password',
      'cookie',
      'cookies',
      'html',
      'raw_html',
      'screenshot',
      'url',
      'urls',
      'full_url',
      'token',
      'tokens',
      'link',
      'magic',
      '4Tredir',
      'selector',
      'selectors',
      'script',
      'scripts',
      'form',
      'forms'
    ]
  ),
  constraint command_requests_result_details_no_forbidden_keys check (
    not result_details ?| array[
      'credential',
      'credentials',
      'password',
      'cookie',
      'cookies',
      'html',
      'raw_html',
      'screenshot',
      'url',
      'urls',
      'full_url',
      'token',
      'tokens',
      'link',
      'magic',
      '4Tredir',
      'selector',
      'selectors',
      'script',
      'scripts',
      'form',
      'forms'
    ]
  )
);

comment on table public.command_requests is
  'Supabase command queue for future ALILOS webapp/desktop coordination. Writes and reads should be mediated by a future Edge Function/API proxy.';
comment on column public.command_requests.command_type is
  'Constrained command type. No arbitrary selector, script, URL, or form commands are allowed.';
comment on column public.command_requests.payload is
  'Minimal sanitized payload only. Do not store credentials, cookies, raw HTML, screenshots, full URLs, tokenized query strings, opaque link values, selectors, scripts, or forms.';
comment on column public.command_requests.result_details is
  'Minimal sanitized result details only. No credentials, cookies, raw HTML, screenshots, URLs, selectors, scripts, forms, or hidden portal values.';

create table public.command_events (
  id uuid primary key default gen_random_uuid(),
  command_id uuid not null references public.command_requests (id) on delete cascade,
  device_id uuid not null references public.devices (device_id) on delete cascade,
  event_time timestamp with time zone not null default now(),
  event_type text not null,
  message text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  constraint command_events_event_type_check check (
    event_type in ('created', 'claimed', 'progress', 'succeeded', 'failed', 'expired', 'rejected', 'cancelled')
  ),
  constraint command_events_message_length check (char_length(message) between 1 and 500),
  constraint command_events_details_object check (jsonb_typeof(details) = 'object'),
  constraint command_events_details_no_forbidden_keys check (
    not details ?| array[
      'credential',
      'credentials',
      'password',
      'cookie',
      'cookies',
      'html',
      'raw_html',
      'screenshot',
      'url',
      'urls',
      'full_url',
      'token',
      'tokens',
      'link',
      'magic',
      '4Tredir',
      'selector',
      'selectors',
      'script',
      'scripts',
      'form',
      'forms'
    ]
  )
);

comment on table public.command_events is
  'Append-only sanitized audit trail for command processing. Do not store sensitive page, credential, URL, selector, script, or form data.';
comment on column public.command_events.details is
  'Small sanitized JSON object only. No arbitrary selectors, scripts, URLs, forms, credentials, cookies, raw HTML, screenshots, or portal hidden values.';

create index skip_dates_device_date_idx
  on public.skip_dates (device_id, skip_date);

create index skip_dates_updated_at_idx
  on public.skip_dates (updated_at);

create index event_logs_device_event_time_idx
  on public.event_logs (device_id, event_time desc);

create index event_logs_device_type_time_idx
  on public.event_logs (device_id, event_type, event_time desc);

create index command_requests_device_status_expires_idx
  on public.command_requests (device_id, status, expires_at);

create index command_requests_device_requested_at_idx
  on public.command_requests (device_id, requested_at desc);

create index command_requests_updated_at_idx
  on public.command_requests (updated_at);

create index command_events_command_event_time_idx
  on public.command_events (command_id, event_time);

create index command_events_device_event_time_idx
  on public.command_events (device_id, event_time desc);

create trigger skip_dates_set_updated_at
before update on public.skip_dates
for each row
execute function public.alilos_set_updated_at();

create trigger command_requests_set_updated_at
before update on public.command_requests
for each row
execute function public.alilos_set_updated_at();

alter table public.skip_dates enable row level security;
alter table public.event_logs enable row level security;
alter table public.command_requests enable row level security;
alter table public.command_events enable row level security;

revoke all on table public.skip_dates from anon, authenticated;
revoke all on table public.event_logs from anon, authenticated;
revoke all on table public.command_requests from anon, authenticated;
revoke all on table public.command_events from anon, authenticated;
