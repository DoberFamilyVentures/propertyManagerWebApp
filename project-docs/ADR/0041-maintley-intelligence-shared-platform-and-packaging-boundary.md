# ADR 0041: Maintley Intelligence Shared Platform and Packaging Boundary

Status: Accepted - planned

Date: 2026-09-06

Related ADRs:

- `0006-maintley-intelligence-architecture.md`
- `0008-intelligence-knowledge-source-priority-and-v1-document-scope.md`
- `0010-maintley-intelligence-history.md`
- `0014-property-memory-change-review.md`
- `0020-maintley-resolution-engine.md`
- `0032-centralized-entitlement-architecture.md`
- `0034-personal-assistant-read-api.md`
- `0036-connected-property-knowledge-model.md`
- `0042-external-application-integration-and-connector-architecture.md`
- `0043-customer-authorized-assistant-and-mcp-boundary.md`

Related documentation:

- `project-docs/docs/Product/MAINTLEY_PLATFORM_DIRECTION.md`
- `project-docs/docs/Intelligence/PROPERTY_INTELLIGENCE.md`
- `project-docs/docs/Intelligence/RECOMMENDATION_ENGINE.md`
- `project-docs/reports/2026-09-06-maintley-intelligence-platform-alignment-report.md`

## Context

Maintley Intelligence currently runs as a shared deterministic guidance layer
inside the Maintley web application. Quick Scan, Property Audit, and Portfolio
Dashboard consumers reuse its rules, prioritization, source filtering,
relationship evidence, readiness logic, and resolution planning.

The current engine is nevertheless coupled to Maintley application record
types, maintenance-history compatibility adapters, plan identifiers,
entitlement resolution, frontend consumers, and Firestore-backed scan
persistence. A separate contractor tool, quoting application, partner
integration, or licensed Intelligence capability should not need to adopt
Maintley Home's UI models or internal storage structure.

Maintley also needs to preserve a clear distinction between reusable software
packaging and commercial licensing. Shipping the complete engine to a browser
or partner application would expose proprietary rules and knowledge while
providing a weak technical enforcement boundary.

## Decision

### 1. Treat Maintley Intelligence as a shared internal platform

Maintley Intelligence will become a reusable platform capability consumed by
Maintley Home and future approved products and integrations.

It will remain a derived system. It may produce observations, readiness
results, assessments, predictions, recommendations, and resolution intents,
but it will not become the canonical owner of Properties, Equipment, Tasks,
Documents, Maintenance Events, Quotes, Jobs, customers, or payments.

### 2. Extract packages before creating a separate service

The first separation will occur through private workspace packages in the
existing repository. The initial target structure is:

```text
packages/
├── intelligence-contracts/
├── intelligence-core/
├── intelligence-maintley-adapter/
└── intelligence-evaluation/
```

Repository or company separation is not required during the initial phase.
Package boundaries must become stable and a second real consumer must exist
before a separately deployed service is required.

### 3. Keep the core independent of product infrastructure

The neutral contracts and pure core must not depend on:

- React or product UI components;
- Redux or client state;
- Firebase or Firestore;
- Maintley routes or navigation actions;
- Maintley plan names;
- partner-specific types such as Jobber records;
- notification delivery;
- payment processing; or
- canonical record writes.

Evaluation time, permitted capabilities, normalized evidence, and requested
modules must be supplied explicitly.

### 4. Separate contracts, engine, modules, and adapters

The platform will distinguish:

- **contracts** - stable subjects, evidence, outputs, manifests, and errors;
- **core** - deterministic orchestration, aggregation, prioritization, and
  policy enforcement;
- **modules** - independently versioned property-care, readiness, document,
  cost, lifecycle, quote, or future predictive capability;
- **adapters** - mappings between product records and neutral contracts; and
- **consumers** - product-owned presentation and completion workflows.

Maintley Home remains responsible for converting its records to neutral input
and mapping resolution intents to its user experience.

### 5. Move entitlement resolution outside the pure core

Product plans and billing policy do not belong in reusable reasoning code.
Maintley Home or a future trusted service policy layer will resolve the
caller's allowed capabilities and pass an explicit evaluation policy.

