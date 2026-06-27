# Auth And Audit

## Auth

Recommended secret flow: store `ACTUAL_SERVER_URL`, `ACTUAL_SYNC_ID`, and either `ACTUAL_SESSION_TOKEN` or `ACTUAL_PASSWORD` in 1Password, then run commands through `op run`.

Fallback: use `.env` in the repo root or `actual-api/` with file mode `600`. The connector loads `.env` before reading config, and already-exported variables take precedence.

Minimal `.env`:

- `ACTUAL_SERVER_URL`: Actual sync server URL. The local desktop server is usually `http://localhost:5006`.
- `ACTUAL_SYNC_ID`: Budget Sync ID from Actual Settings -> Show advanced settings.
- `ACTUAL_PASSWORD`: Actual server login password.

Optional environment variables:

- `ACTUAL_SESSION_TOKEN`: Alternative to `ACTUAL_PASSWORD` when a session token is available.
- `ACTUAL_ENCRYPTION_PASSWORD`: Budget encryption password, only for end-to-end encrypted budgets.
- `API_BRIDGE_ENV_FILE`: Explicit `.env` path to load before the standard search locations.
- `API_BRIDGE_STATE_DIR`: Override local connector cache/state directory.
- `API_BRIDGE_AUDIT_DIR`: Override local audit log directory.
- `API_BRIDGE_ACTOR`: Override actor name recorded in audit events.
- `API_BRIDGE_VERBOSE`: Set to `1` for verbose connector output.

Rules:

- Prefer `ACTUAL_SESSION_TOKEN` over `ACTUAL_PASSWORD` when available.
- Use `ACTUAL_ENCRYPTION_PASSWORD` only when the budget has end-to-end encryption.
- Never pass secrets as CLI flags.
- Never log `process.env`, Actual init config, or raw errors before redaction.

## Audit

The connector writes JSONL audit files under `API_BRIDGE_AUDIT_DIR`, or the OS state directory when unset. Audit files are intentionally outside the repo and ignored if redirected into `.runtime/`.

Each mutating command records:

- actor, connector, command, mode, timestamps
- hashed server and sync identifiers
- account, transaction count, input hash, sanitized transaction summaries
- dry-run result and commit result
- a per-file hash chain to detect later edits

Sanitized summaries include date, amount, imported ID, payee, category, and a notes hash. Raw notes and raw source payloads are not stored by default.
