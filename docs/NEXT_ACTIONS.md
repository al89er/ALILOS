# Next Actions

## PARITY1B Corrected Target

- Use `docs/LEGACY_PARITY_PLAN.md` as the current completion target and parity matrix.
- Complete app means: desktop scheduled click engine, local auto-login/stale recovery, captive portal local reconnect, Supabase skip/log/status/schedule/completion/command sync, webapp/PWA monitoring/control, no normal-browser interference, and no sensitive data in Supabase/logs.
- Telegram is paused/deprioritized. Keep existing Telegram behavior secondary; do not make Telegram parity a completion blocker.
- Fastest build sequence: PARITY2 Supabase skips/logs/status/commands schema, PARITY3 disabled desktop sync skeleton, PARITY4 heartbeat/status/log publishing, PARITY4B status proxy, PARITY4C deployment/smoke runbook, PARITY5 skip-date sync, PARITY6 schedule/completion sync, PARITY7 dry-run command processing, PARITY8 read-only webapp monitoring, PARITY9 webapp status/recalculate/dry-run/cancel controls, PARITY9B three-tab webapp alignment, PARITY9C webapp whole-day skip calendar controls, PARITY9D deployed safe-loop smoke-test runbook, PARITY10A guarded configured-action preflight, PARITY10B guarded configured-action command, PARITY10C deployed field validation, PARITY11 startup/sleep-wake field validation, PARITY12 captive portal local reconnect, PARITY13 end-to-end validation. PARITY4 status publishing, PARITY4B proxy, PARITY4C runbook, PARITY5 skip sync, PARITY6 schedule/completion sync, PARITY7 dry-run/non-clicking command sync, PARITY8 read-only web/PWA monitoring, PARITY9 safe command controls, PARITY9B workflow alignment, PARITY9C whole-day skip calendar controls, PARITY9D safe-loop smoke documentation, PARITY10A preflight scaffolding, and PARITY10B guarded remote action execution are implemented but desktop sync and `paritySync.remoteActionEnabled` remain disabled by default.

## Immediate Next Safe Steps

- Run `npm run typecheck` after any future TypeScript code change.
- Run `npm run build` before manual app testing or packaging work.
- Manually smoke test dashboard startup with `npm run dev`.
- Manually smoke test tab switching across Overview, Schedule, Actions, Browser / Site, Network, Telegram, Logs, and Settings.
- W2 workplace Perakam detection passed in packaged `manual-confirm` mode; do not repeat unless Perakam changes or a regression is suspected.
- W3 Fortinet live smoke passed for the no-live-portal case; repeat only if the portal appears or can be safely triggered without submitting a login form.
- W4 scheduled dry-run/manual-confirm validation passed in packaged `dry-run` mode.
- W5 lock/idle observation passed; full sleep/wake suspend/resume remains pending.
- W6 workplace validation consolidation is complete; W track is mostly complete.
- O1 operational readiness checklist is documented in `docs/OPERATIONAL_READINESS.md`.
- O3 real-machine observation passed for packaged launch, scripted hide/show, clean quit, sanitized logs, launch-at-login disabled, and completion records `0`.
- O4 consolidated the O track as mostly complete. Current go/no-go: monitored `manual-confirm`, `dry-run`, and `notify-only` are acceptable; fully unattended real execution remains no-go.
- RC2 accelerated schedule helper is available from the Schedule tab as `Recalculate today's schedule`; use it only after temporary window changes, prefer `dry-run`, and restore normal windows afterward.
- RC2 accelerated validation passed: due/grace reached, visible dashboard target detected, hidden sidebar duplicate ignored, dry-run passed, manual-confirm cancel passed, no real action, no false completion record.
- RC3 packaged validation passed: latest `ALILOS.exe` includes the helper and safety label, recalculation alone did not open/click Perakam or create completion/execution records, and validation/package commands passed.
- RC1 monitored real-world observation plan is documented in `docs/OPERATIONAL_READINESS.md`; it is one actual scheduled `manual-confirm` cycle with the user physically present.
- Next track options: run the documented PARITY10C field validation in `docs/PARITY_REMOTE_ACTION_FIELD_VALIDATION.md` with `paritySync.remoteActionEnabled=false` first, then `true` only for guard-failure and supervised valid-window phases, add action-specific skip UI after local scheduler support is upgraded, RC small real-world observation tasks, or PARITY11 startup/sleep-wake field validation. Do not implement additional migrations, unattended execution, or captive portal reconnect without explicit approval.
- Keep `docs/PHASE_4D_MANUAL_CONFIRM_DESIGN.md` as historical design context, but update or supersede stale sections before relying on it for current behavior.
- For Phase 6A dry-run testing, set `automation.executionMode` to `dry-run` only in local config and confirm that due actions are simulated, not clicked.

