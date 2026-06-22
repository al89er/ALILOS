# A.L.I.L.O.S. Web Monitor

PARITY8 added a same-repo, static, read-only web/PWA dashboard shell under `webapp/`. PARITY9 adds safe non-clicking command controls. PARITY9B aligns the UI to the existing three-tab workflow: Dashboard, Skip dates, and Log history. PARITY9C adds whole-day skip/unskip calendar controls. PARITY10B adds guarded configured-action request buttons.

## Stack

- Plain HTML, CSS, and JavaScript.
- No frontend dependencies.
- No build step.
- Supabase dashboard reads go through `/functions/v1/alilos-dashboard-read`.
- Safe command creation goes through `/functions/v1/alilos-command-sync` with `create-command`.
- Guarded configured-action requests also go through `/functions/v1/alilos-command-sync` with constrained `perform-configured-action` payloads.
- Whole-day skip/unskip goes through `/functions/v1/alilos-skip-sync` with `upsert-skip` and `delete-skip`.

## Layout

- Dashboard: morning/evening action cards, desktop/device status, configured website/session/network status, schedule/completion state, safe command controls, command sync state, and safety notices.
- Skip dates: calendar-style month view using synced skip rows when available. Date cells toggle whole-day skip/unskip only.
- Log history: recent sanitized event log summaries when available, with mock sanitized fallback rows.

## Configuration

Use placeholder names only:

- `supabaseUrl`
- `supabaseAnonKey`
- `deviceId`

`config.example.js` documents the canonical `window.ALILOS_CONFIG` shape used by GitHub Pages. The app also accepts the earlier `window.ALILOS_WEBAPP_CONFIG` / `VITE_*` names as aliases. Real local `config.js` is ignored by Git. Do not commit real project refs, keys, device ids, service-role keys, credentials, cookies, raw HTML, screenshots, full URLs, tokenized URLs, or opaque `link=` values.

## Boundaries

- Safe command buttons only: status refresh, dry-run/check, recalculate today, and cancel confirmation.
- Guarded configured-action buttons only create constrained command requests after user confirmation. The desktop must have command sync and `paritySync.remoteActionEnabled` enabled locally, then it re-runs local guard checks before any configured-site click.
- Skip-date calendar cells toggle whole-day scheduling skips only.
- Action-specific skip controls remain a future refinement.
- No Perakam/Fortinet login.
- No credentials.
- No browser automation.
- No service-role key in the webapp.
- No direct table writes or table grants.
- No arbitrary `perform-configured-action` payloads, selectors, scripts, forms, URLs, or credential fields.
- Missing live data falls back to a static mock state and must not imply action readiness.
