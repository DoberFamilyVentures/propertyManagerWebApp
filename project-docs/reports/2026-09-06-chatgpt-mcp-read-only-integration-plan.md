# ChatGPT MCP Read-Only Integration Plan

Date: 2026-09-06

Status: Planned; not implemented or deployed

Related decisions:

- [ADR 0034](../ADR/0034-personal-assistant-read-api.md)
- [ADR 0041](../ADR/0041-maintley-intelligence-shared-platform-and-packaging-boundary.md)
- [ADR 0043](../ADR/0043-customer-authorized-assistant-and-mcp-boundary.md)
- [ADR 0044](../ADR/0044-provider-neutral-work-request-and-contractor-response.md)

## Executive summary

Maintley's first customer-authorized assistant integration should expose a
small, read-only set of Maintley tools to ChatGPT through a remote MCP server.
It should reuse the explicit response mappers and domain services behind the
implemented Personal Assistant API, but it must not expose the API's private
Maintley Owner credentials to customers.

The customer integration requires OAuth, explicit account and property
consent, narrow scopes, minimized audit records, revocation, and fail-closed
authorization on every tool call. It does not include record changes,
contractor contact, quote approval, document contents, or autonomous action.

## Existing foundation

ADR 0034 already provides a private, versioned, server-side read boundary for
properties, equipment, tasks, maintenance events, Intelligence findings,
document metadata, and upcoming work. Its public mappers are the preferred
starting point because they avoid returning raw Firestore documents and omit
resident, billing, storage, and other internal fields.

That implementation is Maintley Owner-only. Its personal access tokens are not
a customer authentication mechanism and must remain separate from the planned
OAuth and MCP surfaces.

## Target architecture

```text
Customer in ChatGPT
        |
        | OAuth consent and MCP tool calls
        v
Maintley remote MCP server
        |
        | normalized assistant tool contract
        v
Assistant gateway and authorization policy
        |
        +-- existing public read mappers and domain services
        +-- Maintley Intelligence evidence and explanations
        v
Canonical Maintley property records
```

The MCP server is a channel adapter. Authorization, data minimization,
provenance, and tool behavior belong in the shared assistant gateway so a
future channel cannot bypass them.

## Proposed tool contract

The first private pilot should implement only the minimum tools needed to
answer common property questions.

| Tool                         | Purpose                                                | Required scope      | Existing route or service                          |
| ---------------------------- | ------------------------------------------------------ | ------------------- | -------------------------------------------------- |
| `list_properties`            | List consented properties using minimal summary fields | `properties:read`   | `GET /v1/properties` mapper                        |
| `get_property_summary`       | Return one consented property's public summary         | `properties:read`   | `GET /v1/properties/{propertyId}` mapper           |
| `list_equipment`             | List public equipment records for one property         | `equipment:read`    | `GET /v1/properties/{propertyId}/equipment` mapper |
| `list_tasks`                 | List scoped maintenance tasks with bounded filters     | `tasks:read`        | `GET /v1/properties/{propertyId}/tasks` mapper     |
| `list_upcoming_work`         | List upcoming work across consented properties         | `tasks:read`        | `GET /v1/upcoming` mapper                          |
| `list_maintenance_events`    | Return scoped maintenance history                      | `maintenance:read`  | Maintenance-event read service and mapper          |
| `list_intelligence_findings` | Return findings with evidence and explanation          | `intelligence:read` | Insights read service and mapper                   |

`get_equipment` and `list_document_metadata` may follow after the core pilot if
real conversations require them. Document contents remain excluded.

Every tool input must use typed identifiers, bounded pagination, and explicit
filters. There will be no generic query tool, raw Firestore path, arbitrary
URL fetch, or caller-controlled projection.

## Authentication and consent

Before a customer pilot, Maintley must implement:

1. OAuth authorization code flow with secure token storage and rotation.
2. Explicit account selection and an optional property allowlist.
3. Consent that names the data categories and read-only purpose.
4. Server-side resolution of user, account, property, and scope on every call.
5. Immediate revocation in Maintley plus disconnection guidance for ChatGPT.
6. Expiring access and refresh tokens with minimized, non-secret audit logs.

Authentication proves identity; it does not replace authorization. A valid
token must still fail when a requested property or scope is not allowed.

## Safety and privacy controls

- Treat property notes, filenames, and other stored text as untrusted data, not
  instructions to the assistant or MCP server.
- Return only fields approved by an explicit public schema.
- Exclude residents, billing, plan, team administration, file URLs, storage
  paths, and document contents from the initial contract.
- Preserve evidence identifiers, timestamps, calculation versions, and
  uncertainty for Intelligence findings.
- Log tool name, authorization result, account, property, duration, and a
  request correlation ID without logging bearer tokens or full responses.
- Apply per-user and per-account rate limits and bounded result sizes.
- Return indistinguishable not-found responses for inaccessible records.
- Never interpret a conversational request as permission to write Maintley
  data or contact a third party.

## Delivery phases

### Phase 0 - contract and threat model

Approve schemas, scope mappings, retention, OAuth design, tool descriptions,
prompt-injection boundaries, and incident ownership. Add contract fixtures for
every allowed and excluded field.

### Phase 1 - shared assistant gateway

Extract reusable read operations from the current HTTP handler without
changing its behavior. Centralize authorization and public mapping, then prove
parity with the existing Personal Assistant API.

### Phase 2 - OAuth and MCP adapter

Implement customer OAuth, consent records, revocation, and the remote MCP
adapter. Map MCP tools to gateway operations; do not call private HTTP routes
with Maintley Owner tokens.

### Phase 3 - private ChatGPT pilot

Connect test accounts, run adversarial authorization and prompt-injection
tests, and conduct task-based conversations with consented users. Measure
answer usefulness, unsupported-answer rate, latency, revocation behavior, and
support burden.

### Phase 4 - publication decision

Proceed toward broader distribution only if the private pilot meets approved
security and usefulness thresholds. Public submission, commercial packaging,
and additional assistant channels require separate readiness approval.

## Validation matrix

| Area             | Required evidence before pilot                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| Authorization    | Cross-account, cross-property, missing-scope, expired-token, and revoked-token tests fail closed |
| Contract         | Snapshot tests prove excluded fields never appear                                                |
| Intelligence     | Findings include source evidence, version, time, and uncertainty where applicable                |
| Prompt injection | Stored malicious text cannot change tool policy or trigger another tool                          |
| Operations       | Rate limits, correlation IDs, alerts, revocation, and incident runbook are exercised             |
| Product          | Users complete defined property-information tasks more accurately or quickly than the baseline   |

## Go or no-go criteria

The pilot is a go only when authorization and excluded-field tests have no
known failures, revocation works end to end, Intelligence answers remain
traceable, and Maintley can support the integration operationally. It is a
no-go if the design requires broad customer data access, generic database
queries, assistant writes, or unverifiable predictive claims to demonstrate
value.

## Future adaptive work-request extension

ADR 0044 defines a future workflow in which ChatGPT may guide a homeowner
through the same Maintley-controlled issue intake used by Maintley Home. That
extension is intentionally outside this initial read-only pilot.

It should be considered only after the first-party workflow is validated. Its
MCP tools would operate on an isolated draft session, while Maintley services
would control question selection, safety policy, authorization, structured
report validation, provenance, and state transitions. Saving a reviewed Work
Request Report or sharing it externally would require explicit homeowner
confirmation and would not authorize general assistant writes.

## Current platform references

OpenAI's current plugin platform supports skills, MCP servers, and optional UI.
The implementation should follow the official guidance for building a remote
MCP server and authenticating users:

- <https://developers.openai.com/plugins>
- <https://developers.openai.com/plugins/build/mcp-server>

These references can change. Reconfirm their publication and authentication
requirements immediately before implementation or submission.
