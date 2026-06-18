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
- P1 added minimal `electron-builder` metadata and `npm run package:win` for a Windows unpacked directory package proof at `release/win-unpacked`.
- P2 packaged-app smoke testing is documented but still pending on the intended Windows environment.
- Automated coverage is limited to the Perakam sanitized fixture harness. Runtime behavior still relies on TypeScript checks/build and manual smoke tests.
- Existing Phase 4D design docs are stale relative to current implementation because guarded execution and auto-login have since been implemented.
- Settings can edit selected operational values only. Generated schedules, completion records, automation audit events, raw logs, target mappings, credentials, cookies/session data, screenshots, raw HTML, and personal identifiers remain outside editable settings.
- Supabase heartbeat has a Settings-tab project URL editor and disabled-by-default sender skeleton, but the phone-webapp receiver/dashboard is still not implemented in this repository.
- Supabase is not required for local scheduled operation. The repository has the S2A heartbeat schema migration and S2B sender skeleton only; schedule backup ledger, completion backup ledger, hosted webapp/PWA, and remote command/control queue are not implemented.
- The old Tampermonkey script and old webapp remain fallback/backup references only.
- Workplace Perakam target-detection smoke testing passed in W2 on the intended network with packaged `ALILOS.exe`.

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

- W workplace validation is mostly complete: W1 planning, W2 Perakam workplace smoke, W3 no-live-portal Fortinet smoke, W4 scheduled dry-run, and W5 lock/idle observation passed with packaged `ALILOS.exe`.
- W2 validated `manual-confirm` Perakam behavior: login-required state, dashboard after authentication, visible `a50`/`a51`, hidden sidebar duplicate rejection, no real action, completion records `0`, and sanitized logs.
- W3 validated the current Fortinet no-portal state: network monitor active, internet `online`, captive portal `not-detected`, no form submission, Perakam unaffected, and sanitized logs. Live Fortinet marker validation remains conditional on the portal appearing.
- W4 validated the scheduled dry-run path: temporary local-only near-future evening time, `schedule-due`, Perakam preparation, visible `a51`, simulated-only dry-run, no duplicate/repeat, completion records `0`, and config restored.
- W5 validated lock/idle stability: temporary `dry-run`, local Perakam auto-login enabled, lock and idle intervals stable, network/scheduler/browser/dashboard safe, no execution, completion records `0`, and config restored.
- P packaging/startup local smoke testing passed for the unpacked Windows app, including `ALILOS.exe`, `%APPDATA%\ALILOS`, the project icon, tray show/hide/quit, disabled-by-default launch-at-login, simulated `--hidden-at-login`, and packaged Playwright launch.
- Remaining release risks: full sleep/wake suspend-resume, real Windows sign-in/reboot launch-at-login, visual tray-menu verification, live Fortinet portal marker validation, real scheduled manual-confirm at an actual clock-in/out time, and any fully unattended real action remain unvalidated.

### Readiness Gate

- Do not rely on unattended daily use until workplace detection, scheduled dry-run, real sign-in startup, sleep/wake behavior, locked-session behavior, and sanitized logging have been tested on the intended Windows environment.
- W workplace validation must use `dry-run` or `manual-confirm` by default. Do not allow an automatic real attendance click during validation unless the user explicitly approves that later in the correct attendance window.
- Stop validation immediately if there is unexpected real-action risk, unsanitized credential or tokenized URL logging, repeated browser crashes, or ambiguous Perakam target detection.

### Packaged Windows Smoke-Test Checklist

- Run `npm run package:win` and verify `release/win-unpacked` exists.
- Launch `release/win-unpacked/ALILOS.exe`.
- Confirm the app opens, the tray icon/menu works, close hides to tray, and Quit exits.
- Confirm the packaged app and tray use the project-owned ALILOS icon rather than the default Electron icon.
- Confirm config and logs use packaged Electron `userData`, not repository folders.
- Packaged Windows app internals use `ALILOS`; older smoke-test config/logs may remain under the old trailing-dot `A.L.I.L.O.S.` userData folder and can be manually removed after confirming the new app works.
- Confirm local dev secrets are not bundled, and `.env.local` is not packaged.
- Confirm worker services start, today's schedule loads or generates, Telegram polling behavior is unchanged, the network monitor starts, and Supabase heartbeat remains disabled by default.
- Confirm Playwright browser launch works from the packaged app. If it fails, capture sanitized error/log text only.
- Do not broaden Perakam selectors or detection behavior during packaging smoke testing.
- Keep execution mode as `dry-run` or `manual-confirm`; do not perform an unattended real scheduled action.
- Do not store or send sensitive data during the test.

