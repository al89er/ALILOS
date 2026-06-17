# Project Identity

This repository is a PERSONAL project. It must use the personal GitHub identity and the personal Supabase project declared in `.project-identity.json`.

The identity guard exists to catch account mixups before running commands that can change a remote service.

## Source of Truth

`.project-identity.json` defines the expected identity for this repository:

- `projectType`: `personal`
- `githubHostAlias`: expected SSH host alias, such as `github-personal`
- `gitUserName`: expected repo-local Git author name
- `gitUserEmail`: expected repo-local Git author email
- `supabaseAccountType`: `personal`
- `supabaseProjectRef`: expected Supabase project ref
- `supabaseProjectUrl`: expected Supabase project URL

`.project-identity.example.json` documents the required fields with placeholders.

## Check Identity

Run:

```sh
npm run check:identity
```

This checks the GitHub remote, Git user config, Supabase identity guard, and local environment safety. It does not login, logout, link, deploy, push, reset, or modify remote resources.

## GitHub Identity

This repo expects the `github-personal` SSH host alias. The origin remote should look like:

```sh
git@github-personal:al89er/ALILOS.git
```

Check the current values manually with:

```sh
git remote -v
git config user.name
git config user.email
```

Set repo-local Git identity with:

```sh
git config user.name "Al"
git config user.email "afif89@gmail.com"
```

## Files That Must Not Contain Secrets

Do not put real secrets in:

- `.project-identity.json`
- `.project-identity.example.json`
- `AGENTS.md`
- docs
- scripts
- chat messages

Use `.env.local` for local private values, and keep it ignored by Git.
