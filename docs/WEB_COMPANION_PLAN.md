# Web Companion Plan

WEB1 is a docs-only plan for a future mobile-friendly browser/PWA companion. It does not create webapp code, frontend dependencies, migrations, `.env.local`, secrets, Supabase write enablement, command/control, Electron runtime changes, direct desktop table write policies, or unattended real execution approval.

## Architecture Split

- Electron desktop remains the only local browser/session/action assistant.
- Desktop keeps the Perakam browser profile, local session, local schedule generation, local completion blocking, manual-confirm safety model, and all guarded action behavior.
- The web/PWA companion is a mobile status/control surface only.
- Supabase plus the future Edge Function/API proxy is the control-plane boundary.
- Desktop remains local-first and must continue normal local operation when the web companion, Supabase, or Edge Function/API is unavailable.
- Android/mobile access should be browser/PWA-based, not Electron.

## WEB1 Initial Mode

WEB1 starts read-only.

Initial web/PWA scope:

- Show desktop heartbeat/status when heartbeat writes are available.
- Show stale/offline warnings when the latest heartbeat is old or missing.
- Show planned schedule only after schedule sync exists.
- Show completion/verification state only after completion sync exists.
- Show clear placeholders for unavailable/deferred sync data.
- Add no control commands in WEB1.

The first web version must not rely on data that the desktop does not yet sync.

## WEB2 Read-Only UI Design

WEB2 is still docs/design only. It does not create webapp code, frontend dependencies, migrations, runtime writes, command/control, credential handling, or unattended execution paths.

### Screens

Home/status dashboard:

- First screen after authentication in a future webapp.
- Single-column summary of the current desktop/device state.
- Stale heartbeat warning appears at the top before other status cards.
- Shows read-only label: "Web companion is read-only. Actions still require the desktop app."
- Includes last-seen timestamp and sync availability.

Desktop/device status detail:

- Shows desktop online, stale, or unreachable state.
- Shows last heartbeat time, app status, network status, Perakam status, Telegram status when available, and sync disabled/deferred state.
- Shows device label only if it is owner-provided and non-sensitive.
- Does not show machine username, hostname, staff identity, local config paths, logs, raw URLs, or secrets.

Schedule view:

- Shows today's scheduled action rows only after `daily_schedules` sync exists.
- Shows action key, local date, target time, optional local window, and status.
- Shows "Schedule unavailable" or "Schedule sync deferred" when data is missing.
- Does not generate schedule times or infer schedule state independently of desktop-synced rows.

Completion/verification view:

- Shows completion records only after `completion_records` sync exists.
- Shows action key, local date, completion state, verification state, sanitized reason/status, attempted time, and verified time when present.
- Highlights verification unknown/failed as "Check desktop before retrying."
- Does not offer a retry or attendance action trigger.

Warnings/events view:

- Shows read-only warnings derived from synced sanitized status.
- Prioritizes stale heartbeat, desktop unreachable, Perakam unreachable, login/session issue, captive portal detected/possible, completion verification failed/unknown, and sync disabled/deferred.
- Uses timestamps and short sanitized reason text only.
- Does not display raw logs, screenshots, raw HTML, full URLs, or tokenized values.

Settings/info placeholder:

- Shows account/device read scope, sync status, and "controls not available in WEB2".
- Shows future placeholders for authenticated read-only status, schedule/completion display, supervised controls after approval, and command queue design later.
- Does not include credential inputs, pairing token display, service-role keys, runtime mode change controls, or command buttons.

### Status Cards

Desktop status:

- Online: "Desktop online. Last seen {relative time}."
- Stale: "Desktop status is stale. Last seen {timestamp}. Check the desktop app."
- Unreachable: "Desktop unreachable. No recent heartbeat is available."

Perakam status:

- Reachable: "Perakam reachable from desktop."
- Unreachable: "Perakam unreachable from desktop."
- Session issue: "Perakam login/session issue. Resolve on the desktop."

Captive portal status:

- Detected: "Captive portal detected by desktop. Resolve network access outside this web companion."
- Possible: "Captive portal possible. Check the desktop network status."
- Not detected: "No captive portal detected."

Sync status:

- Disabled/deferred: "Sync disabled or deferred. Local desktop state remains the source of truth."
- Available: "Sync data available from last desktop update."
- Partial: "Some sync data is not available yet."

