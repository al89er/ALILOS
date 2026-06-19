# Supabase Identity Guard

This repository is a PERSONAL project. It must only use the personal Supabase account and the personal Supabase project declared in `.project-identity.json`.

The guard exists to prevent accidental migrations, database pushes, function deploys, secret updates, or branch operations against the wrong Supabase account/project.

## Planned Role

Supabase is planned as the shared backend for the webapp/PWA sync/control plane. It is not required for scheduled local desktop operation. This repository currently has the S2A status-only heartbeat schema migration, an S2B disabled-by-default heartbeat sender skeleton, an S3B schedule/completion schema migration, a PARITY2 skip/log/status/command schema migration, PARITY4 status publishing through an Edge Function, PARITY5 skip sync through an Edge Function, PARITY6 schedule/completion sync through an Edge Function, PARITY7 dry-run/non-clicking command sync through an Edge Function, PARITY8 read-only web monitoring through an Edge Function, and PARITY9 safe web command creation through an Edge Function. Status, skip, schedule/completion, and command sync remain disabled by default on the desktop. It still has no remote configured-action command execution.

The agreed roadmap is:

- S0: Architecture documentation.
- S1: Schema and identity planning.
- S2: Status-only heartbeat.
- S3: Durable schedule/completion backup ledger.
- S4: Phone webapp/PWA status dashboard.
- S5: Command queue/control only after explicit approval.
- Telegram is paused/deprioritized and is not required for completion.

The local desktop agent remains local-first and Windows/desktop-only. Android/mobile access should be through a hosted webapp/PWA, and that webapp may later live under `webapp/` in this repo after explicit approval. The old Tampermonkey script and old webapp remain fallback/backup references.

PARITY1B target sync groups are device heartbeat/status, sanitized logs/events, skip dates, daily schedules, completion records, command requests, and command results. The webapp may monitor status and request supervised controls, but it must not log into the configured website, store credentials, execute browser automation in the phone browser, send arbitrary selectors/scripts/forms, or bypass desktop guardrails.

## Data Boundary

Future Supabase records may store sanitized monitoring data, generated schedule backups, and completion backup records after the relevant phase is approved.

Do not store these values in Supabase:

- Configured-site username/password.
- Cookies or session data.
- Raw page HTML.
- Screenshots.
- Staff ID/name.
- Telegram token/chat ID.
- Full URLs, tokenized query strings, or opaque `link=` values.
- Captive portal usernames/passwords or hidden portal form values.
- Service-role keys in desktop or webapp clients.

Remote configured-action command execution is not implemented. PARITY7/PARITY9 command sync can only create and process safe dry-run/non-clicking requests when explicitly enabled, and any configured-action command remains rejected/deferred until a later explicit approval phase.

## PARITY2 Schema

`supabase/migrations/20260619033529_parity_sync_schema.sql` adds:

- `skip_dates`: sanitized whole-day or action-specific skip rows by device/date/action.
- `event_logs`: append-only sanitized status/event rows for webapp monitoring.
- `command_requests`: constrained command queue rows for future webapp/Supabase/desktop coordination.
- `command_events`: append-only sanitized audit rows for command processing.

All PARITY2 tables enable RLS and revoke direct table privileges from `anon` and `authenticated`. No broad public policies are added. Future access should go through an Edge Function/API proxy with service-role use kept server-side only. The desktop app and webapp must not receive service-role keys.

PARITY2 payloads and details are constrained to sanitized JSON objects and must not contain credentials, cookies, raw HTML, screenshots, full URLs, tokenized query strings, opaque `link=` values, portal hidden fields, arbitrary selectors, scripts, or forms.

## PARITY3 Disabled Desktop Skeleton

The desktop app includes a disabled-by-default `paritySync` config section and `ParitySyncService`. It reports local health/status and keeps all runtime writes and command processing disabled unless specific parity feature flags are explicitly enabled. When disabled, the service starts no sync timers. If explicitly enabled in local config later, only the approved status, skip, and schedule/completion proxy paths can write sanitized metadata; command execution remains unimplemented.

Security boundaries:

- Use publishable/anon keys only for desktop configuration.
- Reject service-role-looking keys from parity-sync local config.
- Keep service-role keys server-side only in a future Edge Function/API proxy.
- Do not send credentials, cookies, raw HTML, screenshots, full/tokenized URLs, opaque `link=` values, selectors, scripts, forms, or hidden portal values through parity-sync payloads.
- Do not process remote commands until a later approved PARITY step defines claim/execute/result behavior.

## PARITY4 Status Publishing

