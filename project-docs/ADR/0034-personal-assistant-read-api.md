# ADR 0034: Personal Assistant Read API

Status: Implemented

Date: 2026-07-29

Related ADRs:

- `0006-maintley-intelligence-architecture.md`
- `0007-maintenance-events-as-historical-source-of-truth.md`
- `0018-maintley-event-engine.md`
- `0022-account-access-resolver-contract.md`
- `0023-property-documents-as-first-class-records.md`
- `0026-property-ownership-and-professional-contribution-model.md`
- `0032-centralized-entitlement-architecture.md`
- `0033-property-type-and-classification-taxonomy.md`
- `0043-customer-authorized-assistant-and-mcp-boundary.md`

Related documentation:

- `project-docs/docs/Product/PRODUCT_DIRECTION.md`
- `project-docs/docs/Architecture/DATA_MODEL.md`
- `project-docs/docs/Architecture/TECHNICAL_ARCHITECTURE.md`
- `project-docs/docs/Architecture/FIREBASE_STRUCTURE.md`
- `project-docs/docs/Architecture/PERMISSIONS.md`
- `project-docs/docs/Intelligence/PROPERTY_INTELLIGENCE.md`
- `project-docs/docs/Operations/TESTING.md`

## Context

Maintley preserves property information that can help a personal assistant
answer practical questions such as:

- What maintenance is coming up?
- Which tasks are overdue?
- What work was completed recently?
- What equipment is recorded at a property?
- What does Maintley currently know about the property?
- Which explainable Maintley Intelligence findings need attention?

The first consumer will be the Maintley owner's privately controlled personal
assistant application. It is not initially a public developer platform,
customer integration, browser application, or mobile application. The consumer
is assumed to have a server-side environment capable of protecting a secret.

Allowing the assistant to read Firestore directly would bypass Maintley's
account, property, permission, compatibility, and derived-view contracts. It
would also couple an external application to internal collection shapes that
will continue to evolve.

The initial integration must therefore expose a narrow, versioned, read-only
application boundary. It must not create a path for completing tasks, changing
property records, scheduling maintenance, accessing other customer accounts,
or reading Maintley's internal admin data.

The Maintley owner may later want the assistant to read feedback from the admin
portal. Customer property data and Maintley operational feedback have different
authorization, privacy, and auditing boundaries. Admin feedback is not part of
this first API and requires a separate decision.

## Decision

### 1. Create a versioned HTTPS JSON API

Maintley will expose a server-owned API under:

```text
/v1
```

The first implementation will use HTTPS Cloud Functions and a shared server
service layer. It will publish an OpenAPI description suitable for the personal
assistant application's tool configuration.

The API is not a direct Firestore proxy. Route handlers will:

1. authenticate the integration credential
2. resolve its account and allowed properties
3. enforce the requested read scope
4. query Maintley's canonical records and compatibility adapters
5. return a stable API response model
6. record a minimized access audit event

An MCP server may later consume the same service layer, but MCP is not required
for the first implementation.

### 2. Limit initial credential issuance to Maintley Owner

Only an authenticated identity with the server-managed Maintley Owner role may
create, list, rotate, or revoke a personal-assistant credential in the first
phase.

Maintley Owner means the owner of Maintley itself. It does not mean:

- homeowner
- customer account owner
- property owner
- landlord
- property manager
- customer administrator

Credential administration must be verified by a trusted server operation.
Hiding the credential interface is not an authorization boundary.

The credential may access only the owner's selected Maintley account and the
explicit property allowlist assigned when the credential is created. Maintley
Owner status does not grant the credential access to other customer accounts.

### 3. Use a scoped personal access token for the private first consumer

The first integration will use a personal access token because the consumer is
a private server application controlled by the Maintley owner. OAuth is
deferred until Maintley supports third-party or customer-created integrations.

Credential behavior:

- the secret is generated with cryptographically secure randomness
- the full token is displayed once at creation
- Maintley never stores or logs the plaintext token
- the stored verifier uses a server-held secret from Secret Manager
- the token contains a non-secret credential identifier or prefix for lookup
- verification uses a constant-time comparison
- the token is accepted only in the `Authorization: Bearer` header
- query-string credentials are rejected
- credentials have a user-selected name
- credentials may have an optional expiration timestamp
- credentials can be revoked immediately
- rotation creates a new secret and invalidates the previous secret
- `lastUsedAt` is updated in a throttled manner

