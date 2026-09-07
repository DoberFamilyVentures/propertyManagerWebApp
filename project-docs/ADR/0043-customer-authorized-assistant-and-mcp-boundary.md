# ADR 0043: Customer-Authorized Assistant and MCP Boundary

Status: Accepted - planned

Date: 2026-09-06

Related ADRs:

- `0006-maintley-intelligence-architecture.md`
- `0014-property-memory-change-review.md`
- `0020-maintley-resolution-engine.md`
- `0022-account-access-resolver-contract.md`
- `0026-property-ownership-and-professional-contribution-model.md`
- `0032-centralized-entitlement-architecture.md`
- `0034-personal-assistant-read-api.md`
- `0041-maintley-intelligence-shared-platform-and-packaging-boundary.md`
- `0042-external-application-integration-and-connector-architecture.md`
- `0044-provider-neutral-work-request-and-contractor-response.md`

Related documentation:

- `project-docs/docs/Architecture/PERSONAL_ASSISTANT_API.md`
- `project-docs/docs/Product/MAINTLEY_PLATFORM_DIRECTION.md`
- `project-docs/reports/2026-09-06-chatgpt-mcp-read-only-integration-plan.md`

## Context

ADR 0034 implemented a private, Maintley Owner-only, versioned, read-only
Personal Assistant API. It uses server-managed credentials, explicit Property
allowlists, narrow scopes, stable response models, rate limits, and minimized
access auditing. It intentionally deferred customer-created integrations,
OAuth, public MCP hosting, third-party consent, write access, and autonomous
actions.

Maintley now intends to preserve that private boundary while establishing a
future customer-authorized assistant layer. ChatGPT is the first preferred
assistant target because Maintley's existing HTTP and OpenAPI boundary can be
adapted into structured tools through a remote MCP server. Gemini, Siri, and
Alexa may later consume the same Maintley capabilities through their supported
tool, application-intent, or skill models.

Assistant providers are presentation and invocation channels. They must not
become the source of Maintley property truth, own Maintley Intelligence rules,
or receive unrestricted access to internal records.

## Decision

### 1. Preserve ADR 0034 as the private first implementation

The existing Personal Assistant API remains Maintley Owner-only and read-only.
Its personal access tokens will not become customer credentials through a flag,
plan change, or broader UI exposure.

Customer access requires a separate OAuth-capable authorization path and
separately issued grants.

### 2. Use one assistant gateway with channel adapters

Maintley will expose stable assistant capabilities through a trusted
server-owned gateway:

```text
Property Memory and Maintley Intelligence
    -> assistant service boundary
    -> channel adapter
    -> ChatGPT, Gemini, Siri, Alexa, or another approved client
```

Tool names, meanings, scopes, and outputs originate from Maintley contracts.
Channel adapters may translate transport and presentation requirements but
must not calculate independent Intelligence findings.

### 3. Make ChatGPT through remote MCP the first public-assistant target

The first planned external assistant will expose a small read-only tool set
through a remote MCP server suitable for a ChatGPT plugin or other approved MCP
client.

The MCP server will reuse the same server service layer and public mappers as
the versioned Personal Assistant API. It will not query Firestore directly from
tool handlers or return raw internal documents.

### 4. Require customer OAuth and explicit consent

Public assistant connections require OAuth authorization code flow with
appropriate modern safeguards, including state validation, PKCE where
supported, short-lived access tokens, refresh-token rotation, revocation, and
server-side secret storage.

The consent experience must identify:

- the assistant or integration receiving access;
- the Maintley account;
- the selected Properties;
- the requested scopes;
- whether the connection is read-only;
- excluded data classes;
- expiration or continuing access behavior; and
- how to revoke access.

New Properties will not become accessible automatically unless the user has
approved an explicit dynamic-selection policy in a later decision.

### 5. Keep the first customer capability read-only

Initial tool scopes remain equivalent to the approved ADR 0034 read classes:

```text
properties:read
equipment:read
tasks:read
maintenance:read
intelligence:read
documents:metadata:read
```

The assistant may retrieve stable, bounded, explainable results. It may not
create, edit, complete, schedule, upload, invite, contact, approve, purchase,
or delete anything.

Operational writes for security audit, rate limiting, token rotation, and
connection usage remain permitted and must not alter customer Property Memory.

### 6. Expose small, task-oriented tools

The first planned MCP surface will prefer narrow tools over a generic query or
database tool. Candidate tools are:

```text
list_properties
get_property_summary
list_equipment
get_equipment
list_tasks
list_upcoming_work
list_maintenance_events
list_intelligence_findings
list_document_metadata
```

Every tool will declare its required scope, Property boundary, pagination,
filters, maximum result size, and stable error behavior.

Tool descriptions must state when Maintley reports saved records rather than
verified physical condition.

### 7. Minimize assistant disclosure

The gateway returns only the fields required for the requested capability. It
will not expose raw prompts, hidden scoring internals, private rules, complete
document contents, storage paths, unrestricted download URLs, resident or team
details, billing data, access lists, secrets, administrative records, or
unapproved financial data.

The user and assistant provider must not receive information from a Property
outside the connection's allowlist even when another Property belongs to the
same account.

### 8. Preserve explanation and source attribution

Maintley Intelligence results returned through assistants must identify the
finding, affected subject, explanation, source type, supporting record
references where safe, baseline or module version, and evaluation time.

The assistant may summarize those results conversationally but must not present
unsupported diagnoses or predictions as Maintley conclusions.

### 9. Treat writes as a separate future authorization class

Future assistant actions will progress through explicit maturity levels:

1. navigation and deep links;
2. read-only structured retrieval;
3. draft preparation without saving;
4. individually confirmed, idempotent writes; and
5. narrowly approved automation, if ever justified.

Moving beyond read-only requires a later ADR covering confirmation receipts,
idempotency, attribution, conflict handling, authorization freshness,
high-impact action review, rollback behavior, and provider-specific safety.

No existing read credential may be upgraded to write authority.

### 10. Add other assistants through adapters, not parallel engines

Gemini may use provider-neutral Maintley function declarations and execute
Maintley API calls through an approved server application. Siri may expose
appropriate Maintley mobile actions through Apple App Intents. Alexa may use a
custom skill with customer account linking.

These channels must reuse Maintley's capability and authorization contracts.
They require separate implementation and provider review, but not separate
Intelligence rules.

### 11. Account for shared-device voice privacy

Voice assistants may be used in shared households. Sensitive results must not
rely solely on possession of a shared device or an uncertain speaker match.

Voice capabilities will begin with low-sensitivity information and may require
an additional confirmation, app handoff, or authenticated display for details.
Addresses, access information, occupancy-related data, sensitive documents,
financial details, and professional contact information remain excluded unless
a later privacy review approves an exact use case.

### 12. Keep assistant integrations optional

Maintley Home remains fully usable without connecting an external assistant.
Disconnecting an assistant stops future access without deleting canonical
Property Memory or valid historical records.

## Consequences

### Benefits

- Maintley can meet users in an existing conversational interface.
- One tool contract can serve several approved assistant channels.
- Current Property permission and explainability boundaries remain intact.
- ChatGPT provides a concrete first consumer for the platform API direction.
- Future providers can be added without duplicating Intelligence logic.

### Costs and risks

- Public OAuth, consent, revocation, and provider review add significant work.
- Assistant providers receive user-authorized data under their own terms and
  retention behavior.
- Conversational summaries can omit nuance or overstate findings.
- Shared voice devices create disclosure risk.
- Tool and provider contracts can change independently.
- Assistant availability does not by itself create paying-customer demand.

## Implementation tracking

- [ ] Define customer OAuth grants separately from ADR 0034 credentials.
- [ ] Define assistant connection, consent, and Property-selection contracts.
- [ ] Implement a provider-neutral assistant service layer over existing
      public mappers.
- [ ] Define and test the initial read-only tool schemas.
- [ ] Implement MCP authentication and tool authorization.
- [ ] Add redaction, pagination, rate-limit, and minimized-audit tests.
- [ ] Verify unsupported Properties and scopes fail closed.
- [ ] Test conversational safety and evidence preservation.
- [ ] Connect and privately test a ChatGPT plugin before public submission.
- [ ] Review customer demand and security evidence before publication.
- [ ] Evaluate Gemini only against the shared tool contract after ChatGPT.
- [ ] Evaluate Siri and Alexa only when their channel-specific user value is
      validated.

## Deferred

This ADR does not implement or approve:

- public customer OAuth;
- a deployed MCP server;
- ChatGPT plugin publication;
- Gemini, Siri, or Alexa release;
- assistant access to document contents;
- assistant access to residents, billing, or administrative information;
- write-capable tools;
- autonomous maintenance actions;
- automatic contractor contact;
- quote approval; or
- model-generated physical-condition diagnosis.
