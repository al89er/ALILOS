# Dev Notes

## PARITY1B Completion Target

- A.L.I.L.O.S. is targeting a generic automated scheduled website clicker: desktop agent, separate Playwright browser, startup/background operation, local auto-login, stale recovery, captive portal reconnect, Supabase sync/control plane, and webapp monitoring/control.
- Telegram is paused/deprioritized. Existing Telegram code remains a secondary local notification/command path, but Telegram parity is not required for completion.
- `docs/LEGACY_PARITY_PLAN.md` is the current parity matrix and fastest PARITY2-PARITY13 sequence.
- PARITY2 adds schema-only Supabase support for `skip_dates`, `event_logs`, `command_requests`, and `command_events`. Runtime sync and command processing remain disabled/deferred.
- PARITY3 adds disabled-by-default `paritySync` config, read-only dashboard status, sanitized shared payload/command types, and a `ParitySyncService` skeleton.
- PARITY4 adds gated status publishing through the Edge Function/API proxy path. It remains disabled by default, uses publishable/anon keys only, sends sanitized device/status payloads, optionally sends generated status events when `logUploadEnabled` is true, and does not process remote commands.
- PARITY4B adds the Supabase Edge Function at `/functions/v1/alilos-parity-status`. The function requires a registered non-personal `device_id`, uses the service-role key only from the Edge Function environment, writes sanitized `heartbeats` and optional generated `event_logs`, and leaves direct `anon` / `authenticated` table privileges closed.
- PARITY4C documents the deployment/smoke runbook in `docs/PARITY_STATUS_DEPLOYMENT.md` and a placeholder-only payload in `docs/examples/parity-status-smoke.json`; no deployment, secrets, RLS changes, command processing, webapp code, or default sync enablement are included.
- PARITY5 adds disabled-by-default skip-date sync through `supabase/functions/alilos-skip-sync`. Remote rows are scheduling-only, preserve local skips on disagreement, and cannot trigger configured-site action, command processing, or webapp behavior.
- PARITY6 adds disabled-by-default schedule/completion sync through `supabase/functions/alilos-schedule-completion-sync`. It backs up sanitized local schedules/completion markers, surfaces remote-only completion markers as warnings, and cannot trigger configured-site action, command processing, or webapp behavior.
- PARITY7 adds disabled-by-default command request/result processing through `supabase/functions/alilos-command-sync`. It handles `request-status-refresh`, `request-dry-run`, `recalculate-today-schedule`, and `cancel-confirmation`; PARITY10B adds guarded `perform-configured-action` handling behind `paritySync.remoteActionEnabled`.
- PARITY8 adds a dependency-free static read-only web/PWA monitor under `webapp/` and the `supabase/functions/alilos-dashboard-read` read proxy. It has no command buttons and falls back to mock data when live read config/data is unavailable.
- PARITY9 adds safe web command controls for status refresh, dry-run/check, recalculate today schedule, and cancel confirmation. They create allowlisted pending commands only; they do not perform configured-site clicks.
- PARITY9B aligns the webapp with the existing three-tab mental model: Dashboard, Skip dates, and Log history. Log history displays sanitized event summaries only.
- PARITY9C makes the Skip dates calendar interactive for whole-day scheduling skip/unskip through `supabase/functions/alilos-skip-sync`. It does not create command requests or configured-site actions.
- PARITY9D documents the deployed safe-loop smoke test in `docs/PARITY_SAFE_LOOP_SMOKE.md`. It validates deployed Edge Functions, existing-device setup, status publishing, dashboard reads, skip upsert/delete, safe command processing, schedule/completion visibility, sanitized logs, and rollback without adding runtime code.
- PARITY10B adds guarded configured-action requests through the existing desktop guard pipeline. It remains disabled by default through `paritySync.remoteActionEnabled = false`, requires `manual-confirm`, and must not be relied on operationally before PARITY10C field validation.
- PARITY10C field-validation planning is documented in `docs/PARITY_REMOTE_ACTION_FIELD_VALIDATION.md`. Validate disabled-gate rejection first, guard-failure rejection second, and a supervised legitimate-window action last; abort on wrong page, ambiguous target, captive portal uncertainty, unsanitized logs, command payload mismatch, date mismatch, prior completion, desktop offline/sleeping, or user uncertainty.
- DEPLOY1 safe-loop setup guidance is documented in `docs/DEPLOY1_SAFE_LOOP_CHECKLIST.md`. It is the first live Supabase/webapp/desktop smoke pass and keeps `remoteActionEnabled=false`, safe commands only, no real configured-site click, placeholder-only command snippets, and explicit rollback.
- DEPLOY1B exposes `paritySync` in the desktop Settings tab for live safe-loop setup. It preserves disabled defaults, masks the publishable/anon key after load, rejects service-role-looking keys, and reconfigures `ParitySyncService` after settings are saved.
- Do not implement migrations, captive portal reconnect, or unattended execution from these notes alone.
- Credentials stay local: configured website credentials and future captive portal credentials must not be sent to Supabase or the webapp, and must not appear in logs/docs. Service-role keys never ship in desktop or webapp clients.

## Install

Use the checked-in lockfile:

```sh
npm install
```

