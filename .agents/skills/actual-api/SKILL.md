---
name: actual-api
description: Use the repo-local Actual Budget connector to read accounts/categories/transactions or import transactions into Actual through the official API with dry-run validation, stable imported IDs, and local audit logging.
---

# Actual API

Use this skill from the `api-bridge-connectors` repo when a task needs Actual Budget reads or writes.

## Safety

- Never inspect, print, or commit secrets. The connector reads auth only from environment variables.
- Run `npm --workspace actual-api run cli -- config-check` before live work.
- For transaction imports, run `import-transactions --dry-run` first. Commit only after validation has no errors and the user or saved automation policy allows it.
- Use stable source-derived `importedId` values. Do not use random IDs when the same source transaction may appear again.
- Resolve categories from existing Actual categories. Leave category blank when unsure; do not create categories during sync unless explicitly asked.
- Use per-transaction `forceAdd: true` only when an authoritative source confirms a distinct row and a dry run shows Actual's fuzzy matcher would otherwise ignore it.
- Treat audit logs as local private state. Do not commit them.

## Commands

Read reference details only when needed: `references/actual-api-contract.md`.

Common commands:

```bash
npm --workspace actual-api run cli -- accounts
npm --workspace actual-api run cli -- categories
npm --workspace actual-api run cli -- transactions --account "<account>" --start YYYY-MM-DD --end YYYY-MM-DD
npm --workspace actual-api run cli -- import-transactions --account "<account>" --file transactions.json --dry-run
npm --workspace actual-api run cli -- import-transactions --account "<account>" --file transactions.json --commit
```

When evolving this connector, update this skill in the same change if command behavior, auth, audit, or input schema changes.
