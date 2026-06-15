# A.L.I.L.O.S. Electron Attendance Assistant — Project Plan and Handoff Notes

**Prepared for:** Al  
**Context:** Continuation document for future ChatGPT sessions  
**Date:** 2026-06-15  
**Related source:** `Tampermonkey Script - Perakam Waktu.txt`

---

## 1. Purpose of This Document

This document captures the planning decisions and agreed direction from the discussion about converting the existing personal Tampermonkey script into a standalone Windows desktop application.

It is intended to be added to the project sources/knowledge so that future conversations can continue the work without needing to reconstruct the background from scratch.

---

## 2. Existing Source: Tampermonkey Script Summary

The current uploaded source is a Tampermonkey userscript for `https://perakamwaktu.upm.edu.my/*`.

The script currently provides:

1. **Automatic scheduled clock-in and clock-out**
   - Clock-in random window: **7:45 AM – 7:50 AM**
   - Clock-out random window: **5:05 PM – 5:10 PM**
   - Same generated times are reused for the day via `localStorage`.

2. **Weekend exclusion**
   - No automatic clocking on Saturday or Sunday.

3. **Auto-refresh before scheduled actions**
   - Reloads the page one minute before scheduled clock-in/clock-out.

4. **Smart button detection**
   - Handles direct IDs such as:
     - `a50` = clock in
     - `a51` = clock out
   - Also searches buttons, inputs, anchors, role buttons, and iframes.
   - Checks for visibility/clickability before clicking.

5. **Missed-action retry**
   - Uses a 5-minute grace period to retry missed clock-in/out if the page loads late.

6. **Keep-alive system**
   - Clicks randomly between keep-alive IDs `a56` and `a57` every 1 minute.
   - Attempts to expand hidden side-menu items before clicking.

7. **Floating browser panel**
   - Shows scheduled in/out times.
   - Includes a test Telegram notification button.
   - Displays a live log box.

8. **Telegram notifications**
   - Sends notifications for script activity, clock actions, status, errors, refresh, and reset events.

9. **Telegram remote commands**
   - `/start`, `/help`
   - `/clockin`
   - `/clockout`
   - `/status`
   - `/skip`
   - `/unskip`
   - `/skipnext`
   - `/unskipnext`
   - `/skips`
   - `/refresh`
   - `/hardreset`

10. **Skip/unskip system**
    - Stores skipped dates in `localStorage.upmSkips`.

11. **Periodic reload**
    - Reloads page every 8 hours.

### Existing concerns

- Telegram bot token and chat ID are hardcoded directly inside the script.
- The script depends on the browser tab being open, logged in, awake, and not suspended.
- It may fail if the Perakam Waktu site changes its layout, IDs, or login/session behavior.
- Attendance automation must remain within user authorization and relevant institutional rules.

---

## 3. Agreed Direction

The preferred direction is to build a standalone Windows application using:

```text
Electron + TypeScript + Playwright
```

This was preferred over Python because:

- The current Tampermonkey code is already JavaScript-based.
- The existing logic can be ported more naturally.
- Electron provides a better desktop GUI experience.
- TypeScript improves maintainability and AI-assisted refactoring.
- Playwright is suitable for robust browser/session automation.

Python was acknowledged as potentially simpler for background reliability, but Electron is preferred because this project benefits from a proper GUI, dashboard, and JavaScript continuity.

---

## 4. Safety and Compliance Boundary

The app should be designed as a **Windows attendance assistant**, not an unauthorized silent attendance bot.

The safer default mode should be:

```text
Detect → Prepare → Notify → Require confirmation → Execute
```

Recommended default behavior:

- Remind the user when clock-in/out time approaches.
- Open or prepare the Perakam Waktu page.
- Detect the correct clock button.
- Ask for user confirmation through GUI, Windows notification, Telegram, or phone webapp.
- Perform the action only after confirmation.

Possible modes:

1. **Notify-only mode**
   - Warns/reminds user only.

