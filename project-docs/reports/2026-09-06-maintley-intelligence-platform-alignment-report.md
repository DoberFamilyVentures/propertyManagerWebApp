# Maintley Intelligence Platform Alignment Report

Date: 2026-09-06

Status: Point-in-time architecture and implementation assessment

## Executive summary

Maintley Intelligence is already directionally aligned with becoming a shared
intelligence platform for Maintley Home, a standalone quoting product, a future
Maintley Pro contractor experience, and other property-focused tools. The
current implementation is not merely a UI label: it has a deterministic rule
engine, a structured finding contract, prioritization and aggregation,
source-based provenance, plan-aware filtering, relationship evidence,
readiness calculations, multiple consumers, resolution planning, versioned
scan snapshots, and focused automated tests.

The strongest alignment is philosophical and contractual. Maintley already
treats Intelligence as derived, explainable guidance rather than canonical
property data. It keeps recommendations separate from completion workflows,
preserves historical snapshots, identifies why findings exist, and requires
review before proposed knowledge becomes Property Memory. Those are the right
foundations for assessments, predictive guidance, document understanding,
quote readiness, and contractor-facing intelligence.

The current implementation is not yet an independent living system. It is a
frontend-local TypeScript subsystem inside the Maintley web application. Its
public input contract imports Maintley application models directly; its engine
performs Maintley plan filtering; its rules reference Maintley-specific asset
and maintenance adapters; its consumers contain product presentation logic;
and snapshot persistence is implemented through the application's Redux and
Firestore layer. There is no independent package boundary, service API,
tenant-neutral contract, model-provider layer, predictive model registry,
general assessment contract, quoting domain, price book, job-outcome learning
loop, or cross-product authorization contract.

The correct conclusion is therefore:

> Maintley Intelligence already contains the seed of the proposed platform,
> but it should be extracted and expanded rather than replaced.

The preferred path is package first, service second. Maintley should first
separate a pure, neutral Intelligence core from Maintley Home adapters,
entitlements, persistence, and UI consumers. It should then add assessment and
prediction contracts, evaluation provenance, outcome measurement, and bounded
domain modules. Only after at least two real consumers need the boundary should
the package become an independently deployed service.

This approach preserves the working, tested rule engine while avoiding a
premature microservice split.

## Scope and questions answered

This report answers five questions:

1. What is Maintley Intelligence today in documentation and implementation?
2. Which parts already align with a shared assessment and prediction platform?
3. Which capabilities are partial, absent, or intentionally prohibited today?
4. What must change to support Maintley Home, quoting, and contractor products?
5. What staged architecture and delivery sequence best preserves trust and
   existing behavior?

This is an architecture report, not an implementation change. It does not
approve predictive claims, change current customer-facing safety language,
create a separate service, or add a quoting domain.

## Methodology and validation boundary

The assessment reviewed:

- current Intelligence documentation under `project-docs/docs/Intelligence`;
- applicable architecture decisions, especially ADRs 0006, 0008, 0010, 0011,
  0014, 0018, 0020, 0026, 0027, 0034, 0036, and 0039;
- all files under `src/intelligence`;
- the property scan adapter and persistence paths under `src/utils` and
  `src/Redux/API`;
- current Property Knowledge Acquisition and document-understanding Functions;
- current engine, consumer, relationship, readiness, and resolution tests; and
- relevant product, data-model, and technical-architecture documentation.

Point-in-time source inventory:

| Item                                        |                         Observed implementation |
| ------------------------------------------- | ----------------------------------------------: |
| TypeScript files under `src/intelligence`   |                                              32 |
| Focused test files under `src/intelligence` |                                               7 |
| Focused `it(...)` / `test(...)` cases       |                                              50 |
| Registered engine rules                     |                                               9 |
| Product consumers                           | Quick Scan, Property Audit, Portfolio Dashboard |
| Persisted scan types                        |   `quick_property_scan_v1`, `property_audit_v1` |

The report uses source inspection and documentation comparison. No production
deployment, live customer-data evaluation, model benchmark, prediction
backtest, or quoting workflow test was performed. Existing automated tests
were inventoried but not re-run because this change adds documentation only.

## Target vision evaluated

The proposed direction is one shared system that handles most property-related
reasoning for multiple products:

```text
                           Maintley Intelligence
                    ┌─────────────────────────────┐
                    │ Evidence and provenance     │
                    │ Deterministic rules         │
                    │ Knowledge retrieval         │
                    │ Assessments                 │
                    │ Predictive models           │
                    │ Bounded AI interpretation   │
                    │ Recommendations             │
                    │ Resolution planning         │
                    └─────────────────────────────┘
                         ↑          ↑          ↑
                         │          │          │
                    Maintley     Quoting    Maintley Pro
                      Home         Tool      / Contractor
```

Under this vision, Intelligence reasons, assesses, predicts, and recommends.
Each consuming product remains responsible for its canonical records,
permissions, transactions, user interface, and final actions.

## Overall alignment assessment