The app depends on Electron, TypeScript, and Playwright. If Playwright browser binaries are missing on a new machine, follow Playwright's install guidance for the local environment.

## Run And Check

```sh
npm run typecheck
npm run build
npm test
npm run dev
npm run package:win
```

`npm run dev` builds first, then starts Electron.

Identity guard commands:

```sh
npm run check:identity
npm run check:supabase
```

These are local safety checks. They are not runtime app checks.

## Important Source Files

| File | Why it matters |
| --- | --- |
| `src/main/main.ts` | Service wiring, IPC handlers, app lifecycle, snapshots, Perakam auto-login orchestration. |
| `src/main/config-store.ts` | Config defaults, normalization, persistence. |
| `src/main/logger.ts` | Local log file writer/reader. |
| `src/main/telegram-service.ts` | Secondary Telegram notifications and prefixed commands; paused/deprioritized for the completion target. |
| `src/worker/scheduler.ts` | Morning/evening action schedule generation and status. |
| `src/worker/reminder-service.ts` | Reminder notification timing and suppression. |
| `src/worker/browser-controller.ts` | Playwright browser, Perakam detection, DOM control detection/clicks, verification. |
| `src/worker/automation-monitor.ts` | Phase 6A due-action monitoring and simulated dry-run telemetry. |
| `src/worker/automation-audit.ts` | Bounded sanitized automation audit event persistence. |
| `src/worker/heartbeat-service.ts` | Disabled-by-default sanitized Supabase heartbeat sender/status. |
| `src/worker/parity-sync-service.ts` | Disabled-by-default Supabase parity-sync service; status publishing, skip sync, schedule/completion sync, and dry-run/non-clicking command sync remain individually gated. |
| `src/worker/confirmation-service.ts` | Manual-confirm action state machine and safety checks. |
| `src/worker/test-click-service.ts` | Guarded non-primary test-click pipeline. |
| `src/worker/network-monitor.ts` | Internet, Perakam reachability, captive portal monitoring. |
| `src/preload/preload.ts` | Renderer API boundary. |
| `src/shared/types.ts` | Cross-process types and API contract. |
| `src/renderer/index.html` | Tabbed dashboard markup. |
| `src/renderer/renderer.ts` | Dashboard rendering, tab navigation, form handling, and UI actions. |
| `src/renderer/styles.css` | Tabbed dashboard styling and responsive layout. |

## App Icon Assets

- `assets/app-icon.svg` is the canonical project-owned atom-like ALILOS icon source.
- `assets/app-icon.ico` is generated from the SVG for Windows packaging, BrowserWindow, and tray use. It should include 16, 24, 32, 48, 64, 128, and 256 px entries with transparency preserved.
- Do not regenerate the SVG from the `.ico`; treat the `.ico` as the derived Windows asset.

## Config Storage

Runtime config is stored at:

```text
<Electron userData>/config.json
```

The exact path is shown in dashboard snapshots as `configPath`. Config includes schedules, skips, completions, Telegram settings, UPM credential metadata/encrypted password, Perakam settings, network settings, automation execution mode/audit events, and disabled-by-default Supabase heartbeat settings.

Telegram secret precedence is:

1. persisted local app config values
2. `.env.local` values for missing `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID`
3. missing/not configured

`.env.local` values are runtime bootstrap defaults only and are not written into `config.json` automatically.

Supabase heartbeat uses the same bootstrap rule for missing `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_ANON_KEY`; the key is used only in the main/worker process and is not sent to the renderer.

Do not commit local config files. Do not paste private config values into docs or chat.

## Logs

Logs are stored at:

```text
<Electron userData>/logs/alilos.log
```

Each line is a JSON object with timestamp, level, and message. The renderer displays recent entries.

## Renderer Tabs

- Overview: app/worker health, generated action times, next action, last result, browser/site state, network/captive portal state, Telegram polling, and recent events.
- Schedule: today's schedule, reminder state, skipped dates, and skip/unskip controls.
- Actions: guarded manual-confirm morning/evening controls plus manual `a56`/`a57` test-click diagnostics.
- Browser / Site: Playwright browser controls, Perakam page state, target detection diagnostics, and Perakam auto-login controls.
- Network: notify-only connectivity, Perakam reachability, captive portal evidence, portal actions, and network monitor settings.
- Telegram: masked Telegram token/chat settings, command prefix summary, and test notification.
- Logs: recent logs plus Phase 6A automation/heartbeat telemetry.
- Settings: safe editor for worker, automation, scheduler window/reminder, Perakam dashboard URL, legacy heartbeat settings, and parity sync safe-loop settings, plus read-only config/log paths and active setting summaries.

## Webapp

`webapp/` contains the PARITY8 monitor, PARITY9 safe non-clicking controls, PARITY9B three-tab workflow, and PARITY9C whole-day skip/unskip calendar controls. It is plain HTML/CSS/JavaScript with no package install, no build step, no service-role key, and no direct table access. Runtime config is represented by placeholder names in `webapp/config.example.js`: `window.ALILOS_CONFIG.supabaseUrl`, `supabaseAnonKey`, and `deviceId`; the older `window.ALILOS_WEBAPP_CONFIG` / `VITE_*` names are accepted as aliases only. Real local `webapp/config.js` is ignored by Git. PARITY9D smoke testing uses that local-only config and must never commit real project URLs, keys, device ids, or credentials.

