# PARITY10 Guarded Remote Configured Action Plan

PARITY10 is the sensitive final remote command path. It must not be treated as a single switch.

## PARITY10A Preflight Only

Status: implemented as preflight/deferred scaffolding.

PARITY10A allows the system to describe and validate the future `perform-configured-action` command shape without making it executable:

- Edge Function `create-command` recognizes `perform-configured-action` only as a configured-action preflight.
- Required fields are `deviceId`, `actionKey`, and `scheduleDate`.
- `expiresAt` is generated server-side.
- Payload is empty or limited to preflight/deferred booleans and `requestedFrom: "webapp"`.
- The resulting command row is marked `rejected` with `executionDeferred`, `preflightOnly`, and `noConfiguredSiteAction`.
- The webapp action cards show configured-action readiness/deferred copy and disabled controls only.
- Desktop still rejects any received `perform-configured-action` with: `Remote configured action is not enabled in this build.`

PARITY10A does not execute a configured website action, create arbitrary payload support, add credentials, expose service-role keys, weaken RLS/grants, or change the configured website adapter.

## PARITY10B Guarded Remote Execution

Status: future explicit approval required.

PARITY10B may only route `perform-configured-action` through the existing local desktop guard pipeline. It must not add a parallel click path.

Required guard checks before any remote requested action can execute:

- Command is fresh and unexpired.
- Device is paired/authorized for this user/control plane.
- Command `actionKey` is `clock-in` or `clock-out`.
- Command `scheduleDate` matches the desktop local date being considered.
- Schedule due/grace is valid locally.
- The date/action is not skipped.
- Local completion/attempt records do not already block the action.
- Supabase completion disagreement fails safe toward no repeat.
- Browser/site is ready.
- Configured website session is valid or recoverable locally.
- Target is visible, actionable, and unambiguous.
- Captive portal, interstitial, wrong-page, and stale-session uncertainty fail closed.
- Local configured-site credentials remain local only.
- Result is recorded locally first, then synced if sync is available.
- Every disagreement or missing prerequisite fails safe toward no action.

PARITY10B must still reject arbitrary selectors, scripts, forms, URLs, credentials, cookies, raw HTML, screenshots, full URLs, tokenized query strings, opaque `link=` values, portal hidden values, and service-role keys.

## PARITY10C Field Validation

Status: future explicit approval required.

PARITY10C is the deployed end-to-end field validation step after PARITY10B implementation. It must be supervised, use sanitized evidence only, and verify:

- Edge Function deployment.
- Webapp guarded action UX.
- Desktop command polling/claim/complete flow.
- Existing local guard pipeline execution.
- Duplicate prevention.
- Skip handling.
- Completion/result sync.
- Sanitized logs/history.
- Safe rollback.

PARITY10C does not approve fully unattended real execution. Any unattended policy change requires a separate explicit decision.