| Platform capability                          | Current alignment            | Assessment                                                                                                                        |
| -------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Derived guidance rather than source of truth | Strong                       | Explicitly established in current documentation and engine behavior.                                                              |
| Deterministic rule execution                 | Strong                       | Implemented through a shared engine and registered rule set.                                                                      |
| Structured findings                          | Strong                       | Findings include identity, category, severity, priority, source, explanation, action, entitlement, metadata, and version context. |
| Explainability                               | Strong                       | Findings expose descriptions, why-it-matters text, source, affected records, and supporting relationship evidence.                |
| Multiple experiences from one engine         | Strong                       | Quick Scan, Property Audit, and Portfolio Dashboard reuse the engine.                                                             |
| Source provenance                            | Strong foundation            | Four source labels exist; evidence granularity and future model provenance need expansion.                                        |
| Knowledge packs                              | Moderate                     | Baseline care and asset-specific guidance exist, but the knowledge system is still application-local and bounded.                 |
| Connected property context                   | Moderate to strong           | Canonical relationships are implemented and can enrich findings without creating authoritative inferences.                        |
| Readiness assessments                        | Moderate                     | Three record-readiness categories exist; there is no universal assessment contract.                                               |
| Resolution planning                          | Moderate                     | Typed plans exist for several findings; execution remains product-specific and coverage is incomplete.                            |
| Scan history and reproducibility             | Moderate                     | Snapshots and baseline versions exist; full engine/rule/input/model reproducibility is not yet captured.                          |
| Property Knowledge Acquisition               | Moderate                     | Review-first extraction and confidence concepts exist outside the core engine.                                                    |
| Contractor contribution                      | Architectural alignment only | Proposed ADRs define stewardship and attribution, but this is not a general contractor collaboration platform.                    |
| Predictive maintenance                       | Not implemented              | Current guidance explicitly avoids equipment-condition and failure prediction.                                                    |
| Financial and lifecycle forecasting          | Not implemented              | Costs exist in operational records, but there is no forecasting engine.                                                           |
| Quote and scope intelligence                 | Not implemented              | No quote domain, price book, quote assessment, or quote resolution type exists in the core.                                       |
| Statistical/model orchestration              | Not implemented              | No model registry, feature pipeline, inference interface, or evaluation harness was found.                                        |
| General LLM/provider layer                   | Not implemented              | Current core is deterministic; document parsers are bounded and task-specific.                                                    |
| Cross-application API                        | Not implemented              | The engine runs in the Maintley application and has no independent service boundary.                                              |
| Outcome-learning loop                        | Not implemented              | History can inform rules, but predictions are not systematically compared with eventual outcomes.                                 |

## What Maintley Intelligence is today

### 1. A deterministic rule engine

`src/intelligence/engine.ts` is the center of the current implementation. It:

1. normalizes the evaluation date and plan;
2. resolves applicable capabilities;
3. merges maintenance-history compatibility sources;
4. constructs an Intelligence context;
5. runs registered rules;
6. aggregates overlapping findings;
7. adds accepted relationship evidence;
8. filters findings by plan and capability;
9. prioritizes the result; and
10. returns a structured summary and findings.

This is a real engine boundary, and its optional injected rule list is a useful
testability and future-modularity seam.

The nine registered rules currently cover:

- overdue tasks;
- missing installation dates;
- missing important identification;
- missing inspection documentation;
- missing Knowledge Pack details;
- missing maintenance history;
- missing actionable maintenance coverage;
- overdue baseline maintenance cadence; and
- seasonal context guidance.

The current rule set primarily detects record gaps, overdue work, schedule
opportunities, and contextual reminders. It does not assess actual physical
condition or predict failure.

### 2. A structured recommendation contract

`src/intelligence/types.ts` defines `MaintleyFinding`. Important fields include:

- stable finding and rule identifiers;
- Property and affected Equipment identifiers;
- category, severity, and priority;
- source provenance;
- title, description, and `whyItMatters`;
- suggested action label and type;
- required plan and capabilities;
- baseline version;
- metadata; and
- creation time.

This aligns well with a future platform because consumers receive structured
results rather than rendered prose. It is not yet sufficient for predictive or
cross-domain assessments because it lacks first-class evidence references,
confidence semantics, validity windows, model versions, uncertainty ranges,
observation-versus-inference typing, and evaluation purpose.

### 3. Multiple consumers sharing one engine

The repository already realizes the ADR 0006 principle, "One intelligence
engine. Multiple experiences."

- Quick Scan converts findings into a focused homeowner review.
- Property Audit groups findings into asset-centered review categories.
- Portfolio Dashboard summarizes intelligence across Properties and applies
  product-specific presentation and entitlement behavior.

This is the clearest proof that the proposed platform shape is evolutionary.
The current consumer pattern can become an explicit application-adapter model.

### 4. Readiness rather than property scoring

`src/intelligence/readiness.ts` calculates record readiness for Equipment
context, maintenance coverage, and service history. The current documentation
carefully states that readiness measures what Maintley can understand from its
records—not property health, homeowner quality, or inspected physical
condition.

This is an important trust pattern to preserve. A future assessment framework
should not erase the distinction between:

- data/readiness assessments;
- observed record conditions;
- attributed general guidance;
- statistical predictions; and
- professionally verified physical assessments.

### 5. Accepted relationship evidence

