# DEPLOY1 Safe Loop Setup Checklist

DEPLOY1 prepares live Supabase, webapp, and desktop smoke testing for the safe monitoring/control loop. It must not enable remote real configured-action execution.

Status: DEPLOY1 passed through Stage 4 for the safe loop. Status publishing, GitHub Pages live dashboard read, skip sync ON/OFF, schedule/completion sync, and safe command sync have been validated with `remoteActionEnabled=false`.

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
- Desktop parity sync is configured from Settings > Parity Sync / Webapp Supabase Sync and uses only a publishable/anon key.
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
window.ALILOS_CONFIG = {
  supabaseUrl: "https://<project-ref>.supabase.co",
  supabaseAnonKey: "<publishable-or-anon-key>",
  deviceId: "<existing-device-uuid>"
};
```

The webapp also accepts the earlier `window.ALILOS_WEBAPP_CONFIG` / `VITE_*` names as aliases, but GitHub Pages should generate the canonical `window.ALILOS_CONFIG` shape.

Verify it is ignored and untracked:

```sh
git check-ignore -v webapp/config.js
git ls-files webapp/config.js
```

Expected:

- `git check-ignore` prints the ignore rule.
- `git ls-files` prints nothing.

## Desktop Config Checklist

Configure only local desktop app/userData values from the packaged app Settings tab, under `Parity Sync / Webapp Supabase Sync`. The older `Heartbeat` settings are legacy status-only settings and are not enough for the DEPLOY1 parity safe-loop smoke.

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

The publishable/anon key field is password-style and blank after loading; leave it blank to preserve the current local key. The Settings save path rejects service-role-looking keys with a sanitized error. Never use a service-role key locally. Never commit the desktop config.

Current validated safe-loop operational config after DEPLOY1:

- `paritySync.enabled=true`
- `skipSyncEnabled=true`
- `scheduleCompletionSyncEnabled=true`
- `commandSyncEnabled=true`
- `remoteActionEnabled=false`

This state is approved for monitored local use with Supabase/webapp status, skip, schedule/completion, and safe command sync. It is not approval for remote configured-site action or unattended execution.

## Smoke Sequence

Run in this order.

Use the desktop `Sync now` button in the Automation / Heartbeat parity detail area when you need an immediate one-shot parity sync instead of waiting for intervals. It publishes status and runs only the enabled skip, schedule/completion, and command sync paths. It does not run disabled sync features, does not expose keys, and does not bypass `remoteActionEnabled`.

### 1. Packaged Desktop Baseline

1. Launch packaged `release/win-unpacked/ALILOS.exe`.
2. Confirm app opens and local operation is normal.
3. Open Settings and confirm the Parity Sync / Webapp Supabase Sync section is available.
4. Confirm parity sync is disabled or all sync flags are off.
5. Confirm mode is `dry-run` or `manual-confirm`.
6. Confirm `remoteActionEnabled=false`.
7. Confirm no configured website click occurs.

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
5. If the browser shows `Failed to fetch`, check deployed Edge Function reachability and CORS preflight handling before changing auth or table grants.

Pass: webapp reads sanitized dashboard data through the Edge Function and exposes no secrets.

### 4. Skip Calendar Round Trip

1. Enable `skipSyncEnabled=true` on desktop.
2. In the webapp Skip dates tab, toggle a future date on.
3. Confirm the webapp uses `upsert-skip`.
4. Confirm desktop receives/applies the skip after sync.
5. Toggle the same future date off.
6. Confirm the webapp uses `delete-skip`.
7. Confirm desktop no longer applies that remote-managed whole-day skip after sync.
8. Confirm local-only or unknown/legacy desktop skips remain until explicitly removed in the desktop Schedule tab skip-date manager.
9. If a stuck skip remains, remove it from the desktop skipped-date list and confirm this only changes scheduling state.

Pass: skip upsert/delete ON and OFF propagation works, local-only skips are preserved, and all changes affect scheduling only.

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

### 6B. Manual Sync Now

1. With the current safe-loop flags enabled, click `Sync now` in the desktop parity detail area.
2. Confirm parity detail shows a manual sync attempt/result.
3. Confirm status publish, skip sync, schedule/completion sync, and command sync update according to their enabled flags.
4. Confirm disabled features remain disabled.
5. Confirm remote configured-site action remains not allowed because `remoteActionEnabled=false`.

Pass: manual sync reduces waiting without changing safety gates or triggering a configured website click.

### 7. Sanitized Log/History Review

1. Keep `logUploadEnabled=false` unless deliberately testing log history.
2. If testing log history, enable it briefly, trigger a safe command, then disable it again.
3. Review desktop logs and webapp Log history.

Pass: no credentials, cookies, raw HTML, screenshots, staff identity, Telegram token/chat id, full URLs, tokenized query strings, opaque `link=` values, service-role keys, selectors, scripts, or forms appear.

## Pass Criteria

DEPLOY1 passes only if:

- Webapp can read dashboard data via `alilos-dashboard-read`.
- Desktop status publishing succeeds.
- Skip calendar upsert/delete ON and OFF round trip works; remote removals clear only remote-managed or uploaded/synced desktop skips.
- Safe commands are created and processed.
- Command results appear.
- Schedule state appears when schedule/completion sync is enabled and rows exist.
- Desktop `Sync now` can run the enabled safe parity sync paths without waiting for intervals.
- No real configured website action occurs.
- No sensitive data appears in UI, logs, command history, Supabase rows, docs, or committed files.
- `remoteActionEnabled` remains false.

## Fail Or Blocker Criteria

Stop and treat as a blocker if any of these occur:

- Function auth failure that cannot be explained by missing placeholder config.
- Browser `Failed to fetch`, especially from GitHub Pages, indicating likely CORS, network, or function reachability failure.
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