2. **Assisted mode**
   - Opens the page, detects the action, and guides the user.

3. **Manual-confirm mode**
   - App prepares everything but requires confirmation before clicking.

4. **Admin/debug mode**
   - Shows internal button detection, browser state, scheduler state, logs, and command status.

Any fully unattended attendance action should only be considered if explicitly authorized and compliant with the relevant policy.

---

## 5. Proposed High-Level Architecture

```text
Electron App
│
├── Main Process
│   ├── App lifecycle
│   ├── Tray menu
│   ├── Startup handling
│   ├── IPC coordination
│   └── Notification bridge
│
├── Background Worker
│   ├── Scheduler
│   ├── Internet monitor
│   ├── Captive portal monitor/login helper
│   ├── Telegram bot/controller
│   ├── Phone webapp heartbeat sender
│   ├── Playwright browser controller
│   ├── Perakam status checker
│   └── Logging system
│
├── Renderer / GUI
│   ├── Dashboard
│   ├── Settings
│   ├── Logs
│   ├── Skip dates
│   ├── Manual controls
│   ├── Internet/captive portal status
│   ├── Perakam status
│   └── Telegram/webapp status
│
├── Preload Bridge
│   └── Safe IPC between renderer and main process
│
└── Local Storage
    ├── Config file or SQLite database
    ├── Encrypted secrets
    ├── Schedule history
    ├── Skip dates
    └── Logs/events
```

---

## 6. Recommended Project Structure

Initial simple version:

```text
alilos-attendance-assistant/
│
├── package.json
├── tsconfig.json
├── electron-builder.yml
├── .env.example
│
├── src/
│   ├── main/
│   │   ├── main.ts
│   │   ├── tray.ts
│   │   ├── ipcHandlers.ts
│   │   ├── workerManager.ts
│   │   └── notifications.ts
│   │
│   ├── worker/
│   │   ├── worker.ts
│   │   ├── scheduler.ts
│   │   ├── browserController.ts
│   │   ├── perakamService.ts
│   │   ├── telegramService.ts
│   │   ├── networkMonitor.ts
│   │   ├── captivePortal.ts
│   │   ├── phoneHeartbeat.ts
│   │   ├── logger.ts
│   │   └── stateMachine.ts
│   │
│   ├── renderer/
│   │   ├── index.html
│   │   ├── renderer.ts
│   │   ├── styles.css
│   │   └── components/
│   │       ├── Dashboard.ts
│   │       ├── Settings.ts
│   │       ├── Logs.ts
│   │       └── SkipDates.ts
│   │
│   ├── preload/
│   │   └── preload.ts
│   │
│   └── shared/
│       ├── types.ts
│       ├── constants.ts
│       ├── config.ts
│       └── events.ts
│
└── data/
    ├── config.json
    ├── logs/
    └── app.db optional later
```

Recommended first version should avoid React initially unless needed. Start with plain HTML/CSS/TypeScript GUI to reduce complexity, then upgrade later.

---

## 7. Core Modules

### 7.1 Scheduler

Responsibilities:

- Generate daily clock-in/clock-out times.
- Preserve generated times for the same day.
- Skip weekends.
- Respect skip/unskip dates.
- Trigger reminder events.
- Trigger page preparation events.
- Handle grace-period logic.

Equivalent logic from Tampermonkey:

- `randomTimeBetween()`
- `loadScheduleTimes()`
- `scheduleAction()`
- `checkMissedActions()`

### 7.2 Browser Controller

Technology: **Playwright**.

Responsibilities:

- Launch and manage Chromium browser session.
- Maintain a persistent browser profile if needed.
- Navigate to Perakam Waktu dashboard.
- Detect login/session state.
- Detect clock-in/clock-out buttons.
- Detect keep-alive buttons.
- Reload page when needed.
- Provide status back to GUI and phone webapp.

Important design choice:

- Avoid visible-screen coordinate clicking.
- Use Playwright DOM locators and selectors wherever possible.
- Prefer robust detection over fragile hardcoded clicks.

### 7.3 Perakam Service

Responsibilities:

- Know Perakam URLs and button identifiers.
- Map actions to selectors/IDs.
- Provide page state:
  - logged in
  - logged out
  - dashboard reachable
  - clock-in button available
  - clock-out button available
  - unknown/error

Initial constants:

```text
DASHBOARD_URL = https://perakamwaktu.upm.edu.my/
CLOCK_IN_ID = a50
CLOCK_OUT_ID = a51
KEEP_ALIVE_IDS = a56, a57
```

### 7.4 Telegram Service

Responsibilities:

- Send Telegram notifications.
- Receive Telegram commands.
- Validate chat ID.
- Support commands:
  - `/status`
  - `/skip`
  - `/unskip`
  - `/skipnext`
  - `/unskipnext`
  - `/skips`
  - `/refresh`
  - `/hardreset`
  - `/test`
  - future confirmation commands such as `/confirm_clockin` and `/confirm_clockout`

Security improvement:

- Do not hardcode bot token in source.
- Store token securely or in config outside version control.

### 7.5 Network Monitor

Responsibilities:

- Detect whether local network is connected.
- Detect whether true internet access exists.
- Detect captive portal redirect.
- Report network state to GUI, logs, Telegram, and phone webapp.

Recommended states:

```text
online
offline
local_network_only
captive_portal_suspected
captive_portal_detected
checking
unknown
```

### 7.6 Captive Portal Login Helper

Purpose:

- If internet appears blocked by a login portal, the Electron worker can open the captive portal page and perform an authorized login using the user’s own saved credentials.

Recommended modes:

1. **Notify only**
   - Alert user that portal login is required.

2. **Assisted login**
   - Open portal and fill username/password.
   - User clicks submit.

3. **Auto-login for trusted portal**
   - Automatically submit login only for known/approved portal URL and authorized account.

Important limitations:

- Cannot bypass CAPTCHA.
- Cannot bypass OTP.
- Cannot bypass device approval.
- May break if portal HTML changes.
- Must only be used with the user’s own authorized credentials.

### 7.7 Phone Webapp Heartbeat

The Electron app should report its status to the existing phone webapp/backend.

Pattern:

```text
Electron App → Backend / Database → Phone Webapp
```

Recommended backend options:

- Supabase
- Firebase
- Existing backend used by current webapp
- Vercel/Node API

The Electron app should send a heartbeat every 15–60 seconds.

Example payload:

```json
{
  "deviceId": "windows-pc",
  "appStatus": "running",
  "internetStatus": "online",
  "portalStatus": "not_detected",
  "perakamStatus": "reachable",
  "telegramStatus": "connected",
  "nextClockIn": "2026-06-15T07:47:00+08:00",
  "nextClockOut": "2026-06-15T17:08:00+08:00",
  "lastSeen": "2026-06-15T07:40:00+08:00",
  "lastError": null
}
```

If the desktop app loses internet completely, it cannot directly report the problem. The phone webapp must infer this from a stale `lastSeen` timestamp.

---

## 8. Phone Webapp Status Messages

The phone webapp should show different warnings based on Electron status.

### All OK

```text
✅ Desktop online
Internet OK
Perakam reachable
Next action: Clock-in reminder at 7:47 AM
```

### Captive portal detected

```text
🔐 Internet login required
Captive portal detected
Auto-login in progress...
```

### Captive portal login successful

```text
✅ Internet restored
Captive portal login successful
Rechecking Perakam...
```

### Captive portal login failed

```text
⚠️ Internet login failed
Captive portal detected, but auto-login did not succeed
Manual action needed on Windows PC
```

### Desktop app unreachable

```text
🔴 Desktop app unreachable
Possible causes: PC asleep, app closed, no internet, user logged out, or network blocked
```

### Perakam unreachable