Maintley can add evidence from canonical Property relationships involving
Equipment, Spaces, Supplies, Documents, and Tasks. The implementation uses
accepted links as supporting evidence; it does not automatically create
authoritative relationships, change finding priority, or mutate Property
Memory.

That is directly aligned with a future property graph. The missing piece is a
neutral evidence graph/query boundary that does not import Maintley UI data
types and can distinguish asserted, imported, professionally recorded,
user-approved, and inferred relationships.

### 6. Resolution planning

`src/intelligence/resolutionEngine.ts` maps supported findings to typed
completion plans such as editing Equipment, creating tasks, adding history,
uploading documents, scanning labels, reviewing knowledge, and involving a
contractor.

The separation is strategically correct:

```text
Finding -> Resolution plan -> Product-owned completion workflow
```

The implementation is still an initial mapping layer rather than a general
workflow orchestrator. Resolution coverage is rule-specific, some declared
resolution types have no complete end-to-end flow, and action types are tied to
Maintley Home navigation concepts.

### 7. Versioned scan persistence and event publication

Quick Scan and Property Audit snapshots are stored separately from Maintenance
History. The persistence layer maintains latest snapshots, preserves Quick Scan
history, records schema and baseline versions, and publishes scan-completed
events.

This supports auditability, but it does not yet provide complete evaluation
reproducibility. A future shared system should retain an evaluation manifest
containing engine version, rule versions, knowledge versions, model and prompt
versions when applicable, normalized input references, capability policy,
timestamps, and execution identity.

### 8. Property Knowledge Acquisition and review-first confidence

Maintley has meaningful adjacent capabilities in Functions and Property
Knowledge UI:

- structured document acquisition;
- inspection-document understanding;
- DOCX service-report extraction;
- confidence values and reasons;
- proposed knowledge changes; and
- explicit review before accepted data enters canonical records.

These capabilities are not unified under the current `src/intelligence` engine.
They demonstrate useful platform patterns, especially evidence preservation and
review-first writes, but currently form a neighboring subsystem rather than one
cohesive Intelligence runtime.

## Where the current implementation strongly aligns

### Explainability is an architectural invariant

Current guidance is designed to answer what Maintley observed, why it matters,
and what the user can do. This is exactly the posture required for trustworthy
assessment and prediction. Predictive outputs should extend this contract, not
replace it with opaque scores.

### Canonical records remain outside Intelligence

Property, Equipment, Task, Document, Supply, Space, Maintenance Event, and
relationship records remain authoritative. Findings and scans are derived.
That boundary allows several products to consume the same intelligence without
letting an inference overwrite customer records.

### Historical truth and derived history are separate

Maintenance Events record work performed. Intelligence scan history records
what the engine concluded at a point in time. This distinction becomes even
more important when predictions are introduced: a prediction is not an event,
and an eventual outcome must not be rewritten to make the prediction appear
correct.

### Provenance already affects access and explanation

The source labels `property_memory`, `knowledge_pack`, `history_inference`, and
`context` provide a workable starting taxonomy. They let Maintley say why a
finding exists and support source-based product entitlements.

### Human review is already preferred over silent automation

Property Knowledge Acquisition and the Resolution Engine both steer toward
reviewed completion. This matches the safety needs of contractor contribution,
quote generation, document extraction, and future AI-assisted changes.

### The connected knowledge model is implemented

ADR 0036 is marked implemented, and Intelligence can consume canonical
relationships as evidence. Maintley therefore has more than flat property
records: it has the beginning of a property knowledge graph that future
assessment modules can use.

## Where alignment is partial

### The engine boundary exists, but the platform boundary does not

The core looks modular inside the frontend repository, yet its input contract
imports `Property`, `Asset`, `Device`, `Task`, `PropertyDocument`,
`PropertySpace`, `PropertySupply`, and `PropertyKnowledgeLink` directly from
the Maintley application. It also imports the maintenance-history compatibility
adapter and plan entitlements.

This means another application cannot safely consume the engine without also
adopting Maintley Home's domain models and product policy.

### Evidence exists, but it is not a universal contract

Relationship evidence is structured, and acquisition suggestions have
confidence information. The finding contract itself still places most
rule-specific evidence inside `metadata: Record<string, unknown>`. That is too
weak for independently versioned assessments or predictions.

### Knowledge exists, but it is not a governed knowledge platform

The Baseline Care Library and asset guidance are useful. A shared system will
need explicit knowledge-package identities, versions, jurisdictions,
applicability constraints, review status, citations, retirement policies, and
compatibility rules.

### Historical inference exists, but prediction does not

The baseline cadence rule can compare recorded dates and known cadence. That is
historical inference in a bounded sense. There is no learned failure model,
remaining-life model, probability calibration, cost forecast, or prospective
validation process.

### Confidence exists in acquisition, but not throughout Intelligence

Document-derived suggestions carry confidence and a reason. Ordinary findings
do not have a first-class confidence or uncertainty contract. A future platform
must avoid pretending deterministic certainty and statistical confidence are
the same concept.

### Events exist, but the feedback loop is incomplete

