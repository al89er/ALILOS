# PARITY6 Schedule/Completion Sync Deployment Runbook

This runbook deploys and smoke-tests the `alilos-schedule-completion-sync` Supabase Edge Function used by disabled-by-default desktop schedule/completion backup sync.

Security boundary:

- Desktop config uses only a publishable/anon key.
- The service-role key is server-side only in the Edge Function environment.
- Direct `anon` / `authenticated` table privileges stay closed.
- Schedule/completion sync is backup and warning telemetry only.
- Remote state must not click Perakam, process commands, implement a webapp, create local success records, store credentials, store cookies, store raw HTML, store screenshots, store selectors/scripts/forms, or store full/tokenized URLs or opaque `link=` values.

## Deploy

Confirm CLI command shape first:

```sh
npx supabase functions deploy --help
npx supabase secrets set --help
```

Set required Edge Function environment values only in Supabase function/project secrets:

```sh
npx supabase secrets set --project-ref <project-ref> SUPABASE_URL=https://<project-ref>.supabase.co
npx supabase secrets set --project-ref <project-ref> --env-file <path-to-untracked-edge-secrets.env>
```

The untracked secrets file should contain only local placeholder-filled values and must not be committed:

```text
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

Deploy:

```sh
npx supabase functions deploy alilos-schedule-completion-sync --project-ref <project-ref> --use-api
```

If `--use-api` is unavailable in the local CLI/environment, deploy from a machine that can build Edge Functions safely:

```sh
npx supabase functions deploy alilos-schedule-completion-sync --project-ref <project-ref>
```

## Device Prerequisite

`deviceId` must already exist in `public.devices`.

```sql
select device_id, display_name, is_active
from public.devices
where device_id = '<existing-device-uuid>'::uuid;
```

Create a non-personal device row if needed. Do not derive values from staff identity, machine username, hostname, credentials, Telegram identity, or workplace identity.

## Curl Smoke Tests

Use only placeholders. Do not include secrets or sensitive page data.

Fetch current-day state:

```sh
curl -X POST "https://<project-ref>.supabase.co/functions/v1/alilos-schedule-completion-sync" \
  -H "Authorization: Bearer <publishable-or-anon-key>" \
  -H "apikey: <publishable-or-anon-key>" \
  -H "Content-Type: application/json" \
  --data '{"deviceId":"<existing-device-uuid>","operation":"get-day-state","scheduleDate":"<yyyy-mm-dd>"}'
```

Upsert one generated schedule row:

```sh
curl -X POST "https://<project-ref>.supabase.co/functions/v1/alilos-schedule-completion-sync" \
  -H "Authorization: Bearer <publishable-or-anon-key>" \
  -H "apikey: <publishable-or-anon-key>" \
  -H "Content-Type: application/json" \
  --data '{"deviceId":"<existing-device-uuid>","operation":"upsert-schedule","scheduleDate":"<yyyy-mm-dd>","actionKey":"clock-out","schedule":{"targetTimeLocal":"17:05","windowStartLocal":"17:00","windowEndLocal":"17:15","source":"local-generated","status":"active"}}'
```

Upsert one sanitized completion marker:

```sh
curl -X POST "https://<project-ref>.supabase.co/functions/v1/alilos-schedule-completion-sync" \
  -H "Authorization: Bearer <publishable-or-anon-key>" \
  -H "apikey: <publishable-or-anon-key>" \
  -H "Content-Type: application/json" \
  --data '{"deviceId":"<existing-device-uuid>","operation":"upsert-completion","actionDate":"<yyyy-mm-dd>","actionKey":"clock-out","completion":{"dedupeKey":"<safe-dedupe-key>","state":"verification-pending","verificationState":"verification-unknown","sanitizedReason":"<safe-short-reason>","attemptedAt":"2026-06-19T00:00:00.000Z","verifiedAt":null}}'
```

Expected success response shapes:

```json
{
  "success": true,
  "operation": "get-day-state",
  "acceptedAt": "2026-06-19T00:00:00.000Z",
  "schedules": [],
  "completions": []
}
```

```json
{
  "success": true,
  "operation": "upsert-schedule",
  "acceptedAt": "2026-06-19T00:00:00.000Z",
  "affectedCount": 1
}
```

## Desktop Smoke

1. Keep `paritySync.enabled = false` until the function is deployed.
2. Configure publishable/anon key only; never use a service-role key locally.
3. Set `paritySync.enabled = true`.
4. Set `paritySync.scheduleCompletionSyncEnabled = true`.
5. Keep `commandSyncEnabled = false`.
6. Start ALILOS and confirm parity status shows schedule/completion sync enabled.
7. Verify current-day generated schedule rows upload as sanitized backup metadata.
8. Verify existing local completion records upload as sanitized backup metadata.
9. Verify remote-only completion rows surface warnings only and do not create local success records.
10. Disable schedule/completion sync if errors or sensitive-data risks appear.

Known conservative behavior: PARITY6 does not recover missing local schedules automatically and does not import remote completion rows as local successful completions. It preserves local authority for configured-site action decisions and treats remote disagreement as review-only warning telemetry.

## Common Failures

- `401` / `missing-authorization`: Authorization header missing or malformed.
- `403` / `service-role-client-key-rejected`: client sent a service-role-looking key.
- `404` / `device-not-registered`: device UUID does not exist in `public.devices`.
- `400` / `forbidden-content`: payload includes forbidden key or suspicious string.
- `400` / `invalid-operation`, `invalid-action-key`, `invalid-schedule`, or `invalid-completion`: request shape is outside the allowed contract.
- `500` / `server-not-configured`: Edge Function environment is missing `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY`.
- `500` / write/list failure: check migrations, function logs, service-role environment, and database constraints. Do not open direct table grants to `anon` or `authenticated`.