PARITY4 implements the first runtime parity-sync publisher, still disabled by default. When explicitly enabled with a valid Supabase URL and publishable/anon key, the desktop posts sanitized device/status payloads to the Edge Function/API proxy endpoint derived from the configured Supabase project:

```text
/functions/v1/alilos-parity-status
```

The desktop does not write directly to `devices`, `heartbeats`, `event_logs`, or other tables in PARITY4. This preserves the existing RLS posture where direct `anon` / `authenticated` table privileges are revoked. PARITY4B adds the server-side proxy implementation with service-role use kept out of desktop and webapp clients.

PARITY4 may include a conservative generated status event when `paritySync.logUploadEnabled` is true. It does not upload arbitrary local log lines. It does not process command requests, sync skip dates, sync schedules/completions, implement a webapp, or upload credentials.

## PARITY4B Status Proxy

`supabase/functions/alilos-parity-status/index.ts` is the server-side endpoint for desktop status publishing. It accepts POST requests only, requires the standard Edge Function Authorization header from the desktop publishable/anon key, rejects service-role-looking keys supplied by the client, and uses `SUPABASE_SERVICE_ROLE_KEY` only from the Edge Function environment.

The function validates the sanitized desktop status shape, maps `deviceStatus.deviceId` to the database `device_id`, and requires that device to already exist in `devices`. It updates safe device metadata, upserts the latest `heartbeats` row, and inserts optional generated `event_logs` when the payload includes allowed events. It returns only sanitized success/error JSON and counts; it does not echo raw payloads.

The proxy rejects forbidden top-level or nested keys and suspicious string values for credentials, passwords, cookies, raw HTML, screenshots, full or tokenized URLs, opaque `link=` values, selectors, scripts, forms, Fortinet hidden values such as `magic` / `4Tredir`, bearer tokens, Telegram bot token patterns, and service-role-looking client keys. Direct table privileges for `anon` and `authenticated` remain closed. No command processing, skip sync, schedule/completion sync, user identity creation, or webapp is implemented by PARITY4B.

PARITY4C deployment and smoke-test steps are documented in `docs/PARITY_STATUS_DEPLOYMENT.md`. The placeholder-only request body is `docs/examples/parity-status-smoke.json`. Manual smoke testing should use placeholders only and a pre-registered non-personal device UUID. Do not use real service-role keys, real staff identity, credentials, cookies, tokenized URLs, `link=` values, screenshots, raw HTML, selectors, scripts, or form values in manual test payloads.

## PARITY5 Skip Sync

`supabase/functions/alilos-skip-sync/index.ts` is the server-side endpoint for skip-date sync. It accepts POST requests only and supports constrained `list-skips`, `upsert-skip`, and `delete-skip` operations. It requires a valid registered `deviceId`, an allowed operation, ISO `skipDate` where required, `actionKey` null or `clock-in` / `clock-out`, and `source` limited to `desktop-local`, `webapp-command`, or `manual-import`.

The desktop uses only a publishable/anon key. The Edge Function uses `SUPABASE_SERVICE_ROLE_KEY` only from the server environment. Direct table privileges for `anon` and `authenticated` remain closed.

Desktop skip sync is disabled by default and requires both `paritySync.enabled` and `paritySync.skipSyncEnabled`. Remote skip rows can only affect scheduling skip state. They cannot trigger configured-site navigation, confirmation, clicking, command processing, credentials, or browser automation. Current local scheduling supports whole-day skipped dates, so remote action-specific rows are conservatively applied as whole-day skips. Remote absence does not remove local skips; disagreement preserves skips.

Deployment and smoke testing are documented in `docs/PARITY_SKIP_SYNC_DEPLOYMENT.md`. No webapp or command queue processing is implemented in PARITY5.

## PARITY6 Schedule/Completion Sync

`supabase/functions/alilos-schedule-completion-sync/index.ts` is the server-side endpoint for daily schedule and completion-record sync. It accepts POST requests only and supports constrained `get-day-state`, `upsert-schedule`, and `upsert-completion` operations. It requires a valid registered `deviceId`, allowed `clock-in` / `clock-out` action keys, ISO local dates, known schedule sources/statuses, and known completion/verification states.

The desktop uses only a publishable/anon key. The Edge Function uses `SUPABASE_SERVICE_ROLE_KEY` only from the server environment. Direct table privileges for `anon` and `authenticated` remain closed.