Maintley publishes operational events and stores scan results. It does not yet
connect each recommendation or prediction to disposition, completed work,
discovered condition, actual cost, and eventual validation outcome.

## Capabilities not implemented today

The following proposed capabilities should be treated as roadmap work, not as
current Maintley Intelligence behavior.

### Predictive condition and failure intelligence

There is no implementation that predicts physical condition, equipment
failure, remaining useful life, or safety. Current active documentation
explicitly prohibits those claims within the present recommendation safety
ladder.

Before adding predictive outputs, Maintley needs:

- a new approved safety and claims boundary;
- appropriate training or reference data;
- a feature-definition and data-quality contract;
- calibrated probabilities or ranges;
- backtesting and prospective validation;
- drift and performance monitoring;
- clear non-diagnostic customer language; and
- escalation rules for safety-sensitive situations.

### General assessment framework

The current readiness implementation is purpose-built. There is no generic
assessment object that can represent quote readiness, maintenance risk,
documentation quality, replacement planning, seasonal preparedness, or a
professionally supplied inspection result without conflating them.

### Quote and estimating intelligence

The current repository contains task estimates and completed-work costs, but
that is not a quoting system. Missing platform capabilities include:

- quote and revision records;
- line-item and scope contracts;
- measurements and assumptions;
- company price books;
- labor, material, minimum, travel, markup, tax, and discount rules;
- quote-readiness assessments;
- actual-versus-estimate comparisons;
- quote approval and delivery;
- `create_quote` and `review_quote` resolution types; and
- a neutral boundary between Intelligence recommendations and deterministic
  financial calculation.

Maintley Intelligence should help determine scope, missing information, risks,
and comparable context. It should not invent a final price. A deterministic,
company-owned pricing engine should calculate monetary results.

### Shared cross-application runtime

There is no authenticated, versioned Intelligence API, job execution layer,
queue, SDK, usage boundary, tenant isolation model for multiple products, or
service-level operational monitoring.

### Model and provider orchestration

There is no general interface for language, vision, statistical, or predictive
models. Existing document parsers are specialized Functions, not a model
registry or orchestration platform.

### Outcome learning and evaluation

There is no closed-loop dataset connecting recommendations and predictions to
user decisions and validated outcomes. Without that loop, predictive claims
cannot be measured or responsibly improved.

## Important current constraints that must change deliberately

### Current safety language prohibits the proposed predictive behavior

Active Intelligence documentation says Maintley evaluates saved records rather
than actual property condition and explicitly places diagnosis, failure
prediction, safety judgment, code compliance, and structural advice in the
avoid category.

This is appropriate for the current engine. It also means predictive work is
not merely a refactor: it is a product, evidence, claims, and safety decision
requiring a new ADR and revised documentation before implementation.

The future platform should preserve distinct output classes:

| Output class            | Example                                                    | Required handling                               |
| ----------------------- | ---------------------------------------------------------- | ----------------------------------------------- |
| Recorded fact           | No service event is recorded after 2025-06-01.             | Cite canonical record query.                    |
| Record readiness        | Model number is missing, limiting model-specific guidance. | Explain missing context.                        |
| Attributed guidance     | Maintley baseline suggests annual review.                  | Identify knowledge source/version.              |
| Historical pattern      | Three recorded services occurred about 12 months apart.    | Identify compared events.                       |
| Statistical prediction  | Elevated probability of repair within 12 months.           | Show model, range, confidence, and limitations. |
| Professional assessment | Contractor recorded corrosion during service.              | Preserve performer/recorder attribution.        |
| Proposed action         | Review replacement options.                                | Require appropriate user workflow.              |

### Professional contribution is proposed, not a completed general capability

ADRs 0026 and 0027 establish useful proposed boundaries for homeowner-owned
Property Memory, professional stewardship, and neutral attribution. They should
inform Maintley Pro, but their proposed status means the platform should not
assume all contractor collaboration, licensing, and contribution mechanics are
already settled or shipped.

### Entitlements currently leak into the engine

The engine resolves and filters Maintley plans and capabilities internally.
That is convenient for one application, but a shared engine should not know
whether a consumer calls a tier Homeowner+, Pro, Portfolio, or something else.
The caller or service policy layer should resolve authorized capabilities and
pass an explicit evaluation policy.

### Execution currently occurs primarily in the client

Quick Scan and Property Audit invoke the engine from application code, then use
the Redux/Firestore layer to persist snapshots. That works for deterministic,
bounded local evaluation. Predictive models, proprietary knowledge, cross-app
consistency, usage controls, and sensitive prompts generally require a trusted
server-side execution boundary.

## Recommended target architecture

### Layer 1: Intelligence contracts

Create a dependency-light package containing stable, neutral contracts:

```text
@maintley/intelligence-contracts
├── subjects
├── evidence
├── observations
├── assessments
├── predictions
├── recommendations
├── resolutions
├── evaluations
└── versions
```

The contracts should not import React, Redux, Firebase, Maintley page models,
or plan names.

Core concepts should include:

- `IntelligenceSubject` — Property, Space, Equipment, Task, Document, Quote,
  Job, or other addressable subject;
