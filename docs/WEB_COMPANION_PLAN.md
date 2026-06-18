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
