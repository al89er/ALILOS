# Decisions

## Confirmed Decisions

| Decision | Status |
| --- | --- |
| Build as Electron + TypeScript. | Reflected in `package.json`, `tsconfig.json`, and source layout. |
| Use a plain HTML/CSS/TypeScript renderer for now. | Reflected in `src/renderer`; no React or router framework is present. |
| Use Playwright for configured-site browser control. | Reflected by `playwright` dependency and `BrowserController`. |
| Use file-based local config and logs. | Reflected by `ConfigStore` and `AppLogger`. |
| Keep real configured-target actions manual-confirm / guarded by default. | Reflected by `ConfirmationService`, dry-runs, one-shot execution, completion tracking, and UI wording. |
| Do not hardcode secrets. | Reflected by local settings forms, `.env.example`, and secret handling guidance. |
| Keep Telegram commands prefixed. | Implemented with default command prefix `alilos`. |
| Do not expose unprefixed Telegram `/clockin` or `/clockout` commands. | No such commands are present in current code. |
| Keep captive portal behavior notify-only for now. | Reflected by `NetworkMonitor` and dashboard text. |
| Add only safe execution modes for Phase 6A: `notify-only`, `manual-confirm`, and `dry-run`. | Reflected by `AutomationSettings.executionMode`; no real silent mode is present. |
| `dry-run` mode must not submit the real configured action. | Automation monitor records telemetry and does not call the real click path. |
| Heartbeat payloads must be sanitized and disabled by default. | Reflected by `HeartbeatSettings` and `HeartbeatPayload`. |
| Dashboard settings editing must be scoped and secret-safe. | Settings IPC edits selected operational fields only; endpoint/token/chat values are masked visually and blank fields preserve existing local secrets. |
| Keep the new Electron app Windows/desktop-only. | Android/mobile access should be through a hosted webapp/PWA, not Electron. |
| Keep the local app local-first. | The desktop agent owns local scheduling, monitoring, logs, and guarded scheduled web action preparation/execution. |
| Keep the old Tampermonkey script and old webapp as fallback/backup references. | They remain legacy references and should not drive new runtime behavior unless explicitly reintroduced. |
| Use Supabase later as a shared monitoring/control plane backend. | Supabase is planned for status heartbeat, backup ledgers, and future webapp/PWA observability; no runtime Supabase features are implemented yet. |
| Telegram remains active now and may become fallback later. | Current Telegram support stays available while hosted webapp/PWA monitoring is planned. |
| Do not store sensitive configured-site or messaging secrets in Supabase. | Excluded data includes configured-site credentials, cookies/session data, raw page HTML, screenshots, staff ID/name, Telegram token/chat ID, and full tokenized URLs or opaque query strings. |
| Do not add remote command/control yet. | Any command queue or control-plane action requires a later explicit approval phase. |

## Decisions Inferred From Repo

| Decision | Evidence |
| --- | --- |
| Main process owns app state and persistence. | Services are instantiated in `src/main/main.ts`; renderer talks through IPC. |
| Shared UPM credentials are stored locally and encrypted with Electron `safeStorage` when possible. | `secret-store.ts`, `institutionCredential`, and Perakam auto-login settings. |
| Configured-site auto-login is allowed but guarded separately from real target execution. | Auto-login has host checks, missing-credential checks, cooldown, result status, and UI controls. |
| `a50`/`a51` are configured morning/evening targets, while `a56`/`a57` are only manual test-click targets. | `attendanceTargetId` and `isTestClickTarget` mappings. |
| SQLite is not needed yet. | No SQLite dependency or database code exists; config/logs are file-based. |
| React is not needed yet. | Plain renderer exists and works with static assets. |
| A Windows Service is not needed yet. | App behavior is Electron/tray-based. |
| Supabase is not a runtime dependency for this app. | Supabase appears only in identity guard docs/scripts. |
| Automation audit records belong in local config for now. | `automation.auditEvents` stores bounded sanitized events. |

## Supabase / Webapp Roadmap Decision

The agreed direction is phased and intentionally conservative:

- S0: Architecture documentation.
- S1: Schema and identity planning.
- S2: Status-only heartbeat.
- S3: Durable schedule/completion backup ledger.
- S4: Phone webapp/PWA status dashboard.
- S5: Command queue/control only after explicit approval.
- S6: Telegram reduced to fallback.

The planned hosted webapp/PWA may later live in this repository under `webapp/`. Until a later implementation phase is approved, the Electron desktop agent remains the only runtime app in this repo and Supabase remains limited to identity guard scripts/docs.

## Decisions Needing Confirmation

- Whether the app should eventually support Telegram confirmation for real configured-target actions.
- Whether real unattended configured-target submission is in scope later, and what explicit confirmation/authorization model is required before implementation.
- Whether Perakam auto-login should be considered production-ready after more manual testing.
- Whether old keep-alive behavior should remain obsolete or be redesigned as a safe diagnostic/reminder feature.
- Whether to add package/build tooling for Windows distribution.
- Whether to add automated tests before more Perakam detection work.
- Whether to update or replace the historical Phase 4D design document now that the implementation has moved beyond it.
- Whether the future Supabase command queue/control phase should exist at all, and what approval model would be required before any remote control action is implemented.
