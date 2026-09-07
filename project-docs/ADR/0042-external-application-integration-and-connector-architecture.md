# ADR 0042: External Application Integration and Connector Architecture

Status: Accepted - planned

Date: 2026-09-06

Related ADRs:

- `0014-property-memory-change-review.md`
- `0018-maintley-event-engine.md`
- `0022-account-access-resolver-contract.md`
- `0026-property-ownership-and-professional-contribution-model.md`
- `0027-business-licensing-property-stewardship-and-record-attribution.md`
- `0032-centralized-entitlement-architecture.md`
- `0036-connected-property-knowledge-model.md`
- `0041-maintley-intelligence-shared-platform-and-packaging-boundary.md`
- `0043-customer-authorized-assistant-and-mcp-boundary.md`
- `0044-provider-neutral-work-request-and-contractor-response.md`

## Context

Maintley may integrate with field-service, accounting, document, assistant,
and other approved platforms. The first preferred business-system validation
target is Jobber because its home-service records, Properties, requests,
quotes, jobs, visits, invoices, products and services, OAuth flow, webhooks,
developer test environment, and private pilot allowance align with Maintley's
property-service direction.

An integration must not become a direct Firestore proxy, create a second
canonical source of Property Memory, or embed partner types in Maintley
Intelligence. External systems have their own ownership, deletion, permission,
and lifecycle contracts.

## Decision

### 1. Use a shared integration gateway and provider adapters

External systems will connect through a trusted server-owned integration
gateway. Each provider will have an adapter that maps provider records to
Maintley integration contracts.

```text
Provider API
    -> provider adapter
    -> integration gateway
    -> proposed records or Intelligence input
    -> reviewed Maintley workflow
```

Provider schemas must not become Maintley core or Intelligence contracts.

### 2. Begin with read-only, narrow-purpose pilots

The first Jobber pilot will read only the minimum data required to validate
approved outcomes such as service-history context, legitimate repeat-service
opportunities, and draft post-job records.

No integration may contact customers, create jobs, alter quotes, or update
Property Memory automatically in the first phase.

### 3. Preserve authoritative ownership and provenance

Imported data retains its provider, provider account, external record ID,
source timestamp, synchronization timestamp, and applicable version.

External records may support Intelligence or create proposed Property Memory
changes. They do not become verified Maintley facts merely because an API
returned them.

Maintley must distinguish:

- externally observed data;
- copied reference data;
- professionally recorded information;
- homeowner-reviewed Property Memory; and
- Maintley Intelligence inference.

### 4. Use OAuth for scalable third-party authorization

Where a provider supports partner OAuth, each provider account administrator
must authorize the requested scopes. Tokens and secrets remain server-side,
encrypted or stored through an approved secret boundary, and excluded from
logs and prompts.

Static API keys may be supported only for constrained provider-approved custom
integrations. Their broader exposure and revocation behavior must be explicit
to the administrator.

### 5. Scope every connection by account, purpose, and capability

An integration grant will identify:

```text
connectionId
provider
providerAccountId
maintleyAccountId
authorizedBy
scopes[]
capabilities[]
status
createdAt
updatedAt
expiresAt
revokedAt
```

Access to one provider account or Maintley account never implies access to
another. Property mappings require explicit, reviewable identity decisions.

### 6. Make synchronization idempotent and auditable

Webhook delivery and synchronization jobs must tolerate retries, duplicate
events, out-of-order updates, delayed delivery, disconnection, and partial
provider outages.

Writes use deterministic external identities or idempotency keys. Integration
audits record connection, provider event, operation, affected record identity,
result, and request correlation without copying sensitive payloads into logs.

### 7. Separate linking from copying

Maintley should retain an external reference when that is sufficient. Copy
only the fields needed for an approved Maintley purpose, and identify their
source. Do not mirror complete provider accounts into Firestore by default.

Attachments, customer communication, financial data, and personal information
require purpose-specific review before ingestion.

### 8. Route authoritative changes through reviewed workflows

External information that could update Property Memory will use the existing
proposed-change and review model. Professional attribution identifies who
performed work, who recorded it, and which organization submitted it without
implying Maintley certified the work.

Future write-back to a provider requires explicit user confirmation, supported
provider scopes, conflict handling, attribution, and a separate enabled
capability. Read permission must never imply write permission.

### 9. Define disconnection and retention behavior

On disconnection, Maintley will stop synchronization, revoke or delete active
tokens as appropriate, and preserve only records Maintley has a continuing
authorized reason to retain.

Accepted homeowner Property Memory and historical attribution may remain under
their own retention contract. Provider caches and unaccepted proposals must
expire according to an explicit retention policy. Maintley must not silently
delete canonical customer history solely because a provider connection ends.

### 10. Keep the connector commercially and technically portable

Jobber is the first preferred validation target, not a permanent dependency.
The integration gateway must allow later Housecall Pro, QuickBooks, Buildxact,
or other approved adapters without changing Intelligence core contracts.

Provider-assisted service requests follow the adaptive intake, homeowner
review, and provider-neutral request boundary defined by ADR 0044. A
marketplace connector transports that workflow; it does not own the underlying
intake or Work Request Report contracts.

## Initial Jobber validation boundary

The initial pilot may evaluate:

- service-history summaries;
- equipment-context suggestions from authorized records;
- missing documentation;
- recurring-service opportunities supported by recorded history;
- draft branded completion records; and
- quote-versus-actual summaries when the necessary records exist.

The pilot must not:

- promise revenue;
- send outreach automatically;
- modify Jobber records;
- claim external notes are verified property condition;
- create duplicate Maintley Properties without review; or
- exceed provider pilot or marketplace restrictions.

## Consequences

### Benefits

- Maintley can add value without replacing contractor workflow systems.
- Provider-specific changes remain isolated in adapters.
- Existing data can validate demand before a full contractor application.
- Provenance, review, and disconnection behavior remain explainable.
- A successful connector can support marketplace, licensing, or acquisition
  discussions.

### Costs and risks

- Every provider requires ongoing schema, OAuth, webhook, and version support.
- Marketplace approval is not guaranteed and does not guarantee adoption.
- Provider APIs may omit data needed for a proposed capability.
- Integrations expand privacy, security, and incident-response obligations.
- A provider may reproduce a successful feature internally.

## Implementation tracking

- [ ] Define neutral integration connection and external-reference contracts.
- [ ] Define token storage, rotation, revocation, and incident procedures.
- [ ] Define Property and customer mapping review behavior.
- [ ] Implement idempotent webhook and synchronization infrastructure.
- [ ] Register a Jobber developer application and test account.
- [ ] Confirm exact Jobber scopes and records required for a read-only pilot.
- [ ] Validate with no more than the provider-allowed private pilot accounts.
- [ ] Measure contractor time, opportunity validity, and repeated usage.
- [ ] Decide whether marketplace review is justified by pilot evidence.
- [ ] Review a second provider adapter only after the first pilot produces a
      repeatable result.

## Deferred

This ADR does not implement or approve:

- a contractor marketplace;
- automatic customer outreach;
- payment processing;
- autonomous provider writes;
- bulk migration of provider accounts;
- a public connector SDK;
- a full Maintley Pro field-service suite; or
- an exclusive Jobber dependency.
