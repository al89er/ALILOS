# PARITY7 Command Sync Deployment

This runbook deploys and smoke-tests the `alilos-command-sync` Supabase Edge Function used by disabled-by-default desktop command request/result processing.

## Boundary

- Desktop local operation does not require Supabase.
- Desktop command sync remains disabled unless both `paritySync.enabled` and `paritySync.commandSyncEnabled` are explicitly enabled.
- PARITY7 handles only `request-status-refresh`, `request-dry-run`, `recalculate-today-schedule`, and `cancel-confirmation`.
- `perform-configured-action` is available only through the PARITY10B guarded desktop path and remains disabled by default through local `paritySync.remoteActionEnabled`.
- No command may contain arbitrary selectors, scripts, forms, full URLs, tokenized URLs, credentials, cookies, raw HTML, screenshots, opaque `link=` values, or service-role keys.

## Deploy

Use placeholder project refs only in docs. Set required Edge Function environment values only in Supabase function/project secrets:

```sh
npx supabase functions deploy alilos-command-sync --project-ref <project-ref> --use-api
```

If `--use-api` is unavailable in the local CLI/environment, deploy from a machine that can build Edge Functions safely:

```sh
npx supabase functions deploy alilos-command-sync --project-ref <project-ref>
```

Do not commit project refs, device ids, publishable keys, service-role keys, access tokens, or smoke-test payloads with real operational data.

## Smoke Test Shape

Use a pre-registered non-personal test `deviceId`, a publishable/anon client key, and non-sensitive test command rows only. Validate:

- `list-pending` returns only unexpired PARITY7-safe command types.
- `claim-command` moves one pending command to claimed.
- `complete-command` writes sanitized result summary/details.
- `append-command-event` writes sanitized audit details.
- `perform-configured-action` may be returned by `list-pending` only as a guarded PARITY10B command. The desktop rejects it unless command sync, `manual-confirm`, `remoteActionEnabled`, local date, constrained payload, and existing guard checks all pass.

Keep desktop command sync off for ordinary monitored use. Enable it only for an explicit Supabase smoke test, then disable it again.

## Expected Failures

- `401` / `missing-authorization`: missing Authorization header.
- `403` / `service-role-client-key-rejected`: a service-role-looking key was sent by the client.
- `404` / `device-not-registered`: the test device id is not registered in `devices`.
- `400` / `forbidden-content`: payload or details included forbidden keys/strings.
- `500` / `server-not-configured`: Edge Function environment is missing `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY`.
