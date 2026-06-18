# ALILOS Operational Readiness Checklist

This checklist is for safe local Windows desktop use after the P packaging/startup track and W workplace validation track. It does not approve unattended real attendance actions.

## Current Readiness Status

- O operational readiness is mostly complete: O1 checklist added, O2 launch-at-login log wording cleaned up, and O3 real-machine packaged observation completed.
- Packaged `release/win-unpacked/ALILOS.exe` launches and runs.
- Visible app/window title remains `A.L.I.L.O.S.`.
- Packaged userData path is `%APPDATA%\ALILOS`.
- App and tray icons are project-owned ALILOS assets.
- Launch-at-login setting exists, is disabled by default, and simulated `--hidden-at-login` smoke passed.
- Workplace Perakam packaged smoke passed: login-required and dashboard states detected, `a50` and `a51` available, hidden sidebar duplicates ignored.
- Fortinet captive portal detection has a safe no-live-portal workplace baseline; live portal marker validation remains conditional on the portal appearing.
- Scheduled workplace dry-run path passed with `schedule-due`, page preparation, `a51` detection, simulated-only dry-run, and explicit confirmation requirement.
- Lock/idle observation passed. Full sleep/wake suspend-resume remains pending.
- O3 real-machine observation passed for packaged launch, scripted window hide/show, clean quit, sanitized logs, launch-at-login disabled, and completion records unchanged. Visual tray-menu verification, real sign-in/reboot launch-at-login, and full sleep/wake suspend-resume remain pending.
- No real action was attempted in W validation. Completion records stayed `0`.
- Checked logs remained sanitized.
- Supabase heartbeat skeleton exists but remains disabled/deferred.
- Local Perakam auto-login is enabled on the test machine and should be intentionally controlled before future tests.

## O Track Consolidation

- O1 added this operational readiness checklist.
- O2 fixed the launch-at-login log wording to `Launch-at-login setting applied from settings...`.
- O3 real-machine observation passed: packaged `ALILOS.exe` launched, `manual-confirm` was observed, launch-at-login final state was disabled, Network Monitor was active, internet was `online`, Perakam reachability was `login-required`, captive portal was `not-detected`, scripted hide/show IPC passed, Quit completed cleanly, no `ALILOS` process remained, completion records stayed `0`, and sanitized log review passed.
- Current recommendation: go for monitored local use in `manual-confirm`, `dry-run`, or `notify-only`; no-go for fully unattended real execution.
- RC1 monitored real-world observation is planned below for one actual scheduled `manual-confirm` cycle with the user physically present.
- Next track options: perform RC1 when physically ready, continue S3/Supabase planning only after explicit approval, or continue web/PWA planning only after explicit approval.

## Daily Pre-Use Checklist

- Launch `release/win-unpacked/ALILOS.exe`.
- Confirm the selected execution mode is intentional: `notify-only`, `manual-confirm`, or `dry-run`.
- Confirm launch-at-login state is known. Default expected state is disabled.
- Confirm Network Monitor is enabled and active.
- Confirm internet and Perakam reachability status are acceptable.
- Confirm captive portal state is `not-detected` or safely detected with sanitized host/evidence only.
- Confirm Perakam state is expected: login-required or dashboard.
- Confirm the next scheduled action and generated times are visible.
- Confirm skip state for today/tomorrow is intentional.
- Confirm Telegram status if Telegram is being used.
- Confirm Supabase heartbeat/write path remains disabled/deferred unless a later approved task changes that.
- Confirm local Perakam auto-login is intentionally enabled or disabled for the session.

## Safe Operating Modes

- `notify-only`: safest observational mode; no configured target action should run.
- `manual-confirm`: acceptable monitored mode; real configured action remains behind explicit user confirmation.
- `dry-run`: safest scheduled validation mode; prepares/checks the page and records simulated-only results.
- Fully unattended real attendance action is not approved and has not been validated.

## Before Trusting Scheduled Execution

- Confirm today's generated morning and evening times.
- Confirm skip state is correct.
- Confirm the next pending action matches expectation.
- Confirm Perakam dashboard is reachable.
- Confirm `a50` or `a51` target availability only on the visible dashboard tile.
- Confirm hidden sidebar duplicate candidates are ignored.
- Confirm confirmation is required before any real configured action.
- Confirm local completion records are not stale or unexpected.
- Confirm recent logs contain sanitized status only.
- Keep execution mode as `dry-run` or `manual-confirm` unless a future explicit approval changes this.

## Workplace And Network Checks

- Confirm Perakam dashboard is reachable from the workplace network.
- Confirm Network Monitor reports internet/Perakam state clearly.
- Confirm Fortinet captive portal state is either `not-detected` or safely detected.
- Captive portal handling is detection-only.
- Do not submit a Fortinet captive portal form from ALILOS.
- Do not store portal credentials, hidden input values, cookies, raw HTML, screenshots, full portal paths, query strings, hashes, or `link=` values.
- If Fortinet appears later, record only sanitized host/origin/port and safe reason text.

## Recovery Checklist

### App Closed Or Crashed

- Relaunch `release/win-unpacked/ALILOS.exe`.
- Confirm execution mode before continuing.
- Confirm scheduler, network monitor, Telegram, and Browser / Site status.
- Review recent logs for sanitized error text only.

### Browser Stuck

- Use Browser / Site controls to stop and start the browser.
- Reopen Perakam.
- Confirm state returns to login-required or dashboard.
- Do not click real target controls while recovering.

### Perakam Session Expired