## Desktop Operational Readiness Checklist

Current Supabase status:

- S2A schema done.
- S2B heartbeat skeleton done.
- S2C/S2D safety and local dry-run passed.
- S2E write-path options documented.
- S3A schedule/completion sync planning documented.
- S3B schedule/completion schema migration drafted.
- PARITY2 skip/log/status/command schema migration added.
- PARITY3 disabled desktop parity-sync skeleton added; no runtime writes or command processing yet.
- PARITY4 gated parity status publishing added; disabled by default, proxy-targeted, and no command processing yet.
- PARITY4B status proxy added at `/functions/v1/alilos-parity-status`; it requires a registered device id, writes sanitized `heartbeats` and optional generated `event_logs` server-side, and keeps service-role use out of desktop/webapp clients.
- PARITY4C deployment/smoke runbook added in `docs/PARITY_STATUS_DEPLOYMENT.md`; use placeholder-only `docs/examples/parity-status-smoke.json` for curl shape.
- PARITY5 skip sync added at `/functions/v1/alilos-skip-sync`; it is disabled by default, supports list/upsert/delete skip rows through the proxy, and remote skip rows affect scheduling only.
- PARITY6 schedule/completion sync added at `/functions/v1/alilos-schedule-completion-sync`; it is disabled by default, supports current-day state fetch plus schedule/completion upserts through the proxy, and remote-only completion rows surface warnings only.
- PARITY7 command sync added at `/functions/v1/alilos-command-sync`; it is disabled by default, supports list/claim/complete/event command processing through the proxy, and only handles dry-run/non-clicking commands.
- PARITY8 read-only web/PWA monitor added under `webapp/`; live reads go through `/functions/v1/alilos-dashboard-read`, with static mock fallback and no command buttons.
- PARITY9 safe command controls added under `webapp/`; safe command creation goes through `/functions/v1/alilos-command-sync` using `create-command`.
- PARITY9B aligns the webapp to Dashboard, Skip dates, and Log history tabs. PARITY9C makes Skip dates calendar cells interactive for whole-day scheduling skip/unskip through `/functions/v1/alilos-skip-sync`; log history shows sanitized event summaries only. PARITY9D documents the combined deployed safe-loop smoke test. PARITY10B adds guarded configured-action requests but keeps operational reliance deferred until PARITY10C field validation.
- PARITY10C field-validation planning is documented in `docs/PARITY_REMOTE_ACTION_FIELD_VALIDATION.md`: disabled-gate rejection, guard-failure rejection, supervised valid-window execution, duplicate prevention, sanitized result review, and rollback.
- S3D write-path decision documented: prefer Edge Function/API proxy plus explicit device pairing/token.
- Parity sync remains disabled by default.
- Guarded configured-action command execution is implemented but disabled by default and remains pending PARITY10C field validation; unattended execution remains deferred.

Desktop operational blockers:

