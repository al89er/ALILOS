# PARITY9D Safe Loop Smoke Test Runbook

DEPLOY1 live setup support now lives in `docs/DEPLOY1_SAFE_LOOP_CHECKLIST.md`. Use that checklist for the first live Supabase/webapp/desktop setup pass. DEPLOY1 keeps `remoteActionEnabled=false` throughout and validates safe monitoring/control only.

This runbook validates the deployed Supabase plus webapp safe loop without exercising remote configured-action execution. PARITY10B has added the guarded command path, but remote-action field validation belongs in `docs/PARITY_REMOTE_ACTION_FIELD_VALIDATION.md`.

It is manual and placeholder-only. Do not paste real Supabase URLs, anon keys, service-role keys, device ids, credentials, cookies, raw HTML, screenshots, full URLs, tokenized query strings, or opaque `link=` values into this document or any committed file.

The smoke test must prove:

- Edge Functions are deployed.
- A safe non-personal device row exists.
- Desktop parity sync can be enabled deliberately and safely.
- Status heartbeat publishing reaches Supabase.
- The webapp dashboard can read sanitized state.
- The skip calendar can upsert and delete whole-day skips.
- Safe web commands can be created.
- The desktop processes safe commands only.
- Schedule/completion sync is visible when enabled.
- Logs/history remain sanitized.
- No real configured website click occurs.
- `paritySync.remoteActionEnabled` stays `false` for DEPLOY1 safe-loop smoke testing.

For guarded remote configured-action validation, use `docs/PARITY_REMOTE_ACTION_FIELD_VALIDATION.md` after this safe-loop smoke path is healthy.

## Prerequisites

- Supabase project selected intentionally.
- Supabase CLI available if deploying from the local machine.
- Project is linked, or the project ref is known as `<project-ref>`.
- Edge Function server secrets are set in the selected project:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Desktop uses only a publishable/anon key.
- No service-role key is stored in desktop config, renderer code, webapp config, `.env.local`, docs, or logs.
- A non-personal device row exists in `devices`.
- Desktop `paritySync.enabled` is set to `true` only for this smoke test.
- Enable only the relevant sync flags as each step requires them:
  - status publishing
  - skip sync
  - schedule/completion sync
  - command sync
- Keep real configured-action command execution disabled/deferred.
- Keep `paritySync.remoteActionEnabled=false` for DEPLOY1. Do not test `perform-configured-action` from this safe-loop runbook.
- Keep execution mode as `dry-run` or `manual-confirm`; no unattended real execution is approved.
- Start with `logUploadEnabled` disabled unless the log-history step is being tested deliberately.

## Deploy Edge Functions

Deploy only to the intended Supabase project. Use placeholders here; do not commit real refs or keys.

```sh
supabase functions deploy alilos-parity-status --project-ref <project-ref>
supabase functions deploy alilos-dashboard-read --project-ref <project-ref>
supabase functions deploy alilos-skip-sync --project-ref <project-ref>
supabase functions deploy alilos-schedule-completion-sync --project-ref <project-ref>
supabase functions deploy alilos-command-sync --project-ref <project-ref>
```

If the project is not linked, link manually only after identity checks pass and the owner confirms the exact project:

```sh
supabase link --project-ref <project-ref>
```

Set function secrets from a trusted local shell or Supabase dashboard. These are placeholders only:

```sh
supabase secrets set SUPABASE_URL=<supabase-project-url> --project-ref <project-ref>
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<server-side-service-role-key> --project-ref <project-ref>
```

Do not put the service-role key in the desktop app or webapp.

## Device Setup

Use a stable non-personal device id and a safe device label. Do not use a staff id, staff name, machine username, hostname, or personal identity.

Placeholder check:

```sql
select device_id, display_name, created_at, updated_at
from public.devices
where device_id = '<safe-device-id>';
```

Placeholder insert if the row is missing:

```sql
insert into public.devices (device_id, display_name)
values ('<safe-device-id>', 'Home desktop smoke device')
on conflict (device_id)
do update set
  display_name = excluded.display_name,
  updated_at = now();
```

Expected result: one row for `<safe-device-id>`.

## Desktop Config

Use the packaged desktop app when possible. Keep values local to the machine.

Example placeholder shape:

