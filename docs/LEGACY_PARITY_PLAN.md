# Legacy Parity Plan

PARITY1B corrects the final target for A.L.I.L.O.S. The complete product target is a generic automated scheduled website clicker, not Telegram-first and not tied only to Perakam.

## Corrected Completion Definition

A complete app means:

- Desktop scheduled click engine complete.
- Local configured-site auto-login and stale/wrong-page recovery complete.
- Captive portal detection and local reconnect complete for the user's own work computer.
- Supabase sync/control plane complete for skip dates, sanitized logs/events, device status, daily schedules, completion records, command requests, and command results.
- Webapp/PWA monitoring/control complete.
- Telegram paused/deferred and secondary to webapp plus Supabase.
- Background desktop agent uses a separate Playwright browser and does not interfere with normal browser use.
- No configured-site credentials, captive portal credentials, cookies, raw HTML, screenshots, staff identity, full/tokenized URLs, opaque `link=` values, Telegram secrets, or service-role keys are stored in Supabase, webapp, logs, or docs.

## Current Product Target

- Automated scheduled website clicker.
- Background Electron desktop agent.
- Separate Playwright browser for configured website automation.
- Windows startup/background operation.
- Local auto-login for the configured website using the user's local credentials.
- Local stale recovery for wrong, timed-out, or stale configured website states.
- Local captive portal detection and future captive portal reconnect.
- Supabase sync/control plane.
- Webapp monitoring/control.

Telegram remains useful as an existing local notification/fallback path, but Telegram parity is not required for completion.

## Parity Matrix

| Capability | Status | Notes |
| --- | --- | --- |
| Scheduled configured action | Implemented | Local scheduler plus guarded configured action path exists. |
| Random schedule windows | Implemented | Morning/evening windows generate persisted daily times. |
| Weekend exclusion | Implemented | Weekend status suppresses due action. |
| Skip dates | Implemented | Today/tomorrow skip controls exist locally. |
| Skip next action | Partially implemented | Local skip dates exist; webapp/Supabase command path missing. |
| Local logs | Implemented | JSON-line logs under Electron userData. |
| Supabase logs | Partially implemented | PARITY2 schema exists; PARITY4 can publish conservative parity status events only when enabled and `logUploadEnabled` is true. |
| Supabase skip dates | Partially implemented | PARITY5 desktop/Edge Function sync exists and is disabled by default; webapp controls are still missing. |
| Supabase schedules/completions | Partially implemented | PARITY6 desktop/Edge Function sync exists and is disabled by default; it backs up local rows and surfaces remote completion warnings only. |
| Supabase command requests/results | Partially implemented | PARITY2 schema exists; command processing is missing. |
| Webapp monitoring | Missing | Planned PWA/mobile status dashboard only. |
| Webapp manual controls | Missing | Future skip/status/recalculate/dry-run/guarded action controls through Supabase. |
| Telegram monitoring/commands | Paused | Existing Telegram code/config stays secondary; not required for completion. |
| Background operation | Implemented | Tray/background packaged app works; field validation remains. |
| Separate Playwright browser | Implemented | Persistent Playwright browser is separate from normal browser use. |
| No interference with normal browser | Implemented | Uses separate Playwright profile/browser; continue validating in packaged use. |
| Launch at Windows startup | Partially implemented | Setting exists and simulated hidden startup passed; real reboot/sign-in validation pending. |
| Configured-site auto-login | Implemented | Local encrypted credentials and recovery path exist for current configured site profile. |
| Stale/wrong-page recovery | Partially implemented | Local stale/login classification and recovery exist; broader wrong-page field validation remains. |
| Keep-alive replacement | Partially implemented | Auto-login/session recovery reduces need; final replacement needs field validation. |
| Internet/network down detection | Implemented | Network monitor checks internet and configured-site reachability. |
| Captive portal detection | Implemented | Fortinet-style portal detection is sanitized and detection-only today. |
| Captive portal notification | Implemented | Local notification/status path exists for detected/suspected portals. |
| Captive portal local auto-login/reconnect | Missing | Future local-only feature; no credentials in Supabase/webapp/logs. |
| Completion/duplicate prevention | Implemented | Local completion state blocks repeat date/action execution. |
| Sanitized logging | Implemented | Current checked patterns exclude credentials, cookies, raw HTML, full/tokenized URLs, and opaque `link=` values. |
| Packaged Windows app | Implemented | `ALILOS.exe` package and smoke checks passed. |

