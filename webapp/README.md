# A.L.I.L.O.S. Web Monitor

PARITY8 added a same-repo, static, read-only web/PWA dashboard shell under `webapp/`. PARITY9 adds safe non-clicking command controls.

## Stack

- Plain HTML, CSS, and JavaScript.
- No frontend dependencies.
- No build step.
- Supabase dashboard reads go through `/functions/v1/alilos-dashboard-read`.
- Safe command creation goes through `/functions/v1/alilos-command-sync` with `create-command`.

## Configuration

Use placeholder names only:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_ALILOS_DEVICE_ID`

`config.example.js` documents the shape. Real local `config.js` is ignored by Git. Do not commit real project refs, keys, device ids, service-role keys, credentials, cookies, raw HTML, screenshots, full URLs, tokenized URLs, or opaque `link=` values.

## Boundaries

- Safe command buttons only: status refresh, dry-run/check, recalculate today, and cancel confirmation.
- No Perakam/Fortinet login.
- No credentials.
- No browser automation.
- No service-role key in the webapp.
- No direct table writes or table grants.
- No remote `perform-configured-action`.
- Missing live data falls back to a static mock state and must not imply action readiness.