```json
{
  "paritySync": {
    "enabled": true,
    "supabaseUrl": "<supabase-project-url>",
    "supabaseAnonKey": "<publishable-or-anon-key>",
    "deviceId": "<safe-device-id>",
    "statusPublishingEnabled": true,
    "skipSyncEnabled": false,
    "scheduleCompletionSyncEnabled": false,
    "commandSyncEnabled": false,
    "logUploadEnabled": false
  }
}
```

Rules:

- Use only a publishable/anon key.
- Do not use a service-role key.
- Do not add `.env.local`.
- Do not commit local config.
- Enable one sync flag at a time for smoke testing.
- Keep `logUploadEnabled` false until the log-history step.
- Keep configured website credentials local only.

## Webapp Config

Create local-only `webapp/config.js` from `webapp/config.example.js`.

Placeholder shape:

```js
window.ALILOS_CONFIG = {
  supabaseUrl: "<supabase-project-url>",
  supabaseAnonKey: "<publishable-or-anon-key>",
  deviceId: "<safe-device-id>"
};
```

These are the local values for the logical `supabaseUrl`, `supabaseAnonKey`, and `deviceId` placeholders. The earlier `window.ALILOS_WEBAPP_CONFIG` / `VITE_*` names remain accepted as aliases only.

Confirm `webapp/config.js` is ignored by Git:

```sh
git check-ignore -v webapp/config.js
git ls-files webapp/config.js
```

Expected result:

- `git check-ignore` shows the ignore rule.
- `git ls-files` prints nothing.

## Smoke Sequence

### 1. Launch Baseline

1. Launch packaged `ALILOS.exe`.
2. Confirm parity sync is disabled or all individual sync flags are off.
3. Confirm the app is in `dry-run` or `manual-confirm`.
4. Confirm no configured website click occurs.
5. Confirm logs do not contain credentials, cookies, raw HTML, screenshots, full URLs, tokenized query strings, or opaque `link=` values.

Expected: local desktop operation is normal without Supabase.

### 2. Status Heartbeat Publishing

1. Enable `paritySync.enabled`.
2. Enable status publishing.
3. Keep skip sync, schedule/completion sync, command sync, and log upload disabled.
4. Wait for a heartbeat interval or use a local safe status refresh if available.
5. Check the latest `heartbeats` row for `<safe-device-id>`.

Expected:

- `last_seen_at` updates.
- Payload is sanitized.
- No schedule/completion rows are required.
- No command is processed.
- No configured website click occurs.

### 3. Dashboard Read From Webapp

1. Open the local webapp with `webapp/config.js` present.
2. Confirm the Dashboard tab loads via `/functions/v1/alilos-dashboard-read`.
3. Confirm device status shows online or recently seen.
4. Confirm missing data is shown as unavailable/deferred rather than action-ready.
5. If the browser reports `Failed to fetch`, check CORS preflight support, network reachability, and deployed function availability before changing auth, RLS, or table grants.

Expected:

- Dashboard shows sanitized device/status data.
- Safety notices remain visible.
- The webapp does not expose credentials or service-role keys.
- GitHub Pages browser calls require CORS-enabled Edge Functions.

### 4. Skip Calendar Upsert/Delete

1. Enable desktop skip sync.
2. In the webapp Skip dates tab, select a future date.
3. Confirm the date enters a pending state and then becomes highlighted.
4. Confirm a `skip_dates` row exists for `<safe-device-id>` and the selected date with `action_key` null.
5. Confirm desktop receives/applies the skip state after sync.
6. Select the same date again to untoggle it.
7. Confirm the row is deleted or no longer returned by the skip-sync path.
8. Confirm desktop no longer applies that remote-managed whole-day skip after sync.
9. Confirm local-only or unknown/legacy desktop skips remain unless explicitly removed from the desktop Schedule tab skip-date manager.

Expected:

- Upsert uses `/functions/v1/alilos-skip-sync` with `upsert-skip`.
- Delete uses `/functions/v1/alilos-skip-sync` with `delete-skip`.
- The webapp uses publishable/anon credentials only.
- The Edge Function keeps service-role use server-side.
- Skip/unskip affects scheduling only.
- Remote removals clear only desktop skips known to be remote-managed or uploaded/synced.
- No command request or configured website action is created.

### 5. Schedule/Completion Sync Visibility

1. Enable schedule/completion sync.
2. Recalculate today's schedule locally if needed.
3. Wait for schedule sync.
4. Open or refresh the webapp Dashboard tab.
5. Confirm today's schedule appears when synced.
6. Confirm completion state is unavailable or unchanged unless a local action occurred outside this smoke test.

