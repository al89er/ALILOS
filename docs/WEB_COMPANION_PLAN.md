# Web Companion Plan

WEB1 is a docs-only plan for a future mobile-friendly browser/PWA companion. It does not create webapp code, frontend dependencies, migrations, `.env.local`, secrets, Supabase write enablement, command/control, Electron runtime changes, direct desktop table write policies, or unattended real execution approval.

## Architecture Split

- Electron desktop remains the only local browser/session/action assistant.
- Desktop keeps the Perakam browser profile, local session, local schedule generation, local completion blocking, manual-confirm safety model, and all guarded action behavior.
- The web/PWA companion is a mobile status/control surface only.
- Supabase plus the future Edge Function/API proxy is the control-plane boundary.
- Desktop remains local-first and must continue normal local operation when the web companion, Supabase, or Edge Function/API is unavailable.
- Android/mobile access should be browser/PWA-based, not Electron.

## WEB1 Initial Mode

WEB1 starts read-only.

Initial web/PWA scope:

- Show desktop heartbeat/status when heartbeat writes are available.
- Show stale/offline warnings when the latest heartbeat is old or missing.
- Show planned schedule only after schedule sync exists.
- Show completion/verification state only after completion sync exists.
- Show clear placeholders for unavailable/deferred sync data.
- Add no control commands in WEB1.

The first web version must not rely on data that the desktop does not yet sync.

## Data Dependencies

Existing/planned data sources:

- `devices` and `heartbeats` exist in the S2A schema, but runtime heartbeat writes remain disabled/deferred.
- `daily_schedules` and `completion_records` exist in the S3B schema, but runtime schedule/completion sync remains disabled/deferred.
- S3D selects a future Edge Function/API proxy plus explicit device pairing/token for writes.

WEB1 can show placeholders until real read data exists. It must not infer schedule or completion state independently of desktop-synced records.

## Future Supervised Controls

These are not part of WEB1. They require explicit later approval, command/control design, and desktop-side safety handling:

- Skip/unskip today or tomorrow.
- Request `notify-only` or `manual-confirm` mode.
- Request status refresh.
- Acknowledge warnings.
- Supervised confirmation workflow, only if explicitly approved later.

No web control may bypass the desktop manual-confirm safety model.

## Forbidden Boundaries

The web companion must not include:

- Perakam login.
- Fortinet login or form submission.
- Credentials.
- Cookies.
- Raw HTML.
- Screenshots.
- Staff ID/name.
- Telegram token/chat ID.
- Full URLs.
- Tokenized query strings.
- Opaque `link=` values.
- Service-role key.
- Direct unattended real action trigger.
- Any bypass of desktop readiness, dry-run, completion blocking, or manual-confirm safety.

## Repo And Hosting Decision

Recommended default: same repo, only if the webapp has a clear isolated app boundary.

Same-repo strengths:

- Keeps desktop, Supabase schema docs, Edge Function/API contract, and web/PWA companion aligned.
- Makes cross-cutting docs and type-contract reviews easier.
- Allows live hosting from the same repository when webapp build/deploy config is isolated.

Same-repo risks:

- Electron-only assets, local config assumptions, or dev secrets could accidentally leak into web builds if boundaries are weak.
- Build/deploy complexity can grow if desktop packaging and web hosting share too much configuration.

Separate-repo strengths:

- Cleaner hosting and deployment separation if the web/PWA becomes large.
- Lower risk of bundling Electron-only files or assumptions.

Separate-repo risks:

- More coordination for Supabase schema, Edge Function/API contracts, and shared status vocabulary.

Decision: start with same-repo planning as the default, with a future `webapp/` boundary only after explicit approval. Move to a separate repo if deployment/build complexity or secret-boundary risk grows.

## Security Model

- Require user authentication before showing device state.
- Use least-privilege reads for the authenticated web user.
- Keep service-role keys server-side only.
- Use the S3D Edge Function/API proxy plus device pairing/token boundary for future writes.
- Keep direct table writes from desktop closed.
- Do not authorize from user-editable metadata.
- Do not expose raw device tokens in browser code.
- Web read access should be scoped to devices owned by or paired to the authenticated user.

## UX Status States

The web/PWA should represent these states clearly:

- Desktop online.
- Desktop stale/unreachable.
- Perakam reachable/unreachable.
- Login/session issue.
- Captive portal detected/possible.
- Next scheduled action.
- Pending manual confirmation.
- Completion verified/unknown/failed.
- Sync disabled/deferred.

## Phased Roadmap

1. WEB1 docs-only plan.
2. WEB2 static/read-only UI design.
3. WEB3 authenticated read-only status.
4. WEB4 schedule/completion display after sync exists.
5. WEB5 supervised command queue design only.
6. WEB6 supervised controls after explicit approval.
7. No unattended execution unless explicitly approved later.