Desktop schedule/completion sync is disabled by default and requires both `paritySync.enabled` and `paritySync.scheduleCompletionSyncEnabled`. It can upload local generated schedule rows and existing local completion records as sanitized backup metadata. It can fetch current-day remote state to surface warnings, but it does not execute remote state, process commands, recover schedules automatically, create local successful completion records from remote data, navigate the configured site, click anything, or change the local configured action decision path. If local and remote completion state disagree, the current behavior is warning-only and fails safe for human review; remote absence never deletes local completion records.

Deployment and smoke testing are documented in `docs/PARITY_SCHEDULE_COMPLETION_SYNC_DEPLOYMENT.md`. No webapp or command queue processing is implemented in PARITY6.

## PARITY7 Command Sync

`supabase/functions/alilos-command-sync/index.ts` is the server-side endpoint for command request/result processing. It accepts POST requests only and supports constrained `create-command`, `list-pending`, `claim-command`, `complete-command`, and `append-command-event` operations. It requires a valid registered `deviceId`, valid command ids where required, sanitized JSON result/event details, and command types limited to:

- `request-status-refresh`
- `request-dry-run`
- `recalculate-today-schedule`
- `cancel-confirmation`

The desktop uses only a publishable/anon key. The Edge Function uses `SUPABASE_SERVICE_ROLE_KEY` only from the server environment. Direct table privileges for `anon` and `authenticated` remain closed.

Desktop command sync is disabled by default and requires both `paritySync.enabled` and `paritySync.commandSyncEnabled`. PARITY9 web controls may create only pending safe commands through the Edge Function using publishable/anon credentials; expiry is generated server-side and responses are sanitized. Commands must be claimed before processing, expired commands are marked expired, unsupported or unsafe payloads are rejected, and API failures are non-fatal to local desktop operation. `perform-configured-action` and remote confirmation creation remain explicitly rejected/deferred. No command may include arbitrary selectors, scripts, forms, full URLs, tokenized URLs, credentials, cookies, raw HTML, screenshots, opaque `link=` values, or service-role keys.

Deployment and smoke testing are documented in `docs/PARITY_COMMAND_SYNC_DEPLOYMENT.md`. Direct table privileges for `anon` and `authenticated` remain closed.

## PARITY8 Dashboard Read Proxy

`supabase/functions/alilos-dashboard-read/index.ts` is the server-side endpoint for read-only web/PWA monitoring. It accepts POST requests only, requires the standard Edge Function Authorization header from a publishable/anon key, rejects service-role-looking keys supplied by the client, validates a registered non-personal `deviceId`, and returns sanitized display summaries only.

The function may read:

- `devices`
- `heartbeats`
- `daily_schedules`
- `skip_dates`
- `completion_records`
- `command_requests`

It must not write rows, create commands, expose raw payloads, echo secrets, or grant direct table access. The webapp uses only publishable/anon credentials and placeholder config names. Service-role use stays server-side only in the Edge Function environment. Direct `anon` / `authenticated` table privileges remain closed.

PARITY8/PARITY9 do not implement configured-action execution, configured-site login, captive portal login, credential handling, arbitrary automation, push notifications, direct table grants, or unattended execution.

## S1 Proposed Schema Outline

This is a planning outline only. Do not create migrations, runtime Supabase clients, remote writes, hosted webapp code, or command/control behavior until the relevant later phase is explicitly approved.

All tables should include `id`, `created_at`, and `updated_at` where useful. Prefer generated UUID primary keys. Store only sanitized operational metadata, and keep the desktop app local-first.

### `devices`

Purpose: identify one desktop agent installation without storing workplace identity.

S1B default: the desktop agent should create one stable generated non-personal `device_id`, store it locally, and reuse it across restarts. The value must not be derived from staff ID, staff name, machine username, hostname, configured-site credentials, or Telegram identity.

Proposed fields:

- `device_id`: UUID primary key generated by the desktop agent and stored locally.
- `owner_user_id`: nullable Supabase auth user id for the future phone webapp owner.
- `device_key_hash`: optional stable hash of a separate locally generated device key; never store the raw device key.
- `display_name`: owner-provided label such as "Home desktop" or "Work laptop".
- `platform`: coarse platform value such as `win32`.
- `app_version`: optional desktop app version.
- `last_seen_at`: timestamp from the latest accepted heartbeat.
- `is_active`: boolean for retired devices.

Notes:

- If multi-device support is deferred, still keep the schema capable of representing more than one device for the same owner.
- Supabase identity supports monitoring/recovery only. The local scheduler must continue operating when Supabase is unavailable.

### `heartbeats`

Purpose: status-only monitoring for S2.

