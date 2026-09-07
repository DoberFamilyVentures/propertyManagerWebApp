# Maintley Product Direction

Last reviewed: 2026-06

# Vision

Maintley helps people preserve, understand, and act on property knowledge over time.

Properties accumulate information across years and decades:

- Maintenance history
- Equipment information
- Service records
- Documentation
- Repairs
- Contractor knowledge
- Owner knowledge

Much of that information is lost when records are scattered across notebooks, emails, folders, spreadsheets, and memory.

Maintley exists to help homeowners, landlords, and property managers build a reliable record of their properties and use that information to make better maintenance decisions.

---

# Current Stage

Maintley has:

- A live production platform
- A paying customer
- Real user feedback
- Android support
- Active product iteration

The current challenge is not feature availability.

The current challenge is discoverability, usability, and clarity.

Users should be able to understand the core value of Maintley without training or extensive onboarding.

---

# Core Problem

Property information is fragmented.

People often know:

- What work was done
- Who performed it
- When it happened
- What equipment exists

until enough time passes.

Then knowledge is lost.

Maintley exists to preserve that information and make it useful.

The goal is not simply task management.

The goal is long-term property knowledge.

---

# Maintley Brand Hierarchy

Maintley's positioning should separate the internal product philosophy from the external customer promise.

## Mission

Help homeowners preserve the knowledge of their property.

## Product Promise

Every record you save today helps future you make better decisions tomorrow.

## Product Philosophy

Homes build history. Maintley makes sure it never gets lost.

## Product Capability

Maintley Intelligence helps users act on preserved property knowledge.

## Feature Layer

Current and future features should roll up to the mission and product promise:

- Quick Property Scan
- Property Setup Assistant
- Maintenance History
- Documents
- Warranties
- Tasks
- Parts
- Timeline

---

# Maintley Product Philosophy

Maintley is not primarily a task manager.

Maintley is not primarily a document storage app.

Maintley is not primarily an AI assistant.

Maintley is a system that preserves a property's operational memory.

Every feature should support at least one of the following:

- Record
- Remember
- Understand
- Guide

These four stages map to Maintley's product architecture:

```text
Record
  ↓
Remember
  ↓
Understand
  ↓
Guide
```

Record:

Capture maintenance, documents, warranties, parts, systems, and service history as work happens.

Remember:

Keep property history with the property, not scattered across emails, folders, calendars, or memory.

Understand:

Use accumulated property history to recognize recurring maintenance, missing information, and emerging patterns.

Guide:

Turn preserved property history into recommendations that help users make better maintenance decisions.

Future features should be evaluated against this progression.

Ask:

- Does it record property knowledge?
- Does it help the property remember?
- Does it help Maintley understand the property history?
- Does it guide the user toward a better decision?

If a feature does none of these, it should be questioned before implementation.

Examples:

- Barcode scanning records knowledge.
- Manual parsing expands what Maintley can understand.
- Maintenance History helps the property remember.
- Linked documents preserve context.
- Maintley Intelligence guides users toward better decisions.
- Property transfer preserves knowledge across owners.

This philosophy should guide product decisions without becoming heavy customer-facing language. Customers should primarily hear the outcome:

```text
Every record you save today helps future you make better decisions tomorrow.
```

---

# Target Users

## Homeowners

Need:

- Maintenance tracking
- Equipment records
- Documentation storage
- Maintenance reminders

Usually focused on a single property.

---

## Property Owners

Need:

- Multi-property organization
- Maintenance visibility
- Contractor coordination
- Historical records

Usually responsible for multiple properties.

---

## Property Managers

Need:

- Team coordination
- Property assignments
- Maintenance operations
- Tenant communication

Usually responsible for portfolios.

---

# Product Principles

## Preserve Knowledge

Information should become more valuable over time.

Every completed task, uploaded document, maintenance event, and equipment record should improve the usefulness of the property record.

---

## Reduce Reliance on Memory

Users should not need to remember:

- Filter sizes
- Install dates
- Contractor names
- Warranty information
- Maintenance schedules

Maintley should preserve that information.

---

## Recommend, Don't Require

Users should never be blocked by missing information.

Maintley should recommend improvements rather than require them.

Examples:

- Add Filter Size
- Add Install Date
- Add Warranty Information

These should remain opportunities rather than requirements.

---

## Focus on Action

Users should be able to quickly answer:

- What needs attention?
- What was done?
- What equipment exists?
- What information is missing?

The product should support decisions and actions rather than data collection for its own sake.

---

## Keep Complexity Optional

Advanced workflows should remain available.

They should not dominate the experience for new users.

Most users should succeed without learning advanced concepts.

---

# Core Workflows

Maintley supports two primary workflows.

---

## Property Workflow

Answers:

> What is the story of this property?

Typical journey:

```text
Property
  ↓
Equipment Records
  ↓
Maintenance History
  ↓
Documentation
```

