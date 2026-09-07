# Technical Architecture

Last reviewed: 2026-06

# Purpose

This document describes how Maintley is implemented today.

It is intentionally descriptive rather than aspirational.

It answers:

> How does Maintley currently work?

This document focuses on:

* System architecture
* Application structure
* Data access patterns
* Service integration
* Runtime behavior
* Technical implementation

For product goals and direction see:

* PRODUCT_DIRECTION.md

For Firebase implementation details see:

* FIREBASE_STRUCTURE.md

For data structures see:

* DATA_MODEL.md

For permissions see:

* PERMISSIONS.md

---

# System Architecture

Maintley is organized into several conceptual layers.

```text
Product Layer
    ↓
User Workflows

Maintley Intelligence Layer
    ↓
Recommendations & Guidance

Application Layer
    ↓
React + Redux

Data Layer
    ↓
Firestore + Storage

Infrastructure Layer
    ↓
Firebase Services
```

Each layer has a distinct responsibility.

The application should avoid duplicating responsibilities across layers.

---

# Core Platform Model

Maintley is organized around three primary concepts.

```text
Properties
    ↓
Organizational Layer

Maintenance Events
    ↓
Historical Layer

Maintley Intelligence
    ↓
Recommendation Layer
```

Properties provide context.

Maintenance Events preserve history.

Maintley Intelligence provides guidance.

Most platform functionality ultimately builds upon these concepts.

---

# Application Shape

Maintley is a React 18 single-page application with Firebase as the backend platform.

The application is also packaged for Android using Capacitor.

Frontend:

* React
* TypeScript
* React Router
* Redux Toolkit
* RTK Query
* styled-components

Backend:

* Firebase Authentication
* Cloud Firestore
* Firebase Storage
* Cloud Functions

Payments:

* Stripe Checkout
* Stripe Webhooks

Mobile:

* Capacitor Android
* Capacitor Push Notifications

Scanning & OCR:

* tesseract.js
* Barcode parsing utilities
* Label parsing utilities
* Browser/PWA scanning through getUserMedia, BarcodeDetector, and ZXing fallback
* Android native scanner bridge through Capacitor, CameraX, and ML Kit barcode scanning

---

# Entry Points

Application startup:

```text
src/index.tsx
```

Application shell:

```text
src/App.tsx
```

Responsibilities include:

* Authentication initialization
* App update checks
* Push notification registration
* Mobile state initialization
* Feedback provider initialization

Routing:

```text
src/router.tsx
```

Authenticated layout:

```text
src/pages/Layout/Layout.tsx
```

Cloud Functions:

```text
functions/index.ts
```

---

# Routing Architecture

Maintley uses an explicit routing build profile:

```text
Web / Firebase Hosting     BrowserRouter + root-relative assets
Packaged Android          HashRouter + relative assets
```

The transitional Android profile prevents the Hosting migration from changing
the installed Capacitor application before native deep-link and callback
validation is complete. Web builds do not support `/#/` application routes.

This supports:

* clean, refreshable Firebase Hosting routes
* safe Android packaging during the staged migration
* an explicit later removal of the Android hash profile after native validation

---

## Public Routes

Examples:

* /
* /login
* /forgot-password
* /registration
* /register
* /paywall
* /docs
* /features
* /help
* /legal
* /legal/:documentName

---

## Authenticated Routes

Examples:

* /dashboard
* /tasks
* /devices
* /properties
* /property/:slug
* /property/:slug/device/:deviceSlug
* /property/:slug/maintenance-history/:groupId
* /team
* /report
* /settings
* /profile
* /tenant-profile

Unit and Suite management routes and screens have been retired from the active
application. Legacy readers remain where existing equipment, history, reports,
exports, permissions, and deletion workflows require location compatibility.

---

# Product Analytics

Maintley uses a centralized analytics layer in:

```text
src/analytics/
```

Analytics is intentionally treated as a product-learning system, not a customer
record system.

The authoritative event definitions, activation rules, funnels, and GA4 setup
handoff are documented in `Product/ANALYTICS_MEASUREMENT_PLAN.md`. ADR 0038
defines the privacy and behavioral-telemetry decision.

It may track:

* Sanitized route views using route patterns such as `/property/:slug`
* Successful product workflow events such as property creation, equipment
  creation, task creation, task completion, maintenance history creation,
  property scans, and report downloads
* Non-identifying metadata such as route area, task priority, report type,
  counts, booleans, and workflow source

The event contract uses event-specific parameter allowlists. Workflows that can
create records through several paths use a controlled `action_source` so setup
automation, imports, system activity, accepted AI suggestions, and self-directed
user actions remain analytically distinct. Authenticated GA4 sessions may use an
opaque Firebase UID through the GA4 User-ID API, plus broad role and plan family
properties. Record IDs are not event parameters.

It must not track:

* Property names or addresses
* Task titles, notes, or descriptions
* Equipment brand, model, serial number, or part number
* User email addresses, names, or free-form customer-entered content
* Maintenance notes or document contents