- W workplace validation is mostly complete: W2 Perakam smoke, W3 no-live-portal Fortinet smoke, W4 scheduled dry-run, and W5 lock/idle observation passed with packaged `ALILOS.exe`.
- Local Perakam auto-login is enabled on the test machine and succeeded during W4/W5 without credential-value logging; intentionally control this setting in future tests.
- P packaging/startup local smoke testing passed for the unpacked Windows app.
- Remaining release risks: full sleep/wake suspend-resume, real Windows sign-in/reboot launch-at-login, visual tray-menu click verification, live Fortinet portal marker validation, real scheduled manual-confirm at an actual clock-in/out time, and any fully unattended real action remain unvalidated.

Before unattended daily use:

- Run workplace smoke testing from the workplace/hospital network.
- Keep scheduled testing in `dry-run` or `manual-confirm`; do not perform real unattended actions.
- Complete real sign-in/reboot launch-at-login, locked-session, sleep/wake, and log/export behavior checks.

Recommended next major track:

- RC small real-world observation tasks when physically ready. S3E Edge Function/API schedule/completion contract planning and WEB5 authenticated read model/RLS planning remain later options only after explicit approval.
- For RC1, use packaged `ALILOS.exe`, confirm `manual-confirm`, keep the user physically present, abort on target ambiguity or unexpected unattended behavior, and record the result with the template in `docs/OPERATIONAL_READINESS.md`.
- Continue to treat fully unattended real execution as no-go; legitimate real clicks still require user confirmation at an appropriate real attendance time.

## Suggested Next Implementation Phase

- Add focused tests or test harnesses around pure logic first: scheduler status, app settings normalization, command prefix parsing, heartbeat payload shaping, automation audit deduplication, URL sanitization, and captive portal classification.
- Add field-level validation polish to the Settings editor if manual testing shows users need inline messages beyond the current save-result errors.
- Add backend/phone-webapp receiver integration only after the sanitized heartbeat payload contract is confirmed.
- Keep Supabase/webapp work phased according to `docs/LEGACY_PARITY_PLAN.md`: Supabase schema first, disabled sync skeleton next, then sanitized status/log/skip/schedule/completion sync, dry-run command processing, webapp monitoring/control, guarded configured-action commands, field validation, and captive portal local reconnect.
- Treat the old Tampermonkey script and old webapp as fallback/backup references while the Electron desktop agent remains Windows/desktop-only.
- Plan Android/mobile access through a hosted webapp/PWA, not Electron. A future webapp may live under `webapp/` in this repo after explicit approval.
- WEB1 planning lives in `docs/WEB_COMPANION_PLAN.md`: read-only first, no control commands, no Perakam/Fortinet login, and no bypass of the desktop manual-confirm safety model.
- Improve dashboard wording where old "scaffold" or "detection only" text conflicts with current guarded execution capabilities.
- Smoke test the disabled-by-default Windows launch-at-login setting with real sign-in/reboot before relying on unattended startup.
- Treat the P packaging/startup and W workplace tracks as mostly complete after local packaged and workplace validation; remaining release work is optional installer/signing plus O-track readiness checks.
- Consider a small diagnostics/export flow for sanitized logs and status snapshots to make future Perakam detection debugging easier.
- Extend detector fixture checks only if they remain independent from runtime fixture reads, including future zero-rect anchor plus visible dashboard descendant cases.
- Do not add selector support for home/outside-workplace Perakam page variants unless explicitly requested later.
- Add explicit documentation or UI affordances for the Perakam auto-login safety model and where encrypted credentials are stored.
- Electron is already upgraded to `39.8.10`; future Electron upgrades should remain targeted and include typecheck, build, test, package, tray, worker startup, Playwright launch, and disabled-by-default heartbeat checks.

## Testing / Smoke-Test Checklist