Property workflows focus on understanding and preserving information.

---

## Action Workflow

Answers:

> What needs my attention?

Typical journey:

```text
Dashboard
  ↓
Tasks
  ↓
Recommendations
  ↓
Completion
```

Action workflows focus on maintenance execution.

Both workflows are equally important.

---

# Product Architecture

Maintley is organized around three conceptual layers.

---

## Properties

The Organizational Layer

Properties are the primary organizing object within Maintley.

Properties own:

- Equipment Records
- Tasks
- Maintenance History
- Documentation
- Contractors
- Tenants

Properties provide context.

---

## Maintenance History

The Historical Layer

Maintenance History preserves:

- Completed work
- Repairs
- Inspections
- Service records
- Documentation

Maintenance Events are the long-term record of activity.

History should remain useful regardless of how the rest of the property evolves.

---

## Maintley Intelligence

The Recommendation Layer

Maintley Intelligence helps users improve records and identify opportunities.

Examples:

- Missing information
- Suggested maintenance
- Quick Scan observations
- Dashboard recommendations
- Property Insights

Maintley Intelligence should derive from records.

It should not become an independent source of truth.

---

# Current Priority

The immediate priority is strengthening the core experience.

Focus areas:

- Discoverability
- Navigation clarity
- Mobile usability
- Workflow simplicity
- Feature visibility

Users should be able to understand Maintley without tutorials.

---

# Homeowner-First Product and Plan Direction

Maintley is a homeowner product first. Businesses may refer, integrate with,
or collaborate through Maintley, but the homeowner owns the property's
operational history.

Operational memory remains the destination. The initial adoption wedge is the
complete maintenance workflow that helps a homeowner build that memory.
Maintley therefore does not charge a homeowner merely to create recurring care
or preserve a complete record for one home.

The product has two plan tracks:

```text
Homeowners: Free (Maintain) -> Homeowner+ (Understand)
Businesses: Property (Manage) -> Portfolio (Understand and Coordinate)
```

Free includes the complete maintenance workflow for one home: equipment,
documents, warranties, recurring tasks, Maintenance History, ordinary task
notifications, and a lightweight record check.

Homeowner+ adds up to five homes, Property Groups, Maintley Intelligence, AI
guidance, Knowledge Packs, advanced document processing, and future premium
understanding and planning capabilities.

Property adds simple teams, residents, requests, and business collaboration to
the core maintenance workflow. It does not include full Maintley Intelligence.

Those resident Maintenance Requests remain an operational
tenant-to-landlord/property-manager workflow. They are distinct from the
homeowner-controlled Service Work Request and Work Request Report direction in
[ADR 0044](../../ADR/0044-provider-neutral-work-request-and-contractor-response.md).
Introducing the homeowner workflow must not repurpose or remove existing
resident request behavior.

Portfolio combines advanced business coordination with full Maintley
Intelligence and cross-property understanding.

When deciding feature placement, ask:

- Does this help someone record or maintain a home? Include it in Free.
- Does this help someone understand, infer, predict, or decide? Include it in
  Homeowner+ and Portfolio.
- Does this coordinate people or resident workflows? Include it in Property
  and Portfolio.

Plan downgrades are non-destructive. They may restrict new creation, premium
processing, automation, invitations, or configuration, but they must not hide
or delete existing customer records.

---

# Dashboard Direction

The dashboard should answer:

> What needs my attention right now?

The dashboard should prioritize:

- Action Center
- Overdue tasks
- Upcoming work
- Maintley Intelligence recommendations
- Property selection
- Home Activity

The dashboard should be personal-first and scope-aware. Owners and managers may
see broader priorities across the homes or properties in view, while team members
and family members should see framing focused on their relevant work and
property context.

The lower dashboard area should combine operational activity into one tabbed
module:

```text
Needs Attention | Home Timeline
```

`Needs Attention` shows current overdue and upcoming work. `Home Timeline` is
the chronological activity view for completed tasks, service records, documents,
and home updates. Upcoming work should stay out of timelines and remain in
action-oriented task surfaces. Dynamic timelines belong on the dashboard;
property details should stay focused on stable home facts, ownership, insurance,
notes, and record metadata.

Dashboard scope is a user preference. `My Focus` narrows the Dashboard toward
tasks assigned to the current user and the property context needed for that
work. `All Work` shows the user's visible work without changing
permissions or duplicating portfolio state.

Avoid turning the dashboard into a reporting screen.

Reports belong elsewhere.

---

# Maintley Intelligence Direction

Maintley Intelligence is becoming a core Maintley capability.

Its purpose is to help users improve records and identify maintenance opportunities.

Current and future examples:

- Setup recommendations
- Suggested maintenance
- Quick Scan
- Dashboard recommendations
- Property Insights
- Portfolio scans

Maintley Intelligence should grow through three distinct levels.

