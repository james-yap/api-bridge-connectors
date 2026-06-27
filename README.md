# API Bridge Connectors

Provider-agnostic connector tools for LLM agents. Each connector exposes a stable JSON CLI so Codex, Claude Code, Pi, or another executor can call it without depending on provider-specific tool APIs.

## Current connector

- `actual-api`: imports, reads, and audits Actual Budget operations through the official `@actual-app/api` Node client.

## Auth recommendation

Use a real secret manager to inject environment variables at runtime. Recommended: 1Password CLI because it is cross-platform, works in local shells and automations, and keeps secrets out of files, shell history, process arguments, git, and audit logs.

```bash
op run --env-file ~/.config/api-bridge-connectors/actual.env -- npm --workspace actual-api run cli -- config-check
```

Fallback for one machine: a gitignored `.env` file in this repo or `actual-api/` with restrictive permissions. Do not put secrets in command-line flags or committed config. Already-exported environment variables override `.env`, so secret managers remain the preferred source.

## Actual quick start

```bash
npm install
npm run build
cp .env.example .env
npm --workspace actual-api run cli -- accounts
npm --workspace actual-api run cli -- import-transactions --account "Checking" --file transactions.json --dry-run
npm --workspace actual-api run cli -- import-transactions --account "Checking" --file transactions.json --commit
```

Input transactions use decimal amounts:

```json
[
  {
    "date": "2026-06-27",
    "amount": -12.34,
    "description": "Merchant",
    "category": "Dining",
    "notes": "optional",
    "importedId": "source-system-stable-id"
  }
]
```

Audit logs are local JSONL files outside the repo by default. They are hash-chained per file and record dry runs, commits, results, and sanitized transaction summaries.
