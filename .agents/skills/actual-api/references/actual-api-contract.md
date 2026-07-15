# Actual API Contract

## Environment

Required:

- `ACTUAL_SERVER_URL`
- `ACTUAL_SYNC_ID`
- `ACTUAL_SESSION_TOKEN` or `ACTUAL_PASSWORD`

Optional:

- `ACTUAL_ENCRYPTION_PASSWORD`
- `ACTUAL_DATA_DIR`
- `API_BRIDGE_STATE_DIR`
- `API_BRIDGE_AUDIT_DIR`
- `API_BRIDGE_ACTOR`

Use 1Password CLI or another secret manager to inject these variables when possible. For local bootstrap, the connector also loads `.env` from the repo root or `actual-api/`; exported environment variables take precedence. Do not pass passwords on the command line.

## Transaction reads

`transactions` resolves Actual payee IDs and adds `payeeName` to each returned transaction and subtransaction. Use `--payee-contains <text>` for case-insensitive filtering against those normalized names; raw `imported_payee` text is not equivalent to the GUI payee filter.

## Import input

`import-transactions` accepts a JSON array:

```json
[
  {
    "date": "2026-06-27",
    "amount": -12.34,
    "description": "Merchant",
    "category": "Dining",
    "notes": "optional",
    "importedId": "stable-source-id"
  }
]
```

Fields:

- `amount` is decimal currency. Use `amountCents` for Actual integer amounts.
- `description` maps to Actual `payee_name`.
- `category` is an existing Actual category name. `categoryId` may be used when already known.
- `importedId` maps to Actual `imported_id` and drives dedupe.

## Import flow

1. Gather candidate transactions.
2. Assign stable imported IDs.
3. Call dry run.
4. Inspect Actual preview result.
5. Commit only after validation.
6. Confirm audit event was written.

## Transfer input

`import-transfers` creates a linked pair between two tracked Actual accounts. The JSON input is an array; `amount` and `amountCents` must be positive because `--from-account` and `--to-account` establish direction.

```json
[
  {
    "date": "2026-07-08",
    "amount": 500,
    "description": "Free Interac E-Transfer",
    "importedId": "bank:statement:2026-07-08:50000",
    "cleared": true
  }
]
```

The command stores the stable imported ID on the source leg, asks Actual to generate the linked destination leg, validates the pair after commit, and writes an audit event. It never assigns a budget category to the transfer.