Next scheduled action:

- Available: "Next scheduled action: {action_key} at {target_time_local}."
- Unavailable: "Schedule unavailable. The desktop may still have a local schedule."
- Deferred: "Schedule sync deferred."

Pending manual confirmation:

- Present: "Manual confirmation required on desktop."
- None: "No pending manual confirmation reported."
- Unknown: "Manual confirmation status unavailable."

Last completion/verification:

- Verified: "Last completion verified."
- Unknown: "Completion verification unknown. Check desktop before retrying."
- Failed: "Completion verification failed. Check desktop before retrying."
- Unavailable: "Completion state unavailable."

### Mobile-First UX Rules

- Use a simple single-column layout.
- Use plain text status language alongside color; never rely on color alone.
- Put timestamp and last-seen labels on every status area.
- Prioritize stale heartbeat and desktop unreachable warnings above all routine cards.
- Keep cards compact and scannable on a phone.
- Use graceful placeholders while heartbeat, schedule, or completion sync is unavailable.
- Do not hide destructive or action-like controls because WEB2 has no controls.
- Avoid disabled action buttons that imply remote execution exists.

### Read-Only Data Dependencies

- Heartbeat/status data if and when desktop heartbeat writes are enabled.
- `daily_schedules` only after schedule sync exists.
- `completion_records` only after completion sync exists.
- Local desktop state remains the source of truth.
- The web companion must handle missing, stale, partial, or deferred data safely.
- Missing Supabase data must never imply that an action is due or safe to perform.

### Forbidden WEB2 UI/Actions

- No Perakam login form.
- No Fortinet login form.
- No credential input.
- No attendance action trigger.
- No direct command buttons.
- No skip/unskip controls.
- No runtime mode switch.
- No status refresh command.
- No confirmation accept/execute control.
- No unattended execution pathway.

### Required Copy

- Desktop online: "Desktop online."
- Desktop stale/unreachable: "Desktop status is stale or unreachable. Check the desktop app."
- Sync disabled/deferred: "Sync disabled or deferred. Local desktop state remains the source of truth."
- Schedule unavailable: "Schedule unavailable. The desktop may still have a local schedule."
- Completion unknown: "Completion state unavailable or unknown. Check desktop before retrying."
- Manual confirmation required: "Manual confirmation required on desktop."
- Read-only companion: "Web companion is read-only. Actions still require the desktop app."

### Future Expansion Placeholders

- WEB3 authenticated read-only status.
- WEB4 schedule/completion display after sync exists.
- WEB5 supervised command queue design only.
- WEB6 supervised controls only after explicit approval.

## WEB3 Legacy Webapp Reference

Known legacy/current webapp reference: `al89er/perakamwaktu`.

WEB3 is docs-only. Do not clone, modify, merge, or copy from the legacy repo unless it is explicitly available locally and the task is reference-only. Do not copy code, secrets, Supabase keys, Telegram tokens, credentials, production config, cookies, raw HTML, screenshots, tokenized URLs, or opaque `link=` values.

Role of the legacy webapp:

- Existing backup/reference implementation.
- Useful for understanding prior UI/data-flow between the old Tampermonkey workflow, Supabase, and a web surface.
- Should remain available as fallback while the Electron desktop app and ALILOS web companion mature.
- Should not be merged into ALILOS automatically.

Reuse decision:

- Reusing `al89er/perakamwaktu` could preserve proven prior behavior, but it risks carrying old assumptions, older security boundaries, production config coupling, and Tampermonkey-era workflows into ALILOS.
- Rebuilding the ALILOS web companion keeps the desktop-first architecture, S3D Edge Function/API boundary, read-only WEB1/WEB2 posture, and future supervised controls cleaner.
- Recommendation: rebuild or create an isolated future `webapp/` folder in this repo unless a later explicit review finds a strong reason to reuse the legacy repo.
- Secrets/config boundaries must be re-designed either way. No legacy secret, token, production config, credential, cookie, raw page capture, full URL, tokenized query string, or opaque `link=` value should be copied.

Same-repo vs separate-repo implication:

- Same ALILOS repo remains possible with an isolated future `webapp/` boundary and separate web build/deploy config.
- The legacy `al89er/perakamwaktu` repo can remain separate as fallback/reference.
- A separate repo may remain better if deployment complexity, production fallback risk, or secret-boundary separation matters more than shared documentation and contracts.

