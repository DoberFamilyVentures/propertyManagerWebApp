# Personal Assistant Read API

The Personal Assistant API is a private, versioned read boundary for a trusted server-side assistant. It implements [ADR 0034](../../ADR/0034-personal-assistant-read-api.md). It is not a browser API and is not available to customer accounts.

## Access management

Only a user whose server-managed `users/{uid}.maintley_role` resolves to Maintley Owner may create, list, rotate, or revoke credentials. The Settings control is hidden from other users, and the callable Function independently enforces the same restriction.

Each credential contains an explicit account, property allowlist, read scopes, status, and optional expiration. The bearer token is returned once. Firestore stores only an HMAC verifier and a short display prefix; the browser does not persist the token.

## Read boundary

The HTTPS Function exposes `/v1` routes for properties, equipment, tasks, maintenance events, Intelligence findings, document metadata, and upcoming tasks. Responses use explicit public mappers rather than returning Firestore documents. Resident, team, billing, cost, file URL, storage path, and document-content fields are excluded.

Maintenance history combines canonical `maintenanceEvents` with legacy `maintenanceHistory`, preferring the canonical record when IDs overlap. This compatibility adapter can be removed after legacy migration is complete.

Credentials are limited to 120 requests per minute. Access creates minimized audit records and updates `lastUsedAt` at most once every 15 minutes. The API supports only `GET`; operational audit, rate-limit, and last-used writes do not modify property records.

The machine-readable contract is [PERSONAL_ASSISTANT_API_OPENAPI.yaml](PERSONAL_ASSISTANT_API_OPENAPI.yaml).

## Future customer assistant direction

This API remains private, Maintley Owner-only, and read-only. It is not the
customer authentication boundary for ChatGPT or another assistant.

[ADR 0043](../../ADR/0043-customer-authorized-assistant-and-mcp-boundary.md)
defines the planned customer-authorized assistant boundary. Customer OAuth, a
remote MCP server, and a public ChatGPT plugin are not implemented or deployed.
The implementation plan is documented in the
[ChatGPT MCP read-only integration plan](../../reports/2026-09-06-chatgpt-mcp-read-only-integration-plan.md).
