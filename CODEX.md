# CODEX.md

This is the main onboarding file for future Codex sessions in the A.L.I.L.O.S. Electron Authorized Website Action Assistant repository.

Before making code changes, read these files in order:

1. `CODEX.md`
2. `docs/PROJECT_BRIEF.md`
3. `docs/APP_STRUCTURE.md`
4. `docs/CURRENT_STATUS.md`
5. `docs/NEXT_ACTIONS.md`
6. `docs/DECISIONS.md`
7. `docs/DEV_NOTES.md`
8. `docs/SUPABASE_IDENTITY_GUARD.md` when a task touches Supabase or identity checks

Also inspect the actual repository before editing. The docs are a guide, but the source tree is the source of truth.

## Working Rules

- Prefer small, phased changes with narrow scope.
- Do not refactor unrelated code.
- Do not rename source files unless the user explicitly asks.
- Preserve the safety boundary around configured website actions.
- Treat configured morning/evening web actions as guarded assistance, not uncontrolled submission.
- Silent monitoring, page preparation, heartbeat telemetry, and simulated dry-runs are allowed.
- Do not add silent real configured-target submission without an explicit confirmed product decision and a separate scoped task.
- Keep secrets out of git, docs, logs, and chat.
- Never print Telegram bot tokens, chat IDs, UPM passwords, Supabase secrets, or private environment values.
- Keep `.env.example` and examples placeholder-only.
- `.env.local` may bootstrap Telegram secrets with `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`; keep it untracked and do not auto-copy those values into app config.
- Keep documentation updated after meaningful implementation changes.
- Run available checks after future code changes. For documentation-only changes, lightweight verification such as `git diff --stat` is enough unless a docs check exists.
- Keep the Settings editor scoped to safe operational fields. Do not expose raw secrets, generated schedules, completions, audit internals, cookies/session data, raw HTML, screenshots, or personal identifiers in editable renderer fields.
- Perakam target detection is currently scoped to the intended workplace-network dashboard structure represented by `fixtures/perakam/dashboard.sanitized.html`. Do not broaden selectors for home/outside-workplace page variants unless the user explicitly asks.
- `npm test` runs sanitized Perakam fixture checks only. Runtime app logic must not import or read fixture files.

## Current Safety Boundary

The current app implements a manual-confirm web-action flow. A real morning or evening target click is only eligible after readiness checks, explicit confirmation, a dry-run safety check, and a guarded one-shot execution path. Do not weaken this boundary without explicit owner confirmation.

Phase 6A adds execution modes for automation research:

- `notify-only`
- `manual-confirm`
- `dry-run`

`dry-run` mode may automatically prepare the configured site profile and record simulated web-action telemetry when an action becomes due, but it must not click `a50`/`a51` or submit the real configured action.

The app also has configured-site auto-login support, but this is separate from real target execution. Auto-login should remain credential-guarded, host-checked, rate-limited, and transparent in the UI/logs.

## Repository Notes

- Runtime: Electron + TypeScript.
- Renderer: plain HTML/CSS/TypeScript.
- Browser automation: Playwright persistent Chromium context.
- Config/log storage: Electron `app.getPath("userData")`.
- Phase 6A telemetry: automation audit records and disabled-by-default heartbeat payload foundation.
- Phase UI-2 settings: safe renderer editor for selected operational config, with masked heartbeat/Telegram secret handling and main-process validation.
- Phase UI-3 Telegram bootstrap: `.env.local` supplies missing Telegram secrets at runtime, while renderer IPC exposes only secret status metadata.
- Live Perakam workplace-network smoke validation is pending for the latest target-detection bugfix; home/outside-network source differences should not be interpreted as supported-profile regressions.
- Main source areas: `src/main`, `src/worker`, `src/preload`, `src/renderer`, `src/shared`.
- Existing project identity files and scripts are present. Do not modify identity files unless the task is specifically about project identity.