- `EvidenceReference` — immutable reference to the fact supporting an output;
- `Observation` — normalized fact derived from evidence;
- `Assessment` — bounded evaluation against explicit criteria;
- `Prediction` — future-oriented result with horizon and uncertainty;
- `Recommendation` — proposed next action with rationale;
- `ResolutionPlan` — product-neutral completion intent;
- `EvaluationManifest` — complete provenance for an engine run; and
- `EvaluationPolicy` — authorized modules and safety constraints supplied by
  the caller.

### Layer 2: Deterministic Intelligence core

Extract the pure rule pipeline:

```text
@maintley/intelligence-core
├── rule registry
├── aggregation
├── prioritization
├── evidence reconciliation
├── confidence normalization
├── policy filtering
└── evaluation manifest generation
```

This layer should be deterministic for identical normalized input, policy, and
version selections. Time must always be injected. It must not perform network,
database, UI, billing, or navigation work.

### Layer 3: Domain modules

Build independently versioned modules:

```text
@maintley/intelligence-property-care
@maintley/intelligence-record-readiness
@maintley/intelligence-quote-readiness
@maintley/intelligence-scope
@maintley/intelligence-lifecycle
@maintley/intelligence-cost
@maintley/intelligence-document-understanding
```

Each module declares accepted inputs, outputs, required evidence, safety class,
capabilities, knowledge dependencies, and validation status.

### Layer 4: Product adapters

Maintley Home and the quoting application should map their canonical records
into neutral contracts:

```text
Maintley records -> Home adapter -> Intelligence contracts
Quote/job records -> Pro adapter -> Intelligence contracts
```

Outputs map back into product workflows, never directly into canonical writes.

### Layer 5: Product-owned calculation and workflow services

Some systems belong beside Intelligence rather than inside it:

- deterministic quote pricing;
- invoicing and payment;
- user and professional permissions;
- subscription and capability resolution;
- notification delivery;
- canonical record persistence; and
- human approval workflows.

### Layer 6: Trusted Intelligence service

After package extraction and a second real consumer, expose the system through
a service boundary:

```text
POST /v1/evaluations/property-readiness
POST /v1/evaluations/property-care
POST /v1/evaluations/quote-readiness
POST /v1/evaluations/scope-review
POST /v1/evaluations/lifecycle
GET  /v1/evaluations/{evaluationId}
POST /v1/evaluations/{evaluationId}/outcomes
```

The service should own module orchestration, knowledge and model selection,
evaluation manifests, usage metering, audit logging, and server-side policy
enforcement. It should not become the canonical database for every consuming
product.

## Proposed universal output contract

A future contract should preserve the strengths of `MaintleyFinding` while
making assessment and prediction explicit:

```ts
interface IntelligenceOutput {
  id: string;
  evaluationId: string;
  kind: "observation" | "assessment" | "prediction" | "recommendation";
  subject: IntelligenceSubject;
  domain: string;
  title: string;
  explanation: string;
  evidence: EvidenceReference[];
  provenance: {
    sourceTypes: string[];
    engineVersion: string;
    moduleVersion: string;
    knowledgeVersions?: string[];
    modelVersion?: string;
    promptVersion?: string;
  };
  confidence?: {
    kind: "deterministic" | "extraction" | "statistical" | "professional";
    value?: number;
    level?: "low" | "medium" | "high";
    reason: string;
    calibrationSet?: string;
  };
  prediction?: {
    horizonStart: string;
    horizonEnd: string;
    range?: { low: number; expected?: number; high: number; unit: string };
  };
  recommendedResolution?: ResolutionIntent;
  validUntil?: string;
  createdAt: string;
}
```

This is an illustrative direction, not an approved schema. Exact contracts
require an ADR and compatibility plan.

## How each proposed product should use the platform

### Maintley Home

Maintley Home should remain the homeowner's durable Property Memory and action
experience. It can use the platform for:

- record readiness;
- maintenance opportunities;
- seasonal guidance;
- lifecycle and cost planning;
- reviewed document extraction;
- issue intake;
- explainable property assessments; and
- recommendations that resolve into homeowner workflows.

It should not represent a prediction as a physical inspection or allow
Intelligence to silently modify Property Memory.

### Standalone quoting product

The quoting product should own customers, jobs, quotes, revisions, price books,
line items, approvals, delivery, and financial calculations. It can use the
platform for:

- intake interpretation;
- scope suggestions;
- missing-information detection;
- measurement and photo requests;
- quote-readiness assessment;
- similar-job retrieval;
- anomaly and omission detection;
- estimate explanation; and
- actual-versus-estimate learning.

A company-controlled deterministic pricing engine must calculate the final
amount.

### Maintley Pro and contractor participation

Maintley Pro can use the same quote and job intelligence independently of a
homeowner account. When a professional is invited to a Maintley Property, the
system should expose only authorized context and return proposed contributions.

Professional contributions should preserve:

- who performed the work;
- who recorded the information;
- the organization responsible for the contribution;
- the evidence supplied;
- whether the homeowner reviewed or accepted it; and
- whether a value is recorded fact, professional opinion, or Intelligence
  inference.

Maintley should not imply that it certified work merely because the record was
submitted through the platform.

## Predictive Intelligence: responsible evolution path