- `npm install` completes from `package-lock.json`.
- `npm run typecheck` passes.
- `npm run build` passes and copies renderer assets.
- `npm test` passes fixture structure/redaction checks.
- `npm run dev` opens the Electron dashboard.
- Window close hides to tray; tray Show/Hide/Quit works.
- Schedule appears for today and skip/unskip today/tomorrow updates state.
- Tabs switch correctly and preserve live status updates.
- Overview shows app, worker, generated action times, next action, last result, browser/site, network, captive portal, Telegram, and recent events.
- Schedule tab shows generated times, reminders, skip/unskip controls, and skipped dates.
- Actions tab shows guarded manual-confirm controls and `a56`/`a57` manual test-click diagnostics.
- Browser / Site tab shows browser controls, Perakam page state, target detection, and Perakam auto-login controls.
- Network tab shows reachability/captive portal status, check/retry actions, and network monitor settings.
- Telegram tab keeps token/chat fields masked and shows the configured command prefix.
- Logs tab shows recent logs plus automation/heartbeat audit details.
- Settings tab shows current execution mode, edits safe operational settings, masks heartbeat/Telegram secrets, and preserves existing secrets when blank fields are saved.
- Telegram settings save with placeholder/test values only; real bot token is never committed or printed.
- Telegram test notification works only with owner-provided local credentials.
- Browser starts and stops.
- Open Perakam navigates to the configured URL.
- Site status refresh classifies login/dashboard/stale-session on the intended workplace site profile without exposing query secrets.
- Workplace-network target-detection smoke passed in W2 for the intended dashboard profile.
- Action readiness remains not-ready outside valid windows or when controls are unavailable.
- Dry-run performs checks without clicking.
- Guarded target execution is tested only when the user intentionally wants the real action and all safety conditions are satisfied.
- Manual test-click uses only `a56`/`a57` and never primary targets `a50`/`a51`.
- Network check updates internet/Perakam/captive portal status without logging secrets.
- In `dry-run` mode, due configured actions create `schedule-due`, `page-prepared`, `candidate-detected` when available, `dry-run-action-simulated`, and `confirmation-required` audit events.
- Confirm no simulated dry-run calls `attendance:execute` or `clickVisibleAttendanceControl`.
- In Settings, switch execution mode between `notify-only`, `manual-confirm`, and `dry-run`, save, reload, and confirm the summary reflects the saved value.
- In Settings, leave the heartbeat endpoint blank and save other heartbeat fields; confirm the endpoint remains configured when one already exists.
- In Telegram, leave token/chat blank while changing command prefix; confirm configured or `.env.local` token/chat are preserved and not displayed.
- With local config Telegram secrets blank and `.env.local` containing `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID`, confirm the UI shows available-from-env-local status and Telegram test notification works after enabling Telegram.

### Workplace Smoke-Test Checklist

- Run from the workplace/hospital network.
- W2 passed: Perakam login detection.
- W2 passed: Perakam dashboard detection.
- W2 passed: visible `a50` / `a51` target availability.
- W2 passed: hidden sidebar candidates are ignored.
- Verify manual-confirm and dry-run behavior.
- Verify no duplicate action after a local completion record exists.
- Verify logs contain sanitized status only.

### W Workplace Validation Track

- W1 workplace validation plan: document the safe checklist, evidence to collect, and stop conditions before live workplace testing.
- W2 manual workplace browser/login/button detection smoke: passed with packaged `ALILOS.exe` in `manual-confirm`; no real action, confirmation, execution, or completion record was created.
- W3 Fortinet captive portal live detection smoke: passed for the no-live-portal case with captive portal `not-detected`, host `none`, and evidence `none`. If a Fortinet portal appears later, repeat detection-only checks for safe `authupm.upm.edu.my` dynamic-port evidence and no full tokenized portal paths/query strings in logs.
- W4 scheduled dry-run/manual-confirm test: passed with a temporary local-only evening schedule change in packaged `dry-run` mode. Observed `schedule-due`, `page-prepared`, `candidate-detected`, `dry-run-action-simulated`, and `confirmation-required`; original config was restored and completion count stayed zero.
- W5 sleep/wake/locked-session observation: lock and idle observation passed with packaged `ALILOS.exe`, temporary `dry-run`, launch-at-login disabled, and local Perakam auto-login enabled. Network, scheduler, browser, and dashboard state stayed stable; no execution or completion record was created. Full sleep/wake suspend/resume and visual tray-menu verification remain pending.
- W6 workplace validation consolidation: complete. W track is mostly complete; remaining release risks are carried into O operational readiness.