The assistant application must keep the token in server-side secret storage.
The token must not be embedded in browser JavaScript, a distributed mobile
binary, analytics, source control, prompts, or logs.

### 4. Store credentials as server-owned integration records

The credential record will be server-managed and inaccessible to ordinary
Firestore clients except through authorized credential-management callables.

The logical record includes:

```text
credentialId
ownerUserId
accountId
name
tokenPrefix
tokenVerifier
scopes[]
propertyIds[]
status
expiresAt
createdAt
updatedAt
lastUsedAt
revokedAt
rotatedFromCredentialId
```

The first phase uses an explicit `propertyIds` allowlist. Newly created
properties do not become accessible automatically. Expanding the allowlist
requires an authenticated Maintley Owner credential-management action.

Credential documents, token verifiers, and access-audit records are not
customer property records and must not be stored inside property documents.

### 5. Define narrow read scopes

The initial scopes are:

```text
properties:read
equipment:read
tasks:read
maintenance:read
intelligence:read
documents:metadata:read
```

Each route declares its required scope. Having one scope does not imply another.
The first personal-assistant credential may be issued with all approved read
scopes, but the API contract must support narrower credentials.

Read scopes cannot be converted into write scopes. A future write-capable
integration requires a new architectural decision, new credential consent, and
separately issued credentials.

### 6. Provide assistant-oriented read endpoints

Initial endpoints:

```text
GET /v1/properties
GET /v1/properties/{propertyId}
GET /v1/properties/{propertyId}/equipment
GET /v1/properties/{propertyId}/tasks
GET /v1/properties/{propertyId}/maintenance-events
GET /v1/properties/{propertyId}/insights
GET /v1/properties/{propertyId}/documents
GET /v1/upcoming
```

`GET /v1/upcoming` is a derived read view. It returns overdue work and upcoming
tasks across allowed properties without creating tasks, advancing recurrence,
or changing task state.

Supported filters will include, where relevant:

```text
propertyId
status
from
to
dueBefore
updatedAfter
limit
cursor
```

The default upcoming window includes overdue tasks and the next 30 days.
Property timezone is preferred when available, followed by account timezone and
then an explicitly documented fallback. Responses include absolute timestamps
and timezone context where dates could otherwise be ambiguous.

### 7. Return stable, explainable response models

API resources will use canonical Maintley IDs and stable machine values. They
will not expose raw Firestore snapshots or collection implementation details.

Responses will include, where applicable:

- resource ID
- property ID
- display label or title
- current status
- relevant dates and timezone
- source or provenance identifiers
- `createdAt` and `updatedAt`
- pagination cursor

Maintley Intelligence responses must remain explainable. They may include the
finding, recommendation, severity, supporting evidence, property context, and
relevant source record IDs. They must not expose private rule implementation,
raw prompts, hidden scoring internals, or unsupported predictions.

The API returns current Maintley records and deterministic derived views. It
does not use a language model to rewrite or summarize customer data. The
personal assistant application remains responsible for conversational
presentation.

### 8. Include only low-risk document and warranty context

The first API may return document metadata such as:

- document ID
- property ID
- display name
- category
- document type
- upload date
- related equipment, task, or Maintenance Event IDs
- acquisition or review status

It must not return:

- file contents
- extracted raw text
- signed or public download URLs
- Storage paths
- document-processing artifacts

Warranty dates and ordinary warranty fields already associated with an allowed
property or equipment record may be returned through the applicable property or
equipment scope. Complete warranty-document contents remain excluded.

### 9. Exclude sensitive and operational data by default

The first API does not expose:

- tenant or resident names and contact details
- family-member or team-member details
- property access lists or permission snapshots
- user profiles
- billing, subscription, or payment information
- maintenance financial details or cost reports
- document file contents or download access
- raw notifications or push tokens
- admin users or admin sessions
- support inbox or feedback records
- entitlement administration
- audit logs
- secrets or integration credential records

Adding one of these data classes requires an explicit scope and security review.
Maintley admin-portal feedback requires a separate authorization decision even
while the only consumer is the Maintley owner's assistant.

### 10. Enforce strict read-only HTTP behavior

The initial API accepts only safe read operations for resource endpoints. It
must reject attempts to:

