# PARITY5 Skip Sync Deployment Runbook

This runbook deploys and smoke-tests the `alilos-skip-sync` Supabase Edge Function used by desktop skip-date sync.

Security boundary:

- Desktop config uses only a publishable/anon key.
- The service-role key is server-side only in the Edge Function environment.
- Direct `anon` / `authenticated` table privileges stay closed.
- Skip sync only changes scheduling skip state.
- Skip sync must not click Perakam, process commands, implement a webapp, store credentials, store cookies, store raw HTML, store screenshots, store selectors/scripts/forms, or store full/tokenized URLs or opaque `link=` values.

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
npx supabase functions deploy alilos-skip-sync --project-ref <project-ref> --use-api
```

If `--use-api` is unavailable in the local CLI/environment, deploy from a machine that can build Edge Functions safely:

```sh
npx supabase functions deploy alilos-skip-sync --project-ref <project-ref>
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

List current/future skips:

```sh
curl -X POST "https://<project-ref>.supabase.co/functions/v1/alilos-skip-sync" \
  -H "Authorization: Bearer <publishable-or-anon-key>" \
  -H "apikey: <publishable-or-anon-key>" \
  -H "Content-Type: application/json" \
  --data '{"deviceId":"<existing-device-uuid>","operation":"list-skips"}'
```

Upsert a whole-day skip:

```sh
curl -X POST "https://<project-ref>.supabase.co/functions/v1/alilos-skip-sync" \
  -H "Authorization: Bearer <publishable-or-anon-key>" \
  -H "apikey: <publishable-or-anon-key>" \
  -H "Content-Type: application/json" \
  --data '{"deviceId":"<existing-device-uuid>","operation":"upsert-skip","skipDate":"<yyyy-mm-dd>","actionKey":null,"reason":"<safe-short-reason>","source":"desktop-local"}'
```

Delete a whole-day skip:

```sh
curl -X POST "https://<project-ref>.supabase.co/functions/v1/alilos-skip-sync" \
  -H "Authorization: Bearer <publishable-or-anon-key>" \
  -H "apikey: <publishable-or-anon-key>" \
  -H "Content-Type: application/json" \
  --data '{"deviceId":"<existing-device-uuid>","operation":"delete-skip","skipDate":"<yyyy-mm-dd>","actionKey":null,"source":"desktop-local"}'
```

Expected success response shapes:

```json
{
  "success": true,
  "operation": "list-skips",
  "acceptedAt": "2026-06-19T00:00:00.000Z",
  "skips": []
}
```

```json
{
  "success": true,
  "operation": "upsert-skip",
  "acceptedAt": "2026-06-19T00:00:00.000Z",
  "affectedCount": 1
}
```

## Desktop Smoke

1. Keep `paritySync.enabled = false` until the function is deployed.
2. Configure publishable/anon key only; never use a service-role key locally.
3. Set `paritySync.enabled = true`.
4. Set `paritySync.skipSyncEnabled = true`.
5. Keep `commandSyncEnabled = false` and `scheduleCompletionSyncEnabled = false`.
6. Start ALILOS and confirm parity status shows skip sync enabled.
7. Verify remote skip rows add local skipped dates only.
8. Verify empty remote lists do not delete local skipped dates.
9. Verify local skip/unskip sends upsert/delete requests only when skip sync is explicitly enabled.
10. Disable skip sync if errors or sensitive-data risks appear.

Known conservative behavior: because current local scheduling stores whole-day skipped dates, any remote action-specific skip row is applied as a whole-day local skip. This fails safe by skipping more rather than accidentally allowing an action.

## Common Failures

- `401` / `missing-authorization`: Authorization header missing or malformed.
- `403` / `service-role-client-key-rejected`: client sent a service-role-looking key.
- `404` / `device-not-registered`: device UUID does not exist in `public.devices`.
- `400` / `forbidden-content`: payload includes forbidden key or suspicious string.
- `400` / `invalid-operation`, `invalid-skip-date`, `invalid-action-key`, or `invalid-source`: request shape is outside the allowed contract.
- `500` / `server-not-configured`: Edge Function environment is missing `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY`.
- `500` / write/list failure: check migrations, function logs, service-role environment, and database constraints. Do not open direct table grants to `anon` or `authenticated`.