Status meanings: implemented means usable now; partially implemented means core local behavior exists but the final target needs sync, command, or field validation; missing means not built; deferred means intentionally later; needs field validation means code exists but real-world observation remains; paused means not part of the completion target.

## Credential And Secret Boundary

- Configured website credentials stay local only.
- Captive portal credentials stay local only.
- Supabase never stores configured website or captive portal credentials.
- Webapp never receives configured website or captive portal credentials.
- Logs never include credentials, cookies, raw HTML, screenshots, full/tokenized URLs, or opaque `link=` values.
- Renderer should receive only status/availability metadata and should not expose secrets unnecessarily.
- Telegram token/chat ID remain local-only if Telegram is used as a secondary channel.
- Supabase service-role keys never ship in the desktop app or webapp.

## Supabase And Webapp Role

Supabase should sync:

- Device heartbeat/status.
- Sanitized logs/events.
- Skip dates.
- Daily schedules.
- Completion records.
- Command requests.
- Command results.

The webapp/PWA should support:

- Mobile status dashboard.
- Online/offline/stale status.
- Next scheduled action.
- Skip/unskip controls.
- Dry-run/check command.
- Recalculate today's schedule command.
- Guarded configured action command/status.
- Result review.

The webapp/PWA must not:

- Directly log into the configured website.
- Store configured website credentials.
- Store captive portal credentials.
- Execute browser automation in the phone browser.
- Send arbitrary selectors, scripts, or forms.
- Bypass the desktop agent's local safety checks and configured action guardrails.

## Fastest Build Sequence

1. PARITY1B corrected target docs.
2. PARITY2 Supabase schema for skips/logs/status/commands.
3. PARITY3 desktop sync skeleton disabled by default.
4. PARITY4 heartbeat/status/log publishing.
5. PARITY5 Supabase skip-date sync.
6. PARITY6 schedule/completion sync.
7. PARITY7 command request/result processing in dry-run mode.
8. PARITY8 webapp/PWA read-only monitoring.
9. PARITY9 webapp skip/status/recalculate/dry-run controls.
10. PARITY10 guarded configured-action command.
11. PARITY11 launch-at-startup and sleep/wake field validation.
12. PARITY12 captive portal local reconnect implementation.
13. PARITY13 end-to-end webapp + Supabase + desktop validation.

Do not add migrations, runtime sync, webapp code, captive portal reconnect, command/control, or unattended execution from this document alone. Each later PARITY step needs explicit approval.

## PARITY2 Schema Result

`supabase/migrations/20260619033529_parity_sync_schema.sql` adds schema-only support for:

- `skip_dates`
- `event_logs`
- `command_requests`
- `command_events`

The migration keeps RLS enabled, revokes direct `anon` / `authenticated` table privileges, and assumes future reads/writes are mediated by an Edge Function/API proxy. It does not enable desktop runtime writes, webapp code, command processing, or unattended execution.

## PARITY3 Disabled Skeleton Result

The desktop app now has a disabled-by-default `paritySync` config section and a `ParitySyncService` skeleton. The service exposes read-only health/status, command type/status constants, sanitized payload types, and lifecycle placeholders for future heartbeat/log/skip/command/schedule-completion sync.

PARITY3 does not poll or process command requests, implement webapp code, add secrets, or enable unattended execution. Supabase keys for this path must be publishable/anon only; service-role-looking keys are rejected from local parity-sync config.

## PARITY4 Status Publishing Result

The desktop app now has gated parity status publishing. Publishing requires `paritySync.enabled = true`, a valid Supabase URL, a publishable/anon key, and a valid local device id. Defaults remain disabled.