Predictive capability should be built as a measured product discipline, not as
a generic AI prompt.

### Phase A: deterministic prospective statements

Start with outputs that are future-oriented but calculable:

- warranty-expiration windows;
- user-defined and baseline maintenance due dates;
- age bands based on a confirmed installation date;
- known replacement reserve schedules supplied by the user or an attributed
  knowledge source; and
- budget projections from explicit planned work.

### Phase B: historical pattern summaries

Use a property's own saved history:

- typical time between comparable services;
- recurring repair categories;
- cost trends with clear sample counts;
- task completion patterns; and
- variance between prior estimates and actual costs.

These should be described as recorded patterns, not population-level failure
predictions.

### Phase C: validated statistical prediction

Only after sufficient data and governance exist should Maintley produce:

- repair probability within a defined horizon;
- expected cost ranges;
- remaining useful-life ranges;
- quote-overrun risk; or
- likely next maintenance needs.

Every model must have a stated population, minimum evidence threshold,
calibration method, validation dataset, version, monitoring owner, and safe
fallback when evidence is insufficient.

### Phase D: bounded multimodal assistance

Language and vision models can interpret customer descriptions, labels,
invoices, manuals, inspection documents, and photographs. Their output should
be proposed structured observations with source references and confidence,
then pass through deterministic validation and human review.

## Outcome and learning architecture

Maintley should create an explicit feedback contract before claiming that the
system learns:

```text
Evaluation
    -> output presented
    -> user or professional disposition
    -> resolution chosen
    -> work completed
    -> actual condition and cost recorded
    -> outcome linked to original output
    -> rule/model performance measured
```

Suggested outcome fields include:

- output and evaluation identifiers;
- presented, dismissed, deferred, accepted, or superseded status;
- selected resolution;
- related Task, Quote, Job, Maintenance Event, or contribution;
- discovered condition;
- actual labor, materials, and total cost when authorized;
- completion date;
- validation result; and
- user correction or disagreement.

Product analytics are not automatically model-training consent. Any use of
customer or professional data for pooled model improvement requires explicit
privacy, retention, de-identification, contractual, and opt-out decisions.

## Security, privacy, and trust requirements

A shared Intelligence platform increases the importance of existing account
and Property boundaries.

Required controls include:

- server-verified tenant, account, Property, and professional authorization;
- least-privilege retrieval of source records;
- no cross-customer model context or retrieval leakage;
- immutable evaluation manifests and audit logs;
- explicit retention rules for prompts, images, documents, and outputs;
- sensitive-field redaction before external model calls;
- provider data-use and residency review;
- idempotency for evaluation and outcome writes;
- versioned schemas and backward-compatible SDKs;
- rate, cost, and abuse controls; and
- fail-closed handling when authorization or source provenance is uncertain.

For contractor collaboration, an invitation to contribute must not become
unbounded access to the homeowner's Property Memory. Access should be scoped by
Property, purpose, record type, duration, and action.

## Recommended staged roadmap

### Stage 0: approve the platform boundary

Objective: decide what Maintley Intelligence is before moving code.

Deliverables:

- ADR defining the shared platform, product boundaries, and naming;
- output-class and safety taxonomy;
- ownership matrix for Intelligence, Maintley Home, quoting, and Maintley Pro;
- decision on package-first extraction; and
- explicit statement that current predictive prohibitions remain until a
  later approved capability.

Exit criterion: no ambiguity about canonical data, calculations, permissions,
or final-action ownership.

### Stage 1: characterize and freeze current behavior

Objective: protect the working engine during extraction.

Deliverables:

- golden evaluation fixtures for representative Properties;
- contract tests for all nine rules and three consumers;
- deterministic clock and ordering tests;
- snapshot compatibility tests;
- dependency map for every import leaving `src/intelligence`; and
- baseline performance measurements.

Exit criterion: the same normalized inputs produce equivalent findings before
and after extraction.

### Stage 2: extract neutral contracts and pure core

Objective: create an independently testable package without changing product
behavior.

Deliverables:

- `@maintley/intelligence-contracts`;
- `@maintley/intelligence-core`;
- Maintley Home input and output adapters;
- entitlement resolution moved outside the pure core;
- persistence and UI dependencies kept in the consuming application; and
- compatibility adapters for saved scan schemas.

Exit criterion: Maintley Home passes existing Intelligence behavior and tests
through the extracted package.

### Stage 3: unify evidence, confidence, and evaluation provenance

Objective: make outputs defensible across deterministic and AI-assisted
modules.

Deliverables:

- typed evidence references;
- universal evaluation manifests;
- explicit output classes;
- confidence kinds rather than one ambiguous number;
- knowledge, rule, and engine version registries; and
- durable links from output to accepted resolution and outcome.

Exit criterion: every output can answer what produced it, from which evidence,
under which versions and policy.

### Stage 4: add assessment modules

Objective: expand beyond findings without beginning with unsafe prediction.

Recommended first modules:

1. existing record readiness, migrated to the universal assessment contract;
2. quote readiness;
3. scope completeness;
4. maintenance coverage;
5. document and evidence completeness; and
6. contractor contribution completeness.

Exit criterion: at least two products consume one shared assessment module.

