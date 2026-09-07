# ADR 0044: Provider-Neutral Work Request and Contractor Response

Status: Accepted - planned

Date: 2026-09-07

Related ADRs:

- `0006-maintley-intelligence-architecture.md`
- `0007-maintenance-events-as-historical-source-of-truth.md`
- `0014-property-memory-change-review.md`
- `0023-property-documents-as-first-class-records.md`
- `0026-property-ownership-and-professional-contribution-model.md`
- `0027-business-licensing-property-stewardship-and-record-attribution.md`
- `0036-connected-property-knowledge-model.md`
- `0041-maintley-intelligence-shared-platform-and-packaging-boundary.md`
- `0042-external-application-integration-and-connector-architecture.md`
- `0043-customer-authorized-assistant-and-mcp-boundary.md`

## Context

Homeowners often know that something is wrong without knowing the trade,
component, terminology, or information a contractor needs. Even experienced
DIYers can omit property-specific history that would improve the request.
Generic marketplace intake forms cannot automatically use Maintley's Property
Memory, and a directory link alone does not reduce the homeowner's uncertainty.

Maintley can use known property and Equipment records, selected history,
homeowner observations, attachments, and Maintley Intelligence to guide the
homeowner toward an accurate, contractor-ready work request. The same workflow
should work in Maintley Home, ChatGPT, or another approved assistant rather
than allowing each channel or language model to invent its own interview.

Home-service marketplaces and field-service systems may deliver the request,
but their availability and commercial terms can change. As of this decision,
Angi publicly supports homeowner service requests, professional matching,
project communication, and selected partnerships, but Maintley has not
identified a generally available public Angi API for the required workflow.
Its published terms also restrict unauthorized programmatic aggregation and
reuse.

## Decision

### 1. Make accurate homeowner work requests the primary outcome

Maintley will define a provider-neutral workflow that turns an incomplete or
technical homeowner report into a reviewed work-request package. Its primary
purpose is to help the homeowner:

- describe what is happening;
- identify the likely service category without asserting a diagnosis;
- include relevant property and Equipment context;
- communicate observations and prior troubleshooting;
- identify important unknowns;
- request an appropriate contractor response; and
- share the request through any approved channel.

Post-job reporting may later enrich Property Memory, but it is not part of the
initial workflow or value proposition in this ADR.

This decision introduces a **Service Work Request** domain. It does not replace
or redefine Maintley's existing **Maintenance Request** workflow:

- a Maintenance Request is a tenant or resident issue submitted to a landlord,
  property manager, or maintenance team for review and operational handling;
- a Service Work Request is a homeowner-controlled guided intake used to
  prepare for an outside service professional; and
- a Work Request Report is the reviewed, portable artifact produced by a
  Service Work Request.

The two workflows have different actors, permissions, recipients, lifecycle
states, records, events, and analytics. They may reuse low-level presentation
components, such as file upload, category selection, and Equipment selection,
but they must not share canonical state or silently trigger one another.

### 2. Use one adaptive intake model for different knowledge levels

Maintley will not maintain separate novice and DIYer questionnaires. It will
use one versioned issue-intake contract with progressive depth.

At the beginning of the flow, the homeowner may choose:

- **Guide me** - one plain-language question at a time;
- **I know some details** - common symptoms plus optional technical fields; or
- **I know what is needed** - direct entry of a proposed request with targeted
  gap checks.

All modes produce the same underlying evidence model. A homeowner can change
depth at any time. Technical measurements, component names, error codes, and
troubleshooting details are optional; Maintley must never require a novice to
guess.

### 3. Use a controlled, resumable workflow

The work-request lifecycle is:

```text
homeowner description
    -> immediate safety triage
    -> affected Property, area, system, or Equipment selection
    -> adaptive follow-up questions
    -> relevant Property Memory selection
    -> Maintley Intelligence work-request report
    -> homeowner review and correction
    -> approved share package
    -> optional contractor response
```

The session must be resumable, versioned, and explainable. Maintley records the
question policy and source of each included fact so a generated request can be
reconstructed.

The workflow integrates with the Maintley Event Engine. Meaningful domain
transitions emit versioned events such as:

```text
WorkRequestStarted
SafetySignalDetected
AffectedContextConfirmed
WorkRequestIntakeCompleted
WorkRequestContextAssembled
WorkRequestReportGenerated
WorkRequestReportApproved
WorkRequestShared
ContractorResponseReceived
```

Events carry stable request, account, Property, actor, correlation, policy, and
schema identifiers as appropriate. Event consumers may initiate context
assembly, report generation, analytics, notifications, or approved connector
behavior. The current persisted workflow state remains authoritative; an event
or LLM response alone does not prove that a transition completed.