The publisher sends sanitized device/status payloads, plus a conservative generated status event only when `paritySync.logUploadEnabled` is true. It targets the Edge Function/API proxy path `/functions/v1/alilos-parity-status` rather than direct table writes, because current migrations intentionally revoke direct `anon` / `authenticated` table privileges. No command polling, command processing, webapp code, skip sync, or schedule/completion sync is implemented in PARITY4.

## PARITY4B Status Proxy Result

The Supabase Edge Function `supabase/functions/alilos-parity-status/index.ts` now provides the server-side proxy used by PARITY4 desktop publishing. The desktop still uses only a publishable/anon key. The service-role key belongs only in the Edge Function environment and is not committed, stored in desktop config, or exposed to the renderer.

The function accepts POST-only sanitized status payloads, rejects forbidden keys and suspicious tokenized strings, requires the posted desktop `deviceId` to match an existing `devices.device_id`, upserts the latest `heartbeats` row, and optionally inserts sanitized generated `event_logs`. It does not auto-create personal identity, process remote commands, sync skip dates, sync schedule/completion records, or implement a webapp.

## PARITY4C Deployment Runbook Result

`docs/PARITY_STATUS_DEPLOYMENT.md` documents safe deployment and smoke testing for `alilos-parity-status`, including Supabase CLI checks, server-only Edge Function secrets, existing-device prerequisites, desktop parity-sync config prerequisites, placeholder-only curl testing, expected database checks, common failures, and staged desktop smoke testing.

`docs/examples/parity-status-smoke.json` provides a placeholder-only sanitized payload. PARITY4C does not deploy the function, add secrets, commit project refs/keys/device ids, weaken RLS, process commands, implement a webapp, or enable desktop sync by default.

## PARITY5 Skip Sync Result

PARITY5 adds `supabase/functions/alilos-skip-sync/index.ts` for server-side skip-date sync. The function supports POST-only `list-skips`, `upsert-skip`, and `delete-skip`, requires a registered non-personal device id, validates allowed date/action/source fields, rejects forbidden keys and tokenized/sensitive strings, and writes `skip_dates` using the Edge Function service-role environment only.

The desktop `ParitySyncService` can fetch remote skip rows, upsert local skips, and delete local unskips only when both `paritySync.enabled` and `paritySync.skipSyncEnabled` are true. Defaults remain disabled. Remote rows are applied conservatively to local scheduling by adding skipped dates only; an empty or missing remote list does not delete local skips. Because current local scheduling stores whole-day skips, action-specific remote skip rows are treated as whole-day local skips. This may over-skip, but it fails safe by preventing unintended actions.

PARITY5 does not process command requests, implement a webapp, change configured-site execution behavior, weaken RLS, expose service-role keys to desktop/webapp clients, or approve unattended execution. Deployment and smoke testing are documented in `docs/PARITY_SKIP_SYNC_DEPLOYMENT.md`.

## PARITY6 Schedule/Completion Sync Result

PARITY6 adds `supabase/functions/alilos-schedule-completion-sync/index.ts` for server-side daily schedule and completion-record backup. The function supports POST-only `get-day-state`, `upsert-schedule`, and `upsert-completion`, requires a registered non-personal device id, validates constrained date/action/state fields, rejects forbidden keys and tokenized/sensitive strings, and writes `daily_schedules` / `completion_records` using only the Edge Function service-role environment.

The desktop `ParitySyncService` can fetch the current day state, upload today's generated local schedule rows, and upload existing local completion records only when both `paritySync.enabled` and `paritySync.scheduleCompletionSyncEnabled` are true. Defaults remain disabled. Remote completion rows are never executed and are not imported as local successful completions; a remote-only completion marker is surfaced as a warning so duplicate-risk review can fail safe. Remote absence does not delete local completion records.

PARITY6 does not process command requests, implement a webapp, recover missing local schedules automatically, change configured-site execution behavior, weaken RLS, expose service-role keys to desktop/webapp clients, or approve unattended execution. Deployment and smoke testing are documented in `docs/PARITY_SCHEDULE_COMPLETION_SYNC_DEPLOYMENT.md`.