Expected:

- Schedule rows are visible as sanitized metadata.
- Completion remains unknown/unchanged unless a legitimate local completion already exists.
- Remote completion rows do not trigger local action.
- Supabase absence/failure never forces an action.

### 6. Safe Command Creation And Desktop Processing

1. Enable desktop command sync.
2. From the webapp Dashboard tab, submit:
   - Refresh status
   - Run dry-run/check
   - Recalculate today's schedule
   - Cancel pending confirmation
3. Confirm each command is created through `/functions/v1/alilos-command-sync`.
4. Confirm desktop claims/processes each command safely.
5. Confirm command results or command events are visible in sanitized dashboard/log history.

Expected:

- Only allowlisted non-clicking commands are exercised in this safe-loop smoke sequence.
- `perform-configured-action` is implemented in PARITY10B but must not be exercised by this runbook; use PARITY10C for supervised guarded-action field validation.
- Desktop may run checks, refresh status, recalculate schedule, or cancel a pending local confirmation.
- No real configured website click occurs.

### 7. Sanitized Logs And History

1. Enable `logUploadEnabled` only if testing log history intentionally.
2. Trigger a safe status refresh or dry-run/check.
3. Open the Log history tab.
4. Review displayed event rows.

Expected:

- Messages are short and sanitized.
- No credentials, cookies, raw HTML, screenshots, staff identity, Telegram token/chat id, full URLs, tokenized query strings, or opaque `link=` values appear.
- No raw payloads are echoed.

## Expected Overall Results

- Webapp shows online or recent desktop status.
- Skip calendar reflects whole-day skip upsert and delete changes, including OFF propagation for remote-managed skips.
- Safe commands produce command status/results.
- Dashboard updates after status refresh.
- Schedule state appears when schedule/completion sync is enabled and rows exist.
- Completion remains unchanged unless a real local action occurred outside this smoke test.
- Logs/history stay sanitized.
- No configured website click occurs.

## Failure Handling

401/403 auth problems:

- Confirm the webapp uses the publishable/anon key.
- Confirm Edge Functions have the expected `Authorization` header.
- Confirm no service-role-looking key was pasted into client config.

Missing Edge Function secret:

- Confirm `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set in the Edge Function environment.
- Redeploy or restart the function if required by the platform.

Unknown device id:

- Confirm the `devices` row exists for `<safe-device-id>`.
- Confirm desktop and webapp use the same non-personal device id.

Function not deployed:

- Deploy the missing function listed in this runbook.
- Confirm the function name matches the webapp or desktop endpoint exactly.

Desktop sync disabled:

- Confirm `paritySync.enabled` is true.
- Confirm the relevant per-feature flag is enabled.
- Confirm the packaged app has reloaded the current local config.

Command sync disabled:

- Confirm `commandSyncEnabled` is true only during the command step.
- Confirm the desktop command poller is running.
- Confirm the command type is one of the safe allowlisted types.

RLS/table write failure:

- Do not weaken table grants.
- Confirm writes are going through Edge Functions, not direct client table access.
- Confirm the Edge Function service role secret is set server-side only.

Stale webapp config:

- Reload the webapp.
- Confirm `webapp/config.js` points at the intended project URL and safe device id.
- Confirm `webapp/config.js` is not tracked by Git.

Network/captive portal issue:

- Resolve network access locally on the desktop.
- Do not enter captive portal credentials into the webapp.
- Do not submit portal forms from the smoke test unless a later local-only captive portal task explicitly approves it.

Service-role-looking key rejected:

- Replace the client key with the publishable/anon key.
- Keep service-role keys only in Edge Function secrets.

## Stop And Rollback

- Turn off `commandSyncEnabled`, `scheduleCompletionSyncEnabled`, `skipSyncEnabled`, status publishing, and then `paritySync.enabled` if the smoke test is complete.
- Turn off `logUploadEnabled` unless actively testing sanitized log upload.
- Remove local-only `webapp/config.js` if desired.
- Never commit `webapp/config.js`.
- Do not change table privileges to make a smoke test pass.
- Do not test remote `perform-configured-action` from this safe-loop runbook. Use the separate PARITY10C field-validation sequence when explicitly approved.
- If any sensitive value appears in UI/logs/history, stop the test, preserve only sanitized notes, disable sync flags, and investigate locally.