S1B default: store one latest heartbeat row per `device_id` using upsert semantics, not an append-only event stream. A latest-row model keeps the future phone dashboard simple because it can read the current state directly without reducing a history table. Append-only event history can be added later if diagnostics or analytics need it.

Proposed fields:

- `id`: UUID primary key.
- `device_id`: references `devices.device_id`.
- `recorded_at`: timestamp from the desktop agent.
- `received_at`: server/database timestamp.
- `app_status`: coarse app/worker status.
- `execution_mode`: `notify-only`, `manual-confirm`, or `dry-run`; never imply real click execution from heartbeat data alone.
- `next_action_at`: sanitized next generated action time, if known.
- `last_result_code`: short sanitized result code, if known.
- `site_state`: coarse classification such as `unknown`, `offline`, `login`, `dashboard`, `stale-session`, or `blocked`.
- `network_state`: coarse internet/workplace/captive-portal status.
- `summary`: optional short sanitized status text.

Notes:

- Exclude configured-site URL query strings, cookies, raw HTML, screenshots, staff identity, Telegram secrets, and credentials.
- Suggested uniqueness is one row per `device_id`.
- Do not treat heartbeats as the durable schedule/completion ledger.

### `daily_schedules`

Purpose: durable generated schedule backup for S3, so the desktop agent can recover the intended day plan without asking Supabase to generate times.

S1B default: store one row per scheduled action and upsert by `(device_id, schedule_date, action_key)`. Upserted per-action schedules avoid duplicate generated times when the desktop agent retries backup writes or regenerates the same local schedule.

Proposed fields:

- `id`: UUID primary key.
- `device_id`: references `devices.device_id`.
- `schedule_date`: local attendance date.
- `action_key`: sanitized action identifier such as check-in/check-out/reminder key.
- `scheduled_at`: local generated due time for that action.
- `timezone`: IANA timezone used when generating the schedule.
- `generation_source`: local generator/version label.
- `schedule_hash`: hash of the sanitized per-action schedule payload for duplicate detection.
- `schedule_payload`: optional sanitized JSON containing action label, due time, reminder metadata, and skip state only.
- `generated_at`: timestamp from the desktop agent.

Suggested uniqueness:

- Unique on `(device_id, schedule_date, action_key)`.
- If future regeneration/version history is needed, add an append-only history table later instead of changing the S2/S3 recovery default.

### `completion_records`

Purpose: durable backup ledger for completed or intentionally skipped attendance actions in S3.

S1B default: upsert by `(device_id, action_date, action_key)` for duplicate prevention. Upserted completion records make duplicate checks straightforward: the desktop agent only needs to ask whether either local storage or Supabase has a row for the same device/date/action.

Proposed fields:

- `id`: UUID primary key.
- `device_id`: references `devices.device_id`.
- `action_date`: local attendance/action date.
- `action_key`: sanitized action identifier such as check-in/check-out/reminder key, not a DOM target id when that would reveal private implementation details.
- `completed_at`: timestamp from the desktop agent.
- `completion_source`: `local`, `manual-confirm`, `dry-run`, `telegram-fallback`, or future approved source.
- `result_code`: short sanitized outcome.
- `dedupe_key`: optional deterministic supporting key from `device_id`, `action_date`, and `action_key`.
- `local_record_hash`: optional hash of the local completion record for reconciliation.

Suggested uniqueness:

- Unique on `(device_id, action_date, action_key)`. Treat `dedupe_key` as supporting metadata, not the authoritative duplicate key.
- If audit history or corrections are needed, add an append-only history/correction table later rather than making the duplicate-prevention table harder to query.

### Deferred `command_queue`

Purpose: possible S5 control plane after explicit approval only. It must not be created or consumed during S1-S4.

S1B default: no `command_queue` table, migration, runtime consumer, phone-webapp writer, or desktop polling behavior until separately approved.

Possible future fields:

- `id`: UUID primary key.
- `device_id`: references `devices.device_id`.
- `requested_by`: Supabase auth user id.
- `command_type`: allowlisted command name.
- `command_payload`: sanitized JSON with no secrets and no arbitrary script/code.
- `status`: `pending`, `claimed`, `completed`, `failed`, `expired`, or `cancelled`.
- `requested_at`, `not_before_at`, `expires_at`, `claimed_at`, `completed_at`.
- `result_code`: sanitized outcome.

Required constraints before implementation:

- Allowlist every command type.
- No arbitrary URL navigation, JavaScript execution, shell execution, secret reads, credential updates, or real attendance action execution without a separate explicit approval.
- Add replay protection, expiry, auditability, owner authorization, and visible local confirmation rules before any runtime consumer exists.