### Stage 5: build the quoting integration

Objective: prove cross-product reuse with a commercially useful workflow.

Deliverables:

- separate quote/job domain and price book;
- quote application adapter;
- quote-readiness and scope-review modules;
- `create_quote` / `review_quote` resolution intents;
- explicit assumptions and evidence display;
- contractor approval before quote delivery; and
- estimate-versus-actual outcome linkage.

Exit criterion: a contractor can create a defensible quote independently, and
an authorized Maintley Property can supply context without transferring record
ownership.

### Stage 6: introduce the trusted service boundary

Objective: support multiple products, proprietary knowledge, and server-side
model execution.

Deliverables:

- versioned service API and SDKs;
- centralized authorization policy adapter;
- evaluation storage and audit trail;
- asynchronous job support for document or model work;
- observability, budgets, rate limits, and retries; and
- explicit service availability and fallback behavior.

Exit criterion: Maintley Home and the quoting product use the service without
losing deterministic fallback capability.

### Stage 7: add measured predictive modules

Objective: introduce only predictions that can be validated and monitored.

Deliverables:

- prediction-specific ADR and safety review;
- model registry and feature definitions;
- training and validation data governance;
- offline backtests and calibration reports;
- prospective shadow evaluation;
- customer-facing uncertainty and limitation language;
- outcome monitoring and rollback thresholds; and
- deterministic fallback when the model is unavailable or inapplicable.

Exit criterion: the module meets predefined accuracy, calibration, coverage,
trust, and safety thresholds before customer-visible release.

## Recommended near-term priorities

The next three investments should be:

1. **Create the platform ADR and ownership matrix.** The proposed change affects
   product boundaries, data contracts, permissions, claims, entitlements, and
   deployment. It needs an explicit decision before code moves.
2. **Extract neutral contracts and a pure package while preserving behavior.**
   This unlocks reuse and reveals hidden coupling at lower risk than creating a
   service immediately.
3. **Use quote readiness as the first new cross-product module.** It exercises
   shared evidence, assessments, resolution planning, and contractor workflows
   without requiring Maintley to claim physical-condition prediction.

Predictive maintenance should follow evidence and outcome infrastructure, not
precede it.

## Decisions required before implementation

The following questions require explicit product and architecture decisions:

1. Is "Maintley Intelligence" an internal platform brand, a separately sold
   product, or both?
2. Does the quoting product share Maintley identity/accounts, or federate with
   a distinct contractor identity system?
3. Which records can a contractor read, propose, and authoritatively write?
4. Who owns quote and job records when a homeowner and contractor are both
   Maintley users?
5. Which Intelligence outputs may be persisted, and for how long?
6. What is the approved distinction between record readiness, property
   assessment, professional opinion, and statistical prediction?
7. Which customer data may be used only for the customer's evaluation, and
   which may be used for pooled product improvement?
8. Which capabilities must work deterministically when external models are
   unavailable?
9. How are Intelligence capabilities entitled across Home, Pro, Portfolio, and
   standalone tools?
10. What accuracy, calibration, and safety thresholds must a predictive module
    meet before release?

## Risks and mitigations

| Risk                                           | Why it matters                                                       | Recommended mitigation                                                        |
| ---------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Premature microservice split                   | Adds operational failure modes before a stable contract exists.      | Extract packages and adapters first.                                          |
| Rebranding rules as AI                         | Creates expectations the current deterministic engine cannot meet.   | Publish explicit capability and evidence labels.                              |
| Intelligence becomes canonical data            | Inferences could overwrite trusted customer or professional records. | Preserve proposed-change and human-review boundaries.                         |
| Unsafe predictive claims                       | Property, safety, and financial decisions can cause real harm.       | Add output classes, validation gates, uncertainty, and escalation policies.   |
| Pricing generated by AI                        | Quotes become inconsistent and difficult to defend.                  | Keep price calculation deterministic and company-controlled.                  |
| Maintley Home models become platform contracts | Other products inherit frontend and legacy compatibility debt.       | Define neutral contracts and product adapters.                                |
| Entitlement coupling                           | Product plans leak into reusable reasoning code.                     | Pass capability policy into the core; resolve plans outside it.               |
| Weak evidence schema                           | Outputs cannot be audited or corrected reliably.                     | Make evidence and provenance first-class, typed records.                      |
| Training-data ambiguity                        | Operational telemetry may be used beyond user expectations.          | Establish explicit consent, purpose, retention, and de-identification policy. |
| Contractor access expansion                    | A job invitation could expose unrelated homeowner data.              | Scope access by Property, purpose, records, actions, and expiration.          |
| Model drift                                    | Predictions can degrade as data and populations change.              | Monitor calibration, coverage, errors, and rollback thresholds.               |
| Split behavior across products                 | Home and Pro could provide contradictory guidance.                   | Centralize modules and versions; keep presentation in product adapters.       |

## Proposed success measures

### Platform measures

- Percentage of outputs with complete evidence and version provenance.
- Deterministic replay success for rule-based evaluations.
- Evaluation latency and cost by module.
- Cross-product contract compatibility.
- Rate of unhandled or unsupported input.
- Module availability and fallback success.