Live data comes from `/functions/v1/alilos-dashboard-read` when deployed and configured. It may include sanitized device, schedule, completion, command, monthly skip-date, and event-log summaries. Missing config, unavailable Supabase, or missing synced data shows static/mock unavailable states and must not imply action readiness. DEPLOY1 validates this live path with `remoteActionEnabled=false`. GitHub Pages/browser calls require CORS-enabled Edge Functions; browser `Failed to fetch` usually means CORS, network reachability, or function availability, not a reason to expose service-role keys or open direct table grants.

Safe command creation goes to `/functions/v1/alilos-command-sync` with `operation: "create-command"`. PARITY7 non-clicking commands remain available when explicitly enabled. PARITY10B also allows `perform-configured-action` as a pending guarded request with constrained `actionKey`, `scheduleDate`, and guard metadata. The webapp has no credential forms, arbitrary command input, raw JSON editor, service-role key, or browser automation; desktop execution is rejected unless local `paritySync.remoteActionEnabled` is true and existing guards pass. Use `docs/PARITY_REMOTE_ACTION_FIELD_VALIDATION.md` before relying on this path operationally.

The Skip dates tab uses `/functions/v1/alilos-skip-sync` with `upsert-skip` and `delete-skip` for whole-day skip/unskip only. These changes affect scheduling only and never trigger configured-site navigation, confirmation, clicking, command requests, credentials, or browser automation. Action-specific skip controls remain a future refinement.

This tab layout is renderer-only. Do not change target IDs, confirmation behavior, persisted key names, or browser/controller behavior when adjusting tab placement.

## Settings Editor Safety

- The Settings tab edits only selected operational settings: worker enable/interval, Windows launch-at-login, automation execution mode/interval/dry-run browser preparation, scheduler windows/grace/reminders, Perakam dashboard URL, Supabase heartbeat enable/project URL/interval, and the parity sync safe-loop flags.
- The Parity Sync / Webapp Supabase Sync section is separate from the legacy Heartbeat section. It stores only local desktop config values, uses publishable/anon keys only, leaves the key field blank after load to preserve the saved key, and rejects service-role-looking keys before saving.
- `paritySync.remoteActionEnabled` remains false by default. Keep it off during DEPLOY1 and enable it only for supervised PARITY10C Phase B/C validation after explicit approval.
- Launch-at-login is backed by top-level `startup.launchAtLogin`. It must not change execution mode, scheduler behavior, or any configured action path.
- Supabase heartbeat is displayed as configured/not configured plus host and key source only. The URL input is blank on load; saving a blank URL preserves the existing local Supabase URL. The publishable key is configured through local config or `.env.local`, not exposed in the renderer.
- Telegram token and chat fields are password inputs and are blank on load. The renderer receives only configured/env-local/missing status, never the actual token or chat ID. Saving blank fields preserves existing local or `.env.local` effective values; typing a new value saves it into local app config.
- The Settings tab does not edit generated schedules, completion records, automation audit events, target mappings, UPM credentials, cookies/session data, screenshots, raw HTML, staff identifiers, or raw log files.
- Main-process settings normalization owns persistence and validation. Renderer validation is only a first-pass usability layer.

## Testing Telegram Safely

- Store real bot token/chat ID in `.env.local` or local app config only.
- `.env.local` may bootstrap Telegram with `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` when local app config secrets are blank.
- Never commit or paste tokens or chat IDs.
- Use the dashboard's test notification first.
- Telegram commands require the configured prefix. With the default prefix, use `/alilos_status`, `/alilos_skip`, and related skip/status commands.
- Current Telegram commands do not perform real configured-target clicks.

## Testing Perakam Detection Safely

- Live target-detection smoke testing is paused while only home/outside-workplace network access is available.
- Home/outside-workplace Perakam page variants are unsupported for now. Do not broaden selectors, add alternate target IDs, or weaken dashboard detection for those variants unless explicitly requested later.
- Treat `fixtures/perakam/dashboard.sanitized.html` as the supported structural reference for target detection until workplace-network testing is available again.
- Start the browser from the dashboard.
- Open Perakam manually through the dashboard button.
- Log in manually or use saved Perakam auto-login only when intentionally testing that feature.
- Use "Refresh status" to inspect page state and control availability.
- Target detection must prefer visible dashboard tiles over duplicate hidden/sidebar IDs. A zero-sized anchor can still be valid when a meaningful dashboard descendant is visible and the clickable candidate is safe.
- Do not request/accept real-action confirmation unless you are in the correct action window and intend the action.
- Use dry-run before execution. Dry-run performs safety checks only.
- Phase 6A `automation.executionMode = "dry-run"` simulates due actions automatically and records telemetry only. It does not click primary target buttons.
- Use the `a56`/`a57` manual test-click section for pipeline testing when appropriate; these are not primary targets.

## Desktop Operational Readiness Checklist

### Current Supabase Status