- create or update a property
- create, edit, complete, postpone, or delete a task
- create or correct a Maintenance Event
- create or change equipment
- upload, link, or delete a document
- start document acquisition
- change recurrence or generate the next occurrence
- invite or modify a person
- change billing or entitlements

No read request may trigger writes to customer records. Operational writes
limited to credential usage throttling, rate limiting, and minimized audit
events are allowed and must not change customer data.

### 11. Apply rate limits, pagination, and bounded queries

Every collection endpoint is paginated and bounded. The API will define a
maximum page size and use opaque cursors rather than unbounded exports.

Rate limits apply per credential and may also apply per account and source IP.
Rate-limit responses use a stable error contract and may include a safe retry
time. Expensive cross-property views use bounded date windows and allowed
property counts.

The API must avoid per-request unbounded fan-out across Firestore collections.
Any denormalized read model requires a separate review and must not become a
competing source of truth.

### 12. Record minimized access audits

Each authenticated request records sufficient metadata to investigate use
without copying customer response data into logs.

Audit metadata includes:

```text
requestId
credentialId
ownerUserId
accountId
route template
required scope
allowed property context
response status
result count when useful
latency
createdAt
```

The audit must not record:

- plaintext tokens
- authorization headers
- response bodies
- task descriptions or notes
- maintenance notes
- document names when avoidable
- property names or addresses

Security logs and product analytics remain separate systems.

### 13. Use a stable API error contract

Errors return a request ID and stable machine code, for example:

```text
invalid_token
expired_token
revoked_token
insufficient_scope
property_not_allowed
resource_not_found
invalid_filter
rate_limited
internal_error
```

Authentication failures must not reveal whether a credential ID, account,
property, or resource exists. Server logs may retain the internal diagnostic
under the request ID without exposing it to the caller.

### 14. Keep public integrations, admin feedback, and writes out of scope

The following require later decisions:

- OAuth and customer-created integrations
- a public developer portal
- MCP hosting as a public Maintley service
- third-party application consent screens
- admin-portal feedback access
- support inbox access
- task completion or scheduling
- property, equipment, or Maintenance Event writes
- webhook subscriptions
- autonomous background actions

Future write access will require idempotency keys, explicit attribution,
confirmation boundaries, conflict handling, auditability, and narrowly scoped
write permissions. This read-only credential must never gain write authority
through a configuration toggle.

## Implementation Tracking

- [x] Add the versioned read-only personal assistant API.
- [x] Add Maintley Owner-only credential issuance, revocation, and Settings UI.
- [x] Enforce scopes, Property allowlists, rate limits, and minimized audits.
- [x] Publish OpenAPI and handoff documentation for the private first consumer.
- [x] Add authorization, credential, pagination, and response-contract tests.

## Consequences

### Benefits

- The personal assistant can answer useful property questions without direct
  Firestore access.
- The first implementation is small enough for a private owner-controlled use
  case while preserving a path to OAuth later.
- Explicit scopes and property allowlists constrain accidental disclosure.
- Stable API models protect the assistant from internal schema migrations.
- Read-only credentials cannot silently evolve into write credentials.
- Admin-portal feedback remains behind its separate operational boundary.

### Tradeoffs

- Maintley must build credential issuance, secure verification, rotation,
  revocation, rate limiting, and access auditing before exposing useful data.
- API response models and compatibility adapters must be maintained alongside
  application models.
- Explicit property allowlists require manual updates when a new property
  should become available to the assistant.
- A personal access token is appropriate for the private first consumer but is
  not sufficient for a future public integration platform.

## Initial implementation boundaries

The first implementation will include:

- Maintley Owner-only credential management
- one private server-side personal-assistant consumer
- scoped, revocable, hashed personal access tokens
- explicit property allowlists
- versioned REST endpoints and OpenAPI documentation
- properties, equipment, tasks, Maintenance Events, explainable Intelligence,
  warranty fields, and document metadata
- pagination and date filters
- the cross-property upcoming-work view
- rate limiting and minimized access auditing
- emulator and authorization tests
- active architecture, permissions, deployment, and testing documentation

The first implementation will not include:

- browser or mobile token storage
- OAuth
- customer-generated credentials
- access to other customer accounts
- tenant, team, billing, financial, document-content, or admin-portal data
- any customer-record write endpoint
- autonomous assistant actions
