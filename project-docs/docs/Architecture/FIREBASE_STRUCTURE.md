# Firebase Structure

Last reviewed: 2026-06

## Purpose

This document describes how Maintley uses Firebase services and how those services work together to support the platform.

It answers:

> How is Maintley organized within Firebase?

This document covers:

* Firebase services
* Account architecture
* Authentication
* Firestore collections
* Cloud Functions
* Storage integration
* Notifications
* Deployment structure

For detailed collection definitions, see:

* DATA_MODEL.md

For file storage behavior, see:

* FILES_AND_STORAGE.md

For deployment details, see:

* DEPLOYMENT.md

---

# Firebase Architecture

Maintley uses Firebase as its primary backend platform.

Firebase provides:

* Authentication
* Database storage
* File storage
* Cloud Functions
* Push notification infrastructure

Maintley follows an account-centric architecture.

High-level relationship:

```text
User
  ↓
Account Membership
  ↓
Family Account
  ↓
Properties
  ↓
Maintenance Records
```

Authentication identifies users.

Account membership determines access.

Properties serve as the primary organizational object.

Most application data ultimately exists within an account and property context.

---

# Firebase Services Used

## Firebase Authentication

Used for:

* User identity
* Login
* Registration
* Session persistence
* Account ownership

Authentication does not determine permissions.

Permissions are determined through account membership and role-based access controls.

---

## Cloud Firestore

Used for:

* Properties
* Spaces
* Equipment
* Tasks
* Maintenance Events
* Teams
* Tenants
* Contractors
* Notifications
* Property documents
* Property knowledge suggestions
* Subscription state
* Application records

Firestore is the primary source of truth for Maintley data.

---

## Firebase Storage

Used for:

* Property photos
* Equipment photos
* Manuals
* Warranty documents
* Invoices
* Maintenance attachments
* Profile images

Firestore stores metadata while Storage stores file contents.

See FILES_AND_STORAGE.md for details.

---

## Firebase Cloud Functions

Used for:

* Billing
* Invitations
* Email delivery
* Maintenance processing
* Notification generation
* Scheduled jobs
* Administrative operations

Functions contain business logic that should not run exclusively on the client.

---

## Firebase Cloud Messaging

Used for:

* Push notifications
* Mobile notification delivery
* Browser notification delivery for supported installed or open web app
  contexts

FCM tokens are stored and managed within Maintley records.

Native/mobile compatibility uses the legacy `users/{userId}.pushToken` field.
Browser push registrations use `users/{userId}.pushTokens[]`, allowing multiple
browsers/devices without replacing the native token.

---

# Firebase Configuration

Client initialization lives in:

```text
src/config/firebase.ts
```

Expected frontend environment variables:

* REACT_APP_FIREBASE_API_KEY
* REACT_APP_FIREBASE_AUTH_DOMAIN
* REACT_APP_FIREBASE_PROJECT_ID
* REACT_APP_FIREBASE_STORAGE_BUCKET
* REACT_APP_FIREBASE_MESSAGING_SENDER_ID
* REACT_APP_FIREBASE_APP_ID
* REACT_APP_FIREBASE_MEASUREMENT_ID, optional and only required when product
  analytics is enabled
* REACT_APP_FIREBASE_WEB_PUSH_VAPID_KEY
* REACT_APP_ENABLE_ANALYTICS, optional; set to `true` to enable GA4/Firebase
  Analytics in supported browser builds

Additional billing-related environment variables may be required for Stripe integration.

---

# Project Configuration

Firebase project configuration is managed through:

```text
firebase.json
```

Current configuration includes:

* Functions source
* Firestore rules
* Hosting configuration
* A shared Storage rules target

Project aliases are managed through:

```text
.firebaserc
```

The `default` Storage target maps to each project's own bucket:

* `maintleybeta.firebasestorage.app` for Maintley Beta
* `mypropertymanager-cda42.firebasestorage.app` for production

---

# Account Architecture

Maintley uses an account-based authorization model.

Authentication identifies a user.

Authorization is determined through account membership.

Primary hierarchy:

```text
User
  ↓
Account Membership
  ↓
Family Account
  ↓
Properties
```

Account records own:

* Properties
* Equipment
* Tasks
* Maintenance History
* Contractors
* Team Members
* Tenants

This architecture allows multiple users to operate within a shared account while maintaining role-based access controls.

---

# Authentication

Firebase Authentication acts as the identity provider.

Auth state is bridged into Redux through:

```text
src/services/authService.ts
```

and

```text
src/App.tsx
```

When Firebase reports a different authenticated user, Maintley should treat the
app as unresolved until the next user profile has loaded. Account-scoped RTK
Query data, Redux slices, and prior-user local cache are cleared during that
transition so protected screens do not briefly render the previous account's
properties, tasks, or dashboard data.

Persistence strategy:

Native platforms:

* IndexedDB persistence when available

Web:

* Browser local persistence

Fallback:

* Browser local persistence if IndexedDB initialization fails

---

# Account Bootstrap

New account creation may create or hydrate:

* users/{uid}
* familyAccounts/{accountId}
* accountMemberships/{accountId}_{uid}
* teamGroups

Bootstrap flows establish the minimum account structure required for Maintley operation.

---

# Firestore Collections

Primary collections:

* users
* familyAccounts
  * entitlementGrants (server-written temporary and permanent access grants)
  * accessLifecycleDeliveries (server-written message idempotency and outcomes)
* accountMemberships
* properties
* propertySpaces
* propertySupplies
* propertyKnowledgeLinks (trusted Space and Supply relationships, including reviewed migration links)
* serviceWorkRequests (server-written, resumable homeowner intake sessions)
* workRequestReports (server-written, versioned report artifacts)
* workRequestEvents (server-written, append-only domain events)
* workRequestShares (server-only secure-share metadata; sharing not yet enabled)
* propertyGroups
* propertyGroupMemberships
* devices
* tasks
* maintenanceEvents
* maintenanceEventRevisions (function-managed, append-only correction metadata)
* maintenanceHistory
* propertyScanLatest
* propertyScanSnapshots
* notifications
* teamMembers
* teamGroups
* teamMemberInvitationCodes
* tenantProfiles
* tenantInvitationCodes
* contractors
* propertyShares
* userInvitations
* favorites
* appConfig
* feedback
* admin_users (function-managed)
* admin_sessions (function-managed)
* admin_audit_logs (server-written high-value administrative and program decisions)
* personalAssistantCredentials (function-managed token verifiers, scopes, and property allowlists)
* personalAssistantRateLimits (short-lived server-written request counters)
* personalAssistantAccessAudits (server-written minimized API access records)

The first-property Homeowner+ trial uses a Firestore property-create trigger.
Account bootstrap marks only eligible new Free owner accounts; the trigger then
creates one deterministic generic grant, updates the derived account access
projection, consumes eligibility, and appends an immutable audit event in one
transaction. All issuance flags default off.

Admin portal collection notes:

* `admin_users` stores app-admin login records for `/admin`.
* Documents are manually provisioned and should include:
  * `username` (string)
  * `usernameLower` (string, lowercase)
  * `displayName` (string)
  * `email` (string)
  * `passwordSalt` (string)
  * `passwordHash` (string, scrypt hash of `usernameLower:password`)
  * `roles` (string[])
  * `isActive` (boolean)
  * `createdAt` / `updatedAt` (timestamps)
* `admin_sessions` stores hashed session tokens and expiry metadata.
* Both collections are function-managed and denied to direct client reads/writes in Firestore rules.

Personal Assistant API collections are also denied to every direct client. The Owner-gated credential callable and the read-only HTTPS API are their only supported access boundaries.

Temporarily hidden but still supported:

* units
* suites

Legacy and compatibility collections:

* userPreferences
* activityLogs
* recentlyViewed
* deviceSubscriptions

See DATA_MODEL.md for detailed collection definitions.

---

# Derived Systems

Some platform capabilities are generated from existing Firestore data rather than existing as primary collections.

Examples:

* Maintley Intelligence
* Recommendations
* Dashboard Insights
* Setup Progress
* Maintley Intelligence readiness
* Attention Center summaries

These features derive information from existing records and should not become authoritative sources of data.

Source collections remain:

* Properties
* Equipment
* Tasks
* Maintenance Events
* Files
* Contractors

Maintley Intelligence scan snapshots are saved in:

* `propertyScanLatest`
* `propertyScanSnapshots`

`propertyScanLatest` stores latest scan snapshots by scan type. Quick Scan keeps the legacy `{propertyId}` latest key; Property Audit uses `{propertyId}__property_audit_v1` so it cannot overwrite the latest Quick Scan.

`propertyScanSnapshots` stores append-only Quick Scan history. Property Audit history is not stored in the current phase; only the latest Property Audit snapshot is retained.

These collections store derived scan output for the property Insights Overview and History views. Property Audit snapshots may include `auditCategories` and `auditAssetReviews` so the UI can present category browsing and asset-centered review without changing the source records. They should not become a source of truth for property details, systems, tasks, or maintenance history.

---

# Firestore Rules

Live Firestore security rules are maintained in:

```text
firestore.rules
```

Important concepts:

* Authentication required for application data
* accountId is the primary account scope
* accountMemberships are the preferred membership model
* Legacy ownership fields remain supported where necessary
* Maintley Intelligence scan snapshots are account-scoped derived records
* Resource limits are enforced through account counters
* Function-managed invitation workflows control sensitive writes
* Notifications follow recipient-based ownership rules
* App configuration remains authenticated read-only

The live source of truth is always:

```text
firestore.rules
```

---

# Cloud Functions Structure

Source directory:

```text
functions/
```

Compiled output:

```text
functions/lib/
```

Main exports:

```text
functions/index.ts
```

Shared authorization helpers:

* functions/accountAuthz.ts
* functions/inviteAuthz.ts

---

# Function Categories

## Account & Membership

Examples:

* ensureFamilyAccount
* finalizeEmailVerification
* createFamilyInvite
* acceptFamilyInvite
* getFamilyMembers
* updateFamilyMember

---

## Team Management

Examples:

* createTeamMemberInvitationCode
* validateTeamMemberInvitationCode
* redeemTeamMemberInvitationCode

---

## Tenant Management

Examples:

* createTenantInvitationCode
* validateTenantInvitationCode
* redeemTenantInvitationCode

---

## Billing

Examples:

* createCheckoutSession
* validatePromotionCode
* verifyCheckoutSession
* cancelSubscription
* getSubscriptionDetails
* syncSubscriptionFromStripe

---

## Maintenance

Examples:

* createMaintenanceEvent
* createMaintenanceEventsBatch
* startServiceWorkRequest

`startServiceWorkRequest` is the only implemented Service Work Request command.
It is account-owner-only, requires the private
`service_work_requests.use` entitlement capability, and writes the initial
session and `WorkRequestStarted` event in one Firestore transaction. Later
interview, report, approval, and share commands are not exported yet.

---

## Email Delivery

Examples:

* sendMonthlyPropertySummaries
* sendMonthlyPropertyInsights
* sendTaskReminderEmails
* sendTeamMemberTaskReports
* sendSeasonalGuidanceEmails
* sendAccessLifecycleEmails
* sendAccessLifecycleActivationOnGrantCreate
* previewComplimentaryAccessCode
* redeemComplimentaryAccessCode
* manageManualOccupancy
* reserveStorageUpload
* getStorageQuotaStatus

Access lifecycle delivery uses an hourly UTC dispatcher plus a grant-create
activation trigger. Both are independently disabled by
`ENABLE_ACCESS_LIFECYCLE_COMMUNICATION`. Key lifecycle milestones also publish
in-app Maintley Events. Provider attempts and outcomes remain operational data,
separate from immutable admin decision audit records.

Complimentary access programs, code verifiers, redemption attempts, storage
upload reservations, grant records, and lifecycle delivery state are
server-written and client-inaccessible. Storage finalize/delete triggers keep
the trusted account usage projection synchronized; Storage rules can require a
live path- and size-bound reservation while preserving read and delete access.

---

## Notifications

Examples:

* sendPushOnNotificationCreate
* publishMaintleyEvent

---

## Account Lifecycle

Examples:

* deleteUserAccount
* deleteFamilyMemberAccount

---

# Triggers and Scheduled Functions

## Firestore Triggers

Examples:

* sendPushOnNotificationCreate
* notifyTaskCompletion

Triggers respond automatically to Firestore changes.

---

## HTTP Functions

Examples:

* stripeWebhook

Used when external systems communicate directly with Maintley.

## Maintley Events

Maintley workflow lifecycle events are stored in:

```text
maintleyEvents/{eventId}
```

Event records are server-owned. Clients may read events they receive or can
access through account membership, but clients do not create, update, or delete
event records directly.

Initial event producers include:

* Property Knowledge Acquisition
* Maintley Intelligence Quick Scan
* Support Tickets

Initial consumers include:

* In-app notifications
* Android push notifications

Future consumer placeholders include:

* Web push
* Email
* Intelligence History
* Activity feeds

---

## Scheduled Functions

Examples:

* sendMonthlyPropertySummaries
* sendMonthlyPropertyInsights
* sendTaskReminderEmails
* sendTeamMemberTaskReports
* sendSeasonalGuidanceEmails

Scheduled functions perform recurring maintenance and communication tasks.

---

# Storage Integration

Firebase Storage is used for file storage.

Storage responsibilities include:

* Property files
* Equipment files
* Maintenance files
* Task attachments
* User images
* Team files

Observed paths include:

* task-completions/{userId}/{taskId}/{timestamp}-{filename}
* properties/{userId}/{filename}
* user-profile-images/{userId}/{filename}
* team-member-images/{userId}/{memberId}/{filename}
* team-member-files/{userId}/{memberId}/{filename}
* device-files/{propertyId}/{deviceId}/{filename}
* maintenance-files/{propertyId}/{filename}

See FILES_AND_STORAGE.md for complete storage documentation.

---

# Local Verification

Common root scripts:

```bash
npm run build
npm run test:ci
npm run test:rules
npm run test:storage
npm run test:rules:all
```

Functions:

```bash
npm --prefix functions run build
npm --prefix functions run test:sandbox
npm --prefix functions run test:cards:sandbox
npm --prefix functions run test:webhook:sandbox
```

These scripts support validation of Firebase-related functionality before deployment.

---

# Guiding Principles

Maintley should remain account-centric.

Properties remain the primary organizational object.

Authentication should remain separate from authorization.

Maintley Intelligence and recommendation systems should derive from persisted records rather than becoming independent sources of truth.

Firebase services should remain focused on infrastructure responsibilities while business logic remains organized through application systems and Cloud Functions.

When introducing new Firebase resources:

* Prefer extending existing account structures.
* Avoid duplicating ownership models.
* Avoid creating parallel data hierarchies.
* Keep permissions aligned with account membership architecture.