Individual conversational messages and draft answers remain in the scoped
intake session and audit trail unless another domain process genuinely needs
them. Maintley should not publish every chat turn as a broad domain event or
place unrestricted homeowner text in event payloads.

The question policy uses service category, reported symptoms, known property
context, previous answers, missing fields, and safety rules. It should ask the
fewest questions necessary to create a useful request, normally preferring a
short progressive interview over a large form.

### 4. Retrieve Property Memory late and selectively

The conversational intake remains lightweight and primarily user-driven. The
homeowner's description and answers narrow the affected category, Property,
area, system, or Equipment. Maintley may present a small list of candidate
records for confirmation, but it must not send the complete Property Memory to
an LLM at the beginning of the conversation or on every turn.

During ordinary intake, an LLM should receive only the minimum context needed
for the current step, such as:

- the latest homeowner message;
- previously confirmed observations;
- the current intake state;
- a small set of candidate areas or Equipment records;
- approved safety and question-policy instructions; and
- the information still needed for the request.

After the homeowner confirms the affected context and the intake is
sufficiently complete, a server-side Maintley service builds a bounded report
context package. It may include relevant:

- Equipment identity, age, installation details, and warranty data;
- maintenance events and previous related problems;
- open or recently completed tasks;
- selected document metadata or extracted facts; and
- other Property Memory explicitly relevant to the reported issue.

Selection uses typed relationships, category rules, time bounds, field
allowlists, and homeowner choices. It does not expose raw Firestore documents,
unrelated systems, resident information, billing information, credentials, or
unselected document contents.

The bounded context package is supplied when generating the Work Request
Report. Each included record retains its identity, date, source, and reason for
selection. The homeowner can remove irrelevant history before approving the
report. Maintley may retrieve a specific fact earlier when necessary to
disambiguate the affected context, but minimum necessary disclosure remains
the default.

### 5. Run safety triage before ordinary problem exploration

Maintley must check for urgent conditions such as fire, smoke, gas odor,
sparking, exposed electrical hazards, active flooding, carbon-monoxide alerts,
dangerous structural movement, or loss of critical systems in extreme weather.

When an urgent signal is present, Maintley stops unsafe inspection questions,
clearly states the limitation of the workflow, and gives approved escalation
guidance. It must not instruct a homeowner to open, touch, test, or approach
hazardous equipment merely to improve the report.

Safety triage is a deterministic policy boundary. An LLM may recognize or
restate a reported signal, but it cannot override the policy or declare the
situation safe.

### 6. Separate evidence from interpretation

The intake model and final report distinguish:

- **homeowner observations** - what the homeowner reports seeing, hearing,
  smelling, measuring, or experiencing;
- **Property Memory facts** - selected Maintley records and their dates;
- **uploaded evidence** - selected photos, videos, or documents;
- **troubleshooting performed** - actions the homeowner reports taking;
- **Maintley Intelligence guidance** - derived categorization, relevance, and
  suggested questions;
- **possible interpretations** - explicitly unverified possibilities; and
- **unknowns** - facts the contractor may need to determine.

Maintley must not silently convert a possibility into a fact or present a work
request as a professional diagnosis, guaranteed scope, guaranteed price, or
verified physical condition.

### 7. Produce a structured Maintley Intelligence Work Request Report

The report is a stable, versioned artifact rendered for people and available
as structured data. It contains:

- plain-language request title;
- requested service outcome;
- affected Property, area, system, or Equipment;
- observed symptoms and timing;
- relevant selected Property Memory;
- troubleshooting already attempted;
- selected attachments;
- safety answers and any escalation shown;
- recommended service category with explanation and confidence;
- facts, possible interpretations, and unknowns clearly separated;
- questions the contractor should answer;
- report, policy, and Intelligence versions; and
- homeowner corrections and approval state.

The homeowner sees and can correct the complete report before sharing. The
approved report becomes an attributable service-request record in Property
Memory; unapproved drafts do not become canonical property facts.

### 8. Use LLMs as replaceable language and reasoning adapters

An approved LLM may:

- conduct the interview conversationally;
- translate homeowner language into candidate structured observations;
- identify missing information from the approved question catalog;
- summarize selected Property Memory;
- draft clear work-request language;
- translate or simplify the report; and
- explain why a question or property fact is relevant.

An LLM does not own the workflow state, permission decision, safety policy,
record retrieval, output schema, or final truth. Server-side Maintley services
validate all tool arguments and structured outputs, enforce authorization,
apply deterministic safety rules, retain provenance, and reject unsupported
fields or state transitions.

The platform must support model replacement and version evaluation. Material
prompt, model, policy, or schema changes require regression testing against a
curated intake evaluation set.

### 9. Keep the workflow channel-independent

