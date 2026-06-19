# PARITY4B Status Proxy Deployment Runbook

This runbook deploys and smoke-tests the `alilos-parity-status` Supabase Edge Function used by desktop parity status publishing.

Keep the security boundary intact:

- Desktop config uses only a publishable/anon key.
- The service-role key is server-side only in the Edge Function environment.
- Do not commit Supabase project refs, anon keys, service-role keys, device ids, real endpoints, `.env.local`, staff identity, credentials, cookies, raw HTML, screenshots, selectors, scripts, forms, full/tokenized URLs, opaque `link=` values, Fortinet `magic` values, or `4Tredir` values.
- Direct `anon` / `authenticated` table privileges remain closed.
- No command processing, webapp, or unattended execution is enabled by this runbook.

## 1. Confirm Tools And Project

Confirm the Supabase CLI is available:

```sh
npx supabase --version
npx supabase functions deploy --help
npx supabase secrets set --help
```

Use either a linked project or pass the project ref explicitly:

```sh
npx supabase status
```

If the project is not linked or you want to avoid relying on local link state, pass the project ref placeholder on each command:

```sh
npx supabase functions deploy alilos-parity-status --project-ref <project-ref> --use-api
```

`--use-api` asks the CLI to bundle functions server-side without using Docker. If your CLI/environment does not support it, use the standard deploy command from a machine where the CLI can build Edge Functions safely:

```sh
npx supabase functions deploy alilos-parity-status --project-ref <project-ref>
```

## 2. Set Edge Function Environment

The function reads:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Set these only as Supabase Edge Function/project secrets or server environment values. Never place the service-role key in desktop config, renderer code, webapp code, docs, `.env.local`, or committed files.

Use the Supabase Dashboard secrets UI, or use the CLI from a local untracked environment source outside this repository. The CLI shape is:

```sh
npx supabase secrets set --project-ref <project-ref> SUPABASE_URL=https://<project-ref>.supabase.co
npx supabase secrets set --project-ref <project-ref> --env-file <path-to-untracked-edge-secrets.env>
```

The untracked secrets file, if used, should contain placeholders like this and must stay outside Git:

```text
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

Do not print the service-role key in terminal logs or paste it into chat.

## 3. Device Prerequisite

The Edge Function requires the posted `deviceStatus.deviceId` to already exist in `public.devices`. It does not auto-create personal identity.

Check for a device row using placeholders only:

```sql
select device_id, display_name, app_version, is_active, last_seen_at
from public.devices
where device_id = '<existing-device-uuid>'::uuid;
```

Create a non-personal device row if needed:

```sql
insert into public.devices (
  device_id,
  display_name,
  platform,
  app_version,
  is_active
) values (
  '<existing-device-uuid>'::uuid,
  '<safe-device-label>',
  'windows',
  '0.1.0',
  true
)
on conflict (device_id) do update
set
  display_name = excluded.display_name,
  platform = excluded.platform,
  app_version = excluded.app_version,
  is_active = true,
  updated_at = now();
```

Use a generated non-personal UUID. Do not derive the device id or label from staff id, staff name, machine username, hostname, credentials, Telegram identity, or workplace identity.

## 4. Desktop Config Prerequisites

Keep desktop parity sync disabled until the function is deployed and the device row exists.

When ready for a supervised smoke test, configure local desktop settings with placeholders replaced locally:

```json
{
  "paritySync": {
    "enabled": true,
    "supabaseUrl": "https://<project-ref>.supabase.co",
    "publishableKey": "<publishable-or-anon-key>",
    "deviceId": "<existing-device-uuid>",
    "deviceLabel": "<safe-device-label>",
    "heartbeatIntervalSeconds": 60,
    "commandPollIntervalSeconds": 60,
    "logUploadEnabled": false,
    "skipSyncEnabled": false,
    "commandSyncEnabled": false,
    "scheduleCompletionSyncEnabled": false
  }
}
```

Initial smoke-test default:

- `paritySync.enabled = true`
- `paritySync.logUploadEnabled = false`
- all skip, command, and schedule/completion sync flags remain `false`
- service-role key is not used locally

## 5. Curl Smoke Test

Use placeholders only. Do not include credentials, staff identity, cookies, raw HTML, screenshots, selectors, scripts, forms, full URLs with query/hash, `link`, `magic`, or `4Tredir` fields.

```sh
curl -X POST "https://<project-ref>.supabase.co/functions/v1/alilos-parity-status" \
  -H "Authorization: Bearer <publishable-or-anon-key>" \
  -H "apikey: <publishable-or-anon-key>" \
  -H "Content-Type: application/json" \
  --data @docs/examples/parity-status-smoke.json
```

Expected success shape:

```json
{
  "success": true,
  "acceptedAt": "2026-06-19T00:00:00.000Z",
  "heartbeatAccepted": true,
  "eventsAccepted": 0
}
```

The timestamp will be generated by the function and will differ.

## 6. Check Database Results

Check latest heartbeat:

```sql
select
  device_id,
  app_status,
  network_status,
  perakam_page_status,
  telegram_status,
  last_seen_at,
  status_text,
  last_error_text,
  updated_at
from public.heartbeats
where device_id = '<existing-device-uuid>'::uuid;
```

If `logUploadEnabled` or a manual payload includes allowed events, check event logs:

```sql
select
  device_id,
  event_time,
  event_type,
  severity,
  action_key,
  schedule_date,
  message,
  details
from public.event_logs
where device_id = '<existing-device-uuid>'::uuid
order by event_time desc
limit 10;
```

Expected safe values:

- no configured-site credentials
- no portal credentials or hidden values
- no cookies
- no raw HTML
- no screenshots
- no selectors, scripts, or forms
- no staff identity
- no Telegram token/chat id
- no service-role key
- no full/tokenized URLs or opaque external values

## 7. Common Failures

`401` / `missing-authorization`:
Authorization header is missing or malformed.

`403` / `service-role-client-key-rejected`:
The client sent a service-role-looking key. Replace desktop config with a publishable/anon key only.

`404` / `device-not-registered`:
The posted device UUID does not exist in `public.devices`. Create/check the placeholder device row first.

`400` / `forbidden-content`:
The payload contains a forbidden key or suspicious value. Remove credential, cookie, raw HTML, screenshot, URL, token, selector, script, form, portal hidden value, or opaque link-like content.

`500` / `server-not-configured`:
`SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is missing from the Edge Function environment.

`500` / `device-check-failed`, `device-update-failed`, `heartbeat-write-failed`, or `event-log-write-failed`:
Check function logs, table existence, migrations, service-role environment, and database constraints. Do not open direct table privileges to `anon` or `authenticated` to work around this.

## 8. Desktop Smoke Test

Use supervised local desktop testing only:

1. Keep `logUploadEnabled = false`.
2. Enable `paritySync.enabled`.
3. Start ALILOS.
4. Confirm the dashboard parity status shows configured endpoint host, attempts, success/failure counts, and sanitized last error if any.
5. Confirm local operation continues even if publishing fails.
6. Review local logs and database rows for sensitive data.
7. Enable `logUploadEnabled` only after heartbeat publishing works.
8. Disable parity sync or log upload again if errors, unexpected payloads, or sensitive data risks appear.

This smoke test must not perform Perakam clicks, process remote commands, change skip/schedule/completion sync flags, or approve unattended real execution.