W-track safety defaults:

- Prefer `dry-run`; use `manual-confirm` only while a human is watching.
- Do not perform an automatic real attendance click during validation unless explicitly approved later in the correct action window.
- Do not change Perakam selectors, Fortinet detection, scheduler/browser behavior, Telegram behavior, Supabase behavior, packaging config, or credential storage.
- Record only sanitized observations: Perakam login/dashboard state, target availability, Fortinet safe reason text, network monitor state, scheduler state, and packaged-vs-dev differences if relevant.

Stop W validation if any of these occur:

- Unexpected real-action risk.
- Credential, cookie, raw HTML, screenshot, staff identity, full portal URL, tokenized path, or query string appears in logs or UI export.
- Repeated browser crash or packaged Playwright launch failure.
- Target detection ambiguity, including multiple visible primary targets or action readiness that conflicts with observed dashboard state.

### Scheduled Dry-Run Checklist

- Keep safe mode as `dry-run` or `manual-confirm`.
- For accelerated RC testing, temporarily set a near-future evening window, save Settings, use `Recalculate today's schedule`, and restore normal windows after the observation.
- Verify generated times persist for the day.
- Verify weekend and skip behavior.
- Verify missed-action grace logic.
- Verify local completion records block repeats.
- Do not perform a real unattended action during the test.

### Packaging / Startup Checklist

- Run `npm run package:win` and verify `release/win-unpacked` exists.
- Launch `release/win-unpacked/ALILOS.exe`.
- Confirm the app opens, the tray icon/menu works, close hides to tray, and Quit exits.
- Confirm the packaged app and tray use the project-owned ALILOS icon rather than the default Electron icon.
- Confirm config and logs use packaged Electron `userData`, not repository folders.
- Confirm packaged Windows userData is under `%APPDATA%\ALILOS`.
- Toggle launch-at-login on/off in Settings and confirm Electron reports the effective login item state.
- Launch with `--hidden-at-login` and confirm the app starts resident in the tray without showing the main window.
- Confirm local dev secrets are not bundled, and `.env.local` is not packaged.
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
- P12 local smoke passed for packaged Playwright launch, `%APPDATA%\ALILOS` userData, project-owned icon, `.env.local` exclusion, disabled launch-at-login, and simulated `--hidden-at-login`.
- Known remaining concerns: installer/signing are not implemented, real Windows sign-in/reboot startup is untested, full sleep/wake suspend/resume is pending, and the high-severity npm advisory requires separate review rather than automatic fix.

### Launch-at-Login Smoke Checklist

Implemented design:

- Uses top-level config section `startup`, separate from `automation`, with `launchAtLogin: false` by default.
- Exposes the setting in `AppSettingsSnapshot` and `AppSettingsInput` as `startup.launchAtLogin`.
- Adds one Settings checkbox under General / Automation: `Start ALILOS when I sign in to Windows`.
- Keep manual app launches unchanged: open the main `A.L.I.L.O.S.` window normally.
- When launched by Windows login startup, start resident in the tray and do not show the main window unless the user chooses Show from the tray or starts the app again.
- Uses explicit startup argument `--hidden-at-login` in the login item args so the app can distinguish login startup from normal launches.
- Applies login item changes from the main process after config load/save with Electron `app.setLoginItemSettings()`.
- Reads back effective state with `app.getLoginItemSettings()` for diagnostics/status text; Windows packaged builds are the supported registration target.
- For packaged Windows, uses `process.execPath` as the login item path. The current package/product app name is `ALILOS`, and the packaged executable is `release/win-unpacked/ALILOS.exe`.
- Do not change `automation.executionMode`, scheduler behavior, browser startup, Telegram, Supabase heartbeat, or Fortinet detection when enabling login startup.
- Keep the safe operating default: launch-at-login disabled; if enabled, tray-resident at sign-in; no automatic real attendance action beyond the already configured execution mode and existing schedule guards.