## Local-First Recovery Rules

The desktop agent should recover schedules and completion state in this order:

1. Load local encrypted/plain app config and local schedule/completion storage.
2. Validate local records for the current local date and timezone.
3. If local schedule exists, use it as the source of truth and optionally reconcile sanitized backup metadata to Supabase in a later approved phase.
4. If local schedule is missing or corrupt, read matching `daily_schedules` backup rows for the same `device_id`, `schedule_date`, and timezone.
5. If no usable Supabase backup exists, regenerate locally using the existing local scheduler rules.
6. Merge completion state by treating either local completion records or Supabase `completion_records` as sufficient evidence that an action is already completed.

Duplicate prevention rule: before any action is considered due or executable, check local completion records OR Supabase completion records for the same `device_id`, `action_date`, and `action_key`. If either source says the action is completed, skip execution and record a sanitized reconciliation/audit event locally. Supabase must never be the only guard against duplicate actions.

Supabase is recovery and monitoring support, not a required dependency for scheduled local operation. If Supabase is unavailable, local schedule generation, local completion checks, and local guarded execution behavior must continue using existing local state.

## S3A Schedule/Completion Sync Plan

S3A is a docs-only plan for durable backup and recovery of generated daily schedules and completion records. It does not approve migrations, runtime clients, dependencies, `.env.local`, Supabase enablement, command/control, or unattended real execution.

The desktop remains local-first:

- The local schedule and local completion records are the operational source of truth when valid.
- Supabase is backup/recovery only and must not be required for local startup, schedule generation, duplicate blocking, reminders, manual-confirm, dry-run, or notify-only operation.
- No service role key belongs in the desktop app, renderer, local user-editable config, or desktop `.env.local`.
- Supabase records must exclude Perakam credentials, cookies, raw HTML, screenshots, staff ID/name, Telegram token/chat ID, full URLs, tokenized query strings, and opaque `link=` values.

Conceptual `daily_schedules` model:

- Key: one sanitized row per `device_id`, `schedule_date`, and `action_key`.
- Fields: `id`, `device_id`, `schedule_date`, `action_key`, `scheduled_at`, `timezone`, `generation_source`, `schedule_hash`, optional sanitized `schedule_payload`, `generated_at`, `created_at`, and `updated_at`.
- Allowed payload shape: action label/key, due time, reminder metadata, skip state, generator version, and hashes. Do not include workplace identity, page URLs, DOM HTML, credentials, cookies, screenshots, or raw site state.

Conceptual `completion_records` model:

- Key: one sanitized row per `device_id`, `action_date`, and `action_key`, with optional deterministic `dedupe_key` as supporting metadata.
- Fields: `id`, `device_id`, `action_date`, `action_key`, `completed_at`, `completion_source`, `result_code`, optional `dedupe_key`, optional `local_record_hash`, `created_at`, and `updated_at`.
- Allowed payload shape: sanitized completion/skip outcome, source, timestamp, result code, and reconciliation hashes. Do not include staff identity, confirmation UI details that reveal private implementation, credentials, cookies, raw HTML, screenshots, full URLs, query strings, or `link=` values.

Recovery order:

1. Load and validate local schedule/completion storage for the current local date and timezone.
2. Use a valid local schedule first.
3. If the local schedule is missing or corrupt, fetch matching Supabase `daily_schedules` rows.
4. Generate a schedule locally only when neither a valid local schedule nor a usable Supabase backup exists.
5. Save generated or recovered schedule state locally first, then attempt a sanitized Supabase backup.
6. If Supabase is unavailable or the backup write fails, continue local operation and surface only sanitized status.

Duplicate prevention:

- Before considering an action due or executable, check local completion records and any available Supabase `completion_records` for the same `device_id`, date, and `action_key`.
- A blocking attempt/completion in either local storage or Supabase prevents repeat execution.
- If local and Supabase disagree, fail safe toward no repeat until a later approved reconciliation rule says otherwise.
- Supabase absence, read failure, or write failure must never force or justify a real action; local guards continue to decide from local state.

S3 follow-up decisions:

- S3D selects a hybrid Edge Function/API proxy plus explicit device pairing/token for future desktop writes.
- Whether schedule/completion backup uses latest-row upserts or append-only audit history.
- Whether user confirmation is required when local and Supabase records disagree.
- Exact Edge Function/API contract, token issuance, token rotation, revocation flow, and recovery-test flow.

## RLS and Security Planning

