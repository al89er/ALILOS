# Current Status

## Completed Work

- Electron + TypeScript app shell with a single-instance lock, BrowserWindow, tray show/hide/quit behavior, and local dashboard.
- Plain HTML/CSS/TypeScript renderer reorganized into tabs for Overview, Schedule, Actions, Browser / Site, Network, Telegram, Logs, and Settings.
- Preload bridge exposing a typed `window.alilos` API.
- File-based config under Electron user data with defaults and normalization.
- JSON-line file logging under Electron user data.
- Daily randomized morning/evening action schedule generation with persisted same-day schedules.
- Weekend exclusion and skip/unskip for today/tomorrow.
- Reminder service with system notifications, optional Telegram reminders, duplicate suppression, and retention pruning.
- Telegram settings, test notification, polling, chat authorization, and prefixed status/skip commands.
- Playwright persistent browser controller for manual browser start/stop and Perakam opening.
- Read-only Perakam page classification for dashboard/login/stale-session/unknown/error states.
- Configured target detection for `a50` morning action and `a51` evening action, including duplicate/hidden candidate handling.
- Perakam auto-login using locally encrypted shared UPM credentials, host checks, stale-session recovery, cooldown, and result tracking.
- Manual-confirm web-action flow with readiness checks, confirmation creation/accept/cancel/expiry, dry-run safety checks, guarded one-shot execution, post-click verification, completion tracking, and manual visual verification.
- Manual test-click pipeline for non-primary `a56`/`a57` targets with diagnostics, confirmation, dry-run, and one-shot execution.
- Notify-only network and Perakam reachability monitoring, including captive portal detection/suspected state, retained sanitized evidence, notifications, and portal URL open/copy actions.
- Phase 6A automation telemetry foundation with execution modes, automatic simulated dry-run monitoring in `dry-run` mode, persisted sanitized audit events, dashboard visibility, and disabled-by-default Supabase heartbeat skeleton support.
- UI organization pass completed: existing controls were moved into tab/page sections without changing scheduler, target detection, Telegram, network, confirmation, completion, or config persistence behavior.
- Phase UI-2 Settings editor completed: safe app settings can be viewed/edited from the Settings tab through typed IPC, with Supabase heartbeat URL and Telegram credentials visually masked and blank secret fields preserving existing local values.
- Phase UI-3 / Config-1 Telegram bootstrap completed: `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in `.env.local` can supply missing Telegram secrets at runtime without exposing or auto-persisting them.
- Phase TEST-1 fixture harness completed: `npm test` validates sanitized Perakam fixture structure/redaction assumptions without live Perakam access.
- Project identity guard files/scripts are present in the working tree.
- Architecture direction documented for future Supabase/webapp work: local-first Windows desktop agent now, hosted phone webapp/PWA later, Supabase as a future shared monitoring/control plane, and Telegram active now with possible fallback role later.

## Partially Completed Work

- `BackgroundWorker` is still a heartbeat scaffold. The real implemented behavior is in specialized services such as scheduler, reminder, browser controller, confirmation service, and network monitor.
- Post-click verification is heuristic/read-only. It can mark success, failure, or unknown and asks for visual confirmation when server-side acceptance cannot be confirmed.
- Perakam auto-login exists for Perakam only. Captive portal login remains detection-only.
- Packaging/distribution is not present. There is no `electron-builder` config in the inspected repo.
- Package/startup audit found no package script or packaging metadata yet; only `dev`, `build`, `typecheck`, `test`, and identity-check scripts exist.
- Automated coverage is limited to the Perakam sanitized fixture harness. Runtime behavior still relies on TypeScript checks/build and manual smoke tests.
- Existing Phase 4D design docs are stale relative to current implementation because guarded execution and auto-login have since been implemented.
- Settings can edit selected operational values only. Generated schedules, completion records, automation audit events, raw logs, target mappings, credentials, cookies/session data, screenshots, raw HTML, and personal identifiers remain outside editable settings.
- Supabase heartbeat has a Settings-tab project URL editor and disabled-by-default sender skeleton, but the phone-webapp receiver/dashboard is still not implemented in this repository.
- Supabase is not required for local scheduled operation. The repository has the S2A heartbeat schema migration and S2B sender skeleton only; schedule backup ledger, completion backup ledger, hosted webapp/PWA, and remote command/control queue are not implemented.
- The old Tampermonkey script and old webapp remain fallback/backup references only.
- Live Perakam target-detection smoke testing is paused until intended workplace network access is available. The latest target-detection bugfix is assumed acceptable for now and remains pending workplace manual validation.

## Current Focus

The active implementation focus appears to be hardening the guarded manual-confirm web-action assistant:

- keep real target execution explicit and single-use
- improve Perakam dashboard/control detection
- improve post-click verification and completion state
- improve captive portal evidence and notify-only behavior
- keep Telegram commands prefixed and non-destructive
- add background observability and simulated action telemetry before any broader automation
- maintain local config/log safety and secret hygiene
- keep future Supabase/webapp work phased: documentation first, schema/identity planning next, then status-only heartbeat before any durable ledger or phone dashboard work

## Desktop Operational Readiness

### Current Supabase Status

- S2A status-only heartbeat schema is done.
- S2B disabled-by-default heartbeat skeleton is done.
- S2C/S2D safety review and local dry-run passed.
- S2E heartbeat write-path options are documented.
- Heartbeat remains disabled by default.
- Real Supabase writes are deferred until auth/pairing/write-path authorization is decided.

### Desktop Operational Blockers

- Workplace Perakam smoke test is pending.
- Scheduled dry-run testing is pending.
- Windows packaging is pending.
- Startup/tray reliability testing is pending.

### Readiness Gate

- Do not package for unattended daily use until workplace detection, scheduled dry-run, tray/startup behavior, sleep/wake behavior, and sanitized logging have been tested on the intended Windows environment.

## Known Issues And Gaps

- No automated unit/integration test suite exists.
- No app packaging/signing/install workflow exists.
- Tray icon is currently empty.
- Launch-at-login is not implemented.
- Playwright browser binaries/executable handling for a packaged Windows app is not decided yet.
- `BackgroundWorker` status text may understate implemented services because it says the worker scaffold performs no configured-site clicking, while the separate confirmation/browser services do implement guarded clicking.
- Telegram bot token/chat ID can be stored in local config or supplied by `.env.local`; both are sensitive and must remain untracked/unlogged.
- Perakam selectors and page-text heuristics may drift if the site changes.
- Home/outside-workplace Perakam page variants can differ from the intended workplace network version and are unsupported for now.
- Browser automation and notifications need manual Windows smoke testing.
- Android/mobile use is not planned through Electron; future phone access should be via hosted webapp/PWA.
- The current repository has uncommitted identity-related changes; do not overwrite them during unrelated work.

## Recent Important Implementation Notes

- Perakam default dashboard URL is `https://perakamwaktu3.upm.edu.my/`.
- The legacy Perakam URL `https://perakamwaktu.upm.edu.my/` is still tracked in status snapshots.
- Supported target detection is scoped to the intended workplace dashboard structure represented by `fixtures/perakam/dashboard.sanitized.html`.
- Do not treat home/outside-network page-source differences as a regression in the supported site profile unless the user explicitly asks to support that variant.
- `a50` maps to the morning action and `a51` maps to the evening action in current guarded target execution.
- `a56` and `a57` are allowed only as manual test-click targets in the current code.
- Telegram commands use the configured prefix, defaulting to `alilos`; there are no `/clockin` or `/clockout` commands.
- Captive portal detection is notify-only and does not login.
- Completion records are persisted in local config under `attendance.completionsByDate`; the key is intentionally preserved for compatibility.
- Perakam auto-login shares the `institutionCredential` config fields and keeps legacy Perakam credential fields synchronized.
- Execution mode is stored under `automation.executionMode`; default is `manual-confirm`.
- `dry-run` mode records simulated action results and never calls the real target click method.
- Supabase heartbeat payloads include sanitized app/worker/execution/network/Perakam/Telegram status metadata and exclude schedules, completion records, credentials, Telegram identifiers, personal identifiers, raw HTML, screenshots, cookies, and full sensitive URLs.
- Future Supabase payloads must continue excluding configured-site username/password, cookies/session data, raw page HTML, screenshots, staff ID/name, Telegram token/chat ID, and full tokenized URLs or opaque query strings.
- Generated schedules and completion records should eventually be backed up to Supabase as a durable ledger, after schema and identity planning. They remain local-only today.
- No remote command/control is implemented. Future command queue/control work is S5 and requires explicit approval before implementation.
- Renderer tabs are UI-only; all existing DOM IDs and preload calls remain the behavior boundary.
- The Settings tab can edit worker enable/interval, automation execution mode/interval/dry-run preparation, scheduler windows/grace/reminders, Perakam dashboard URL, and Supabase heartbeat enable/project URL/interval. Supabase URL input is blank on load and only replaces the stored URL when a new URL is entered.
- Telegram token/chat fields are password inputs, blank on load, and preserve existing configured or `.env.local` effective values unless replacements are typed. The renderer receives only configured/env-local/missing status, not actual token/chat values. The command prefix is editable.

## Testing And Build Status

Inferable scripts:

- `npm run typecheck`
- `npm run build`
- `npm test`
- `npm run dev`
- `npm run check:identity`
- `npm run check:supabase`

No docs lint script was found.