Validation and smoke checklist for P11:

- Run `npm run typecheck`, `npm run build`, `npm test`, and `npm run package:win`.
- Launch packaged `ALILOS.exe`, toggle launch-at-login on and off, save, reload, and confirm the Settings checkbox reflects the saved/effective state.
- Confirm `app.getLoginItemSettings()` reports enabled after saving on and disabled after saving off.
- Confirm a simulated `--hidden-at-login` launch starts the app without showing the main window and leaves the tray available.
- Confirm a normal packaged launch still opens the main window.
- Confirm close-to-tray, tray Show/Hide, and Quit still work.
- Confirm worker, scheduler, network monitor, Telegram polling, and disabled-by-default Supabase heartbeat startup logs are unchanged except for safe startup-setting status.
- Confirm no real configured action runs unexpectedly during startup testing; keep execution mode as `manual-confirm` or `dry-run`.

Rollback and manual disable:

- In the app, open Settings, uncheck `Start ALILOS when I sign in to Windows`, save, then quit from the tray.
- If the UI is unavailable, disable `ALILOS` from Windows Settings > Apps > Startup or Task Manager > Startup apps.
- As a last resort, remove the per-user Windows startup entry for `ALILOS` from the current user's Run startup entries, then launch `ALILOS.exe` manually and save the setting disabled.
- Reverting the P11 implementation commit should leave startup disabled once the app next runs with `app.setLoginItemSettings({ openAtLogin: false })`.

## Supabase / Webapp Roadmap

- S0: Architecture documentation.
- S1: Schema and identity planning.
- S2: Status-only heartbeat.
- S3: Durable schedule/completion backup ledger.
- S4: Phone webapp/PWA status dashboard.
- S5: Command queue/control only after explicit approval.
- S6: Telegram reduced to fallback.

Do not implement Supabase runtime features, schema migrations, remote command/control, or `webapp/` scaffolding until the relevant phase is explicitly requested. Future Supabase records must exclude configured-site credentials, cookies/session data, raw page HTML, screenshots, staff ID/name, Telegram token/chat ID, and full tokenized URLs or opaque query strings.

WEB1 web companion planning:

- `docs/WEB_COMPANION_PLAN.md` defines the future mobile/PWA companion as a status/control surface only.
- WEB1 is read-only: show heartbeat/status when available, stale/offline warnings, and placeholders until schedule/completion sync exists.
- WEB2 defines the static/read-only UI design: home/status dashboard, device detail, schedule, completion/verification, warnings/events, and settings/info placeholder screens.
- WEB3 documents `al89er/perakamwaktu` as legacy webapp fallback/reference only. Prefer rebuilding the ALILOS web companion or using an isolated future `webapp/` boundary unless a later explicit review justifies reuse.
- WEB4 defines read-only display data contracts for heartbeat/status, Perakam/browser/session status, network/captive portal status, schedule, completion/verification, warnings/events, and sync capability/status.
- Future web controls require later approval and must go through the Supabase/Edge Function/API control-plane boundary.
- The default repo plan is same-repo under a future isolated `webapp/` boundary, with separate repo still available if deployment/build complexity or secret-boundary risk grows.
- Android/mobile use should be browser/PWA-based, not Electron.

### S1 Schema and Identity Planning Notes

Proposed future tables are documented in `docs/SUPABASE_IDENTITY_GUARD.md`:

- `devices`: one stable generated non-personal `device_id`, stored locally and never derived from staff ID/name or machine identity.
- `heartbeats`: S2 status-only latest-row upsert by `device_id`, with coarse app, schedule, site, and network status.
- `daily_schedules`: S3 durable local schedule backup rows upserted by `device_id`, `schedule_date`, and `action_key`.
- `completion_records`: S3 durable completion/skip backup rows upserted by `device_id`, `action_date`, and `action_key`.
- Deferred `command_queue`: S5-only control-plane table, with no table/migration/runtime consumer until separate explicit approval.