```text
⚠️ Perakam Waktu unreachable
Internet may be working, but the Perakam page cannot be reached
```

### Perakam session/login issue

```text
⚠️ Perakam login/session issue
Manual login may be required
```

### Recommended warning priority

```text
1. Heartbeat lost / desktop unreachable
2. Captive portal login failed
3. Captive portal login attempting
4. Perakam unreachable
5. Perakam login/session issue
6. Telegram disconnected
7. Schedule warning
8. All OK
```

---

## 9. Captive Portal State Machine

Recommended state flow:

```text
ONLINE
↓
CONNECTIVITY_DEGRADED
↓
CAPTIVE_PORTAL_DETECTED
↓
PORTAL_LOGIN_ATTEMPTING
↓
PORTAL_LOGIN_SUCCESS
or
PORTAL_LOGIN_FAILED
or
HEARTBEAT_LOST
```

Important detail:

- If possible, the Electron app should report `CAPTIVE_PORTAL_DETECTED` to the backend before attempting auto-login.
- If the internet path to the backend is fully blocked, the phone webapp will only see stale heartbeat until the desktop regains internet.

---

## 10. Multiple Windows User Accounts / Locked PC Behavior

The user’s current PC has two Windows accounts. The user often locks their own account, and other people sometimes use the other account.

This affects app reliability depending on how the app is deployed.

### Expected behavior

| Situation | Expected effect |
|---|---|
| User locks PC only | App should usually keep running if account remains signed in |
| User switches account | App may continue in background, but browser automation needs testing |
| User logs out | Normal Electron app stops |
| PC sleeps | App cannot run until PC wakes |
| Other account uses PC | App in user account does not automatically run in other account |

### Recommended design

Use a separation between:

```text
Background worker
+
Electron GUI
```

The worker handles critical monitoring. The GUI is just the dashboard/control panel.

### Deployment levels

| Setup | Locked account | Switched user | Logged out |
|---|---|---|---|
| Normal Electron tray app | Usually works | Maybe works | No |
| Scheduled task at user login | Usually works | Usually works | No |
| Windows Service | Best | Best | Yes, after boot |

Recommended phased approach:

1. Start with Electron tray app + background worker at user login.
2. Later consider Windows Service if it must run even when logged out or after reboot before login.

---

## 11. Reliability Considerations

Reliability means the app should not fail silently.

It should handle:

- App started/stopped.
- Browser crashed.
- Page not reachable.
- Perakam session expired.
- Network disconnected.
- Captive portal detected.
- Telegram failure.
- Backend heartbeat failure.
- PC locked or switched user.
- Missed scheduled action.
- Log persistence.

Recommended reliability features:

- File logs.
- GUI log viewer.
- Phone heartbeat.
- Telegram backup alerts.
- Browser restart logic.
- Network retry logic.
- Explicit state machine.
- Health status panel.
- Export logs button.
- Startup launch option.

---

## 12. Security Plan

### Secrets

Do not hardcode:

- Telegram bot token
- Telegram chat ID
- Backend API keys
- Captive portal credentials
- Perakam credentials, if ever used

Recommended storage:

- Windows Credential Manager where possible.
- Environment file for development only.
- Encrypted local config for packaged app.
- `.env.example` committed, `.env` ignored.

### App security

Electron-specific recommendations:

- Disable Node integration in renderer.
- Use context isolation.
- Use a strict preload bridge.
- Avoid exposing secrets to the renderer.
- Validate IPC commands.
- Avoid remote code execution patterns.
- Keep dependencies minimal.

---

## 13. Initial Development Phases

### Phase 1 — Electron shell

Build:

- Main window.
- Tray icon.
- Start/minimize-to-tray behavior.
- Basic dashboard.
- Basic settings page.
- File logger.

### Phase 2 — Port existing scheduling logic

Build:

- Daily random clock-in/out time generation.
- Saved schedule per day.
- Skip/unskip today.
- Skip/unskip tomorrow.
- Weekend exclusion.
- Log panel.