- S2A status-only heartbeat schema is done.
- S2B disabled-by-default heartbeat skeleton is done.
- S2C/S2D safety review and local dry-run passed.
- S2E heartbeat write-path options are documented.
- S3A schedule/completion sync planning is documented.
- S3B schedule/completion schema migration is drafted.
- PARITY2 skip/log/status/command schema migration is added.
- PARITY3 disabled desktop parity-sync skeleton is added.
- PARITY4 gated parity status publishing is added; defaults remain disabled and the desktop uses only publishable/anon credentials.
- PARITY4B status proxy is added under `supabase/functions/alilos-parity-status`; it performs the server-side `devices` check, `heartbeats` upsert, and optional sanitized `event_logs` insert.
- PARITY4C deployment/smoke documentation is added. Use it before any live Edge Function deploy or desktop parity sync smoke.
- PARITY5 skip sync is added under `supabase/functions/alilos-skip-sync`; `ParitySyncService` can list, upsert, and delete skip rows only when `skipSyncEnabled` is explicitly true.
- PARITY6 schedule/completion sync is added under `supabase/functions/alilos-schedule-completion-sync`; `ParitySyncService` can fetch current-day remote state and upload sanitized local schedules/completion rows only when `scheduleCompletionSyncEnabled` is explicitly true.
- S3D schedule/completion write-path decision is documented: future writes should use an Edge Function/API proxy plus explicit device pairing/token.
- WEB1 web/PWA companion planning is documented in `docs/WEB_COMPANION_PLAN.md`.
- WEB2 static/read-only web companion UI design is documented in `docs/WEB_COMPANION_PLAN.md`.
- WEB3 legacy webapp relationship is documented in `docs/WEB_COMPANION_PLAN.md`.
- WEB4 read-only web companion data contracts are documented in `docs/WEB_COMPANION_PLAN.md`.
- RC1 monitored real-world observation plan is documented in `docs/OPERATIONAL_READINESS.md`.
- Parity sync remains disabled by default and command processing remains unimplemented.
- Command processing and webapp access remain deferred until auth/pairing/control-path authorization is expanded beyond status, skip, and schedule/completion sync.

### Desktop Operational Blockers

- W workplace validation is mostly complete: W1 planning, W2 Perakam workplace smoke, W3 no-live-portal Fortinet smoke, W4 scheduled dry-run, and W5 lock/idle observation passed with packaged `ALILOS.exe`.
- W2 validated login-required, dashboard, visible `a50`/`a51`, hidden sidebar duplicate rejection, no real action, completion records `0`, and sanitized logs in `manual-confirm`.
- W3 validated active network monitor, internet `online`, captive portal `not-detected`, no form submission, Perakam unaffected, and sanitized logs. Live Fortinet portal marker validation remains conditional on the portal appearing.
- W4 validated scheduled dry-run: temporary local-only near-future evening time, `schedule-due`, page preparation, visible `a51`, simulated-only result, no duplicate/repeat, completion records `0`, and config restored.
- W5 validated lock/idle stability: temporary `dry-run`, local Perakam auto-login enabled, lock and idle intervals stable, network/scheduler/browser/dashboard safe, no execution, completion records `0`, and config restored.
- P packaging/startup local smoke testing passed for `ALILOS.exe`, `%APPDATA%\ALILOS`, project-owned icons, tray show/hide/quit, disabled-by-default launch-at-login, simulated `--hidden-at-login`, and packaged Playwright launch.
- Remaining release risks: full sleep/wake suspend-resume, real Windows sign-in/reboot launch-at-login, visual tray-menu verification, live Fortinet portal marker validation, real scheduled manual-confirm at an actual clock-in/out time, and any fully unattended real action remain unvalidated.

### Workplace Smoke-Test Checklist

- Run from the workplace/hospital network.
- Verify login detection.
- Verify dashboard detection.
- Verify visible `a50` / `a51` target availability.
- Verify hidden sidebar candidates are ignored.
- Verify manual-confirm and dry-run behavior.
- Verify no duplicate action after a local completion record exists.
- Verify logs contain sanitized status only.

### Scheduled Dry-Run Checklist

- Keep safe mode as `dry-run` or `manual-confirm`.
- Verify generated times persist for the day.
- Verify weekend/skip behavior.
- Verify missed-action grace logic.
- Verify local completion records block repeats.
- Do not perform a real unattended action during the test.

### Packaging / Startup Checklist

- Run `npm run package:win` and verify `release/win-unpacked` exists.
- Launch `release/win-unpacked/ALILOS.exe`.
- Confirm the app opens, the tray icon/menu works, close hides to tray, and Quit exits.
- Confirm the packaged app and tray use the project-owned ALILOS icon rather than the default Electron icon.
- Confirm config and logs use packaged Electron `userData`, not repository folders.
- Packaged Windows app internals use `ALILOS`; older smoke-test config/logs may remain under the old trailing-dot `A.L.I.L.O.S.` userData folder and can be manually removed after confirming the new app works.
- Confirm existing local dev secrets are not bundled, and `.env.local` is not packaged.
- Confirm worker services start.
- Confirm scheduler loads or generates today's times.
- Confirm Telegram polling behavior is unchanged.
- Confirm the network monitor starts.
- Confirm Supabase heartbeat remains disabled by default.
- Confirm Playwright browser launch works from the packaged app.
- If browser launch fails, capture sanitized error/log text only.
- Do not broaden selectors or change Perakam detection during the packaging test.
- Keep mode as `dry-run` or `manual-confirm`.
- Do not perform an unattended real scheduled action.
- Do not store or send sensitive data.
- P12 local smoke status: packaged Playwright launch passed, `.env.local` was not packaged, no credential or tokenized portal URL log matches were observed, and no ALILOS process remained after Quit.
- Known remaining concerns: installer/signing are not implemented, real Windows sign-in/reboot startup is untested, full sleep/wake suspend/resume is pending, and the high-severity npm advisory requires separate review rather than automatic fix.

