# App Structure

There is no web/PWA companion app in this repository yet. WEB1-WEB3 planning lives in `docs/WEB_COMPANION_PLAN.md`; a future web companion may live under an isolated `webapp/` boundary only after explicit approval. The legacy/current `al89er/perakamwaktu` webapp is reference/fallback only and is not imported into this repo.

## Runtime And Scripts

Detected from `package.json`:

| Item | Value |
| --- | --- |
| App name | `alilos` |
| Runtime | Electron `^33.2.1` |
| Language | TypeScript `^5.7.2` |
| Browser automation | Playwright `^1.60.0` |
| Main entry | `dist/main/main.js` |
| Module target | CommonJS, ES2022 |

Scripts:

| Script | Purpose |
| --- | --- |
| `npm run dev` | Build, then run `electron .`. |
| `npm run build` | Clean `dist`, compile TypeScript, copy renderer assets. |
| `npm run typecheck` | Run `tsc --noEmit`. |
| `npm run check:identity` | Check local GitHub/Supabase identity guard files. |
| `npm run check:supabase` | Check local Supabase identity safety. |

## Main Process

Main process files live in `src/main`:

| File | Responsibility |
| --- | --- |
| `main.ts` | App lifecycle, single-instance lock, BrowserWindow creation, service wiring, IPC handlers, snapshot building, tray behavior coordination, Perakam auto-login orchestration. |
| `tray.ts` | Tray creation with show/hide/quit controls. The tray currently uses an empty native image. |
| `config-store.ts` | Loads/saves local JSON config and normalizes defaults/migrations. |
| `logger.ts` | Appends JSON-line logs under user data and returns recent entries. |
| `secret-store.ts` | Wraps Electron `safeStorage` for local password encryption/decryption. |
| `telegram-service.ts` | Telegram send, polling, command prefix handling, chat authorization, token/error sanitization. |

The main process creates the renderer window with context isolation enabled and Node integration disabled. The preload script is loaded from `dist/preload/preload.js`.

## Worker And Background Services

Worker-side files live in `src/worker`:

| File | Responsibility |
| --- | --- |
| `background-worker.ts` | Heartbeat scaffold. Its snapshot explicitly says no Perakam clicking or captive portal login is implemented in this class. |
| `automation-monitor.ts` | Phase 6A automation monitor that records due schedule events, prepares/checks the configured site profile in dry-run mode, and simulates web-action telemetry without clicking. |
| `automation-audit.ts` | Bounded sanitized automation audit event persistence. |
| `heartbeat-service.ts` | Disabled-by-default heartbeat sender and status snapshot built from sanitized app state. |
| `scheduler.ts` | Daily schedule generation, weekend/skip handling, due/grace/missed states, status transition logging. |
| `reminder-service.ts` | 30-second reminder evaluation, system notifications, Telegram reminders, duplicate suppression, notification-state retention. |
| `browser-controller.ts` | Playwright persistent browser context, configured-site navigation/status classification, target button detection, guarded DOM clicks, test target diagnostics, auto-login form interaction, post-click verification. |
| `confirmation-service.ts` | Manual action readiness, confirmation lifecycle, dry-run safety checks, guarded one-shot click execution, completion persistence, manual verification. |
| `test-click-service.ts` | Guarded manual test-click flow for non-primary targets `a56` and `a57`. |
| `network-monitor.ts` | Notify-only internet/Perakam reachability checks, captive portal detection, notifications, portal URL open/copy support. |

## Preload Bridge

`src/preload/preload.ts` exposes a typed `window.alilos` API through Electron `contextBridge`. It maps renderer calls to IPC channels for:

- dashboard snapshots
- window show/hide
- schedule skip/unskip
- safe app settings snapshot/save
- Telegram settings and test notifications
- network monitor settings/checks/portal actions
- browser start/stop/status
- Perakam open/status/auto-login
- configured-action confirmation/dry-run/execution/manual verification
- manual test-click checks/dry-run/execution
- snapshot update subscription

The shared API shape is declared in `src/shared/types.ts`.

## Renderer

Renderer files live in `src/renderer`:

| File | Responsibility |
| --- | --- |
| `index.html` | Single static dashboard page organized into tab panels: Overview, Schedule, Actions, Browser / Site, Network, Telegram, Logs, and Settings. |
| `renderer.ts` | DOM wiring, tab navigation, snapshot rendering, form handling, IPC calls through `window.alilos`, button enable/disable logic. |
| `styles.css` | Plain CSS tabbed layout, cards, forms, status pills, and responsive styles. |
| `global.d.ts` | Renderer global type declaration for `window.alilos`. |