Maintley Home is the first-party experience and reference implementation.
ChatGPT may later conduct the same flow through narrowly defined MCP tools, and
Gemini or other assistants may use equivalent adapters. Channels call Maintley
workflow operations; they do not implement their own question trees or create
their own report definitions.

Candidate operations include:

- `start_work_request`;
- `record_issue_description`;
- `get_candidate_property_context`;
- `select_affected_property_context`;
- `get_next_intake_question`;
- `record_intake_answer`;
- `build_work_request_context`;
- `generate_work_request_report`;
- `get_work_request_report`; and
- `approve_work_request_for_sharing`.

Draft-session mutations are isolated from canonical Property Memory. Saving a
reviewed request or sharing it externally requires explicit homeowner
confirmation. These bounded commands are a later extension to ADR 0043's
initial read-only ChatGPT surface, not general assistant write access.

### 10. Make the work request portable before depending on a provider

The homeowner may share an approved report through formats such as:

- copyable text;
- a printable or downloadable document;
- a secure, expiring link;
- email initiated with explicit confirmation;
- a contractor-facing Maintley page; or
- a future official Angi, Jobber, or other provider connector.

Maintley owns the work-request contract. No provider-specific record becomes
the core model, and no direct integration is required to validate homeowner
value.

Maintley will not scrape contractor directories, automate provider consumer
websites, reuse provider content outside approved terms, or treat unofficial
endpoints as product dependencies. A direct integration requires an official
provider-supported API or written partnership and review under ADR 0042.

### 11. Request a structured but lightweight contractor response

When supported by the sharing channel, Maintley may ask a contractor to return:

- whether the request matches the contractor's trade;
- clarifying questions;
- the proposed inspection or diagnostic approach;
- a proposed scope or summary of work;
- estimate assumptions and exclusions; and
- scheduling or next-step information.

Contractor responses remain attributed proposals. They are not accepted facts,
verified diagnoses, or proof that work occurred. The initial experience must
not require a complete post-job closeout report.

### 12. Measure homeowner outcomes

The workflow succeeds when it measurably improves outcomes such as:

- homeowner confidence describing a problem;
- time required to create a usable request;
- correct service-category selection;
- fewer contractor clarification cycles;
- contractor assessment of request completeness;
- useful contractor response rate;
- reduced duplicate data entry; and
- homeowner confidence choosing the next step.

Requests generated, integrations connected, and report word count are not
evidence of customer value by themselves.

## Relationship to existing Maintenance Requests

The current tenant/resident-to-manager Maintenance Request form, submission
behavior, manager review, notification routing, and task-conversion behavior
must remain functionally unchanged while Service Work Requests are introduced.
Implementation requires regression coverage around that existing workflow.

A future authorized manager may explicitly create a Service Work Request from
a Maintenance Request. That conversion is not part of the initial pilot and
must:

- create a separate Service Work Request rather than changing the original;
- require deliberate user action and review;
- let the manager choose which issue details and attachments are copied;
- exclude tenant identity, contact details, private notes, and unrelated data
  by default;
- retain a source reference and actor attribution; and
- preserve the original Maintenance Request lifecycle and audit history.

No automated conversion, external sharing, or contractor contact is implied by
the existence or status of a Maintenance Request.

## Consequences

### Benefits

- Maintley addresses a stressful homeowner moment instead of functioning only
  as a passive record system.
- Novices and experienced DIYers share one maintainable workflow.
- Property Memory supplies context a generic service form does not have.
- Late, selective retrieval reduces unnecessary disclosure and model cost.
- ChatGPT and future assistants can reuse the same trusted intake engine.
- Structured reports can work before an Angi or other marketplace partnership.
- Homeowner review, evidence separation, and provenance reduce misleading
  claims.

### Costs and risks

- A long or repetitive interview could frustrate homeowners.
- LLM extraction can misclassify statements or imply unsupported conclusions.
- Safety triage requires conservative rules, expert review, and ongoing tests.
- Property records may be incomplete or outdated.
- Attachments and secure sharing introduce privacy and operational risk.
- Providers may not accept the proposed structured request format.
- The experience must demonstrate better outcomes than writing a short message
  directly to a contractor.

## Initial validation boundary

The first pilot may implement:

1. One narrow HVAC vertical slice with text input first and optional photos
   only after the text flow is proven.
2. The three progressive knowledge modes using one intake schema.
3. Deterministic safety screening and escalation.
4. Selection of known Property, Equipment, and maintenance context.
5. A bounded context package assembled only after affected context is
   confirmed.
6. LLM-assisted observation extraction and report drafting.
7. A complete homeowner review and correction screen.
8. Copyable text, a document, or a secure share link.
9. A lightweight contractor response form.
10. Task-based evaluation with novice homeowners, DIYers, and contractors.

The first pilot must not include:

- autonomous diagnosis;
- guaranteed scope, price, urgency, or contractor quality;
- automatic contractor selection or endorsement;
- unsafe homeowner inspection instructions;
- external sharing without confirmation;
- unapproved assistant writes to canonical Property Memory;
- replacement or repurposing of the tenant/resident Maintenance Request
  workflow;
- automatic conversion from a Maintenance Request to a Service Work Request;
- an unofficial marketplace API;
- automatic quote acceptance, payment, or scheduling; or
- a required post-job closeout workflow.

## Lean prototype and evaluation plan

The initial objective is to validate report usefulness, not build a complete
marketplace integration. A solo-developer prototype should reuse Maintley's
existing Firebase and Event Engine foundations and avoid new paid
infrastructure unless measurement demonstrates a need.

Ordinary interface, state-transition, authorization, event, and report-render
tests should use deterministic mocked model responses. Paid LLM calls are
reserved for conversational quality, extraction accuracy, report drafting,
and selected model comparisons.

The prototype planning envelope is:

- **new cash expense:** approximately USD 10-25;
- **initial OpenAI API budget:** approximately USD 5-10 with a hard project
  spend limit;
- **scenario set:** 20-30 curated HVAC cases covering novices, DIYers,
  ambiguity, missing records, conflicting history, and safety escalation; and
- **external review:** approximately 5-10 contractor reviews when practical,
  without requiring an Angi integration.

These amounts are planning assumptions, not guaranteed prices or required
spend. Model pricing and infrastructure costs must be rechecked before
implementation.

Each model call records the `workRequestId`, stage, model and prompt version,
input and output tokens, latency, estimated cost, retry count, and outcome. It
must not log credentials or unrestricted request content.

Prototype review asks contractors whether the report:

- identifies the appropriate trade;
- communicates enough information to evaluate the request;
- omits essential context;
- contains distracting or unnecessary history;
- would reduce the first clarification call; and
- improves the contractor's ability to respond with a proposed next step.

Continuation requires evidence that the workflow outperforms a homeowner's
ordinary short message on request completeness, homeowner confidence, or
contractor clarification effort. A polished report by itself is insufficient.

## Implementation tracking

- [ ] Define the versioned issue-intake session and evidence schemas.
- [ ] Add regression tests proving existing Maintenance Request submission,
      review, notification, and task-conversion behavior remains unchanged.
- [ ] Define event names, versions, payload minimization, consumers, and
      idempotency behavior through the Maintley Event Engine.
- [ ] Define the Work Request Report schema and human-readable template.
- [ ] Define initial categories and approved adaptive question catalogs.
- [ ] Obtain appropriate review of safety rules and escalation copy.
- [ ] Define novice, intermediate, and direct-entry interaction behavior.
- [ ] Define fact, observation, interpretation, unknown, and confidence labels.
- [ ] Implement typed candidate-context lookup and homeowner confirmation.
- [ ] Define field allowlists, relevance rules, time bounds, and provenance for
      the bounded report context package.
- [ ] Implement model-independent orchestration and server-side validation.
- [ ] Create LLM extraction and report-drafting evaluation fixtures.
- [ ] Use mocked model responses for non-model workflow and event tests.
- [ ] Measure tokens, model cost, context-selection accuracy, and removed
      irrelevant history per completed report.
- [ ] Design homeowner review, correction, approval, and sharing controls.
- [ ] Threat-model attachments, guest links, prompt injection, replay, and
      cross-Property access.
- [ ] Validate the first-party Maintley workflow before a marketplace
      dependency.
- [ ] Define a bounded MCP tool extension only after the Maintley workflow is
      proven.
- [ ] Establish continuation thresholds based on homeowner and contractor
      outcomes.

## Deferred

This ADR does not implement or approve:

- a direct Angi integration or commercial partnership;
- a Maintley contractor marketplace;
- broad contractor directory access;
- contractor lead pricing or resale;
- autonomous diagnosis or repair advice;
- public contractor ratings or endorsement;
- quote acceptance, payment, escrow, or dispute resolution;
- a required post-job completion report;
- unattended Property Memory changes; or
- autonomous service procurement.

## Current external references

- Angi homeowner service and project flow: <https://www.angi.com/landing/angies-list>
- Angi and Contractor+ partnership example: <https://www.angi.com/landing/contractorplus>
- Angi Terms of Use: <https://www.angi.com/terms>
- OpenAI remote MCP server guidance: <https://developers.openai.com/plugins/build/mcp-server>
- OpenAI tool and structured-response API reference: <https://developers.openai.com/api/reference/cli/resources/responses/methods/create>
- OpenAI GPT-5.6 Luna pricing: <https://developers.openai.com/api/docs/models/gpt-5.6-luna>

These references describe the provider and assistant environment at the
decision date and must be revalidated before implementation, partnership
outreach, or public distribution.
