# Perakam Fixtures

This folder stores sanitized structural fixtures for Perakam detector debugging and tests.

Runtime app logic must not depend on these files. Fixtures are for local debugging, regression checks, and future test data only.

Raw page sources must only be placed temporarily in `fixtures/perakam/raw/`. Raw files must not be committed. The raw folder is ignored by Git except for its `.gitkeep` placeholder.

Sanitized fixture files may be committed only after review.

## Sanitized References

- `login.sanitized.html` preserves only the Perakam login form markers needed for detection.
- `dashboard.sanitized.html` preserves sidebar duplicate IDs and visible dashboard attendance tile structure.
- `stale-page.sanitized.html` preserves stale/session marker text and login navigation structure.
- `tampermonkey-original.sanitized.js` preserves reviewed legacy behavior references from the old userscript without secrets.

The sanitized Tampermonkey reference is not runtime code. Do not import or execute it. Port behavior intentionally through TypeScript code after review.

## Supported Site Profile

`dashboard.sanitized.html` is the current structural reference for the intended workplace-network Perakam dashboard target detection.

Live workplace-network smoke validation for the latest target-detection bugfix is still pending. Home/outside-workplace page variants may have different source structure and are unsupported for now.

Do not add selector support for home/outside-workplace variants or alternate target IDs unless explicitly requested later.

## Fixture Tests

Run fixture checks with:

```sh
npm test
```

The test harness uses Node built-in `node:test` and reads sanitized fixtures only. It validates supported workplace dashboard structure, login/stale markers, sanitized legacy Tampermonkey constants, and basic redaction assumptions.

These tests do not prove live Perakam behavior. Workplace-network smoke validation remains pending.

## Redaction Rules

Before a fixture is committed:

- remove names
- remove staff IDs
- remove personal identifiers
- remove IP addresses
- remove credentials
- remove cookies/session data
- remove tokenized URLs/query strings
- replace encrypted/opaque `link=` values with `REDACTED_LINK`
- replace profile/image URLs with `#`
- replace Telegram bot tokens with `REDACTED_TELEGRAM_BOT_TOKEN`
- replace Telegram chat IDs with `REDACTED_TELEGRAM_CHAT_ID`