The core may filter by the supplied policy, but it must not infer commercial
access from names such as Homeowner+, Portfolio, or Pro.

### 6. Version every material evaluation dependency

Persisted outputs will progressively record:

- contract version;
- engine version;
- module and rule versions;
- knowledge versions;
- evaluation-policy version;
- model and prompt versions when applicable;
- evaluation time; and
- evidence references sufficient for explanation and correction.

Existing baseline and scan schema versions remain supported through
compatibility adapters.

### 7. Preserve distinct output classes

The shared contracts will distinguish recorded observations, record readiness,
attributed guidance, historical patterns, statistical predictions,
professional assessments, and recommendations.

A confidence value must identify its meaning. Deterministic rule confidence,
document-extraction confidence, statistical probability, and professional
opinion must not be collapsed into one unexplained score.

### 8. Keep proprietary execution server-side before external licensing

The private core may initially remain build-compatible with Maintley Home while
behavior is characterized and extracted. Proprietary knowledge, external model
calls, predictive modules, cross-product execution, and licensed partner use
will run behind a Maintley-controlled service boundary.

The preferred external distribution model is:

```text
Partner application
    -> @maintley/intelligence-sdk
    -> Maintley Intelligence API
    -> private core and modules
```

The partner-facing SDK may include contracts, authentication helpers, API
calls, retries, idempotency support, and version negotiation. It will not
contain the complete proprietary engine unless a separately approved strategic
agreement requires source distribution.

### 9. Support licensing without making licensing the product's only outcome

The platform must be technically and contractually separable so selected
modules can be licensed, embedded, or acquired. Maintley Home will remain a
first-class consumer and proving environment.

The initial decision does not create a separate company, promise a licensing
partner, or authorize publication of private packages.

### 10. Require validation before predictive release

Current restrictions on diagnosing physical property condition, predicting
failure, making safety judgments, or asserting code compliance remain in
force. Predictive modules require a later decision covering evidence quality,
training and validation data, calibration, monitoring, customer language,
privacy, and rollback thresholds.

## Consequences

### Benefits

- Existing Intelligence behavior can be reused without duplicating rules.
- Maintley Home, contractor tools, and integrations can evolve independently.
- Commercial plans no longer define core technical contracts.
- Proprietary logic remains protected behind a service boundary.
- Versioned modules improve explainability and licensing flexibility.
- Maintley can add providers and products without rewriting the engine.

### Costs and risks

- Extraction requires compatibility adapters and strong regression fixtures.
- Package and module versioning create ongoing release responsibilities.
- Moving execution server-side adds latency, operating cost, and availability
  considerations.
- Neutral contracts may initially feel more verbose than application types.
- Poorly chosen abstractions could freeze current limitations into a public
  interface.

## Implementation direction

1. Capture golden fixtures for current rules and consumers.
2. Inventory imports that cross the current `src/intelligence` boundary.
3. Create dependency-light neutral contracts.
4. Extract deterministic orchestration and rule interfaces.
5. Add a Maintley Home adapter preserving current behavior.
6. Move plan resolution and presentation actions outside the core.
7. Add typed evidence and evaluation manifests.
8. Preserve saved scan compatibility.
9. Prove reuse through a second approved consumer.
10. Introduce a hosted service and external SDK only after the package boundary
    is stable.

## Implementation tracking

- [ ] Add golden fixtures for the current Intelligence engine and consumers.
- [ ] Create `@maintley/intelligence-contracts` as a private workspace package.
- [ ] Create `@maintley/intelligence-core` as a private workspace package.
- [ ] Add a Maintley Home adapter for current Property Memory records.
- [ ] Move entitlement resolution outside the pure engine.
- [ ] Add typed evidence and evaluation-manifest contracts.
- [ ] Preserve Quick Scan and Property Audit snapshot compatibility.
- [ ] Validate equivalent current behavior through focused tests.
- [ ] Prove the package with a second real consumer.
- [ ] Review the hosted service and SDK boundary before external licensing.

## Deferred

This ADR does not implement or approve:

- a public NPM package;
- a separate Maintley Intelligence company;
- an independent repository;
- external source-code licensing;
- predictive maintenance;
- autonomous property changes;
- Jobber or other partner integration;
- customer OAuth; or
- a public Intelligence API.