## Packaging / Startup Audit

- Existing scripts include `dev`, `build`, `package:win`, `typecheck`, `test`, `check:identity`, and `check:supabase`.
- Minimal `electron-builder` metadata is configured for a Windows unpacked directory package proof; no installer or auto-update is configured.
- Window close hides to tray; tray Show/Hide/Quit behavior exists.
- App lifecycle uses a single-instance lock, starts services after `app.whenReady()`, keeps the process resident on `window-all-closed`, and stops services during `before-quit`.
- Launch-at-login is implemented for packaged Windows builds with `app.setLoginItemSettings()` / `app.getLoginItemSettings()`, `process.execPath`, and `--hidden-at-login`.
- Config and logs use Electron `userData`, which is suitable for packaged app state.
- Playwright is a runtime dependency; local packaged smoke testing has confirmed browser launch, but release machines should still verify browser binary installation/executable resolution.
- Recommended next operational step: run the O operational readiness / release-candidate checklist before relying on unattended startup or scheduled browser automation.

## Launch-at-Login Behavior

- Config location: top-level `startup.launchAtLogin`, separate from `automation`, with `false` as the default.
- Settings surface: exposed through `AppSettingsSnapshot` / `AppSettingsInput` with one checkbox under General / Automation, worded `Start ALILOS when I sign in to Windows`.
- Default behavior: launch-at-login remains disabled. Normal manual launches continue to show the main `A.L.I.L.O.S.` window.
- Enabled behavior: Windows sign-in launch should start ALILOS resident in the tray, with the main window hidden until tray Show or second-instance activation.
- Startup marker: configure login item args with `--hidden-at-login` and treat only that argument as a tray-hidden startup request.
- Electron API: uses `app.setLoginItemSettings()` when settings are applied, and `app.getLoginItemSettings()` for effective status/diagnostics.
- Packaged Windows behavior: use `process.execPath` for the login item path. The packaged product/executable name is `ALILOS`; userData is `%APPDATA%\ALILOS`.
- Dev behavior: avoid registering dev runs as a Windows login item by default. If a dev-only diagnostic is needed, keep it explicit and do not persist surprising startup entries.
- Safety boundary: enabling launch-at-login must not change `automation.executionMode`, scheduler generation, Browser/Perakam startup, Telegram, Supabase heartbeat, or Fortinet detection. No automatic real attendance action should occur beyond the existing configured mode/schedule guardrails.
- Manual disable: uncheck the Settings checkbox and save; if the app cannot be opened, disable `ALILOS` in Windows Startup Apps or Task Manager Startup apps, then relaunch and save disabled.

## W Workplace Validation Track

- W1 workplace validation plan: docs-only planning for safe workplace validation, evidence to collect, and stop conditions.
- W2 manual workplace browser/login/button detection smoke: passed in packaged mode. Login-required state was seen before authentication, dashboard state was seen after manual authentication, `a50` and `a51` were available from visible dashboard candidates, hidden sidebar duplicates were ignored, and log/config review found no credential, cookie, raw HTML, tokenized `link=`, completion record, or real execution evidence.
- W3 Fortinet captive portal live detection smoke: passed for the observed no-live-portal case. If a Fortinet portal appears later, repeat W3 to verify `authupm.upm.edu.my` dynamic-port detection and safe marker evidence. Current log/config review found no credential, cookie, raw HTML, Fortinet marker value, `magic`, `4Tredir`, or tokenized portal URL/path/query/hash evidence.
- W4 scheduled dry-run/manual-confirm test: passed. Temporary changes were limited to local userData config and restored afterward: execution mode `manual-confirm` -> `dry-run` -> `manual-confirm`, evening time `17:08` -> test time -> `17:08`, and monitor interval `30` -> requested `5` seconds with effective clamped `15` seconds -> `30`. No completion record, real execution, credential value, cookie, raw HTML, screenshot, full URL, or `link=` value was observed in logs.
- W5 sleep/wake/locked-session observation: lock and idle observation passed. No real action, completion record, credential value, cookie, raw HTML, screenshot, full tokenized URL, or `link=` value was observed. Scripted tray/window hide/show IPC completed, but visual tray-menu verification and full sleep/wake suspend/resume remain pending.
- W6 workplace validation consolidation: complete. W track is mostly complete; remaining items belong in an O operational readiness / release-candidate checklist unless the user explicitly chooses S3 Supabase schedule/completion sync planning.

Operational notes after W validation:

