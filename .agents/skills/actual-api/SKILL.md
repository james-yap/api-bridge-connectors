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

## Read-only SQLite diagnostics

- Use the API connector for normal reads and all writes. Direct SQLite access is diagnostic-only and requires explicit user authorization; open the database with `-readonly` and set `PRAGMA query_only = ON`.
- Actual's `transactions.description` is a payee ID in the materialized budget database, not the displayed payee text. To reproduce a GUI payee filter, join `payees` on `payees.id = transactions.description` and filter `payees.name`.
- Exclude deleted rows from both tables: `transactions.tombstone = 0` and `payees.tombstone = 0`. Do not total raw `imported_description` matches alone: it can miss transactions whose displayed payee was normalized after import.
- For the query pattern and date/amount conventions, read `docs/actual-sqlite-reference.md` from the repo root.

## Connector Evolution

- When the connector needs a patch to complete the task safely, make the patch directly after normal scope, secret, and validation checks; do not stop for confirmation solely because the connector is evolving.
- Report the changed behavior, validation, and publish result to James at the end.
- Commit on `main` and push to `origin/main`; do not open PRs unless James explicitly asks.

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