Migration strategy:

1. Do not disturb the existing production/backup webapp.
2. Document ALILOS data contracts first.
3. Build the ALILOS web companion read-only first.
4. Compare UI/behavior later using sanitized screenshots or written summaries only.
5. Migrate or retire legacy behavior only after explicit approval.

Safety/security boundaries:

- No legacy secrets copied.
- No direct command/control copied.
- No web-triggered attendance action.
- No desktop service-role exposure.
- No Perakam/Fortinet credential handling in the web companion.
- No bypass of the desktop manual-confirm safety model.

## WEB4 Read-Only Data Contracts

WEB4 is docs-only. It defines display contracts for future authenticated read-only web/PWA views. It does not create webapp code, runtime sync, migrations, writes, command/control, or unattended execution paths.

All examples below are fake, non-sensitive, and display-safe.

### Desktop/Device Heartbeat Status

Purpose: show whether the desktop app is recently online and which coarse app state it last reported.

Source: `devices` plus latest-row `heartbeats`, or a future read-only summary API.

Minimum fields:

- `device_id`
- `display_name`
- `last_seen_at`
- `app_status`
- `execution_mode`
- `sync_status`

Optional fields:

- `app_version`
- `platform`
- `status_text`
- `last_error_text`

Stale/missing behavior:

- Fresh heartbeat means "Desktop online."
- Stale heartbeat means "Desktop status is stale or unreachable. Check the desktop app."
- Missing heartbeat means "Desktop unreachable. No recent heartbeat is available."

Sanitization:

- No machine username, hostname, staff identity, config paths, raw logs, full URLs, credentials, tokens, or secrets.

Exists now: schema exists for `devices` and `heartbeats`; runtime heartbeat writes remain disabled/deferred.

Example:

```json
{
  "device_id": "device-demo-001",
  "display_name": "Home desktop",
  "last_seen_at": "2026-06-18T09:15:00Z",
  "app_status": "running",
  "execution_mode": "manual-confirm",
  "sync_status": "heartbeat-only",
  "status_text": "Desktop online."
}
```

### Perakam/Browser/Session Status

Purpose: show the desktop-observed Perakam/browser/session state without exposing the browser session.

Source: current heartbeat payload fields or future read-only status summary API.

Minimum fields:

- `device_id`
- `perakam_status`
- `browser_status`
- `checked_at`

Optional fields:

- `sanitized_reason`
- `control_availability`

Stale/missing behavior:

- Missing or stale data shows "Perakam status unavailable. Check the desktop app."
- Session issue shows "Perakam login/session issue. Resolve on the desktop."

Sanitization:

- No Perakam credentials, cookies, raw HTML, screenshots, staff identity, full URLs, tokenized query strings, or opaque `link=` values.

Exists now: desktop can observe these states locally; web-readable sync is future/deferred.

Example:

```json
{
  "device_id": "device-demo-001",
  "perakam_status": "login-required",
  "browser_status": "running",
  "checked_at": "2026-06-18T09:14:30Z",
  "sanitized_reason": "Desktop reports login/session issue."
}
```

### Network/Captive Portal Status

Purpose: show desktop-observed network and captive portal status.

Source: heartbeat payload fields or future read-only status summary API.

Minimum fields:

- `device_id`
- `network_status`
- `captive_portal_status`
- `checked_at`

Optional fields:

- `confidence`
- `sanitized_reason`

Stale/missing behavior:

- Missing data shows "Network status unavailable."
- Captive portal detected/possible should be a high-priority warning.

Sanitization:

- No portal form data, Fortinet credentials, full portal URLs, tokenized query strings, `magic`, `4Tredir`, opaque `link=` values, raw HTML, screenshots, or cookies.

Exists now: desktop can observe these states locally; web-readable sync is future/deferred.

Example:

```json
{
  "device_id": "device-demo-001",
  "network_status": "online",
  "captive_portal_status": "not-detected",
  "checked_at": "2026-06-18T09:14:00Z",
  "sanitized_reason": "No captive portal detected."
}
```

### Daily Schedule Display

Purpose: show desktop-generated schedule rows after schedule sync exists.

Source: `daily_schedules` or a future read-only schedule summary API.