- O1 operational readiness guidance lives in `docs/OPERATIONAL_READINESS.md`. Treat it as the current release-candidate checklist before monitored local use.
- O3 real-machine observation passed for packaged launch, scripted window hide/show, clean quit, sanitized logs, launch-at-login disabled, and completion records `0`. Visual tray-menu click verification, real sign-in/reboot launch-at-login, and full sleep/wake suspend-resume remain pending.
- O4 consolidated the O track as mostly complete. Monitored `manual-confirm`, `dry-run`, and `notify-only` local use are acceptable; fully unattended real execution remains no-go. Next work should be RC observation tasks, S3E Edge Function/API contract planning, or WEB5 authenticated read model/RLS planning only after explicit approval.
- RC1 is planned for one actual scheduled `manual-confirm` cycle with the user physically present. It is not approval for unattended execution or for Codex to perform a real action.
- RC2 adds a schedule-only recalculation helper for accelerated near-future scheduler validation. It regenerates today's local generated schedule from the current windows, clears reminder markers for today, and does not touch Perakam, confirmations, completions, Supabase, Telegram, or Fortinet behavior.
- RC2 accelerated workplace validation passed: near-future evening recalculation reached due/grace, visible dashboard candidate was found while hidden sidebar duplicate was ignored, confirmation plus dry-run passed, manual-confirm cancel passed, no real action occurred, no false completion record was created, and checked notes remained sanitized.
- RC3 packaged validation passed. The latest `ALILOS.exe` includes the helper and safety label; recalculation alone did not open browser/Perakam, click Perakam, create a completion record, or create an execution result. Validation and packaging passed.
- Local Perakam auto-login is enabled on the test machine and succeeded during W4/W5 without credential-value logging. Intentionally decide whether it should be enabled or disabled before future tests.
- Fully unattended real attendance action is not approved or validated.
- Supabase parity sync remains disabled by default; do not enable status, skip, schedule/completion, command sync, or `paritySync.remoteActionEnabled` against a live project without explicit approval and the deployment runbooks, especially `docs/PARITY_SAFE_LOOP_SMOKE.md` and PARITY10C for guarded action field validation.
- Installer and signed release remain optional release decisions, not blockers for local unpacked operation.

Safe defaults:

- Prefer `dry-run` for scheduled validation and `manual-confirm` only when a human is watching.
- Do not perform an automatic real attendance click during W validation unless explicitly approved later in the correct real attendance window.
- Keep Supabase heartbeat disabled unless a later Supabase write-path task explicitly enables it.
- Keep launch-at-login disabled unless W5 is explicitly testing startup behavior.
- Do not change Perakam selectors, Fortinet detection, scheduler behavior, Telegram behavior, Supabase behavior, packaging config, or credential storage during W validation.

Observe and record only sanitized status:

- Perakam login/dashboard state and target availability.
- Fortinet captive portal state and safe reason text.
- Network monitor internet/Perakam/captive-portal state.
- Scheduler next action, generated times, skip/weekend/grace state, and completion-blocking state.
- Whether behavior differs between packaged `ALILOS.exe` and dev mode, if both are used.

Stop conditions:

- Unexpected path toward a real attendance action.
- Credential, cookie, raw HTML, screenshot, staff identity, full portal URL, tokenized path, or query string appears in logs or UI export.
- Repeated browser crash or packaged Playwright launch failure.
- Ambiguous target detection, such as multiple visible primary targets or disagreement between dashboard state and action readiness.

RC1 notes:

- Use packaged `ALILOS.exe`, `manual-confirm`, and one real scheduled morning/evening cycle.
- Keep the user physically present; the user manually confirms or cancels.
- Abort on wrong target, unexpected unattended click, captive portal uncertainty, stale/login loop, target ambiguity, unsanitized logs, app crash, or user absence.
- Record date/time, environment, mode, scheduled action, observed states, confirm/cancel outcome, completion state, verification state, sanitized log review, result classification, and follow-up.

### npm Advisory Audit

- `npm audit --omit=dev` reports zero production dependency vulnerabilities.
- Full `npm audit` reports one high-severity advisory group against direct dev dependency `electron@33.4.11` at `node_modules/electron`, with advisories covering multiple Electron runtime issues.
- The advisory is not introduced by Playwright or Electron Builder; Electron Builder uses the direct Electron dependency as the packaged runtime version.
- npm reports a fix only through `npm audit fix --force`, which would install `electron@42.4.1` as a breaking major upgrade. Do not apply the automatic force fix during packaging smoke-test work.
- Treat the Electron major upgrade as a separate targeted task with release-note review, local validation, and packaged Windows smoke testing.

### Targeted Electron Upgrade Plan