### Trust measures

- Percentage of outputs accepted, dismissed, corrected, or deferred.
- Reasons for correction or disagreement.
- Percentage of proposed record changes reviewed before save.
- Unsupported-claim and evidence-mismatch incidents.
- Contractor attribution and authorization errors.

### Assessment and prediction measures

- Coverage: how often sufficient evidence exists.
- Calibration: whether stated probabilities match outcomes.
- Error by property, asset, job, and customer segment.
- False-positive and false-negative rates for the specific decision.
- Performance drift over time.
- Outcome-link completion rate.

### Quoting measures

- Time from intake to reviewed quote.
- Frequency and type of missing-scope warnings.
- Quote revision rate after site inspection.
- Estimate-versus-actual labor and material variance.
- Contractor override rate and reason.
- Customer acceptance rate, reported separately from accuracy.

## Final assessment

Maintley Intelligence is approximately at the **shared deterministic guidance
engine** stage of the larger vision. It is beyond a prototype because it has
real rules, multiple consumers, explainability, provenance, resolution plans,
snapshots, connected evidence, and tests. It is before the **independent
intelligence platform** stage because contracts, policy, execution,
persistence, and product models are still coupled to the Maintley application.

The current state can be summarized as:

```text
Implemented now
    Deterministic record guidance
    Source-aware recommendations
    Readiness summaries
    Connected-record evidence
    Quick Scan / Property Audit / Portfolio consumers
    Resolution-plan foundation
    Versioned scan snapshots
    Review-first knowledge acquisition patterns

Partially established
    General evidence and confidence
    Property knowledge graph consumption
    Historical inference
    Workflow orchestration
    Contractor contribution architecture
    Cross-surface capability policy

Not implemented
    Independent package/service boundary
    Universal assessments
    Predictive maintenance and lifecycle models
    Cost forecasting
    Quote and scope intelligence
    Deterministic quote pricing
    General model/provider orchestration
    Cross-product APIs and SDKs
    Closed-loop prediction validation
```

The proposed future is therefore well aligned with Maintley's existing
architecture, but it broadens the system's claims and responsibilities enough
to require deliberate governance. Maintley should preserve its current trust
advantages—derived guidance, evidence, provenance, canonical ownership, and
human review—while extracting the engine into a neutral package and proving
reuse through quote readiness.

The preferred sequence is:

```text
Current engine
    -> behavior characterization
    -> neutral contracts
    -> pure shared package
    -> universal evidence and assessments
    -> quoting integration
    -> trusted service
    -> validated predictive modules
```

That sequence evolves Maintley Intelligence into a living system without
discarding the strongest parts of what already exists or claiming intelligence
the current implementation cannot yet support.

## Principal evidence reviewed

### Current documentation

- `project-docs/docs/Intelligence/PROPERTY_INTELLIGENCE.md`
- `project-docs/docs/Intelligence/RECOMMENDATION_ENGINE.md`
- `project-docs/docs/Intelligence/PROPERTY_KNOWLEDGE_ACQUISITION.md`
- `project-docs/docs/Intelligence/PROPERTY_KNOWLEDGE_ACQUISITION_STATUS_MATRIX.md`
- `project-docs/docs/Architecture/DATA_MODEL.md`
- `project-docs/docs/Architecture/TECHNICAL_ARCHITECTURE.md`
- `project-docs/docs/Product/PRODUCT_DIRECTION.md`

### Architecture decisions

- `project-docs/ADR/0006-maintley-intelligence-architecture.md`
- `project-docs/ADR/0008-intelligence-knowledge-source-priority-and-v1-document-scope.md`
- `project-docs/ADR/0010-maintley-intelligence-history.md`
- `project-docs/ADR/0011-property-knowledge-acquisition.md`
- `project-docs/ADR/0014-property-memory-change-review.md`
- `project-docs/ADR/0018-maintley-event-engine.md`
- `project-docs/ADR/0020-maintley-resolution-engine.md`
- `project-docs/ADR/0026-property-ownership-and-professional-contribution-model.md`
- `project-docs/ADR/0027-business-licensing-property-stewardship-and-record-attribution.md`
- `project-docs/ADR/0034-personal-assistant-read-api.md`
- `project-docs/ADR/0036-connected-property-knowledge-model.md`
- `project-docs/ADR/0039-one-level-equipment-relationships.md`

### Implementation

- `src/intelligence/engine.ts`
- `src/intelligence/types.ts`
- `src/intelligence/rules/index.ts`
- `src/intelligence/readiness.ts`
- `src/intelligence/relationshipEvidence.ts`
- `src/intelligence/resolutionEngine.ts`
- `src/intelligence/consumers/quickScan.ts`
- `src/intelligence/consumers/propertyAudit.ts`
- `src/intelligence/consumers/portfolioDashboard.ts`
- `src/utils/propertyIntelligenceScan.ts`
- `src/utils/propertyIntelligencePersistence.ts`
- `src/Redux/API/propertyIntelligenceSlice.ts`
- `functions/propertyKnowledgeAcquisition.ts`
- `functions/inspectionDocumentUnderstanding.ts`
- `functions/docxServiceReport.ts`
