# A.L.I.L.O.S. Web Monitor

PARITY8 added a same-repo, static, read-only web/PWA dashboard shell under `webapp/`. PARITY9 adds safe non-clicking command controls. PARITY9B aligns the UI to the existing three-tab workflow: Dashboard, Skip dates, and Log history.

## Stack

- Plain HTML, CSS, and JavaScript.
- No frontend dependencies.
- No build step.
- Supabase dashboard reads go through `/functions/v1/alilos-dashboard-read`.
- Safe command creation goes through `/functions/v1/alilos-command-sync` with `create-command`.

## Layout

- Dashboard: morning/evening action cards, desktop/device status, configured website/session/network status, schedule/completion state, safe command controls, command sync state, and safety notices.
- Skip dates: read-only calendar-style month view using synced skip rows when available. Interactive skip/unskip toggles are planned for a later phase.
- Log history: recent sanitized event log summaries when available, with mock sanitized fallback rows.

## Configuration

Use placeholder names only:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_ALILOS_DEVICE_ID`

`config.example.js` documents the shape. Real local `config.js` is ignored by Git. Do not commit real project refs, keys, device ids, service-role keys, credentials, cookies, raw HTML, screenshots, full URLs, tokenized URLs, or opaque `link=` values.

## Boundaries

- Safe command buttons only: status refresh, dry-run/check, recalculate today, and cancel confirmation.
- Skip-date calendar cells are visual/read-only in PARITY9B.
- No Perakam/Fortinet login.
- No credentials.
- No browser automation.
- No service-role key in the webapp.
- No direct table writes or table grants.
- No remote `perform-configured-action`.
- Missing live data falls back to a static mock state and must not imply action readiness.