- Current package metadata requests `electron@^33.2.1`; the lockfile currently resolves `electron@33.4.11`.
- Latest Electron seen from npm during P5 target-version check is `42.4.1`.
- Recommended first upgrade target is `electron@39.8.10`, the latest Electron 39 patch seen from npm. P3's audit range flagged `electron <=39.8.4`, so `39.8.10` is past the advisory cutoff while avoiding an immediate jump to Electron 42.
- Current packaging metadata uses `electron-builder@26.15.3`, `@electron/rebuild@4.0.4`, and `npm run package:win` builds `dist/main/main.js` into a Windows x64 unpacked directory.
- Installed Electron Builder metadata does not show a narrow Electron peer-version constraint; `@electron/rebuild@4.0.4` lists Electron 39 in its own development metadata, so Electron 39 appears like a reasonable first compatibility target. Treat Electron Builder updates as a follow-up only if packaging validation fails.
- No explicit in-repo Node/Chromium API assumptions are documented beyond the Electron runtime, BrowserWindow/preload/tray lifecycle, safeStorage use, notifications, and packaged `userData` paths.
- Do not use `npm audit fix --force` blindly because it proposes a breaking Electron major jump to `42.4.1` without checking app lifecycle, preload IPC, tray behavior, safeStorage, Playwright interaction, or Electron Builder packaging compatibility.
- Proposed upgrade strategy: choose the target Electron major deliberately after release-note review; upgrade Electron only first with `npm install --save-dev --save-exact electron@39.8.10`; run full validation; run the packaged app smoke test; only then consider Electron Builder or related tooling updates if compatibility requires them.
- Required validation after the Electron-only upgrade: `npm run typecheck`, `npm run build`, `npm test`, `npm run package:win`, launch `release/win-unpacked/ALILOS.exe`, verify tray close/quit behavior, verify worker startup, verify Playwright browser launch, and confirm Supabase heartbeat remains disabled by default.
- Rollback plan: keep the Electron/package-lock upgrade isolated in one commit and revert that commit if the packaged Windows smoke test fails.

## Perakam Fixture Safety

- Sanitized structural Perakam fixtures may live under `fixtures/perakam/` after review.
- `fixtures/perakam/tampermonkey-original.sanitized.js` is a sanitized legacy reference only. Runtime code must not import or execute it.
- `fixtures/perakam/dashboard.sanitized.html` preserves duplicate sidebar and visible dashboard `a50` / `a51` structure for detector debugging only.
- The sanitized dashboard fixture represents the intended workplace-network dashboard structure. Home/outside-network source differences should not be interpreted as supported target-detection regressions.
- `npm test` runs a small Node built-in `node:test` fixture harness. It validates sanitized fixture structure and redaction assumptions only; it does not prove live Perakam behavior.
- Raw page captures must only be placed temporarily in `fixtures/perakam/raw/`.
- Raw captures and `*.raw.html` / `*.unsanitized.html` / `*.raw.js` / `*.unsanitized.js` variants are ignored by Git and must not be committed.
- Before committing any sanitized fixture, remove names, staff IDs, personal identifiers, IP addresses, credentials, cookies/session data, tokenized URLs/query strings, encrypted or opaque `link=` values, profile/image URLs, Telegram bot tokens, and Telegram chat IDs.
- Runtime app logic must not depend on fixture files.

## Testing Heartbeat Safely

- Heartbeat is disabled by default.
- Configure the Supabase heartbeat URL only through local config or the Settings tab. The renderer shows only configured state, project host, and key source after loading.
- Heartbeat payloads include app status, worker state, execution mode, network state, Perakam status, Telegram status, sanitized status/error text, and timestamp.
- Heartbeat payloads must not include credentials, Telegram token, Telegram chat ID, staff name, staff number, personal identifiers, raw HTML, screenshots, cookies, session data, or full sensitive URLs.

## Planning Schedule/Completion Backup Safely

- S3A is docs-only and S3B is schema-only. Do not add runtime Supabase clients, dependencies, `.env.local`, Supabase enablement, command/control, or unattended real execution from these notes alone.
- Planned `daily_schedules` rows are keyed by `device_id`, `schedule_date`, and `action_key`; planned `completion_records` rows are keyed by `device_id`, `action_date`, and `action_key` or an equivalent deterministic `dedupe_key`.
- Store only sanitized schedule/completion metadata: generated due time, timezone, generator/source, skip state, result code, source, timestamps, and reconciliation hashes.
- Never store Perakam credentials, cookies, raw HTML, screenshots, staff ID/name, Telegram token/chat ID, full URLs, tokenized query strings, or opaque `link=` values in Supabase.
- Recovery stays local-first: use valid local schedule, fetch Supabase only when local schedule state is missing/corrupt, generate only if neither exists, save local first, then attempt backup.
- Duplicate prevention fails safe: a local or Supabase blocking attempt/completion prevents repeat execution, disagreement blocks repeat until an approved reconciliation path exists, and Supabase absence/failure never forces action.
- Do not place a service role key in desktop, renderer, user-editable config, or desktop `.env.local`.
- `supabase/migrations/20260618215953_s3b_schedule_completion_schema.sql` adds `daily_schedules` and `completion_records` only. It enables RLS and revokes direct `anon` / `authenticated` privileges, but adds no broad table policies.
- Current allowed action keys are `clock-in` and `clock-out`. Current completion states are the `AttendanceCompletionState` values from `src/shared/types.ts`.
- `completion_records.dedupe_key` is optional supporting metadata rather than a generated or authoritative duplicate key; the `(device_id, action_date, action_key)` unique constraint remains authoritative.
- Future `AttendanceCompletionState` additions require a deliberate schema-constraint migration before runtime sync writes those states.
- S3D selects a hybrid Edge Function/API proxy plus explicit device pairing/token for future writes. Direct desktop table writes remain closed for `anon` and `authenticated`.
- Keep service-role keys server-side only. Never put a service-role key in desktop, renderer, user-editable config, logs, docs, or desktop `.env.local`.
- Allowed future payload fields are stable non-personal `device_id`, local date, action key, schedule target/window, completion state, verification state, sanitized reason/status, and timestamps.
- Forbidden future payload fields are Perakam credentials, cookies, raw HTML, screenshots, staff ID/name, Telegram token/chat ID, full URLs, tokenized query strings, opaque `link=` values, and service-role keys.
- PARITY6 implements the schedule/completion Edge Function/API contract and disabled runtime client skeleton. It is not a recovery engine: remote-only completion markers are warning-only, remote absence does not delete local rows, and local scheduling remains authoritative for action decisions.
- Remaining decisions before broader implementation: append-only audit details, user confirmation on disagreement, token issuance, token rotation, revocation flow, supervised backup smoke testing, recovery testing, and no unattended execution approval unless explicitly decided later.