Minimum fields:

- `device_id`
- `schedule_date`
- `action_key`
- `target_time_local`
- `status`

Optional fields:

- `window_start_local`
- `window_end_local`
- `source`
- `updated_at`

Stale/missing behavior:

- Missing data shows "Schedule unavailable. The desktop may still have a local schedule."
- Sync disabled shows "Schedule sync deferred."
- Missing schedule data must never imply an action is due or safe.

Sanitization:

- No staff identity, credentials, browser state, URLs, raw page content, screenshots, or command intent.

Exists now: schema exists; runtime schedule sync remains disabled/deferred.

Example:

```json
{
  "device_id": "device-demo-001",
  "schedule_date": "2026-06-18",
  "action_key": "clock-in",
  "target_time_local": "08:05",
  "window_start_local": "08:00",
  "window_end_local": "08:10",
  "status": "active",
  "source": "local-generated"
}
```

### Completion/Verification Display

Purpose: show desktop-synced completion and verification state after completion sync exists.

Source: `completion_records` or a future read-only completion summary API.

Minimum fields:

- `device_id`
- `action_date`
- `action_key`
- `state`
- `verification_state`

Optional fields:

- `sanitized_reason`
- `attempted_at`
- `verified_at`
- `updated_at`

Stale/missing behavior:

- Missing data shows "Completion state unavailable or unknown. Check desktop before retrying."
- `verification-unknown` or `verification-failed` must warn the user to check the desktop.
- Missing completion data must never imply action readiness.

Sanitization:

- No confirmation ids if they reveal implementation details, no target DOM ids, no URLs, no raw page evidence, no screenshots, no staff identity, no credentials, no cookies.

Exists now: schema exists; runtime completion sync remains disabled/deferred.

Example:

```json
{
  "device_id": "device-demo-001",
  "action_date": "2026-06-18",
  "action_key": "clock-out",
  "state": "verification-unknown",
  "verification_state": "verification-unknown",
  "sanitized_reason": "Desktop could not verify completion; check desktop.",
  "attempted_at": "2026-06-18T09:10:00Z"
}
```

### Warnings/Events Display

Purpose: show prioritized read-only warnings derived from sanitized synced state.

Source: future read-only summary API; optionally derived client-side from heartbeat/schedule/completion records.

Minimum fields:

- `warning_id`
- `device_id`
- `severity`
- `type`
- `message`
- `created_at`

Optional fields:

- `related_action_key`
- `related_date`
- `source`

Stale/missing behavior:

- Missing warning data should not hide stale heartbeat, sync disabled, or completion unknown warnings if those can be derived from other data.

Sanitization:

- Short sanitized messages only. No raw logs, raw HTML, screenshots, URLs, tokens, credentials, staff identity, or opaque external values.

Exists now: future/deferred.

Example:

```json
{
  "warning_id": "warning-demo-001",
  "device_id": "device-demo-001",
  "severity": "warning",
  "type": "desktop-stale",
  "message": "Desktop status is stale. Check the desktop app.",
  "created_at": "2026-06-18T09:30:00Z"
}
```

### Sync Capability/Status

Purpose: explain which data groups are available, disabled, partial, stale, or deferred.

Source: future read-only summary API derived from configuration and latest synced rows.

Minimum fields:

- `device_id`
- `heartbeat_sync`
- `schedule_sync`
- `completion_sync`
- `last_success_at`

Optional fields:

- `summary`
- `deferred_reason`

Stale/missing behavior:

- Missing sync status shows "Sync disabled or deferred. Local desktop state remains the source of truth."

Sanitization:

- No endpoint URLs, keys, tokens, project refs unless explicitly approved as non-sensitive display metadata.

Exists now: future/deferred.

Example:

```json
{
  "device_id": "device-demo-001",
  "heartbeat_sync": "disabled",
  "schedule_sync": "deferred",
  "completion_sync": "deferred",
  "last_success_at": null,
  "summary": "Sync disabled or deferred."
}
```

### Stale/Offline Logic

- Heartbeat fresh means desktop online.
- Heartbeat stale means desktop stale/unreachable.
- Schedule missing means show "Schedule unavailable."
- Completion missing means show "Completion unknown."
- Sync disabled means show "Sync disabled/deferred."
- Missing web data must never imply action readiness, action due state, or permission to retry.

