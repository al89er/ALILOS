# AGENTS.md

## Project overview

This repository contains a project that must be kept separate from my other work/personal projects.
Update this section with the project purpose, tech stack, and important context.

## Project identity

This repo must use either WORK or PERSONAL identity, never both.

Use `.project-identity.json` as the source of truth. `.project-identity.example.json` documents the required fields and should contain placeholders only.

The standard trigger phrase is:

```text
check project identity
```

When the user asks "check project identity", "verify project identity", "check identity", or "check GitHub/Supabase identity", verify that this repo is using the correct GitHub and Supabase identity.

First check whether this repo already has identity setup:
- `AGENTS.md`
- `.project-identity.json`
- `.project-identity.example.json`
- `scripts/check-project-identity.js`
- `scripts/check-supabase-identity.js`
- `docs/PROJECT_IDENTITY.md`
- `docs/SUPABASE_IDENTITY_GUARD.md`
- `package.json` scripts: `check:identity` and `check:supabase`

If `.project-identity.json` exists, use it as the source of truth.

If identity scripts exist, prefer:

```sh
npm run check:identity
npm run check:supabase
```

If scripts do not exist, perform safe read-only checks manually.

If no identity setup is found, do not assume the identity. Ask whether to set it up using the saved template. Do not create or modify `AGENTS.md` until the user confirms. Use `AGENTS.md`, not `agent.md`.

If `AGENTS.md` exists, preserve existing content and offer to append only the project identity section.

## Account separation rules

This repo must not mix work and personal accounts.

Check GitHub identity using:
- `git remote -v`
- `git config user.name`
- `git config user.email`

Check GitHub remote safety:
- The remote should use `github-work` or `github-personal`
- The remote should not accidentally use plain `github.com`
- Values should match `.project-identity.json`

Check Supabase identity using:
- `.project-identity.json`
- `supabase --version`
- `supabase/config.toml`
- `.env.local`
- `npm run check:supabase` if available

Check Supabase safety:
- Supabase CLI is available
- Linked project ref matches `.project-identity.json`
- `.env.local` exists
- `.env.local` contains the expected Supabase project URL
- `.env.local` is ignored by Git
- `.env.local` is not tracked by Git

## Supabase safety rules

Never print or request:
- Supabase service role key
- Supabase access token
- Database password
- JWT secret
- Production secrets
- Private environment values

Do not print actual `.env.local` values.

Do not run these commands unless identity checks pass and the user explicitly confirms:
- `supabase db push`
- `supabase db reset`
- `supabase migration repair`
- `supabase functions deploy`
- `supabase secrets set`
- `supabase branches create`
- `supabase link --project-ref`

If the Supabase linked project does not match `.project-identity.json`, do not logout/login/link automatically. Show manual commands only:

```sh
supabase logout
supabase login
supabase link --project-ref EXPECTED_PROJECT_REF
npm run check:supabase
```

## Git safety rules

Do not run these commands unless the user explicitly asks:
- `git push`
- `git pull`
- `git reset`
- `git rebase`
- `git clean`
- force push commands

## Environment files

`.env.local` is local-only and must not be committed.

Use `.env.example` for placeholders only.

Check:
- `.env.local` exists
- `.env.local` is ignored
- `.env.local` is not tracked by Git
- `.env.local` contains the expected Supabase project URL
- Do not print actual values

## Standard command meanings

When the user says "check project identity":
- First check whether project identity setup exists
- If setup exists, check GitHub identity
- If setup exists, check Supabase identity
- Check `.project-identity.json`
- Check `.env.local` safety
- Report pass/warning/error clearly
- Do not modify remote resources
- If setup does not exist, ask whether to create or append setup from the saved template

When the user says "setup project identity":
- Ask how to handle `AGENTS.md` if needed
- Create missing identity guard files using placeholders only
- Create or update `.project-identity.example.json`
- Create `.project-identity.json` only if missing
- Create identity check scripts if missing
- Add safe npm scripts if `package.json` exists
- Do not add secrets

When the user says "fix Supabase login":
- Do not run logout/login/link automatically
- Show manual commands
- Ask for explicit confirmation before running anything

## Recommended scripts

```json
{
  "scripts": {
    "check:identity": "node scripts/check-project-identity.js",
    "check:supabase": "node scripts/check-supabase-identity.js"
  }
}
```

## Final response format

For every `check project identity` request, end with:

```text
Project identity summary:
- AGENTS.md:
- .project-identity.json:
- GitHub remote:
- Git user:
- Supabase CLI:
- Supabase linked project:
- .env.local:
- Overall status:
- Manual action needed:
```
