# Project Brief

This documentation reflects the current repository after inspection, not only the original Tampermonkey plan.

## What A.L.I.L.O.S. Is

A.L.I.L.O.S. is an Electron desktop authorized website automation assistant for a configured legacy site profile. The current site profile is the UPM Perakam Waktu workflow. It is a Windows-oriented desktop app built with TypeScript, a plain renderer, file-based local state, Telegram integration, Playwright browser control, and a guarded manual-confirm web-action workflow.

## Problem It Solves

The app helps the user remember and safely prepare configured morning and evening web actions. It generates daily randomized action times, reminds the user near those times, opens and inspects the configured site in a controlled browser session, reports readiness, and requires explicit confirmation before a guarded real target click.

## Relationship To The Original Tampermonkey Script

The project is derived from an earlier Tampermonkey workflow for the current legacy site profile:

- historical morning-action target: `a50`
- historical evening-action target: `a51`
- older keep-alive targets: `a56` and `a57`
- original behavior included randomized morning/evening windows, weekend exclusion, skip dates, refresh/retry behavior, Telegram notifications/commands, keep-alive clicks, and DOM button detection

The current repository is no longer a userscript. It is an Electron app with explicit UI state, local config/log files, Playwright browser automation, and guarded confirmation. `a56` and `a57` are currently used only by a manual test-click pipeline, not as keep-alive automation.

## Safe-Assistance Boundary

The current direction is guarded authorized web-action assistance:

```text
Detect -> Prepare -> Notify -> Require confirmation -> Execute one guarded action
```

The app should not become an uncontrolled background submitter. The current code requires readiness checks, confirmation, dry-run checks, and one-shot guarded execution before a real configured-target click. If verification is uncertain, the user is asked to visually confirm in the configured-site browser, and the app blocks automatic repeat execution for the same date/action.

## Core Responsibilities

| Area | Current responsibility |
| --- | --- |
| Scheduling | Generate and persist daily randomized morning/evening action times, skip weekends, respect skipped dates, expose due/grace/missed state. |
| Reminder/confirmation | Send system/Telegram reminders and maintain manual confirmation, dry-run, execution, completion, and manual verification state. |
| Site detection | Open the configured site profile in Playwright, classify login/dashboard/stale-session states, detect `a50`/`a51` target buttons, sanitize URLs and evidence. |
| Telegram | Store local Telegram settings, send test/reminder/network notifications, poll prefixed commands for status and skip/unskip actions. |
| Logs | Append JSON-line local logs and display recent entries in the dashboard. |
| Config | Store app config locally under Electron user data; keep generated schedules, skips, completions, reminders, Telegram settings, Perakam settings, and network settings in one JSON file. |
| Network/captive portal | Notify-only internet and Perakam reachability monitoring, passive captive portal detection, evidence retention, external portal opening/copying. |

## Current Drift From The Older Plan

- The current site profile default URL is `https://perakamwaktu3.upm.edu.my/`; the legacy URL is still tracked for display/context.
- The app has progressed beyond the older Phase 4D design document: guarded attendance execution and Perakam auto-login now exist.
- The `BackgroundWorker` class still describes itself as a scaffold, even though many worker-side services are implemented separately.
- Telegram commands are prefixed by the configured command prefix, defaulting to `alilos`.
- No React, SQLite, Windows Service, backend, or Supabase app integration is present in runtime code.
