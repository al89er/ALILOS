# A.L.I.L.O.S. Web Monitor

PARITY8 adds a same-repo, static, read-only web/PWA dashboard shell under `webapp/`.

## Stack

- Plain HTML, CSS, and JavaScript.
- No frontend dependencies.
- No build step.
- Supabase access goes through the read-only Edge Function proxy at `/functions/v1/alilos-dashboard-read`.

## Configuration

Use placeholder names only:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_ALILOS_DEVICE_ID`

`config.example.js` documents the shape. Real local `config.js` is ignored by Git. Do not commit real project refs, keys, device ids, service-role keys, credentials, cookies, raw HTML, screenshots, full URLs, tokenized URLs, or opaque `link=` values.

## Boundaries

- Read-only dashboard only.
- No command creation UI.
- No Perakam/Fortinet login.
- No credentials.
- No browser automation.
- No service-role key in the webapp.
- No direct table writes or table grants.
- Missing live data falls back to a static mock state and must not imply action readiness.