- Reopen Perakam.
- Log in manually or intentionally use local Perakam auto-login if enabled.
- Confirm dashboard and target availability again.
- Do not store or print credentials.

### Captive Portal Detected

- Treat it as detection-only.
- Use only sanitized host/origin/port and safe reason text.
- Complete network login outside ALILOS if needed.
- Recheck Network Monitor and Perakam after network access is restored.

### PC Locked, Slept, Or Returned From Idle

- Confirm app process/window/tray state.
- Confirm Network Monitor is active and current.
- Confirm scheduler state and next action.
- Confirm browser and Perakam status.
- Full sleep/wake suspend-resume remains a release-candidate blocker until tested.

### Config Looks Wrong

- Do not perform real actions.
- Confirm `%APPDATA%\ALILOS\config.json` belongs to the expected Windows user profile.
- Confirm execution mode, schedule, skips, launch-at-login, Perakam auto-login, Telegram, and Supabase heartbeat settings.
- Prefer restoring known-good local config over editing during a due action window.

### Accidental Launch-At-Login Enabled

- Open Settings, uncheck `Start ALILOS when I sign in to Windows`, save, and quit from the tray.
- If the UI is unavailable, disable `ALILOS` in Windows Startup Apps or Task Manager Startup apps.
- Relaunch manually and confirm the setting is disabled.

## Release-Candidate Blockers

- Full sleep/wake suspend-resume not tested.
- Real Windows sign-in/reboot launch-at-login behavior pending.
- Visual tray-menu verification pending.
- Live Fortinet portal marker validation pending until the portal appears.
- Real scheduled manual-confirm at actual clock-in/out time not tested.
- Fully unattended real action remains not approved and not validated.
- Installer and signing remain optional release decisions.
- Supabase schedule/completion sync remains deferred until explicit S3 approval.

## RC1 Monitored Real-World Observation Plan

RC1 is planning only. Do not perform a real Perakam action from Codex. RC1 is for one actual scheduled morning or evening cycle in `manual-confirm` with the user physically present.

Current go/no-go remains:

- Go for monitored local use in `manual-confirm`.
- Go for `dry-run` and `notify-only`.
- No-go for fully unattended real execution.

### Pre-Use Setup

- Use packaged `release/win-unpacked/ALILOS.exe`.
- Confirm mode is `manual-confirm`.
- Confirm the user is physically present and watching.
- Keep launch-at-login disabled unless RC1 is explicitly testing startup behavior.
- Review completion records before the test and confirm no stale/unexpected completion blocks exist.
- Keep the Network/status panel visible.
- Keep Logs available for review.
- Do not require `.env.local` or secrets for RC1.
- Confirm Supabase heartbeat/write path remains disabled/deferred unless a later approved task changes it.

### Observation Target

- Observe one actual scheduled morning or evening cycle.
- Use the actual target window selected by the existing local scheduler.
- The app may prepare Perakam and detect the configured target.
- The user must manually decide whether to confirm or cancel.
- No unattended action is allowed.

### What To Observe

- App launch state.
- Tray/window state.
- Schedule due detection.
- Perakam login/session/dashboard state.
- Target detection.
- Notification/manual-confirm dialog behavior.
- User confirm/cancel outcome.
- Completion-state record.
- Post-click verification state if the user confirms.
- Log sanitization.

### Abort Conditions

Abort RC1 and do not continue toward a real action if any of these occur:

- Wrong action target.
- Unexpected unattended click.
- Fortinet/captive portal uncertainty.
- Stale/login error loop.
- Target detection ambiguity.
- Unsanitized log output.
- App instability/crash.
- User not physically present.

### Result Classification

- Pass: expected monitored `manual-confirm` flow, sanitized logs, and expected completion/verification state if confirmed.
- Pass with observation: safe flow completed, but a non-blocking issue or follow-up was observed.
- Fail/blocker: safety issue, wrong target, unexpected click, unsanitized output, crash, or other blocker.
- Inconclusive/deferred: the scheduled window, network, Perakam state, or user availability did not permit a complete observation.

### RC1 Result Template

```text
RC1 monitored observation result
- Date/time:
- Environment: work/home, network status:
- Mode:
- Scheduled action:
- User present: yes/no
- Observed states:
- Confirm/cancel:
- Completion record state:
- Verification state:
- Sanitized log review:
- Result classification:
- Follow-up item:
```

## O3 Real-Machine Observation

- Packaged `release/win-unpacked/ALILOS.exe` launched successfully on the real Windows machine.
- Execution mode observed: `manual-confirm`.
- Launch-at-login observed final state: disabled.
- Local Perakam auto-login observed: enabled with shared local credential; credential values were not exposed.
- Network Monitor observed: active, internet `online`, Perakam reachability `login-required`, captive portal `not-detected`.
- Scheduler observed: both actions were already missed for the day; no due action was executed.
- Scripted window hide/show IPC completed and the app quit cleanly.
- Quit result: no `ALILOS` process remained.
- Completion records remained `0`.
- Sanitized log review found no checked credential, cookie, raw HTML, full tokenized URL, or `link=` patterns.
- Not performed: visual tray-menu click verification, real Windows sign-in/reboot launch-at-login, and sleep/wake suspend-resume.

## Go / No-Go

- Go for monitored local use in `manual-confirm` or `dry-run` with the checklist above.
- Go for notify-only observation.
- No-go for fully unattended real execution.
- No-go for Supabase-backed schedule/completion sync until explicitly planned and approved.
