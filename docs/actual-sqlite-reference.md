# Actual SQLite Diagnostics

Use this only for an explicitly authorized, read-only diagnostic. Routine reads and every write belong on the `actual-api` connector.

Open the budget with `sqlite3 -readonly` and issue `PRAGMA query_only = ON` before querying.

## Matching the GUI payee filter

`transactions.description` stores the payee ID, not the visible payee name. Match the GUI's payee filter by joining the active payee row, and exclude deleted transaction rows:

```sql
SELECT t.date, t.amount, p.name
FROM transactions AS t
JOIN payees AS p ON p.id = t.description
WHERE t.acct = :account_id
  AND t.tombstone = 0
  AND p.tombstone = 0
  AND lower(p.name) LIKE '%' || lower(:payee_text) || '%'
ORDER BY t.date;
```

Do not search only `imported_description`: it is raw import text and can be blank or differ from Actual's normalized payee. In this schema, `date` is an integer in `YYYYMMDD` form and `amount` is integer cents; negative amounts are payments/outflows.
