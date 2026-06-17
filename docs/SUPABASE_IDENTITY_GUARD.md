# Supabase Identity Guard

This repository is a PERSONAL project. It must only use the personal Supabase account and the personal Supabase project declared in `.project-identity.json`.

The guard exists to prevent accidental migrations, database pushes, function deploys, secret updates, or branch operations against the wrong Supabase account/project.

## Planned Role

Supabase is planned as a shared backend for a future monitoring/control plane. It is not a runtime dependency of the desktop agent yet, and this repository currently has no Supabase schema migrations, Supabase writes, hosted webapp/PWA, or remote command/control queue.

The agreed roadmap is:

- S0: Architecture documentation.
- S1: Schema and identity planning.
- S2: Status-only heartbeat.
- S3: Durable schedule/completion backup ledger.
- S4: Phone webapp/PWA status dashboard.
- S5: Command queue/control only after explicit approval.
- S6: Telegram reduced to fallback.

The local desktop agent remains local-first and Windows/desktop-only. Android/mobile access should be through a hosted webapp/PWA, and that webapp may later live under `webapp/` in this repo after explicit approval. Telegram remains active now and may become fallback later. The old Tampermonkey script and old webapp remain fallback/backup references.

## Data Boundary

Future Supabase records may store sanitized monitoring data, generated schedule backups, and completion backup records after the relevant phase is approved.

Do not store these values in Supabase:

- Configured-site username/password.
- Cookies or session data.
- Raw page HTML.
- Screenshots.
- Staff ID/name.
- Telegram token/chat ID.
- Full tokenized URLs or opaque query strings.

Remote command/control is not implemented. Any command queue or control-plane action requires a later explicit approval phase before schema, runtime code, or webapp behavior is added.

## Source of Truth

`.project-identity.json` defines:

- `supabaseAccountType`: must be `personal`
- `supabaseProjectRef`: the expected Supabase project ref
- `supabaseProjectUrl`: the expected URL, usually `https://<project-ref>.supabase.co`

The initial values are placeholders. Replace `TODO_SUPABASE_PROJECT_REF` before running remote-changing Supabase commands.

## Find the Supabase Project Ref

Use the Supabase dashboard:

1. Open your personal Supabase dashboard.
2. Select the correct project.
3. Open Project Settings.
4. Copy the project ref from the project URL or API settings.

The project URL has this shape:

```text
https://<project-ref>.supabase.co
```

## Check the Current Project

Run:

```sh
npm run check:supabase
```

The script checks local files only plus `supabase --version`. It does not require Docker, does not print secrets, and does not modify remote Supabase resources.

It checks:

- `.project-identity.json`
- Supabase CLI availability
- `supabase/config.toml` if present
- local Supabase link marker files if present
- `.env.local` existence
- whether `.env.local` contains the expected Supabase project URL
- whether `.env.local` is ignored by Git
- whether `.env.local` is accidentally tracked by Git

The script does not print actual `.env.local` values.

## Safe Manual Login and Link Flow

If the check reports the wrong project or no linked project, fix it manually:

```sh
supabase logout
supabase login
supabase link --project-ref YOUR_PROJECT_REF
npm run check:supabase
```

Do not paste Supabase access tokens, service role keys, database passwords, JWT secrets, or private environment values into Codex or chat.

## Commands That Need Identity Check First

Only run these after `npm run check:supabase` passes and you are sure this is the correct PERSONAL project:

```sh
supabase db push
supabase db reset
supabase migration repair
supabase functions deploy
supabase secrets set
supabase branches create
supabase link --project-ref
```

## Why .env.local Must Not Be Committed

`.env.local` can contain private keys, database URLs, tokens, and other credentials. It must stay local and ignored by Git.

The guard checks whether `.env.local` is ignored and whether it is accidentally tracked. If it is tracked, remove it from Git's index without deleting the local file:

```sh
git rm --cached .env.local
```

Then commit the removal.

## Secret Handling

Never paste these into Codex or chat:

- Supabase access tokens
- service role keys
- database passwords
- JWT secrets
- private environment values

Use the Supabase CLI and local shell prompts for secret entry when needed.