S1B default: RLS/security details remain planning-only. Do not write final policies, migrations, grants, service roles, Edge Functions, or client code during S1B.

Before any table is created in an exposed schema:

- Enable RLS on every table.
- Keep service role keys out of desktop and webapp public clients.
- Use authenticated owner policies tied to `devices.owner_user_id` or a dedicated membership table; do not authorize from user-editable metadata.
- Limit inserts/updates so a device can only write rows for itself after a device-pairing design is approved.
- Prevent phone/webapp clients from writing completion records or command queue entries unless the specific flow has been approved.
- Avoid views that bypass RLS; if views are needed on supported Postgres versions, use security-invoker views or keep them out of exposed schemas.
- Use short retention for high-volume heartbeat rows and keep durable records minimal.

## S1B Implementation Defaults

- Use one stable generated non-personal `device_id` stored locally; never use staff ID/name.
- Model `heartbeats` as latest-row upserts by `device_id` first.
- Model `daily_schedules` as per-action upserts by `device_id`, `schedule_date`, and `action_key`.
- Model `completion_records` as per-action upserts by `device_id`, `action_date`, and `action_key`.
- Keep `command_queue` fully deferred with no table or migration until separately approved.
- Keep RLS/security policy text as planning guidance only until a schema implementation phase begins.
- Keep the desktop agent local-first; Supabase supports recovery and monitoring but is not required for scheduled local operation.

Rationale:

- A latest heartbeat row keeps the future phone dashboard simple.
- Upserted schedules avoid duplicate generated times after retries or regeneration.
- Upserted completion records make duplicate-prevention checks straightforward.
- Append-only event history can be added later if monitoring, auditing, or diagnostics require it.

## S2A Migration Status

`supabase/migrations/20260617125521_s2a_status_heartbeat.sql` adds the minimum status-only heartbeat schema:

- `devices` for stable generated non-personal desktop device identity.
- `heartbeats` as one latest sanitized heartbeat row per device.

RLS is enabled on both tables. No final row policies are included yet because the device pairing, owner authorization, and runtime write path are not implemented. The migration revokes direct `anon` and `authenticated` table privileges until a later approved phase defines the access model.

## S3B Migration Status

`supabase/migrations/20260618215953_s3b_schedule_completion_schema.sql` adds the schema-only S3 durable backup tables:

- `daily_schedules` for sanitized generated schedule backup rows, unique by `device_id`, `schedule_date`, and `action_key`.
- `completion_records` for sanitized attempt/completion backup rows, unique by `device_id`, `action_date`, and `action_key`.

The migration is schema-only. It does not add runtime desktop sync, heartbeat write enablement, Supabase client dependencies, `.env.local`, secrets, Edge Functions, command/control, or unattended real execution approval.

Constraint summary:

- `action_key` is limited to current app actions: `clock-in` and `clock-out`.
- `daily_schedules.source` allows `local-generated`, `recovered-from-supabase`, and `manual-reconciled`.
- `daily_schedules.status` allows `active`, `skipped`, `superseded`, and `archived`.
- `completion_records.state` matches the current `AttendanceCompletionState` values.
- `completion_records.verification_state` matches the current verification status values when present.
- `completion_records.dedupe_key` is optional stored supporting metadata, not generated and not authoritative. The tuple unique constraint remains authoritative because generated date-to-text keys can be sensitive to PostgreSQL date formatting settings.
- Future completion-state additions must update the schema constraint deliberately before any runtime sync writes those states.

RLS is enabled on both S3B tables. No broad public policies are added. Direct table privileges are revoked from `anon` and `authenticated`, matching the conservative S2A posture until device pairing/write-path authorization is approved.

Write path is decided in S3D below. Runtime sync remains disabled until the chosen write path is implemented and tested.

## S3D Schedule/Completion Write-Path Decision

S3D is a docs-only decision. It does not add migrations, runtime desktop sync, heartbeat write enablement, Supabase client dependencies, `.env.local`, secrets, Edge Functions, command/control, direct desktop table policies, or unattended real execution approval.

Recommended future write path: use an Edge Function/API proxy plus explicit device pairing/token.

Decision:

- Keep direct table writes closed for `anon` and `authenticated`.
- Keep the service-role key server-side only, inside the Edge Function/API environment. Never place it in the desktop app, renderer, user-editable config, logs, docs, or desktop `.env.local`.
- Pair each desktop installation with a stable non-personal `device_id` and a revocable device token or pairing secret.
- Store only a hash or server-side representation of the pairing secret where needed; never make raw device tokens part of table RLS policy inputs.
- Have the desktop send only sanitized, minimal schedule/completion payloads to the Edge Function/API.
- Let the Edge Function/API validate device authorization, payload shape, allowed enum values, date/action uniqueness, size limits, and sanitization before writing to `daily_schedules` or `completion_records`.
- Runtime sync remains disabled until this path has an approved contract, disabled client skeleton, dry-run logging, smoke testing, supervised backup, and recovery testing.

