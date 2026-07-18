# Agent Instructions

## Purpose

This repo hosts public, provider-agnostic connector CLIs for LLM agents. Keep connectors small, auditable, cross-platform, and safe to publish.

## Non-negotiables

- Never commit secrets, tokens, passwords, server URLs containing credentials, local budget caches, raw email bodies, or audit logs.
- Do not accept secrets through CLI flags. Read secrets from environment variables injected by a secret manager.
- Prefer JSON stdin/stdout contracts over provider-specific mechanisms.
- Keep docs succinct. Link to source files instead of repeating the same rules.
- Every mutating connector command must support validation before commit and must write an audit event.
- Future executor agents may evolve this repo when a connector has a blind spot, but they must notify the human, describe the proposed change, and give a choice before applying or relying on evolved behavior.

## Project layout

- `actual-api/`: Actual Budget connector package.
- `.agents/skills/`: project-scoped skills. Use these when working from this repo.
- `docs/`: concise shared policy docs for auth, audit, and connector contracts.

## Development

- Use Node.js 22 or newer.
- Run `npm install`, `npm run build`, and `npm test` before publishing changes.
- Keep runtime files outside the repo or under ignored `.runtime/`.
- Use `@actual-app/api` for Actual Budget. Actual does not expose a REST API.

## Hermes skill setup

The repo-local Actual connector skill is the source of truth at `.agents/skills/actual-api/`. On a Hermes workstation, register the repository's skill root as an external skill directory instead of copying or symlinking individual skills.

Edit the active profile's Hermes configuration (`hermes config edit`) and add:

```yaml
skills:
  external_dirs:
    - /absolute/path/to/api-bridge-connectors/.agents/skills
```

- Point `external_dirs` at `.agents/skills/`, not the individual `actual-api/` directory, so future repo-local skills are discovered automatically.
- External skills remain editable in place; Hermes skill-management updates modify the repository source directly when it is writable.
- If the same skill name also exists under the profile's local `skills/` directory, the local skill takes precedence. Remove stale copies or symlinks that would shadow the repository version.
- After adding or changing the external directory, start a new Hermes session or run `/reload-skills` followed by `/reset` so skill discovery refreshes.
- Before Actual work, load the `actual-api` skill and follow its auth, dry-run, stable-ID, audit, and connector-evolution rules.

## Actual connector safety

- Use `importTransactions` for routine transaction sync because it applies Actual reconciliation and supports `dryRun`.
- Use stable `imported_id` values for every imported transaction.
- Resolve category names to existing category IDs. Do not create categories during transaction sync unless the user explicitly asks.
- Run a dry run first. Commit only after validation has no errors and the human or automation policy allows it.