Analytics is disabled unless `REACT_APP_ENABLE_ANALYTICS=true` and
`REACT_APP_FIREBASE_MEASUREMENT_ID` is present. Tests always no-op analytics.
Firebase automatic page-view collection is disabled so route analytics can use
sanitized route patterns instead of customer-specific URL values.

---

# State Management

Redux is configured through:

```text
src/Redux/store/store.tsx
```

---

## Redux Slices

Examples:

* user
* app
* navigation
* propertyData
* team
* maintenanceRequests

Several slices remain for compatibility with older application structures.

---

## RTK Query

Shared API configuration:

```text
src/Redux/API/apiSlice.ts
```

Responsibilities:

* Shared API setup
* Cache tags
* Firestore timestamp handling
* App version retrieval
* Feedback submission

Feature APIs provide access to:

* Properties
* Tasks
* Equipment
* Contractors
* Team Members
* Tenants
* Notifications
* Maintenance Events
* Favorites
* Units

Most endpoints interact directly with Firebase SDKs.

Privileged workflows typically use Cloud Functions.

---

# Maintley Intelligence Architecture

Maintley Intelligence is a derived system.

Maintley Intelligence consumes:

* Properties
* Equipment
* Tasks
* Maintenance Events
* Documentation

Maintley Intelligence generates:

* Structured findings
* Recommendations derived from findings
* Property Insights
* Quick Scan results
* Dashboard guidance

Maintley Intelligence does not own source data.

Source data remains in the underlying collections.

The shared engine lives in:

```text
src/intelligence/
```

Quick Scan, future Property Audit, Dashboard Insights, and Email Insights should consume this shared engine rather than implementing separate recommendation logic.

See:

* PROPERTY_INTELLIGENCE.md
* RECOMMENDATION_ENGINE.md

---

# Firebase Client Layer

Firebase initialization:

```text
src/config/firebase.ts
```

Services initialized:

* Firebase App
* Firestore
* Authentication
* Storage
* Functions

Firestore uses:

```text
experimentalAutoDetectLongPolling
```

for compatibility across environments.

---

# Authentication Services

Primary service:

```text
src/services/authService.ts
```

Responsibilities:

* Sign up
* Sign in
* Sign out
* Account bootstrap
* Account membership creation
* Invitation redemption
* User hydration

This service acts as the primary authentication orchestration layer.

---

# Billing Services

Primary service:

```text
src/services/stripeService.ts
```

Responsibilities:

* Checkout creation
* Subscription retrieval
* Billing integrations

Billing behavior is documented separately.

See:

* BILLING.md
* MAINTLEY_PLAN_FEATURE_MATRIX.md

## Shared entitlement resolver

Runtime-neutral entitlement contracts and resolution live in:

```text
functions/packages/entitlements
```

The browser and Firebase Functions consume the same pure resolver through local
package dependencies. The canonical package lives inside the Functions source
directory so Firebase includes it in the deployment upload. It separates billing state from effective capabilities,
supports versioned plan bundles and account-scoped additive grants, uses an
explicit clock for expiration, and emits diagnostics for compatibility or
default-deny outcomes.

The current rollout keeps subscription compatibility while routing primary web
and Functions feature decisions through shared capability and limit helpers.
Direct plan-name checks are restricted to classified billing, pricing,
presentation, analytics, and migration boundaries by repository validation.
Server capability decisions that can be affected by complimentary access use
the account-aware resolver. It loads the family account's authoritative billing
state and entitlement-grant collection before evaluating background email,
push, invite, report, property-group, and document-intelligence behavior.
Subscription-only checks are reserved for questions that are specifically
about Stripe-paid state, such as paid-conversion communication suppression.

Internal grant issuance remains disabled by default and requires an explicit
deployment variable. Existing grants continue to resolve even when new issuance
is disabled.

---

# Push Notification Services

Primary service:

```text
src/services/pushNotifications.ts
```

Responsibilities:

* Native token registration
* Foreground notification handling
* Device token synchronization

Push preferences are stored with user records.

---

# Cloud Functions

Cloud Functions are written in TypeScript.

Source:

```text
functions/
```

Compiled output:

```text
functions/lib/
```

Compiled output is generated during build and is not source-controlled. The
current public deployment surface is guarded by
`functions/function-exports.json`; the executable inventory currently contains
112 Firebase exports.

Primary export:

```text
functions/index.ts
```

---

## Function Categories

### Billing

Examples:

* createCheckoutSession
* validatePromotionCode
* verifyCheckoutSession
* cancelSubscription
* getSubscriptionDetails
* syncSubscriptionFromStripe

---

### Feedback

Examples:

* submitFeedback

---

### Account Management

Examples:

* ensureFamilyAccount
* finalizeEmailVerification
* createFamilyInvite
* acceptFamilyInvite
* getFamilyMembers
* updateFamilyMember

---

### Team Management

Examples:

* createTeamMemberInvitationCode
* validateTeamMemberInvitationCode
* redeemTeamMemberInvitationCode

---

### Tenant Management

Examples:

* createTenantInvitationCode
* validateTenantInvitationCode
* redeemTenantInvitationCode

---

### Maintenance

Examples:

* createMaintenanceEvent
* createMaintenanceEventsBatch
* notifyTaskCompletion

---

### Notifications

Examples:

* sendPushOnNotificationCreate

---

# Data Access Pattern

Maintley uses a mixed access model.

---

## Client Access

Used for:

* Property data
* Tasks
* Equipment
* Contractors
* Maintenance records

Most account-scoped resources are accessed directly through Firebase SDKs.

---

## Cloud Functions

Used for:

* Billing
* Invitations
* Account setup
* Privileged workflows
* Maintenance event creation

Cloud Functions provide controlled access to sensitive operations.

---

## Firestore Triggers

Used for:

* Notifications
* Push delivery
* Maintenance side effects

Triggers handle cross-cutting system behavior.

---

# Authorization Model

Authorization is enforced through multiple layers.

```text
UI
    ↓
Firestore Rules
    ↓
Cloud Functions
```

UI restrictions improve usability.

Firestore Rules and Cloud Functions provide authoritative security controls.

See:

* PERMISSIONS.md

---

# Account Architecture

Maintley uses an account-centric authorization model.

Hierarchy:

```text
User
    ↓
Account Membership
    ↓
Account
    ↓
Properties
```

Important records:

* users
* familyAccounts
* accountMemberships
* teamMembers

Account membership is the preferred access model.

Legacy ownership fields remain in portions of the application for compatibility.

---

# Maintenance Architecture

Maintenance Events are the canonical maintenance timeline.

Primary collection:

```text
maintenanceEvents
```

Legacy compatibility:

```text
maintenanceHistory
```

Task completion typically results in:

```text
Task
    ↓
Maintenance Event
    ↓
Notification
```

Maintenance history views currently support both collections through:

```text
src/maintenanceHistory/maintenanceHistoryAdapter.ts
```

Property- and account-scoped RTK queries feed collection and embedded-property
sources into this adapter. It owns the UI-facing shape, source identity,
canonical preference, safe provenance deduplication, and ordering. Individual
property views should consume the adapted records rather than merging legacy
arrays independently.

Equipment compatibility history is composed through the same adapter before it
reaches equipment timelines, reports, profile and dashboard summaries, or
Maintley Intelligence. The Intelligence engine also enforces this boundary so
all Intelligence consumers reason over the same normalized history contract.

See:

* MAINTENANCE_EVENT_SCHEMA.md

---

# Notification Architecture

Maintley workflow lifecycle events are stored in:

```text
maintleyEvents/{eventId}
```

In-app notification delivery records are stored in:

```text
notifications/{notificationId}
```

Maintley Event producers include:

* Property Knowledge Acquisition
* Maintley Intelligence Quick Scan
* Support Tickets

Event consumers include:

* In-app notification upserts
* Android push delivery for actionable milestones

Future event consumers include:

* Web push
* Email
* Intelligence History
* Activity feeds

Legacy notification-create push delivery remains handled through:

```text
sendPushOnNotificationCreate
```

Event-generated in-app notifications suppress the legacy create trigger and let
the event consumer decide whether Android push should be sent. This prevents
non-actionable milestones, such as document review started, from sending noisy
push notifications while still allowing later milestones to update the same
in-app notification record.

Notification delivery architecture is documented separately.

See:

* EMAIL_NOTIFICATIONS.md

---

# File Storage Architecture

Firebase Storage is used for:

* Property photos
* Equipment photos
* Maintenance attachments
* Warranty documents
* User images

File uploads are managed through upload helper utilities.

Storage behavior is documented separately.

See:

* FILES_AND_STORAGE.md

---

# Build & Test Commands

Root application:

```bash
npm run start
npm run build
npm run test:ci
npm run e2e
npm run test:rules
npm run test:storage
npm run test:rules:all
```

Functions:

```bash
npm --prefix functions run build
npm --prefix functions run deploy
npm --prefix functions run test:sandbox
npm --prefix functions run test:cards:sandbox
npm --prefix functions run test:webhook:sandbox
```

These commands support validation, deployment, and testing workflows.

---

## Personal Assistant read boundary

Maintley exposes a private `/v1` HTTPS read API for the Maintley Owner's trusted server-side assistant. The boundary authenticates HMAC-verified bearer credentials, applies explicit scopes and property allowlists, and maps Firestore records into stable public response models. It never returns raw Firestore documents or file content and does not permit property-data writes. See `PERSONAL_ASSISTANT_API.md` for the operational contract.

---

# Current Technical Priorities

Current technical priorities include:

* Continued account-model consolidation
* Legacy ownership cleanup
* Maintley Intelligence expansion
* Mobile UX improvements
* Documentation alignment
* Incremental technical debt reduction

These priorities reflect active implementation efforts rather than long-term product direction.

---

# Design Principles

Maintley architecture should remain:

* Property-centric
* Account-centric
* Event-driven
* Mobile-friendly
* Incrementally maintainable

Source data should remain authoritative.

Derived systems should consume source data rather than create parallel sources of truth.

Properties provide organization.

Maintenance Events provide history.

Maintley Intelligence provides guidance.

The architecture should continue reinforcing those responsibilities as the platform evolves.