Option comparison:

- Direct RLS from desktop app: lowest component count, but highest risk for this project. It exposes a publishable client path directly to tables, makes row ownership hard to prove without a stronger pairing model, puts more logic into RLS policies, weakens payload-shape validation, and makes device revocation harder to reason about. Reject as the S3 schedule/completion default.
- Edge Function/API proxy: good sanitization and validation boundary, keeps privileged writes server-side, works well for schedule/completion payload contracts, and is compatible with a future web/PWA companion. By itself it still needs a device identity/revocation model.
- Device-token or pairing-based write path: strong fit for local-first desktop identity and device revocation, but direct table use would still push too much trust into client-visible policies. Better as an input to a narrow API endpoint than as standalone table access.
- Hybrid Edge Function plus device pairing/token: best balance. It keeps secrets server-side, avoids broad table policies, supports revocation, centralizes payload validation/sanitization, works for both schedule and completion backup, and can later share authorization concepts with a web/PWA companion.

Payload boundaries:

Allowed:

- Stable non-personal `device_id`.
- Local date.
- `action_key`.
- Schedule target/window.
- Completion state.
- Verification state.
- Sanitized reason/status.
- Timestamps.

Forbidden:

- Perakam credentials.
- Cookies.
- Raw HTML.
- Screenshots.
- Staff ID/name.
- Telegram token/chat ID.
- Full URLs.
- Tokenized query strings.
- Opaque `link=` values.
- Service-role key.

Rollout phases:

1. Docs-only decision.
2. Edge Function/API schema contract.
3. Disabled runtime client skeleton.
4. Dry-run payload logging without network writes.
5. Write-path smoke test with non-sensitive test payloads.
6. Supervised schedule/completion backup.
7. Recovery testing.
8. No unattended execution approval unless explicitly decided later.

## WEB4 Read-Only Web Companion Contracts

`docs/WEB_COMPANION_PLAN.md` defines the read-only data contracts for future web/PWA display. The contracts cover desktop/device heartbeat status, Perakam/browser/session status, network/captive portal status, daily schedule display, completion/verification display, warnings/events, and sync capability/status.

The contracts are display-only. They do not approve runtime sync, webapp code, direct writes, command/control, or unattended execution.

Security defaults:

- Authenticated web users may read only paired device summaries in a future read model.
- Direct write access remains closed.
- Future writes go through the S3D Edge Function/API proxy plus device pairing/token.
- Service-role keys remain server-side only.
- Desktop remains the local source of truth.
- Missing web data must never imply action readiness.

## S2B Runtime Skeleton Status

The desktop app has a config-gated Supabase heartbeat sender skeleton. It is disabled by default, and local scheduling continues normally when Supabase is disabled, missing config, or unreachable.

Runtime defaults:

- Local config stores a stable generated non-personal `heartbeat.deviceId`.
- Supabase URL/key can come from local config, or `.env.local` values `SUPABASE_URL` plus `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_ANON_KEY` when local values are missing.
- The renderer receives only configured state, host, and key source. It never receives the key value.
- Service-role-looking JWT keys are rejected by the sender.
- Outbound rows are limited to `devices` and latest-row `heartbeats` status metadata.

## S2C/S2D Review Status

S2B safety review found no required code changes. S2D local dry-run checked the user-facing disabled path:

- The app started normally.
- Disabled heartbeat was logged as a non-error status.
- `.env.local` Supabase values were not persisted back into local config.
- No Supabase key leakage was found in the inspected renderer/UI/log path.
- Local scheduler, network monitor, Telegram polling, and automation monitor continued independently of heartbeat status.

## S2E Heartbeat Write-Path Decision

Before real heartbeat writes are enabled, decide how the desktop agent may upsert `devices` and `heartbeats` while keeping RLS safe. The current conservative state is: heartbeat disabled by default, direct table access effectively closed, no service role key in desktop or renderer, and no command/control.

### Option 1: Direct anon/publishable key with RLS policies

