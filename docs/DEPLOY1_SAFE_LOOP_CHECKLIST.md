# DEPLOY1 Safe Loop Setup Checklist

DEPLOY1 prepares live Supabase, webapp, and desktop smoke testing for the safe monitoring/control loop. It must not enable remote real configured-action execution.

Hard safety rule:

- Keep `remoteActionEnabled=false` for the entire DEPLOY1 test.
- Do not send or test `perform-configured-action`.
- Do not trigger any real configured website click.
- Use placeholders only in docs, commands, notes, and committed files.

Do not commit or paste real Supabase project refs, publishable/anon keys, service-role keys, device ids, credentials, cookies, raw HTML, screenshots, full URLs, tokenized query strings, opaque `link=` values, `webapp/config.js`, `.env.local`, or local desktop config.

## Setup Checklist

Confirm before smoke testing:

- Supabase project is intentionally selected.
- Local identity checks pass before remote-changing Supabase commands.
- Required migrations are applied in the selected project.
- Direct table privileges remain closed; do not add broad `anon` or `authenticated` grants.
- Edge Functions are deployed:
  - `alilos-parity-status`
  - `alilos-dashboard-read`
  - `alilos-skip-sync`
  - `alilos-schedule-completion-sync`
  - `alilos-command-sync`
- Edge Function secrets are configured server-side only:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- A safe existing device row exists in `public.devices`.
- Desktop parity sync uses only a publishable/anon key.
- Desktop `paritySync.remoteActionEnabled=false`.
- Webapp local config is created from `webapp/config.example.js`.
- `webapp/config.js` is ignored and untracked.
- `.env.local` is not created or changed for this smoke test unless the user explicitly chooses local-only setup outside Git.

## Placeholder Commands

Inspect Supabase CLI command shapes first:

```sh
npx supabase functions deploy --help
npx supabase secrets set --help
```

Deploy Edge Functions to the intended project:

```sh
npx supabase functions deploy alilos-parity-status --project-ref <project-ref>
npx supabase functions deploy alilos-dashboard-read --project-ref <project-ref>
npx supabase functions deploy alilos-skip-sync --project-ref <project-ref>
npx supabase functions deploy alilos-schedule-completion-sync --project-ref <project-ref>
npx supabase functions deploy alilos-command-sync --project-ref <project-ref>
```

Set server-side Edge Function secrets. Enter the real service-role value only in a trusted local shell or Supabase dashboard, never in docs, desktop config, webapp config, or chat:

```sh
npx supabase secrets set --project-ref <project-ref> SUPABASE_URL=https://<project-ref>.supabase.co
npx supabase secrets set --project-ref <project-ref> --env-file <path-to-untracked-edge-secrets.env>
```

The untracked secrets file shape is:

```text
SUPABASE_SERVICE_ROLE_KEY=<server-side-service-role-key>
```

Check for an existing safe device row:

```sql
select device_id, display_name, is_active, created_at, updated_at
from public.devices
where device_id = '<existing-device-uuid>'::uuid;
```

Insert a safe non-personal device row only if needed:

```sql
insert into public.devices (device_id, display_name, is_active)
values ('<existing-device-uuid>'::uuid, '<safe-device-label>', true)
on conflict (device_id)
do update set
  display_name = excluded.display_name,
  is_active = true,
  updated_at = now();
```

Use a safe label such as `<safe-device-label>`. Do not use staff identity, machine username, hostname, workplace identity, Telegram identity, or credentials.

## Local Webapp Config

Create local-only `webapp/config.js` from `webapp/config.example.js`.

Use this placeholder shape:

```js
window.ALILOS_WEBAPP_CONFIG = {
  VITE_SUPABASE_URL: "https://<project-ref>.supabase.co",
  VITE_SUPABASE_ANON_KEY: "<publishable-or-anon-key>",
  VITE_ALILOS_DEVICE_ID: "<existing-device-uuid>"
};
```

Verify it is ignored and untracked:

```sh
git check-ignore -v webapp/config.js
git ls-files webapp/config.js
```

Expected:

- `git check-ignore` prints the ignore rule.
- `git ls-files` prints nothing.

## Desktop Config Checklist

Configure only local desktop app/userData values:

- `paritySync.enabled=false` for the baseline step.
- `paritySync.supabaseUrl=https://<project-ref>.supabase.co`
- `paritySync.publishableKey=<publishable-or-anon-key>`
- `paritySync.deviceId=<existing-device-uuid>`
- `paritySync.deviceLabel=<safe-device-label>`
- `paritySync.logUploadEnabled=false` initially.
- `paritySync.skipSyncEnabled=false` initially.
- `paritySync.scheduleCompletionSyncEnabled=false` initially.
- `paritySync.commandSyncEnabled=false` initially.
- `paritySync.remoteActionEnabled=false` throughout DEPLOY1.

Never use a service-role key locally. Never commit the desktop config.

## Smoke Sequence

Run in this order.

### 1. Packaged Desktop Baseline

