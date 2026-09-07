# ADR 0026: Homeowner Ownership, Professional Contribution, and Property Transition

Status: Proposed (Revised)

Date: 2026-07-21

Related ADRs:

- `0027-business-licensing-property-stewardship-and-record-attribution.md`
- `0044-provider-neutral-work-request-and-contractor-response.md`

Related report: `project-docs/reports/2026-07-21-business-licensing-readiness-and-implementation-plan.md`

## Context

Maintley is homeowner-first. The homeowner owns the account, the property, and
the Property Memory associated with that property. Businesses may use licensed
Maintley software to contribute maintenance information, but they do not own the
homeowner's property record and are not Maintley partners.

Earlier planning treated live account ownership transfer as a near-term product
capability. That approach creates avoidable privacy and authorization risk. A
property record can contain both durable operational knowledge and private
homeowner context. Those categories must not move together by default.

Maintley still needs to preserve useful property knowledge when a homeowner
sells a property. It also needs a clear model for business-created properties,
professional access, revocation, and attribution.

## Decision

### 1. The homeowner remains the owner

The homeowner is the owner and intended beneficiary of the property and its
Property Memory. A business that creates or initially sponsors a property acts
only within the limited authority granted by the homeowner and Maintley's
terms.

A pre-claim or sponsored property does not give the sponsoring organization
ownership of the Property Memory. Claiming the property establishes the
homeowner's direct control without converting business-owned data into
homeowner-owned data; the system was homeowner-oriented from the beginning.

Billing responsibility is independent from ownership and access. The party
paying for a subscription does not acquire ownership of the property record.

### 2. Properties manage external relationships

Organizations manage their people, roles, billing, and internal property
assignments. Properties manage their relationships with organizations and other
external contributors.

The guiding rule is:

> Organizations manage people. Properties manage relationships.

The homeowner can add, remove, or reinstate an organization's property
relationship. Removing a relationship revokes the organization's access
immediately. Removal does not create an archived, read-only, or historical
access path.

The system may retain an audit record that access existed and what actions were
taken, but that audit record does not grant continued access to the property.

### 3. Businesses contribute; they do not own Property Memory

Maintenance records submitted by a business become part of the homeowner's
Property Memory, subject to correction, retention, privacy, and audit rules.
Every contribution must preserve its source and attribution.

Maintley records what a user or organization submitted. It does not certify that
the underlying work occurred or that the submission is accurate. Product
language must use attribution such as "Recorded by ABC Home Services" rather
than "certified maintenance record" unless Maintley introduces a separate,
explicit verification service.

ADR 0027 defines organization roles, property relationship types, effective
permissions, and required maintenance-event attribution.

### 4. Property Memory has transferable and private boundaries

Property Memory includes structured operational knowledge that can remain
useful across changes in occupancy or ownership, including:

- property systems and equipment
- maintenance events and service dates
- warranties and service intervals
- explainable maintenance recommendations
- non-personal documents intentionally designated for transition

Private homeowner context is not transferable by default, including:

- personal notes
- costs and financial information
- receipts
- personal photographs and documents
- household-member information
- user names or other personal identity data

Data classification and export eligibility must be explicit. Maintley must not
infer that every field attached to a property is safe to transfer.

### 5. Use a Property Transition Report instead of live ownership transfer

Maintley will not implement direct transfer of a live property account or its
complete record as the initial ownership-transition mechanism.

The supported direction is a Property Transition Report: a homeowner-controlled
export of structured operational property knowledge. The report is a snapshot,
not continuing access to the original account.

The initial report must exclude personal notes, costs, receipts, personal
photos, personal documents, household-member data, and user names. The homeowner
must be able to review the report before sharing it.

The report may first support printing or secure sharing. Import into another
Maintley property may be considered later, but requires provenance,
deduplication, conflict handling, and explicit recipient consent.

Any future proposal for live ownership transfer must be authorized by a new or
superseding ADR. It must define consent by both parties, field-level transfer
rules, revocation boundaries, auditability, dispute handling, and deletion or
retention behavior.

## Required behavior

Implementation aligned with this decision must:

1. Treat the homeowner as owner and intended beneficiary of Property Memory.
2. Keep billing, organization membership, property relationships, and property
   ownership as separate concepts.
3. Let a homeowner add, remove, and reinstate professional contributors.
4. Revoke removed contributors immediately at the authorization layer.
5. Preserve attribution and contributor access history without preserving
   property access.
6. Separate transition-eligible operational data from private homeowner data.
7. Use a reviewed Property Transition Report for near-term ownership changes.
8. Avoid claims that Maintley verifies or certifies contributed records.

## Non-goals

This ADR does not:

- create a CRM, scheduling, dispatch, invoicing, or field-service platform
- make Maintley responsible for a professional's services or record accuracy
- authorize businesses to access homeowner-private data
- define a live account-transfer workflow
- make a sponsor or subscription payer the property owner

## Consequences

### Positive

- Maintley remains clearly homeowner-first.
- Business access is revocable without weakening auditability.
- Durable property knowledge can be shared without transferring an account or
  exposing private homeowner context.
- Ownership, payment, and contribution responsibilities remain explainable.

### Trade-offs

- Transition exports require deliberate data classification.
- A report is less seamless than direct account transfer.
- Future import will need provenance and conflict-resolution rules.
- Existing ownership-transfer planning and terminology must be updated.

## Implementation sequence

1. Establish organization and property-relationship authorization from ADR 0027.
2. Complete maintenance-event attribution and contributor access history.
3. Establish sponsored-property claim and licensing controls.
4. Define and implement the Property Transition Report schema and exclusions.
5. Consider import only after export, consent, and provenance controls are proven.

## Decision principles

- Homeowners own Property Memory.
- Businesses contribute under limited, revocable authority.
- Attribution records who submitted information; it does not certify truth.
- Operational property knowledge may transition; personal context does not.
- Access history survives revocation, but access itself does not.
- Live ownership transfer is deferred unless a later ADR explicitly authorizes it.