## Planning The Web Companion Safely

- WEB1 was docs-only; PARITY8 created the first `webapp/` monitoring shell, PARITY9 adds safe non-clicking command controls, PARITY9B aligns the shell to Dashboard/Skip dates/Log history, PARITY9C adds whole-day skip/unskip calendar controls, PARITY9D documents the deployed safe-loop smoke test, and PARITY10B adds guarded configured-action request buttons. Do not add frontend dependencies, migrations, `.env.local`, secrets, or unattended execution from the old plan alone.
- The Electron desktop app remains the only local browser/session/action assistant. The web/PWA companion is a mobile status/control surface only.
- WEB1 starts read-only: heartbeat/status when available, stale/offline warnings, placeholders until schedule/completion sync exists, and no control commands.
- Future supervised controls require later explicit approval and must go through the Supabase/Edge Function/API control-plane boundary.
- The web companion must not perform Perakam login, Fortinet login/form submission, credential handling, cookie handling, raw HTML/screenshot display, tokenized URL handling, direct unattended real actions, or any bypass of desktop manual-confirm safety.
- Default repo plan is same-repo under a future isolated `webapp/` boundary after approval; move to a separate repo if deployment/build complexity or secret-boundary risk grows.
- Android/mobile use should be browser/PWA-based, not Electron.
- WEB2 screen design includes home/status dashboard, desktop/device detail, schedule, completion/verification, warnings/events, and settings/info placeholder.
- WEB2 status cards cover desktop online/stale/unreachable, Perakam reachability/session issues, captive portal state, sync disabled/deferred, next scheduled action, pending desktop manual confirmation, and last completion/verification state.
- WEB2 UI must stay single-column, timestamped, text-explicit, placeholder-friendly, and free of hidden/destructive controls.
- WEB2 remains read-only: no credential inputs, Perakam/Fortinet forms, attendance triggers, command buttons, mode switches, refresh commands, skip/unskip controls, or confirmation controls.
- WEB3 treats `al89er/perakamwaktu` as legacy/current webapp fallback/reference only. Do not clone, merge, copy code, copy secrets/config, or disturb any production/backup deployment unless a future task explicitly approves a sanitized reference review.
- Prefer rebuilding the ALILOS web companion or using an isolated future `webapp/` boundary. Compare legacy behavior later using sanitized screenshots or written summaries only.
- WEB4 data contracts are read-only and display-safe. They cover desktop/device heartbeat, Perakam/browser/session, network/captive portal, daily schedule, completion/verification, warnings/events, and sync capability/status.
- WEB4 sample payloads must stay fake and non-sensitive. Missing web data must show unavailable/unknown/deferred states and must never imply action readiness.
- WEB4 does not add command queue, skip/unskip, mode switch, configured-action command, confirmation execution control, runtime sync, or authenticated read/RLS implementation. PARITY9 separately adds only safe status refresh, dry-run/check, recalculate today schedule, and cancel confirmation command buttons.

## Avoiding Accidental Real Actions

- Do not call `attendance:execute` directly from experiments.
- Do not treat Phase 6A dry-run telemetry as real action completion.
- Do not weaken readiness checks in `ConfirmationService`.
- Do not map test-click targets to `a50` or `a51`.
- Do not add unprefixed Telegram clock commands.
- Do not add Telegram commands that silently perform real configured-target actions.
- Do not add automatic retries after a real configured-target click.
- Preserve same-day completion blocking for each date/action.

## Common Pitfalls

- The Phase 4D design document is historical and partly stale. Check current source before relying on it.
- `BackgroundWorker` is a scaffold; implemented behavior lives in separate services.
- Perakam page layout may change; detection logic must be tested visually and logs must avoid full page dumps.
- Electron `safeStorage` availability can vary by OS/session.
- Network/captive portal detection is passive and heuristic.
- `dist/` is generated output and should not be edited manually.
- `.env.local`, local config, and real credentials must stay out of git.

## Local-Machine Assumptions

- The app is intended for Windows desktop use, but this repo may be edited on macOS.
- Runtime paths under Electron `userData` differ by OS.
- Browser/profile state is local to the current machine and user account.
- Perakam access depends on the user's network, credentials, and the live Perakam website state.