1. Launch packaged `release/win-unpacked/ALILOS.exe`.
2. Confirm app opens and local operation is normal.
3. Confirm parity sync is disabled or all sync flags are off.
4. Confirm mode is `dry-run` or `manual-confirm`.
5. Confirm `remoteActionEnabled=false`.
6. Confirm no configured website click occurs.

Pass: desktop runs locally with no Supabase dependency and no real action.

### 2. Status Publishing

1. Enable `paritySync.enabled=true`.
2. Keep `skipSyncEnabled=false`, `scheduleCompletionSyncEnabled=false`, `commandSyncEnabled=false`, `logUploadEnabled=false`, and `remoteActionEnabled=false`.
3. Wait for a heartbeat/status publish interval.
4. Verify status/heartbeat appears through Supabase or webapp read path.

Pass: desktop status publish succeeds, and payload/status text is sanitized.

### 3. Webapp Dashboard Read

1. Open the webapp locally with `webapp/config.js` present.
2. Confirm `/functions/v1/alilos-dashboard-read` returns dashboard data for `<existing-device-uuid>`.
3. Confirm dashboard shows online/recent status or a clear stale/unavailable state.
4. Confirm missing schedule/completion data is not shown as action-ready.

Pass: webapp reads sanitized dashboard data through the Edge Function and exposes no secrets.

### 4. Skip Calendar Round Trip

1. Enable `skipSyncEnabled=true` on desktop.
2. In the webapp Skip dates tab, toggle a future date on.
3. Confirm the webapp uses `upsert-skip`.
4. Confirm desktop receives/applies the skip after sync.
5. Toggle the same future date off.
6. Confirm the webapp uses `delete-skip`.
7. Confirm desktop no longer applies the remote whole-day skip after sync.

Pass: skip upsert/delete round trip works and affects scheduling only.

### 5. Schedule/Completion Visibility

1. Enable `scheduleCompletionSyncEnabled=true`.
2. Recalculate today's schedule locally if needed.
3. Wait for schedule/completion sync.
4. Refresh the webapp Dashboard.
5. Confirm today's schedule appears when rows exist.
6. Confirm completion state is unchanged unless a legitimate local completion already existed.

Pass: schedule metadata appears safely, and no remote completion row triggers local action.

### 6. Safe Command Processing

1. Enable `commandSyncEnabled=true`.
2. Keep `remoteActionEnabled=false`.
3. From the webapp, send only:
   - refresh status
   - dry-run/check
   - recalculate today
   - cancel confirmation
4. Confirm desktop claims/processes each command.
5. Confirm command results appear in the webapp or log history.
6. Do not send guarded configured-action commands in DEPLOY1.

Pass: safe commands are created, processed, and recorded without any configured website click.

### 7. Sanitized Log/History Review

1. Keep `logUploadEnabled=false` unless deliberately testing log history.
2. If testing log history, enable it briefly, trigger a safe command, then disable it again.
3. Review desktop logs and webapp Log history.

Pass: no credentials, cookies, raw HTML, screenshots, staff identity, Telegram token/chat id, full URLs, tokenized query strings, opaque `link=` values, service-role keys, selectors, scripts, or forms appear.

## Pass Criteria

DEPLOY1 passes only if:

- Webapp can read dashboard data via `alilos-dashboard-read`.
- Desktop status publishing succeeds.
- Skip calendar upsert/delete round trip works.
- Safe commands are created and processed.
- Command results appear.
- Schedule state appears when schedule/completion sync is enabled and rows exist.
- No real configured website action occurs.
- No sensitive data appears in UI, logs, command history, Supabase rows, docs, or committed files.
- `remoteActionEnabled` remains false.

## Fail Or Blocker Criteria

Stop and treat as a blocker if any of these occur:

- Function auth failure that cannot be explained by missing placeholder config.
- Edge Function server secret missing or misconfigured.
- Unknown device id.
- Desktop does not publish after sync is enabled.
- Webapp config points to the wrong project/device or is stale.
- Skip sync mismatch or remote skip deletion does not propagate after sync.
- Command sync does not poll, claim, or complete safe commands.
- Any unsanitized credential, cookie, raw HTML, screenshot, staff identity, full/tokenized URL, opaque `link=`, Telegram secret, service-role key, selector, script, or form value appears.
- Any unexpected configured website click or action path occurs.

## Rollback

1. Set `paritySync.remoteActionEnabled=false`.
2. Set `commandSyncEnabled=false`.
3. Set `scheduleCompletionSyncEnabled=false`.
4. Set `skipSyncEnabled=false`.
5. Set `logUploadEnabled=false`.
6. Set `paritySync.enabled=false` if the smoke session is complete.
7. Remove local-only `webapp/config.js` if desired.
8. Do not change table grants to make the smoke test pass.
9. Do not commit `.env.local`, `webapp/config.js`, local desktop config, Supabase keys, device ids, screenshots, raw logs, or sensitive observations.

If a sensitive value appears, stop testing, disable sync flags, keep only sanitized notes, and investigate locally.
