# PARITY10C Remote Action Field Validation

PARITY10C validates the PARITY10B guarded remote configured-action path in the field. It does not approve unattended execution. Do not treat remote configured action as operationally ready until this runbook passes with sanitized evidence.

Run `docs/DEPLOY1_SAFE_LOOP_CHECKLIST.md` first. DEPLOY1 must pass with `remoteActionEnabled=false`, safe commands only, and no configured website click before any PARITY10C phase attempts remote guarded-action validation.

The path remains local-first: the webapp creates a constrained command, Supabase stores sanitized command metadata through Edge Functions, and the desktop alone decides whether any configured-site action may run. Configured-site credentials, sessions, cookies, raw HTML, screenshots, full URLs, tokenized query strings, opaque `link=` values, staff identity, and service-role keys must stay out of Supabase, the webapp, docs, and logs.

## Preconditions

- Edge Functions are deployed to the intended project:
  - `alilos-parity-status`
  - `alilos-dashboard-read`
  - `alilos-skip-sync`
  - `alilos-schedule-completion-sync`
  - `alilos-command-sync`
- A safe non-personal device row exists in `devices`.
- Desktop configured-site credentials exist only in local desktop config/storage.
- Desktop parity sync uses only a publishable/anon key.
- No service-role key is present in desktop config, renderer code, webapp config, `.env.local`, docs, or logs.
- Desktop has `paritySync.enabled=true` only for the validation session.
- Desktop has `paritySync.commandSyncEnabled=true`.
- Desktop starts Phase A with `paritySync.remoteActionEnabled=false`.
- Desktop mode is `manual-confirm`.
- Webapp config is local-only, copied from `webapp/config.example.js`, and `webapp/config.js` is ignored by Git.
- Status, schedule/completion, and log sync flags are enabled only as needed for the observation being performed.
- No live deployment, secret change, RLS change, or table grant change is performed from this document without separate explicit approval.
- DEPLOY1 safe loop has passed with `remoteActionEnabled=false`, status publishing, dashboard read, skip round trip, safe commands, and sanitized logs.

## Phase A: Disabled-Gate Validation

Goal: prove the newly implemented command is still blocked by default.

1. Launch the packaged desktop app.
2. Confirm `manual-confirm` mode.
3. Confirm parity command sync is enabled only for this validation.
4. Confirm `paritySync.remoteActionEnabled=false`.
5. Open the configured webapp locally or in the intended hosted preview.
6. From the Dashboard action card, submit a guarded morning or evening action request.
7. Wait for the desktop command poller to claim and complete/reject the command.

Expected:

- The webapp submits or creates a command through `/functions/v1/alilos-command-sync`.
- The desktop rejects the command because remote action is disabled in local config.
- No configured-site click occurs.
- No successful completion record is created.
- Command result mentions remote action disabled in sanitized wording.
- Logs and dashboard history contain no secrets, raw page data, full/tokenized URLs, or opaque `link=` values.

Pass condition: command creation, desktop rejection, no click, no completion success, sanitized result.

## Phase B: Guard-Failure Validation

Goal: prove the enabled remote path still fails closed when local guards do not allow action.

Use `paritySync.remoteActionEnabled=true` only for this phase, then turn it off again if validation pauses.

Run this phase outside a valid schedule/grace window, on an intentionally non-due action, or in another safe non-actionable state that should fail local readiness.

1. Confirm desktop mode is still `manual-confirm`.
2. Confirm desktop command sync is enabled.
3. Set `paritySync.remoteActionEnabled=true` locally.
4. Confirm the chosen action is not currently due/allowed, or intentionally make a safe guard fail.
5. Submit a guarded action request from the webapp.
6. Wait for desktop command processing.
7. Review command result, completion state, and sanitized logs.

Expected:

- Desktop claims the command.
- Desktop routes through the guarded path but rejects before click due to local guard failure.
- No configured-site click occurs.
- No successful completion record is created.
- Rejection reason is sanitized and does not include raw DOM, raw URL, credentials, screenshots, cookies, or page content.

Pass condition: enabled path reaches local guard evaluation, fails closed, and records only sanitized failure evidence.

## Phase C: Supervised Valid-Window Validation

Goal: prove the full guarded path works only in a legitimate configured action window.

Run Phase C only during a legitimate scheduled configured-action window. The user must be physically present or explicitly supervising remotely. This is not an unattended test.

Before submitting:

- Desktop is online and awake.
- Configured site is reachable.
- Captive portal state is `not-detected`.
- Desktop mode is `manual-confirm`.
- `paritySync.enabled=true`.
- `paritySync.commandSyncEnabled=true`.
- `paritySync.remoteActionEnabled=true`.
- Today's schedule is due or within grace for the selected action.
- Today/action is not skipped.
- No existing local or synced completion/attempt blocks the action.
- Browser/site state is expected and recoverable.
- Target is expected to be visible, actionable, and unambiguous.
- User agrees the action is legitimate for the current window.

Steps:

1. Open the webapp Dashboard.
2. Submit the guarded action request for the due action.
3. Confirm the webapp confirmation prompt before command creation.
4. Watch the desktop process the command.
5. Confirm the desktop uses the existing guarded path.
6. If all guards pass, allow the desktop to perform the configured action.
7. Confirm local completion/verification is recorded.
8. Confirm sanitized command result and completion/schedule sync visibility if sync is enabled.
9. Submit a repeat guarded command for the same action only if it is safe to verify duplicate prevention.

Expected:

- The webapp does not click and does not receive credentials.
- Desktop executes only if all existing local guards pass.
- Completion/verification state is recorded locally first.
- Optional Supabase sync shows sanitized completion/result state.
- A repeat command for the same date/action is blocked by local or synced completion evidence and does not click again.

Pass condition: one legitimate supervised action can complete through the existing desktop guard path, and repeat prevention blocks duplicate execution.

## Abort Conditions

Abort immediately and disable `paritySync.remoteActionEnabled` if any condition appears:

- Wrong page or unexpected configured-site page.
- Ambiguous, missing, hidden, duplicate, or wrong target.
- Captive portal, interstitial, or network uncertainty.
- Stale session is not recoverable.
- Unsanitized logs, UI, command result, or event history.
- Command payload mismatch or unexpected payload fields.
- Desktop local date does not match command `scheduleDate`.
- Prior local or synced completion exists for the same date/action.
- Desktop is offline, sleeping, locked in a way that prevents observation, or command polling is stale.
- User is not present, unsure, or no longer approves the test.
- Any unexpected click or action outside the guarded path.

## Result Template

```text
PARITY10C remote action field-validation result
- Date/time:
- Environment: home/work, network status:
- Desktop app/package:
- Desktop mode:
- paritySync.enabled:
- commandSyncEnabled:
- remoteActionEnabled:
- Webapp config method: local config.js / hosted config / other:
- Command id: <redacted-or-first-8-chars>
- Action key:
- Schedule date:
- Phase A result:
- Phase B result:
- Phase C result:
- Guard outcome:
- Click outcome:
- Completion state:
- Verification state:
- Schedule/completion sync result:
- Command result summary:
- Sanitized log review:
- Result classification: pass / pass with observation / fail-blocker / inconclusive
- Follow-up item:
```

## Rollback

- Set `paritySync.remoteActionEnabled=false`.
- Turn off `commandSyncEnabled` if command validation is complete.
- Turn off schedule/completion sync, skip sync, log upload, and status publishing if not needed.
- Remove local-only `webapp/config.js` if desired.
- Never commit local config, Supabase keys, device ids, screenshots, raw logs, or validation evidence containing sensitive values.