### Phase 3 — Telegram integration

Build:

- Telegram config screen.
- Test notification.
- `/status`.
- `/skip`.
- `/unskip`.
- `/skips`.
- Confirmation command placeholders.

### Phase 4 — Playwright browser controller

Build:

- Launch Chromium.
- Open Perakam dashboard.
- Detect login/session state.
- Detect clock-in/out buttons.
- Detect keep-alive buttons.
- Report page state.
- Manual-confirm clock action.

### Phase 5 — Internet and captive portal monitor

Build:

- Internet status check.
- Captive portal detection.
- Portal state machine.
- Notify-only and assisted-login modes.
- Auto-login only for trusted portal and authorized account.

### Phase 6 — Phone webapp integration

Build:

- Backend heartbeat sender.
- Status payload.
- Stale heartbeat detection support.
- Phone warning states.
- Event history/log sync.

### Phase 7 — Reliability hardening

Build:

- Browser crash recovery.
- Worker crash recovery.
- Startup task.
- Better error messages.
- Log export.
- Health checks.
- Optional Windows Service investigation.

---

## 14. Suggested First MVP

The first MVP should be intentionally small:

```text
Electron + TypeScript
Plain HTML/CSS dashboard
File-based config
File-based logs
Daily schedule generator
Skip/unskip dates
Telegram test notification
System tray
Manual status updates
```

Then add Playwright after the shell is stable.

Avoid starting with:

- React
- SQLite
- Auto-update
- Windows Service
- Full credential encryption
- Complex portal automation

These can be added later.

---

## 15. Continuation Prompt for Future ChatGPT Session

Use the following prompt in a new chat if continuation is needed:

```text
We are continuing the A.L.I.L.O.S. Electron Attendance Assistant project.

Relevant project source: Tampermonkey Script - Perakam Waktu.txt.
Also refer to this planning document: A.L.I.L.O.S. Electron Attendance Assistant — Project Plan and Handoff Notes.

The goal is to convert the existing personal Tampermonkey script into a standalone Windows Electron + TypeScript + Playwright app with GUI, tray mode, background worker, Telegram integration, phone webapp heartbeat, internet/captive portal monitoring, and safe manual-confirm attendance assistance.

Important agreed decisions:
- Prefer Electron + TypeScript + Playwright.
- Start without React if possible.
- Use Electron GUI + separate background worker.
- Default to safe manual-confirm mode for attendance actions.
- Add captive portal detection/login helper for authorized network account.
- Integrate with existing phone webapp using heartbeat/status payload.
- Phone webapp should distinguish captive portal login attempts from full desktop unreachable state.
- PC has two Windows accounts; user often locks account and others may use the second account.
- Initial deployment should be tray app + background worker at user login, with optional Windows Service later.

Please continue from the planning document and help build the project step by step.
```

---

## 16. Open Questions for Next Session

1. What technology does the existing phone webapp use?
   - Supabase?
   - Firebase?
   - Vercel?
   - Custom backend?

2. Does the captive portal have:
   - simple username/password form?
   - CAPTCHA?
   - OTP?
   - device approval?

3. Does Perakam require manual login every time, or does the browser session persist?

4. Should the first MVP use:
   - plain HTML/CSS/TypeScript renderer, or
   - React from the start?

5. Should logs be file-based first or SQLite first?

6. Should the app support multiple device profiles later?

7. Does the user want the app to install per-user or system-wide?

---

## 17. Final Agreed Recommendation

For this user and project, the recommended stack is:

```text
Electron + TypeScript + Playwright
```

Recommended architecture:

```text
Electron GUI
+
Separate Node background worker
+
Playwright browser controller
+
Telegram integration
+
Phone webapp heartbeat
+
Captive portal monitor/login helper
+
File logs/config first
+
SQLite/encrypted credential storage later
```

Recommended build philosophy:

```text
Start simple, make it observable, avoid silent failures, then harden reliability.
```
