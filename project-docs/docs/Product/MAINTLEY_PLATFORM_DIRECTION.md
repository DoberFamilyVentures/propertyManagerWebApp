# Maintley Platform Direction

Last reviewed: 2026-09

## Purpose

This document describes Maintley's accepted product-platform direction. It
does not claim that every named product, integration, or Intelligence
capability is implemented.

Maintley's current product remains centered on preserving, understanding, and
acting on Property Memory. The platform direction allows that foundation to
support additional products and integrations without turning Maintley Home
into a field-service suite or duplicating Intelligence behavior.

## Platform thesis

Maintley should develop as a connected platform with four distinct
responsibilities:

```text
Maintley Home
    Durable homeowner and property-owner Property Memory

Maintley Intelligence
    Shared evidence, assessment, prediction, and recommendation capabilities

Professional connections
    Reviewed contributions and service continuity across authorized parties

External integrations
    Adapters for business systems, assistants, and approved partner products
```

The platform exists to make property knowledge more useful over time. It does
not justify building several unrelated applications or pursuing feature parity
with established field-service systems.

## Maintley Home

Maintley Home remains the primary customer experience and canonical home for:

- Properties;
- Equipment;
- Spaces;
- Documents and warranties;
- Tasks;
- Maintenance Events and History;
- accepted professional contributions; and
- homeowner decisions and corrections.

Maintley Home should become easier to populate through real property events,
documents, professional work, and approved integrations. Users should not need
to reconstruct their entire Property Memory manually before receiving value.

Maintley preserves two distinct request workflows:

- **Maintenance Requests** coordinate tenant or resident issues with a
  landlord, property manager, or maintenance team; and
- **Service Work Requests** guide a homeowner through describing a problem and
  preparing a contractor-ready Work Request Report under ADR 0044.

The homeowner workflow is additive. It does not replace the resident workflow
or reuse its records, permissions, lifecycle, notification routing, or
analytics. Any future conversion requires explicit authorized review and
privacy-filtered copying into a new record.

## Maintley Intelligence

Maintley Intelligence is the shared derived platform described by ADR 0041.
It may progressively provide:

- deterministic record guidance;
- readiness and completeness assessments;
- evidence reconciliation;
- document and image understanding;
- historical pattern summaries;
- quote and scope readiness;
- cost and lifecycle planning; and
- validated predictive capabilities when later approved.

Intelligence does not own canonical product records, calculate unreviewed final
prices, control permissions, or execute user actions silently.

## Professional and contractor direction

Maintley may support professional participation without requiring Maintley to
replace a contractor's operational software.

The near-term direction is integration-first:

```text
Existing contractor system
    -> authorized Maintley connector
    -> Property and service Intelligence
    -> reviewed contribution or contractor outcome
```

Potential value must be validated through contractor outcomes such as reduced
administrative work, better service context, defensible documentation,
legitimate repeat-service opportunities, or improved customer retention.

"Connects to Maintley" is not itself a contractor value proposition.

Jobber is the preferred first business-system validation target under ADR 0042. This preference does not create exclusivity or authorize implementation
beyond the staged connector boundary.

Work-request preparation remains provider-neutral under ADR 0044. Maintley
guides novice homeowners and experienced DIYers through one adaptive intake,
uses Property Memory and Maintley Intelligence to build a reviewed report, and
may request an attributed contractor response. Secure links or documents can
validate this homeowner workflow before a direct Angi or other marketplace
partnership exists.

## Assistant direction

Maintley should make authorized Property Memory available through assistants
without delegating truth, permissions, or Intelligence behavior to those
assistants.

ChatGPT through a remote MCP server is the preferred first public-assistant
target. Gemini, Siri, Alexa, and other approved channels may later use the same
Maintley capabilities through provider adapters.

```text
User
    -> assistant channel
    -> authorized Maintley tool
    -> Maintley API and Intelligence
    -> evidence-backed response
```

The initial customer capability is read-only. Writes, scheduling, contractor
contact, purchasing, and autonomous behavior require later decisions.

## Product expansion rule

Shared architecture creates options; it does not require Maintley to build
every possible application.

A new product or integration should proceed only when it has:

1. a specific user with a repeated problem;
2. a measurable outcome worth paying for;
3. evidence from real workflows rather than stated interest alone;
4. a distribution path;
5. a clear canonical-data owner;
6. a bounded Intelligence role; and
7. a reason to exist beyond the availability of shared technology.

The preferred sequence is one validated expansion at a time.

## Current preferred sequence

```text
1. Preserve and improve Maintley Home
2. Extract Maintley Intelligence contracts and core packages
3. Design customer-authorized ChatGPT/MCP read access
4. Validate the provider-neutral adaptive work-request flow
5. Validate one read-only Jobber integration with a small design-partner group
6. Measure actual assistant and contractor value
7. Expand only the capability that demonstrates repeated demand
8. Introduce predictive modules after outcome and validation infrastructure
```

Architecture work may prepare later stages, but product implementation should
not move ahead of validation.

## Commercial and licensing direction

Maintley Intelligence should be technically and contractually separable for
internal reuse, hosted licensing, strategic partnerships, and potential
acquisition. The preferred future external model is a Maintley-hosted service
accessed through a restricted SDK or integration adapter.

Maintley should not publish or distribute the proprietary core merely because
it is packaged through NPM. External source distribution requires a separately
approved strategic agreement.

Acquisition is a possible outcome, not the only product thesis. The strongest
negotiating position is a useful independent product with paying customers,
measurable outcomes, clean intellectual property, and portable integrations.

## Ownership boundaries

| Concern                                           | Owner                                           |
| ------------------------------------------------- | ----------------------------------------------- |
| Property Memory and homeowner records             | Maintley Home                                   |
| Intelligence evaluation and explanation           | Maintley Intelligence                           |
| Contractor quotes, jobs, scheduling, and payments | Contractor system or approved Maintley product  |
| Final quote calculation                           | Company-controlled deterministic pricing engine |
| Provider authentication and synchronization       | Integration gateway and adapter                 |
| Conversational presentation                       | Assistant channel                               |
| Permission and consent decisions                  | Maintley trusted authorization boundary         |
| Acceptance of proposed record changes             | Authorized Maintley user workflow               |

## Trust principles

All platform surfaces must preserve:

- canonical ownership;
- evidence and provenance;
- record-versus-inference distinctions;
- least-privilege access;
- explicit consent;
- neutral professional attribution;
- human review for authoritative changes;
- explainable recommendations;
- revocation and auditability; and
- honest validation boundaries for predictive claims.

## Success criteria

The platform direction is succeeding when:

- Maintley Home becomes more useful without greater manual setup burden;
- more than one product reuses the same Intelligence contracts and modules;
- integrations add measurable user value without replacing canonical records;
- assistant answers remain scoped, explainable, and attributable;
- contractor workflows demonstrate paid, repeated demand before expansion;
- Intelligence outputs can be reproduced or audited by version and evidence;
- predictive capabilities are released only after meeting approved thresholds;
  and
- Maintley retains the option to operate independently, license capabilities,
  or enter a strategic transaction.