### Read-Only Access Model

- Future authenticated web users may read only their paired device summaries.
- Direct write access remains closed.
- Future writes go through the S3D Edge Function/API proxy plus device pairing/token.
- Service-role keys remain server-side only.
- Desktop remains the local source of truth.
- Read policies/API responses must be least-privilege and must not authorize from user-editable metadata.

### WEB4 Contract Boundaries

- Web companion may display state.
- Web companion may not trigger Perakam or Fortinet actions.
- No command queue in WEB4.
- No skip/unskip, mode switch, refresh command, or confirmation controls in WEB4.
- No unattended execution pathway.

### Future Contract Dependencies

- Heartbeat runtime write enablement.
- Schedule/completion runtime sync skeleton.
- Edge Function/API contract.
- Authenticated read model and RLS policy design.
- Supervised command queue design only after explicit approval.

## Data Dependencies

Existing/planned data sources:

- `devices` and `heartbeats` exist in the S2A schema, but runtime heartbeat writes remain disabled/deferred.
- `daily_schedules` and `completion_records` exist in the S3B schema, but runtime schedule/completion sync remains disabled/deferred.
- S3D selects a future Edge Function/API proxy plus explicit device pairing/token for writes.

WEB1 can show placeholders until real read data exists. It must not infer schedule or completion state independently of desktop-synced records.

## Future Supervised Controls

These are not part of WEB1. They require explicit later approval, command/control design, and desktop-side safety handling:

- Skip/unskip today or tomorrow.
- Request `notify-only` or `manual-confirm` mode.
- Request status refresh.
- Acknowledge warnings.
- Supervised confirmation workflow, only if explicitly approved later.

No web control may bypass the desktop manual-confirm safety model.

## Forbidden Boundaries

The web companion must not include:

- Perakam login.
- Fortinet login or form submission.
- Credentials.
- Cookies.
- Raw HTML.
- Screenshots.
- Staff ID/name.
- Telegram token/chat ID.
- Full URLs.
- Tokenized query strings.
- Opaque `link=` values.
- Service-role key.
- Direct unattended real action trigger.
- Any bypass of desktop readiness, dry-run, completion blocking, or manual-confirm safety.

## Repo And Hosting Decision

Recommended default: same repo, only if the webapp has a clear isolated app boundary.

Same-repo strengths:

- Keeps desktop, Supabase schema docs, Edge Function/API contract, and web/PWA companion aligned.
- Makes cross-cutting docs and type-contract reviews easier.
- Allows live hosting from the same repository when webapp build/deploy config is isolated.

Same-repo risks:

- Electron-only assets, local config assumptions, or dev secrets could accidentally leak into web builds if boundaries are weak.
- Build/deploy complexity can grow if desktop packaging and web hosting share too much configuration.

Separate-repo strengths:

- Cleaner hosting and deployment separation if the web/PWA becomes large.
- Lower risk of bundling Electron-only files or assumptions.

Separate-repo risks:

- More coordination for Supabase schema, Edge Function/API contracts, and shared status vocabulary.

Decision: start with same-repo planning as the default, with a future `webapp/` boundary only after explicit approval. Move to a separate repo if deployment/build complexity or secret-boundary risk grows.

## Security Model

- Require user authentication before showing device state.
- Use least-privilege reads for the authenticated web user.
- Keep service-role keys server-side only.
- Use the S3D Edge Function/API proxy plus device pairing/token boundary for future writes.
- Keep direct table writes from desktop closed.
- Do not authorize from user-editable metadata.
- Do not expose raw device tokens in browser code.
- Web read access should be scoped to devices owned by or paired to the authenticated user.

## UX Status States

The web/PWA should represent these states clearly:

- Desktop online.
- Desktop stale/unreachable.
- Perakam reachable/unreachable.
- Login/session issue.
- Captive portal detected/possible.
- Next scheduled action.
- Pending manual confirmation.
- Completion verified/unknown/failed.
- Sync disabled/deferred.

## Phased Roadmap

1. WEB1 docs-only plan.
2. WEB2 static/read-only UI design.
3. WEB3 authenticated read-only status.
4. WEB4 schedule/completion display after sync exists.
5. WEB5 supervised command queue design only.
6. WEB6 supervised controls after explicit approval.
7. No unattended execution unless explicitly approved later.
