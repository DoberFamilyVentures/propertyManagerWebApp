# Service Work Request Implementation Handoff

Date: 2026-09-07

Status: Ready for implementation planning; no runtime implementation started

Repository:
`D:\Project Folder\DoberFamilyVentures\Maintley\propertyManagerWebApp`

## Objective

Build a homeowner-first Service Work Request workflow that helps a novice or
experienced DIYer describe a property problem, confirms the affected context,
retrieves only relevant Property Memory, and produces a homeowner-reviewed,
contractor-ready Work Request Report.

The first vertical slice is HVAC, text-first, provider-neutral, and implemented
inside Maintley before ChatGPT, Jobber, or Angi integration.

## Required decisions

Read these before implementation:

- [ADR 0041](../ADR/0041-maintley-intelligence-shared-platform-and-packaging-boundary.md)
- [ADR 0042](../ADR/0042-external-application-integration-and-connector-architecture.md)
- [ADR 0043](../ADR/0043-customer-authorized-assistant-and-mcp-boundary.md)
- [ADR 0044](../ADR/0044-provider-neutral-work-request-and-contractor-response.md)
- [Maintley Platform Direction](../docs/Product/MAINTLEY_PLATFORM_DIRECTION.md)
- [ChatGPT MCP Read-Only Integration Plan](2026-09-06-chatgpt-mcp-read-only-integration-plan.md)
- [Maintley Intelligence Platform Alignment Report](2026-09-06-maintley-intelligence-platform-alignment-report.md)

## Terminology and preserved behavior

- **Maintenance Request:** the existing tenant/resident-to-landlord or
  property-manager operational request.
- **Service Work Request:** the new homeowner-controlled guided intake for
  preparing to contact an outside service professional.
- **Work Request Report:** the reviewed, portable artifact produced by a
  Service Work Request.

The existing Maintenance Request form, submission behavior, manager review,
notification routing, reporting, and task conversion must remain unchanged.
The new domain must not reuse its canonical records, Redux state, lifecycle,
permissions, events, recipients, or analytics. Low-level presentation
components may be reused.

Any later conversion from a Maintenance Request must create a separate Service
Work Request through explicit, authorized, privacy-filtered copying. That
conversion is not part of the initial vertical slice.

## Current implementation findings

### Frontend

- React 18, Redux Toolkit, React Router 6, styled-components, and TypeScript.
- The current request UI is
  `src/Components/MaintenanceRequestModal/MaintenanceRequestModal.tsx`.
- `src/pages/PropertyDetailPage/useMaintenanceRequestHandlers.ts` uploads files
  and dispatches the created request into the Redux maintenance-request slice.
- The current request path does not provide the durable, resumable,
  server-controlled workflow required here.
- Property Memory subscriptions exist through
  `src/propertyKnowledge/usePropertyMemoryRecords.ts` and
  `src/propertyKnowledge/propertyMemoryRecordService.ts`.

### Maintley Intelligence

- `src/intelligence/engine.ts` is a deterministic synchronous rule engine.
- `src/intelligence/types.ts` defines versioned inputs, findings, evidence, and
  plans/capabilities.
- The current engine is useful for evidence and deterministic guidance but is
  frontend-located and should not become the server workflow orchestrator.

### Firebase Functions and read models

- Functions use TypeScript on Node 22.
- `functions/personalAssistantApi.ts` contains useful minimized mappers for
  Properties, Equipment, tasks, maintenance events, documents, and findings.
- Those mappers are private to the HTTP handler and should be extracted into a
  reusable server read-model module without changing current API responses.
- Customer-authorized assistant OAuth and public MCP are not implemented.
- No OpenAI SDK or Maintley-owned LLM adapter is currently declared as a direct
  Functions dependency.

### Events

- `functions/maintleyEventEngine.ts` validates membership and creates
  server-owned `maintleyEvents` plus notifications.
- Event IDs are based on `workflowKey + entityKey`; lifecycle history is stored
  on an upserted record.
- The existing engine is notification-oriented. It should receive meaningful
  work-request milestones but should not be treated as the sole immutable
  domain-event ledger.
- Firestore rules prevent direct client writes to `maintleyEvents`.

## Target architecture

```text
Maintley Home
    -> callable Work Request API
    -> server workflow orchestrator
        -> deterministic safety policy
        -> adaptive HVAC question policy
        -> bounded Property Memory context builder
        -> Maintley Intelligence evidence and explanation
        -> replaceable LLM adapter
    -> versioned Work Request Report
    -> homeowner review and approval
    -> copy, document, or secure share link
```

Future ChatGPT and provider adapters call the same server operations. They do
not implement their own question trees, context selection, or report schema.

## Recommended data boundary

Use dedicated top-level collections rather than the existing Maintenance
Request state:

```text
serviceWorkRequests/{workRequestId}
workRequestReports/{reportVersionId}
workRequestEvents/{eventId}
workRequestShares/{shareId}
```

The authoritative session should contain structured observations and workflow
state, not unrestricted full conversation transcripts or copied Property
Memory. Reports are versioned rather than overwritten.

Every record requires account, Property, actor, schema-version, creation, and
update attribution as applicable. External shares require expiration,
revocation, minimum disclosure, and non-enumerable credentials.

## Recommended shared contracts

Create the minimum package needed for the first slice, following Maintley's
existing local-package pattern:

```text
functions/packages/work-request-contracts/
```

Initial types:

- `ServiceWorkRequestSession`
- `WorkRequestMode`
- `IntakeObservation`
- `IntakeQuestion`
- `SafetySignal`
- `AffectedContext`
- `WorkRequestContextPackage`
- `WorkRequestReport`
- `ContractorResponse`
- command and event payloads
- schema and policy versions

Keep React, Firebase, provider, routing, plan, and model-specific concerns out
of the contracts.

## Recommended server operations

Begin with authenticated callable Functions:

- `startServiceWorkRequest`
- `recordWorkRequestAnswer`
- `confirmAffectedContext`
- `generateWorkRequestReport`
- `approveWorkRequestReport`
- `createWorkRequestShare`

All mutations resolve account and Property authorization, validate the current
state, enforce deterministic safety policy, validate typed input, and write the
state transition and domain event atomically. External sharing always requires
explicit homeowner confirmation.

## Event model

Persist append-only, server-owned work-request events for accepted domain
transitions:

- `WorkRequestStarted`
- `SafetySignalDetected`
- `AffectedContextConfirmed`
- `WorkRequestIntakeCompleted`
- `WorkRequestContextAssembled`
- `WorkRequestReportGenerated`
- `WorkRequestReportApproved`
- `WorkRequestShared`
- `ContractorResponseReceived`

Mirror only meaningful, user-visible milestones into the current Maintley
Event Engine. Keep ordinary answers in the scoped session and audit trail; do
not publish every chat message or unrestricted homeowner text broadly.

Consumers must be idempotent. Persisted workflow state is authoritative; an
event or LLM response alone does not prove that a transition completed.

## HVAC adaptive intake

Use one schema with three presentation depths:

- **Guide me:** one plain-language question at a time.
- **I know some details:** symptom choices plus optional technical fields.
- **I know what is needed:** direct proposed request plus targeted gap checks.

Implement deterministic category and safety policies before adding an LLM.
Safety signals stop unsafe exploration and display approved escalation copy.
The LLM cannot override a safety result or declare a situation safe.

The initial question policy should use reported symptoms, prior answers,
candidate affected context, and missing required information. It should ask the
fewest questions needed for a useful request.

## Late and selective Property Memory retrieval

During intake, provide an LLM only the latest message, confirmed observations,
workflow state, small candidate Equipment/area list, approved policy, and
missing-information summary.

After the homeowner confirms the affected context, build a bounded server-side
context package from relevant:

- Equipment identity, age, installation, and warranty information;
- maintenance events and previous related problems;
- open or recent tasks;
- selected document metadata or extracted facts; and
- related Maintley Intelligence findings.

Use typed relationships, category rules, time bounds, field allowlists, and
homeowner choices. Do not expose raw Firestore documents, unrelated equipment,
resident or billing information, credentials, or unselected document contents.

Each included record retains its identity, date, source, and selection reason.
The homeowner may remove irrelevant history before approval.

## Work Request Report

The versioned report separates:

- homeowner observations;
- Property Memory facts;
- uploaded evidence;
- troubleshooting already attempted;
- Maintley Intelligence guidance;
- unverified possible interpretations; and
- unknowns for the professional to determine.

It includes the requested outcome, affected context, symptoms and timing,
selected history, attachments, safety answers, recommended service category
with explanation, contractor questions, versions, and homeowner corrections.

The report is not a professional diagnosis, guaranteed scope, guaranteed
price, or verified physical condition.

## LLM boundary

Define a replaceable server interface with at least:

- `MockWorkRequestLanguageModel`
- `OpenAIWorkRequestLanguageModel`

Permitted LLM responsibilities:

- conversational interview wording;
- candidate observation extraction;
- approved missing-information detection;
- selected-history summarization;
- report drafting; and
- plain-language explanation.

Maintley retains workflow state, authorization, safety policy, context
selection, schema validation, provenance, and final approval. Use strict
structured outputs and validate them server-side.

Ordinary UI, state, event, authorization, and report-render tests use the mock.
Paid calls are reserved for extraction and report-quality evaluation. Store the
model, prompt version, tokens, latency, estimated cost, retry count, and outcome
against the request without logging secrets or unrestricted request content.

## First-party UI

Use a dedicated homeowner route rather than expanding the tenant request modal:

```text
/properties/:propertyId/service-requests/new
/properties/:propertyId/service-requests/:workRequestId
```

Suggested stages:

1. Describe the problem.
2. Complete safety screening.
3. Confirm affected Equipment, system, or area.
4. Answer adaptive follow-ups.
5. Review relevant Property Memory.
6. Review and correct the Work Request Report.
7. Copy, download, or securely share it.

Potential entry points are the Property dashboard, Equipment detail, an open
task, or a relevant Maintley Intelligence finding. Redux may manage transient
presentation state, but the Firestore workflow is resumable truth.

## Implementation sequence

### Phase 0 - decisions and safeguards

1. Commit the approved ADR and direction documents.
2. Create ADR implementation trackers.
3. Add regression coverage for existing Maintenance Requests.
4. Add a private feature capability or flag for pilot accounts.

### Phase 1 - contracts, persistence, and authorization

1. Create shared contracts.
2. Add server-owned collections and Firestore rules.
3. Implement state-machine and authorization tests.
4. Implement atomic state transition plus event persistence.

### Phase 2 - deterministic HVAC vertical slice

1. Create HVAC category and safety policy.
2. Create the versioned question catalog.
3. Implement candidate Equipment/area matching and confirmation.
4. Generate a deterministic report without an LLM.
5. Build the first-party resumable UI.

### Phase 3 - bounded Property Memory context

1. Extract existing public read mappers without API behavior changes.
2. Implement typed, allowlisted context selection.
3. Show selected history and allow removal before report generation.
4. Test unrelated and unauthorized data exclusion.

### Phase 4 - LLM assistance

1. Add the model interface and deterministic mock.
2. Add the OpenAI adapter behind the private feature boundary.
3. Validate strict structured outputs server-side.
4. Run curated extraction and report-quality evaluations.

### Phase 5 - portable delivery and validation

1. Add copyable text and a printable/downloadable report.
2. Add a secure, expiring share link only after threat-model review.
3. Add a lightweight contractor response when justified.
4. Compare reports with ordinary homeowner messages.

### Later phases

1. Add ADR 0043's read-only ChatGPT/MCP access.
2. Add bounded draft-session MCP commands only after first-party validation.
3. Validate Jobber under ADR 0042.
4. Approach Angi or another marketplace only with measured evidence and an
   official API or written partnership.

## Lean validation envelope

- One HVAC vertical slice.
- Text first; optional photos after the text flow works.
- Approximately 20-30 curated cases covering novice, DIYer, ambiguity,
  incomplete Property Memory, conflicting history, and safety scenarios.
- Approximately 5-10 contractor reviews when practical.
- Initial OpenAI budget approximately USD 5-10 with a hard spend limit.
- Total new-cash planning envelope approximately USD 10-25, excluding
  engineering time.

Continue only if the workflow beats an ordinary homeowner message on request
completeness, homeowner confidence, correct trade selection, or contractor
clarification effort. A polished report alone is not success.

## Validation gates

Before calling the first slice complete:

- existing Maintenance Request regression tests pass;
- cross-account and cross-Property access fails closed;
- accepted state transitions and events are idempotent;
- urgent safety cases stop normal intake;
- unrelated or excluded data never enters the context package;
- report facts remain distinguishable from interpretations and unknowns;
- the homeowner can correct and approve the complete report;
- model failures fall back safely without corrupting workflow state;
- token and cost telemetry is attributable to a request; and
- the workflow has not contacted a contractor or provider automatically.

## Explicit non-goals for the first slice

- Changing or replacing tenant Maintenance Requests.
- A direct Angi, Jobber, or other marketplace integration.
- ChatGPT/MCP implementation.
- Autonomous diagnosis or repair advice.
- Guaranteed urgency, scope, price, or contractor quality.
- Automatic contractor selection, outreach, scheduling, quote acceptance, or
  payment.
- Required post-job closeout reporting.
- Unattended writes to canonical Property Memory.

## Recommended first implementation task

Start with Phase 0 and the smallest Phase 1 foundation:

1. Reconfirm the working tree and preserve unrelated changes.
2. Commit or otherwise establish the approved documentation baseline according
   to the user's requested workflow.
3. Inventory and add regression tests around the current Maintenance Request
   submission and conversion behavior without changing it.
4. Draft the shared Service Work Request contracts and state-transition table.
5. Stop for review before adding Firestore collections or callable Functions.

Do not begin with OpenAI, MCP, Jobber, Angi, or a broad Intelligence rewrite.

## Working-tree warning

At handoff creation, the ADR and direction work from this planning session is
still present as uncommitted/untracked repository work. The `output/` directory
was pre-existing and unrelated; do not modify, stage, or remove it without
separate authorization. Reinspect `git status` before making changes and
preserve all unrelated user work.