There is no React, router, component framework, or frontend build tool beyond TypeScript compilation and static asset copying.

The tab structure is presentation-only. Existing DOM IDs, preload API calls, target mappings, Telegram commands, network detection, and confirmation/execution paths are preserved.

The Settings tab uses the typed settings IPC to edit selected operational config only. It masks heartbeat endpoint and Telegram credential values visually, preserves blank secret fields, and leaves generated schedules, completions, audit events, target mappings, raw logs, raw page content, cookies/session data, screenshots, and personal identifiers out of editable settings.

## Shared Types

`src/shared/types.ts` defines the cross-process contract for:

- app config
- scheduler snapshots
- reminders
- Telegram polling/test results
- network/captive portal snapshots
- browser and Perakam status
- configured-action readiness, confirmations, dry-runs, executions, verification, completions
- test-click diagnostics and execution state
- automation execution mode, dry-run telemetry, audit events, and heartbeat payloads
- the `AlilosApi` preload contract

## Config Storage Pattern

`ConfigStore` writes `config.json` under Electron `app.getPath("userData")`. The default config includes:

- worker settings
- action placeholders and completions by date
- scheduler windows, skips, generated schedules, reminder state
- Telegram settings, including default command prefix `alilos`
- shared institution credential fields
- Perakam dashboard and auto-login settings
- network monitor settings
- automation execution mode and audit events
- heartbeat settings

UPM passwords are stored encrypted with Electron `safeStorage` when available. Telegram bot tokens and chat IDs are currently stored in the local config file, so they must not be committed or printed.

Automation execution mode defaults to `manual-confirm`. Phase 6A supports `notify-only`, `manual-confirm`, and `dry-run`; no real silent execution mode is implemented.

Heartbeat settings are disabled by default. Dashboard snapshots expose only status, endpoint host, timing, sanitized errors, and sanitized payload data, not endpoint secrets or credentials.

## Logging Pattern

`AppLogger` writes JSON lines to:

```text
<Electron userData>/logs/alilos.log
```

The dashboard reads and displays the latest log entries. Log messages sanitize obvious tokens/URLs in sensitive paths, but future work should continue avoiding raw secrets in messages.

## IPC/API Boundaries

The renderer does not access Node APIs directly. It calls the typed preload API, which invokes `ipcMain.handle` channels in `main.ts`. Main owns config, services, browser state, confirmation state, and persistence.

## Browser Controller And Site Detection

`BrowserController` launches a non-headless Playwright Chromium persistent context at:

```text
<Electron userData>/playwright-profile
```

It classifies configured-site states including `not-opened`, `loading`, `reachable`, `dashboard`, `login-required`, `stale-session`, `likely-logged-in`, `likely-login-required`, `unknown`, and `error`. It detects visible target buttons for:

- `a50` / morning action / Masa Hadir
- `a51` / evening action / Masa Keluar

It ignores hidden/sidebar-style candidates when deciding actionable controls, prefers dashboard-area candidates under `.right_col` / `.top_tiles`, and can treat a target anchor as visible when a meaningful dashboard descendant such as `.tile-stats`, `.animated`, `.count`, or `h3` has a visible bounding box. Displayed URLs are sanitized.

## Perakam Fixtures

`fixtures/perakam` is reserved for sanitized structural Perakam page fixtures and a sanitized legacy Tampermonkey reference used for detector debugging and future tests. Runtime app logic must not depend on these files.

Raw captured page sources belong only temporarily under `fixtures/perakam/raw/`, which is ignored by Git except for `.gitkeep`.

Sanitized fixtures currently cover login, dashboard, stale/session, and legacy userscript reference structures. They are committed only after redaction review.

## Telegram Integration

`TelegramService` sends messages and polls Telegram every 10 seconds when enabled and configured. It accepts commands only from the configured chat ID and only when commands use the configured prefix. With the default prefix, commands are:

- `/alilos_start`
- `/alilos_help`
- `/alilos_status`
- `/alilos_skip`
- `/alilos_unskip`
- `/alilos_skipnext`
- `/alilos_unskipnext`
- `/alilos_skips`

There are no Telegram real-action commands in the current code.

## Network And Captive Portal Monitoring

`NetworkMonitor` is notify-only. It probes public endpoints, does a DNS fallback, checks Perakam reachability, detects/suspects captive portals from redirects or login-like HTML, retains sanitized evidence for a configurable time, and can open/copy a detected portal URL. It does not perform captive portal login.