Local-first schedule recovery should remain:

1. Read local config and local schedule/completion state.
2. Use valid local schedule records first.
3. Use Supabase `daily_schedules` only as recovery backup rows when local schedule state is missing or corrupt.
4. Regenerate locally if no usable local or Supabase schedule exists.
5. Treat local OR Supabase completion records as sufficient to suppress duplicate execution for the same device/date/action.
6. Continue scheduled local operation when Supabase is unavailable.

S1 security baseline:

- Enable RLS on all future exposed-schema tables.
- Keep service role keys and private secrets out of desktop and webapp clients.
- Authorize by owner/device relationships, not user-editable metadata.
- Store only sanitized operational metadata; no credentials, cookies, raw HTML, screenshots, staff identity, Telegram secrets, or tokenized URLs.
- Keep command/control schema and runtime consumers deferred until S5 is explicitly approved.
- Treat RLS/security details as planning only for now; no final policies, grants, migrations, Edge Functions, or client code are part of S1B.

S1B safe implementation defaults for later S2/S3:

- The desktop agent remains local-first; Supabase is recovery/monitoring support, not required for scheduled local operation.
- A latest heartbeat row keeps the future phone dashboard simple.
- Upserted schedule rows avoid duplicate generated times after retries or regeneration.
- Upserted completion rows make duplicate-prevention checks straightforward.
- Append-only event history can be added later if monitoring, auditing, or diagnostics require it.

S2A migration status:

- `supabase/migrations/20260617125521_s2a_status_heartbeat.sql` adds only `devices` and latest-row `heartbeats`.
- RLS is enabled, with no final row policies yet because pairing/authorization/runtime writes are still pending.
- S2B adds a disabled-by-default Electron heartbeat sender skeleton using built-in `fetch`, local config/`.env.local` bootstrap, and sanitized status-only metadata.
- S3B adds schema-only `daily_schedules` and `completion_records` tables for future sanitized backup/recovery.
- Supabase client dependencies and command queue remain unimplemented. Runtime schedule/completion sync exists only through the disabled-by-default PARITY6 Edge Function path.

S2C/S2D review status:

- S2B safety review found no code changes needed.
- Local dry-run confirmed app startup, non-error disabled heartbeat status, no `.env.local` Supabase persistence, no observed key leakage, and local operation unaffected by heartbeat status.

S2E write-path recommendation:

- Keep heartbeat disabled by default and keep direct table access closed until a write authorization model is approved.
- Prefer a future explicit pairing/device-token or Edge Function/API proxy approach before enabling desktop writes.
- Do not put service role keys in desktop, renderer, or desktop `.env.local`.
- Do not add command queue/control until S5 is separately approved.

### S3A Schedule/Completion Sync Planning Notes

S3A is docs-only. It does not add migrations, runtime Supabase clients, dependencies, `.env.local`, Supabase enablement, command/control, or unattended real execution.

Planned model:

- `daily_schedules`: one sanitized row per `device_id`, `schedule_date`, and `action_key`, with generated due time, timezone, generator/version metadata, schedule hash, and optional sanitized payload.
- `completion_records`: one sanitized row per `device_id`, `action_date`, and `action_key`, or equivalent `dedupe_key`, with completion timestamp, source, result code, and reconciliation hash.
- Supabase remains backup/recovery only. The desktop must start, generate schedules, block duplicates, remind, and run guarded local flows without Supabase.
- No service role key belongs in desktop, renderer, user-editable config, or desktop `.env.local`.
- Supabase records must exclude Perakam credentials, cookies, raw HTML, screenshots, staff ID/name, Telegram token/chat ID, full URLs, tokenized query strings, and opaque `link=` values.

Recovery order:

1. Use a valid local schedule.
2. If local schedule storage is missing or corrupt, fetch matching Supabase schedule backup rows.
3. Generate locally only when neither local nor Supabase schedule state is usable.
4. Save recovered/generated state locally first, then attempt a sanitized Supabase backup.
5. Continue local operation if Supabase is unavailable.

