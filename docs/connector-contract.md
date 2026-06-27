# Connector Contract

Connectors should expose commands that:

- read JSON from files or stdin
- write JSON to stdout
- write diagnostics to stderr
- use environment variables for credentials
- support dry-run validation before mutation
- write append-only local audit events for mutations

Exit codes:

- `0`: success
- `1`: user input, validation, auth, or API error
- `2`: command usage error

Do not require a specific LLM provider. Agent-specific integrations should wrap the CLI instead of changing the core contract.

