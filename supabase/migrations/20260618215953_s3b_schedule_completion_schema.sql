create table public.daily_schedules (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  schedule_date date not null,
  action_key text not null,
  target_time_local text not null,
  window_start_local text,
  window_end_local text,
  source text not null,
  status text not null default 'active',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint daily_schedules_device_id_length check (char_length(device_id) between 1 and 80),
  constraint daily_schedules_action_key_check check (action_key in ('clock-in', 'clock-out')),
  constraint daily_schedules_target_time_local_length check (char_length(target_time_local) between 1 and 16),
  constraint daily_schedules_window_start_local_length check (window_start_local is null or char_length(window_start_local) between 1 and 16),
  constraint daily_schedules_window_end_local_length check (window_end_local is null or char_length(window_end_local) between 1 and 16),
  constraint daily_schedules_source_check check (source in ('local-generated', 'recovered-from-supabase', 'manual-reconciled')),
  constraint daily_schedules_status_check check (status in ('active', 'skipped', 'superseded', 'archived')),
  constraint daily_schedules_unique_action unique (device_id, schedule_date, action_key)
);

comment on table public.daily_schedules is
  'Sanitized generated schedule backup rows for A.L.I.L.O.S. recovery only. Local desktop schedule remains the operational source of truth.';
comment on column public.daily_schedules.device_id is
  'Stable generated non-personal desktop device identifier. Stored as text to match the desktop config value; no staff identity, username, or hostname.';
comment on column public.daily_schedules.action_key is
  'Sanitized app action key. Current allowed values are clock-in and clock-out; do not store DOM target ids, staff identity, URLs, or site payloads.';
comment on column public.daily_schedules.target_time_local is
  'Local generated action time text such as HH:mm. No timezone conversion or remote generation is implied.';
comment on column public.daily_schedules.source is
  'Sanitized origin of this schedule row. Supabase is backup/recovery only and must not generate attendance times.';

create index daily_schedules_device_date_idx
  on public.daily_schedules (device_id, schedule_date);

create index daily_schedules_updated_at_idx
  on public.daily_schedules (updated_at);

create table public.completion_records (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  action_date date not null,
  action_key text not null,
  dedupe_key text,
  state text not null,
  verification_state text,
  sanitized_reason text,
  attempted_at timestamp with time zone,
  verified_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint completion_records_device_id_length check (char_length(device_id) between 1 and 80),
  constraint completion_records_action_key_check check (action_key in ('clock-in', 'clock-out')),
  constraint completion_records_dedupe_key_length check (dedupe_key is null or char_length(dedupe_key) between 1 and 220),
  constraint completion_records_state_check check (
    state in (
      'not-attempted',
      'click-attempted',
      'click-succeeded-local',
      'verification-pending',
      'verified-success',
      'verification-unknown',
      'verification-failed',
      'manually-verified'
    )
  ),
  constraint completion_records_verification_state_check check (
    verification_state is null
    or verification_state in (
      'pending',
      'verified-success',
      'verification-unknown',
      'verification-failed',
      'manually-verified'
    )
  ),
  constraint completion_records_sanitized_reason_length check (sanitized_reason is null or char_length(sanitized_reason) <= 500),
  constraint completion_records_unique_action unique (device_id, action_date, action_key)
);

comment on table public.completion_records is
  'Sanitized completion/attempt backup rows for duplicate prevention and recovery. Local desktop completion records remain authoritative when valid.';
comment on column public.completion_records.device_id is
  'Stable generated non-personal desktop device identifier. Stored as text to match the desktop config value; no staff identity, username, or hostname.';
comment on column public.completion_records.action_key is
  'Sanitized app action key. Current allowed values are clock-in and clock-out; do not store DOM target ids, staff identity, URLs, or site payloads.';
comment on column public.completion_records.dedupe_key is
  'Optional stored deterministic key supplied by a future write path when useful. If present, it should derive from device_id, action_date, and action_key. It is not generated here because date-to-text generated expressions can be DateStyle-sensitive; the tuple unique constraint is authoritative.';
comment on column public.completion_records.sanitized_reason is
  'Short sanitized reason/result text only. No credentials, cookies, raw HTML, screenshots, staff identity, Telegram secrets, full URLs, tokenized query strings, or opaque link values.';

create index completion_records_device_date_idx
  on public.completion_records (device_id, action_date);

create index completion_records_updated_at_idx
  on public.completion_records (updated_at);

alter table public.daily_schedules enable row level security;
alter table public.completion_records enable row level security;

revoke all on table public.daily_schedules from anon, authenticated;
revoke all on table public.completion_records from anon, authenticated;
