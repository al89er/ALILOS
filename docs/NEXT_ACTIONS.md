# Next Actions

## Immediate Next Safe Steps

- Run `npm run typecheck` after any future TypeScript code change.
- Run `npm run build` before manual app testing or packaging work.
- Manually smoke test dashboard startup with `npm run dev`.
- Manually smoke test tab switching across Overview, Schedule, Actions, Browser / Site, Network, Telegram, Logs, and Settings.
- Verify configured-site detection manually on the intended workplace network when access is available, without creating a real-action confirmation unless intentionally testing during the correct real action window.
- Keep live Perakam target-detection smoke testing marked pending while only home/outside-workplace network access is available.
- Keep `docs/PHASE_4D_MANUAL_CONFIRM_DESIGN.md` as historical design context, but update or supersede stale sections before relying on it for current behavior.
- For Phase 6A dry-run testing, set `automation.executionMode` to `dry-run` only in local config and confirm that due actions are simulated, not clicked.

## Desktop Operational Readiness Checklist

Current Supabase status:

- S2A schema done.
- S2B heartbeat skeleton done.
- S2C/S2D safety and local dry-run passed.
- S2E write-path options documented.
- Heartbeat remains disabled by default.
- Real writes remain deferred until auth/pairing/write-path authorization is decided.

Desktop operational blockers:

- Workplace Perakam smoke test pending.
- Scheduled dry-run pending.
- Packaged Windows smoke testing pending.
- Startup/tray reliability pending.

Before packaging/startup work:

- Run workplace smoke testing from the workplace/hospital network.
- Keep scheduled testing in `dry-run` or `manual-confirm`; do not perform real unattended actions.
- Run the minimal Windows package proof with `npm run package:win` and verify tray/minimize, launch-at-login decision, locked-session, sleep/wake, and log/export behavior.

Recommended first packaging/startup step:

- Implement launch-at-login only after the packaged `ALILOS.exe` smoke path remains green with the ALILOS userData path and project-owned icon.

## Suggested Next Implementation Phase

- Add focused tests or test harnesses around pure logic first: scheduler status, app settings normalization, command prefix parsing, heartbeat payload shaping, automation audit deduplication, URL sanitization, and captive portal classification.
- Add field-level validation polish to the Settings editor if manual testing shows users need inline messages beyond the current save-result errors.
- Add backend/phone-webapp receiver integration only after the sanitized heartbeat payload contract is confirmed.
- Keep Supabase/webapp work phased: S0 architecture documentation, S1 schema and identity planning, S2 status-only heartbeat, S3 durable schedule/completion backup ledger, S4 phone webapp/PWA status dashboard, S5 command queue/control only after explicit approval, and S6 Telegram reduced to fallback.
- Treat the old Tampermonkey script and old webapp as fallback/backup references while the Electron desktop agent remains Windows/desktop-only.
- Plan Android/mobile access through a hosted webapp/PWA, not Electron. A future webapp may live under `webapp/` in this repo after explicit approval.
- Improve dashboard wording where old "scaffold" or "detection only" text conflicts with current guarded execution capabilities.
- Add the planned disabled-by-default Windows launch-at-login setting after a docs-only design review.
- Consider a small diagnostics/export flow for sanitized logs and status snapshots to make future Perakam detection debugging easier.
- Extend detector fixture checks only if they remain independent from runtime fixture reads, including future zero-rect anchor plus visible dashboard descendant cases.
- Do not add selector support for home/outside-workplace Perakam page variants unless explicitly requested later.
- Add explicit documentation or UI affordances for the Perakam auto-login safety model and where encrypted credentials are stored.
- Plan and run a targeted Electron-only major upgrade separately from packaging smoke testing. Full `npm audit` flags direct `electron@33.4.11` as high severity, while `npm audit --omit=dev` is clean; npm's automatic fix requires a breaking upgrade to `electron@42.4.1`.
- First target for that Electron-only upgrade: `electron@39.8.10`. Latest Electron seen from npm is `42.4.1`, but Electron 39.8.10 is past the `<=39.8.4` advisory cutoff while reducing upgrade jump size.
- Future upgrade command: `npm install --save-dev --save-exact electron@39.8.10`.
- For that Electron upgrade, avoid related tooling churn first, run `npm run typecheck`, `npm run build`, `npm test`, `npm run package:win`, then launch the packaged app and verify tray close/quit, worker startup, Playwright browser launch, and disabled-by-default heartbeat.
- If the packaged smoke test fails after the Electron upgrade, revert the isolated Electron/package-lock commit and reassess before changing Electron Builder or packaging behavior.

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
- Workplace-network target-detection smoke test remains pending for the latest dashboard descendant visibility bugfix.
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
- Verify Perakam login detection.
- Verify Perakam dashboard detection.
- Verify visible `a50` / `a51` target availability.
- Verify hidden sidebar candidates are ignored.
- Verify manual-confirm and dry-run behavior.
- Verify no duplicate action after a local completion record exists.
- Verify logs contain sanitized status only.

### Scheduled Dry-Run Checklist

- Keep safe mode as `dry-run` or `manual-confirm`.
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
- Known remaining concerns: Playwright browser binary handling, launch-at-login not implemented, installer not implemented, and the high-severity npm advisory requires separate review rather than automatic fix.

### P11 Launch-at-Login Implementation Checklist

Recommended design:

- Add a new top-level config section, `startup`, separate from `automation`, with `launchAtLogin: false` by default.
- Expose the setting in `AppSettingsSnapshot` and `AppSettingsInput` as `startup.launchAtLogin`.
- Add one Settings checkbox under General / Automation with wording like `Start ALILOS when I sign in to Windows`.
- Keep manual app launches unchanged: open the main `A.L.I.L.O.S.` window normally.
- When launched by Windows login startup, start resident in the tray and do not show the main window unless the user chooses Show from the tray or starts the app again.
- Use an explicit startup argument such as `--hidden-at-login` in the login item args so the app can distinguish login startup from normal launches.
- Apply login item changes from the main process after config load/save with Electron `app.setLoginItemSettings()`.
- Read back effective state with `app.getLoginItemSettings()` for diagnostics/status text; treat Windows as the supported platform and avoid changing login items in dev unless explicitly needed for local testing.
- For packaged Windows, use `process.execPath` as the login item path. The current package/product app name is `ALILOS`, and the packaged executable is `release/win-unpacked/ALILOS.exe`.
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
- Supabase client dependencies, schedule/completion backup, and command queue remain unimplemented.

S2C/S2D review status:

- S2B safety review found no code changes needed.
- Local dry-run confirmed app startup, non-error disabled heartbeat status, no `.env.local` Supabase persistence, no observed key leakage, and local operation unaffected by heartbeat status.

S2E write-path recommendation:

- Keep heartbeat disabled by default and keep direct table access closed until a write authorization model is approved.
- Prefer a future explicit pairing/device-token or Edge Function/API proxy approach before enabling desktop writes.
- Do not put service role keys in desktop, renderer, or desktop `.env.local`.
- Do not add command queue/control until S5 is separately approved.

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