## Known Issues And Gaps

- No automated unit/integration test suite exists.
- No signed installer or auto-update workflow exists.
- Launch-at-login is implemented for packaged Windows builds, disabled by default, and starts hidden to tray when launched with `--hidden-at-login`.
- Packaged Playwright launch passed in local unpacked smoke testing; real release machines should still verify browser binary availability.
- The high-severity npm advisory reported during packaging setup requires separate review, not an automatic fix during packaging work.
- Electron is upgraded to `39.8.10`; packaged Windows smoke testing has covered the renamed `ALILOS.exe`, `%APPDATA%\ALILOS` userData, and the project-owned app/tray icon.
- `BackgroundWorker` status text may understate implemented services because it says the worker scaffold performs no configured-site clicking, while the separate confirmation/browser services do implement guarded clicking.
- Telegram bot token/chat ID can be stored in local config or supplied by `.env.local`; both are sensitive and must remain untracked/unlogged.
- Perakam selectors and page-text heuristics may drift if the site changes.
- Home/outside-workplace Perakam page variants can differ from the intended workplace network version and are unsupported for now.
- Workplace browser automation dry-run and notification-adjacent audit behavior passed in W4; remaining checks are operational release-readiness items.
- W workplace validation is mostly complete; remaining work is operational/release hardening rather than broad detector changes.
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
- Launch-at-login uses top-level `startup.launchAtLogin`, remains disabled by default, uses Windows login items only in packaged ALILOS builds, and starts hidden to tray when launched at sign-in.
- Telegram token/chat fields are password inputs, blank on load, and preserve existing configured or `.env.local` effective values unless replacements are typed. The renderer receives only configured/env-local/missing status, not actual token/chat values. The command prefix is editable.
- P packaging/startup track is mostly complete after P12 local validation; remaining release risks are optional installer/signing, real Windows sign-in/reboot testing, and full sleep/wake testing.
- Local Perakam auto-login is enabled on the test machine and succeeded during W4/W5 without credential-value logging. Treat it as an operational setting to intentionally enable, disable, or document before future workplace tests.
- Next recommended major track: O operational readiness / release-candidate checklist. S3 Supabase schedule/completion sync planning remains a later option only after explicit approval.
- O1 operational readiness checklist is documented in `docs/OPERATIONAL_READINESS.md`: monitored `manual-confirm`/`dry-run` local use is acceptable; fully unattended real execution remains no-go.

## W Workplace Validation Track

- W1 workplace validation plan: document the safe checklist, stop conditions, and evidence to collect before live network testing.
- W2 manual workplace browser/login/button detection smoke: passed with packaged `ALILOS.exe`; no confirmation, execution, completion record, credential logging, raw HTML, cookie, or tokenized `link=` logging was observed.
- W3 Fortinet captive portal live detection smoke: passed for the no-live-portal case. No portal form was opened or submitted; log review found no credential, cookie, raw HTML, Fortinet marker value, `magic`, `4Tredir`, or tokenized portal URL/path/query/hash evidence.
- W4 scheduled dry-run/manual-confirm test: passed in `dry-run` mode. The monitor observed the due evening action, prepared Perakam, detected visible dashboard `a51`, recorded simulated-only audit events, and kept real attendance behind explicit confirmation.
- W5 sleep/wake/locked-session observation: lock and idle observation passed. Full sleep/wake suspend/resume remains untested; tray/window hide/show IPC completed, but visual tray-menu verification was not performed during the scripted observation.
- W6 workplace validation consolidation: complete. W track is mostly complete; pending items are release-readiness checks, optional installer/signing, and explicitly approved future sync/planning work.

## Testing And Build Status

Inferable scripts:

- `npm run typecheck`
- `npm run build`
- `npm test`
- `npm run dev`
- `npm run check:identity`
- `npm run check:supabase`

No docs lint script was found.
