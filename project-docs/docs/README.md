# Maintley Documentation

Last reviewed: 2026-06

This directory contains Maintley's authoritative documentation.

Documentation within this directory represents the current source of truth for product behavior, architecture, operations, UX standards, and development practices.

---

# Documentation Context

Maintley's project knowledge is organized into three areas:

```text
project-docs/
├── ADR/
├── docs/
└── reports/
```

### ADR

Architecture Decision Records preserve historical decision-making.

They answer:

> Why was this decision made?

---

### Documentation

This directory.

Documentation answers:

> How does Maintley work today?

Documentation should be treated as authoritative.

---

### Reports

Reports contain audits, reviews, investigations, and point-in-time analyses.

They answer:

> What was true when the report was created?

Reports are not authoritative documentation.

---

# Documentation Structure

```text
docs/
├── Product/
├── Intelligence/
├── Architecture/
├── Operations/
├── UX/
├── Development/
├── Compliance/
└── Archive/
```

Each folder owns a specific area of responsibility.

---

# Start Here

New contributors should begin with:

1. Product/PRODUCT_DIRECTION.md
2. Product/FEATURES.md
3. Architecture/DATA_MODEL.md
4. Architecture/TECHNICAL_ARCHITECTURE.md

These documents provide the fastest path to understanding Maintley.

---

# Product

Answers:

> What is Maintley?

Documents:

- PRODUCT_DIRECTION.md
- FEATURES.md
- PUBLIC_SEO.md
- PUBLIC_SEO_ARCHITECTURE.md
- ANALYTICS_MEASUREMENT_PLAN.md
- MAINTLEY_PLAN_FEATURE_MATRIX.md
- ROADMAP_STATUS.md

Contains:

- Product vision
- Strategic direction
- Platform capabilities
- Plan limitations
- Customer-facing functionality

---

# Intelligence

Answers:

> How does Maintley guide users?

Documents:

- PROPERTY_INTELLIGENCE.md
- RECOMMENDATION_ENGINE.md
- APPLIANCE_PROFILES.md
- PROPERTY_KNOWLEDGE_ACQUISITION.md
- PROPERTY_KNOWLEDGE_ACQUISITION_STATUS_MATRIX.md

Contains:

- Maintley Intelligence architecture
- Property Knowledge Acquisition
- Property Knowledge Acquisition source support status
- Recommendation generation
- Equipment profile guidance
- Setup guidance
- Insight generation

Maintley Intelligence should remain a derived system.

It should never become a competing source of truth.

---

# Architecture

Answers:

> How is Maintley built?

Documents:

- DATA_MODEL.md
- TECHNICAL_ARCHITECTURE.md
- FIREBASE_STRUCTURE.md
- FIRESTORE_QUERY_CONTRACTS.md
- PERMISSIONS.md
- PERSONAL_ASSISTANT_API.md
- FILES_AND_STORAGE.md
- MAINTENANCE_EVENT_SCHEMA.md

Contains:

- Data ownership
- Collection structures
- Firebase architecture
- Permission boundaries
- Storage architecture
- Historical record models

---

# Product direction

Documents:

- Product/PRODUCT_DIRECTION.md
- Product/MAINTLEY_PLATFORM_DIRECTION.md

---

# Operations

Answers:

> How is Maintley operated?

Documents:

- BILLING.md
- DEPLOYMENT.md
- CI_RELEASE_GATES.md
- EMAIL_NOTIFICATIONS.md
- TESTING.md
- ANDROID_RELEASE_ACCEPTANCE.md
- WORKFLOW_ERROR_TAXONOMY.md

Contains:

- Billing systems
- Deployment workflows
- Email architecture
- Testing strategy

Operational documentation should be updated whenever production processes change.

---

# UX

Answers:

> How should Maintley feel?

Documents:

- UX_LANGUAGE_GUIDE.md
- MOBILE_UX_GUIDE.md

Contains:

- Language standards
- Navigation principles
- Mobile-first design guidance
- Dashboard guidance
- Communication standards

Mobile should be treated as a first-class experience.

---

# Development

Answers:

> How should Maintley be developed?

Documents:

- CODE_ORGANIZATION_GUIDE.md
- DOCUMENTATION_MAINTENANCE.md
- SCRIPTS_AND_UTILITIES.md

Contains:

- Code organization standards
- Refactoring guidance
- Documentation processes
- Script inventory
- Operational tooling

Development documentation should help maintain consistency across future implementations.

---

# Compliance

Answers:

> What external obligations exist?

Documents:

- THIRD_PARTY_LICENSES.md

Contains:

- Open source dependency inventory
- License tracking
- Compliance references

---

# Archive

Answers:

> What was true previously?

Location:

```text
Archive/
```

Archived documentation is retained for:

- Historical context
- Migration reference
- Legacy implementation details

Archived documentation is not authoritative.

When archived documentation conflicts with active documentation, active documentation should be considered correct.

---

# Documentation Ownership Model

Maintley documentation follows:

```text
Implementation
    ↓
Documentation
    ↓
Decision Records
    ↓
Reports
```

Each layer serves a different purpose.

Documentation should describe the current platform.

Decision records preserve historical reasoning.

Reports preserve analysis and investigation.

---

# Documentation Update Process

When making changes:

1. Update implementation.
2. Update affected documentation.
3. Create or update ADRs when appropriate.
4. Archive superseded documentation.
5. Avoid duplicate sources of truth.

Documentation should evolve alongside the platform.

---

# Important Current Direction

Maintley continues moving toward:

```text
Properties
    ↓
Maintenance Events
    ↓
Maintley Intelligence
    ↓
User Action
```

Core principles:

- Property-centric organization
- Maintenance Event-centric history
- Maintley Intelligence-driven guidance
- Mobile-first experience
- Account-centric ownership
- Clear ownership boundaries

Properties provide context.

Maintenance Events preserve history.

Maintley Intelligence provides guidance.

These responsibilities should remain distinct as Maintley evolves.

---

# Guiding Principle

Documentation should answer:

> How does Maintley work today?

If a document does not help answer that question, consider whether it belongs in:

- ADR/
- reports/
- Archive/

instead of the active documentation set.