- Strengths: simplest runtime path; no extra server component; works with built-in `fetch`.
- Weaknesses: hard to prove a desktop device owns only its row without a stronger pairing secret or authenticated user; exposed publishable key plus permissive policies can accidentally allow spoofed device rows.
- Complexity: low implementation complexity, higher RLS design risk.
- Suitability: acceptable only for a very narrow private prototype after explicit RLS design. Not the preferred default for enabling writes.

### Option 2: User-authenticated desktop agent

- Strengths: can tie rows to `auth.uid()` / `devices.owner_user_id`; uses Supabase Auth patterns instead of anonymous writes.
- Weaknesses: adds desktop login/session UX, token refresh/storage, logout/revocation handling, and risk of broadening the app beyond local-first operation.
- Complexity: medium to high.
- Suitability: reasonable if the phone webapp and desktop agent share a clear owner account model. Heavier than needed for first status-only heartbeat.

### Option 3: Supabase Edge Function/API proxy

- Strengths: keeps table writes behind a narrow server-side endpoint; can validate payload shape, sanitize again, rate-limit, and use privileged writes without exposing service role keys to desktop or renderer.
- Weaknesses: adds deploy/config surface and requires separate function security design; the function becomes another backend component to monitor.
- Complexity: medium.
- Suitability: strong conservative candidate for this project, especially before any phone dashboard or multi-device ownership model is finalized.

### Option 4: Pre-provisioned device token or pairing secret

- Strengths: preserves local-first desktop operation; device can authenticate as a paired installation without user login; supports row ownership by hashed token/device pairing.
- Weaknesses: requires secure issuance, local storage, rotation/revocation, and clear handling for lost/reinstalled devices.
- Complexity: medium.
- Suitability: strong conservative candidate for a personal desktop agent. Can be combined with an Edge Function so raw pairing secrets never become table policy inputs.

### Recommended Default

For the next implementation phase:

- Keep heartbeat disabled by default.
- Keep direct table access closed for now.
- Prefer a future explicit pairing/device-token or Edge Function approach before enabling desktop writes.
- Never place a service role key in the desktop app, renderer, local config intended for UI editing, or `.env.local` used by the desktop runtime.
- Do not add command queue/control until separately approved.
- Keep Supabase as monitoring/recovery support; local scheduled operation must remain independent of Supabase availability.

## Source of Truth

`.project-identity.json` defines:

- `supabaseAccountType`: must be `personal`
- `supabaseProjectRef`: the expected Supabase project ref
- `supabaseProjectUrl`: the expected URL, usually `https://<project-ref>.supabase.co`

The initial values are placeholders. Replace `TODO_SUPABASE_PROJECT_REF` before running remote-changing Supabase commands.

## Find the Supabase Project Ref

Use the Supabase dashboard:

1. Open your personal Supabase dashboard.
2. Select the correct project.
3. Open Project Settings.
4. Copy the project ref from the project URL or API settings.

The project URL has this shape:

```text
https://<project-ref>.supabase.co
```

## Check the Current Project

Run:

```sh
npm run check:supabase
```

The script checks local files only plus `supabase --version`. It does not require Docker, does not print secrets, and does not modify remote Supabase resources.

It checks:

- `.project-identity.json`
- Supabase CLI availability
- `supabase/config.toml` if present
- local Supabase link marker files if present
- `.env.local` existence
- whether `.env.local` contains the expected Supabase project URL
- whether `.env.local` is ignored by Git
- whether `.env.local` is accidentally tracked by Git

The script does not print actual `.env.local` values.

## Safe Manual Login and Link Flow

If the check reports the wrong project or no linked project, fix it manually:

```sh
supabase logout
supabase login
supabase link --project-ref YOUR_PROJECT_REF
npm run check:supabase
```

Do not paste Supabase access tokens, service role keys, database passwords, JWT secrets, or private environment values into Codex or chat.

## Commands That Need Identity Check First

Only run these after `npm run check:supabase` passes and you are sure this is the correct PERSONAL project:

```sh
supabase db push
supabase db reset
supabase migration repair
supabase functions deploy
supabase secrets set
supabase branches create
supabase link --project-ref
```

## Why .env.local Must Not Be Committed

`.env.local` can contain private keys, database URLs, tokens, and other credentials. It must stay local and ignored by Git.

The guard checks whether `.env.local` is ignored and whether it is accidentally tracked. If it is tracked, remove it from Git's index without deleting the local file:

```sh
git rm --cached .env.local
```

Then commit the removal.

## Secret Handling

Never paste these into Codex or chat:

- Supabase access tokens
- service role keys
- database passwords
- JWT secrets
- private environment values

Use the Supabase CLI and local shell prompts for secret entry when needed.