Each level should answer a different customer question:

- Quick Property Scan: "What did Maintley find that is worth my attention?"
- Full Property Audit: "How complete and maintainable are my property records?"
- Ongoing Maintley Intelligence: "What should I think about next?"

Quick Property Scan should remain fast, actionable, and available on free and paid plans.

Quick Property Scan should be marketed as an explainable review of what Maintley already knows about a property.

Preferred positioning:

```text
Maintley reviewed what it knows about your property and found a few things worth your attention.
```

Avoid positioning Quick Property Scan as:

```text
AI scanned your house.
```

Full Property Audit should be a premium, comprehensive review of documentation, equipment records, maintenance coverage, lifecycle planning, and property completeness.

Ongoing Maintley Intelligence should be a premium guidance layer that surfaces seasonal reminders, cost trends, lifecycle forecasts, warranty timing, and personalized observations as Maintley records improve.

Maintley Intelligence should prioritize actionable opportunities unless the user explicitly requests an audit.

Preferred:

```text
Top 3 Opportunities
```

Avoid:

```text
27 Missing Items
```

The goal is progress, not completeness.

Completeness belongs in Full Property Audit, where a user has intentionally asked for a broader review.

---

# Property Setup Assistant Direction

The Property Setup Assistant should help users create useful records without overwhelming them.

The setup experience should remain lightweight.

When entering the property-level Setup Assistant, users choose one of three
paths:

1. 10-minute essentials
2. Continue room by room
3. Upload an existing report

The essentials path is a focused subset of common safety, utility, laundry,
and exterior records. The report path reuses Property Knowledge Acquisition;
it does not introduce a separate document-processing workflow. Detected
Equipment remains unreviewed until the user confirms it.

Recommended flow:

1. Basics
2. Property Profile
3. Equipment Records
4. Suggested Maintenance
5. Access & Sharing
6. Review

The Setup Assistant should not become a required onboarding checklist.

Initial onboarding should introduce one outcome and one primary action. For a
new account, the blocking flow is limited to a concise welcome and a
first-property confirmation. The first-Property dialog includes only Basics
and Property Profile so name, address, classification, bedroom count, and
bathroom count can establish a useful record without introducing Access and
Sharing or a separate Review step. The user chooses whether to continue into
Setup Assistant afterward.

Users with an existing property should not be sent through property-creation
education again. Advanced feature education belongs in contextual empty states,
help content, and the relevant feature surface rather than the initial tour.

---

## Ongoing Setup

Property setup should continue after onboarding.

The assistant should live within the property experience and support gradual improvement over time.

Examples:

- Kitchen
- Bathrooms
- Laundry
- Garage
- Exterior
- Utility Systems
- Safety
- Attic
- Basement

Supported responses:

- Present
- Not Present
- Skip for now

Users should never be penalized for systems they do not have.
Items skipped for now should stay open so users understand they can return later.

---

# Product Simplification

Maintley should prioritize clarity over feature breadth.

When forced to choose:

Prefer:

- Simpler workflows
- Better discoverability
- Better defaults
- Better navigation

Over:

- Additional complexity
- Advanced configuration
- Rare edge cases

---

# Current Strategic Decision

Units are temporarily deprioritized.

Units are not removed permanently.

However, they should not be part of the primary Maintley experience until the core property workflow is stronger.

Current recommendation:

```text
123 Main St - Apartment A
123 Main St - Apartment B
```

as separate properties.

This keeps the experience simpler while supporting real-world use cases.

---

# Feature Evaluation Framework

Future features should answer at least one of the following questions:

Does this help users:

- Understand a property?
- Maintain a property?
- Preserve knowledge?
- Improve decision making?
- Reduce reliance on memory?
- Complete maintenance more effectively?

Features that do not support these goals should be carefully evaluated before implementation.

---

# Long-Term Direction

Maintley should become the operational memory system for properties.

Over time the platform should help users:

- Understand their properties
- Preserve maintenance history
- Improve maintenance habits
- Reduce forgotten information
- Coordinate maintenance activities
- Make better property decisions

Tasks, documentation, maintenance history, recommendations, and Maintley Intelligence all exist to support this goal.

The long-term objective is not to create more data.

The objective is to make property knowledge useful over time.

---

# Success Criteria

The product is improving if users can:

- Understand the main workflow quickly.
- Find important features without help.
- Add information with minimal effort.
- Complete maintenance tasks easily.
- Understand how tasks become history.
- Understand why records matter.
- Improve their property records over time.
- Feel confident using Maintley without tutorials.

If users can do those things, Maintley is moving in the right direction.

The staged multi-product, shared-Intelligence, integration, and assistant
direction is documented separately in
[Maintley Platform Direction](MAINTLEY_PLATFORM_DIRECTION.md). That direction
does not imply that its planned packages, connectors, or assistant channels are
currently implemented.
