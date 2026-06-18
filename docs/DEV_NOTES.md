# Dev Notes

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
| `src/main/telegram-service.ts` | Telegram notifications and prefixed commands. |
| `src/worker/scheduler.ts` | Morning/evening action schedule generation and status. |
| `src/worker/reminder-service.ts` | Reminder notification timing and suppression. |
| `src/worker/browser-controller.ts` | Playwright browser, Perakam detection, DOM control detection/clicks, verification. |
| `src/worker/automation-monitor.ts` | Phase 6A due-action monitoring and simulated dry-run telemetry. |
| `src/worker/automation-audit.ts` | Bounded sanitized automation audit event persistence. |
| `src/worker/heartbeat-service.ts` | Disabled-by-default sanitized Supabase heartbeat sender/status. |
| `src/worker/confirmation-service.ts` | Manual-confirm action state machine and safety checks. |
| `src/worker/test-click-service.ts` | Guarded non-primary test-click pipeline. |
| `src/worker/network-monitor.ts` | Internet, Perakam reachability, captive portal monitoring. |
| `src/preload/preload.ts` | Renderer API boundary. |
| `src/shared/types.ts` | Cross-process types and API contract. |
| `src/renderer/index.html` | Tabbed dashboard markup. |
| `src/renderer/renderer.ts` | Dashboard rendering, tab navigation, form handling, and UI actions. |
| `src/renderer/styles.css` | Tabbed dashboard styling and responsive layout. |

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
- Settings: safe editor for worker, automation, scheduler window/reminder, Perakam dashboard URL, and heartbeat settings, plus read-only config/log paths and active setting summaries.

This tab layout is renderer-only. Do not change target IDs, confirmation behavior, persisted key names, or browser/controller behavior when adjusting tab placement.

## Settings Editor Safety

- The Settings tab edits only selected operational settings: worker enable/interval, Windows launch-at-login, automation execution mode/interval/dry-run browser preparation, scheduler windows/grace/reminders, Perakam dashboard URL, and Supabase heartbeat enable/project URL/interval.
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
- Heartbeat remains disabled by default.
- Real Supabase writes are deferred until the auth/pairing/write-path decision is made.

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

- Local Perakam auto-login is enabled on the test machine and succeeded during W4/W5 without credential-value logging. Intentionally decide whether it should be enabled or disabled before future tests.
- Fully unattended real attendance action is not approved or validated.
- Supabase heartbeat/write path remains disabled/deferred; do not start S3 schedule/completion sync without explicit approval.
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