Duplicate prevention:

- Local or Supabase completion/attempt evidence for the same device/date/action blocks repeat execution.
- If local and Supabase disagree, fail safe toward no repeat until a reconciliation rule is explicitly approved.
- Supabase absence or failure never forces an action.

S3B schema status:

- `supabase/migrations/20260618215953_s3b_schedule_completion_schema.sql` creates `daily_schedules` and `completion_records`.
- Both tables use per-device/date/action uniqueness for duplicate prevention.
- `completion_records.dedupe_key` is optional supporting metadata rather than a generated or authoritative duplicate key; the tuple unique constraint is authoritative because generated date-to-text keys can be formatting-sensitive.
- Future completion-state additions require a deliberate schema-constraint migration before runtime sync writes those states.
- RLS is enabled on both tables and direct `anon` / `authenticated` privileges are revoked.
- No table policies, Edge Functions, runtime writes, dependencies, `.env.local`, secrets, command/control, or unattended real execution are added.

S3D write-path decision:

- Prefer a hybrid Edge Function/API proxy plus explicit device pairing/token for future schedule/completion writes.
- Keep direct table writes closed for `anon` and `authenticated`; do not add direct desktop table write policies.
- Keep service-role keys server-side only, never in desktop, renderer, user-editable config, logs, docs, or desktop `.env.local`.
- Desktop payloads must be sanitized and minimal. Allowed fields are stable non-personal `device_id`, local date, action key, schedule target/window, completion state, verification state, sanitized reason/status, and timestamps.
- Forbidden fields remain Perakam credentials, cookies, raw HTML, screenshots, staff ID/name, Telegram token/chat ID, full URLs, tokenized query strings, opaque `link=` values, and service-role keys.
- Runtime sync remains disabled until the write path is implemented and tested through the documented rollout.

Rejected/default-deferred options:

- Direct RLS from desktop is rejected as the default because row ownership, revocation, and payload-shape validation would be too policy-heavy for this project.
- Edge Function/API without pairing is incomplete because it lacks a clear revocable device identity.
- Device-token/pairing without an API proxy is deferred because it would still require client-visible table access policies.

Rollout phases:

1. Docs-only decision.
2. Edge Function/API schema contract.
3. Disabled runtime client skeleton.
4. Dry-run payload logging without network writes.
5. Write-path smoke test with non-sensitive test payloads.
6. Supervised schedule/completion backup.
7. Recovery testing.
8. No unattended execution approval unless explicitly decided later.

Remaining decisions before broader runtime sync:

- Latest-row upsert vs append-only audit history details beyond the current PARITY6 latest-row backup path.
- Whether user confirmation is required on local/Supabase disagreement.
- Exact Edge Function/API route shape, token issuance, token rotation, and revocation flow.

## Documentation Maintenance Tasks

- Update `docs/CURRENT_STATUS.md` after meaningful implementation milestones.
- Update `docs/APP_STRUCTURE.md` when files, IPC channels, storage patterns, scripts, or dependencies change.
- Update `docs/DECISIONS.md` when a project decision is confirmed or reversed.
- Keep `CODEX.md` as the first-read onboarding file for future Codex sessions.
- Avoid duplicating private machine-specific values in docs.

## Items Needing Owner Confirmation

- Whether to keep the `BackgroundWorker` heartbeat scaffold or rename/reframe its dashboard status to avoid confusion.
- Whether Perakam auto-login should remain enabled as a user-controlled feature in production builds.
- Whether to add Telegram confirmation commands later; current Telegram commands do not execute real configured actions.
- Whether heartbeat should post only on events or also on a recurring interval when enabled.
- Whether to package with `electron-builder`, another installer tool, or no installer for now.
- Whether to introduce automated tests before further feature work.
- Whether keep-alive behavior is obsolete now that auto-login/session recovery exists.
