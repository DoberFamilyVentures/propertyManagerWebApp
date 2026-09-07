# Permissions

Last reviewed: 2026-06

## Purpose

This document describes how authorization is enforced throughout Maintley.

It answers:

> Can a user perform a specific action?

This document covers:

* Authorization philosophy
* Permission layers
* Role models
* Account-scoped access
* Property-scoped access
* Firestore rule behavior
* Cloud Function authorization
* Collection-level permissions

For related documentation:

* FIREBASE_STRUCTURE.md
* DATA_MODEL.md
* MAINTLEY_PLAN_FEATURE_MATRIX.md
* BILLING.md

---

# Authorization Philosophy

Maintley separates three related but independent concepts:

```text
Authentication
    ↓
Identity

Authorization
    ↓
Access

Subscription
    ↓
Feature Availability
```

Authentication answers:

> Who is this user?

Public registration may use Firebase Authentication's email-method lookup as
a non-blocking availability hint. It must not query the protected `users`
collection before authentication. Firebase Authentication account creation is
the authoritative duplicate-email check.

New self-service registrations are created with
`registrationStatus: pending_email_verification`. In production they may
authenticate, but the application routes them only to email verification until
a trusted callable confirms `emailVerified` from Firebase Authentication and
sets the profile to `active`. Beta and local development explicitly disable the
gate; their trusted callable may activate the profile without writing a false
verification timestamp. Clients and account managers cannot change
`registrationStatus`, `registrationMode`, or `emailVerifiedAt` directly.
Existing profiles without a registration status remain active for compatibility
and may verify voluntarily in production from Profile. Maintley does not
automatically delete unverified accounts.

Authorization answers:

> What may this user access?

Subscription answers:

> Which platform capabilities are available?

A user may:

* Be authenticated
* Have access to an account
* Lack access to specific resources

or

* Have access to resources
* Lack access to premium features

Permissions should determine resource access, not subscription value.

---

# Permission Layers

Permissions are enforced in three locations.

## UI Capability Checks

Purpose:

Improve usability.

Examples:

* Hide buttons
* Disable actions
* Hide restricted navigation

UI checks should never be considered authoritative security controls.

---

## Firestore Rules

Purpose:

Protect data access.

Examples:

* Read permissions
* Write permissions
* Resource ownership
* Account membership validation

Firestore Rules are an authoritative security boundary.

---

## Firebase Storage Rules

Purpose:

Protect file objects that support property documents, equipment records,
maintenance records, team member profiles, user profile images, and feedback
attachments.

Storage authorization should mirror the Firestore metadata owner wherever
possible.

Rules:

* Read access may be granted to authorized account or property readers.
* Create, update, and delete access should require the corresponding management
  permission.
* Read-only account or property access should not allow file upload or deletion.
* User profile image writes are limited to the owning user.
* Feedback attachments are function-owned and cannot be written directly by the
  client.

This prevents files from being uploaded or deleted when the matching Firestore
metadata write would be denied.

---

## Cloud Functions

Purpose:

Protect privileged operations.

Examples:

* Invitation workflows
* Account management
* Billing workflows
* Administrative actions

Cloud Function authorization is an authoritative security boundary.

---

# Permission Hierarchy

Maintley follows this enforcement model:

```text
UI
  ↓
Firestore Rules
  ↓
Cloud Functions
```

The UI may hide actions.

Firestore Rules enforce access.

Cloud Functions enforce privileged operations.

The source of truth is:

* Firestore Rules
* Cloud Function authorization

Never the UI.

---

# Admin Portal Boundary

The `/admin` route is an app-admin workflow and is separate from normal Maintley user authentication.

`maintley_role` is a platform-employment authority field. The `owner` value
means owner of Maintley itself; it never means homeowner, property owner,
landlord, family-account owner, or customer account owner. Customer ownership
continues to use account membership and `isAccountOwner` fields. Clients cannot
create or modify `maintley_role`; only trusted server or administrative
operations may assign it.

Rules:

* Standard user login should not grant access to admin inbox workflows.
* Admin credentials are validated via Cloud Functions against `admin_users`.
* Admin sessions are function-managed in `admin_sessions`.
* Firestore client access to `admin_users` and `admin_sessions` is denied in rules.
* Admin audit log viewing is restricted to top-level Maintley roles and enforced in Cloud Functions.

This keeps admin access isolated from customer account roles and prevents UI-only protection from becoming a security dependency.

## Internal entitlement-grant administration

Internal access grants use a narrower authority than general admin-portal
access. A Maintley administrator must hold the server-managed
`entitlement_grants.manage` permission (or its legacy
`entitlement_grant_manager` role token) before previewing or changing grants.

`maintley_role: owner` is the sole exception. It means the owner of Maintley,
is unrestricted by the grant-management permission, may use owner-only grant
programs, and may grant access to the owner's own Maintley account. No customer
role—including homeowner, property owner, landlord, or account owner—receives
this exception.

All other Maintley administrators are prohibited from granting access to their
own identity or family account, including indirectly targeting another user in
that same account. Grant programs, bundles, kinds, and durations remain
server-allowlisted for every actor. Every successful mutation requires preview,
typed confirmation, a reason, and a stable request ID, and is written to the
immutable admin audit trail.

## Maintley Team administration

The admin portal exposes a `Maintley Team` surface only to authenticated
Maintley Owner and Admin roles. This is employment authority and must never be
derived from a customer's homeowner, property-owner, account-owner, landlord,
or property-management role.

* Maintley Owner may invite and manage Owner, Admin, Support, and Operations
  roles.
* Maintley Admin may invite and manage Support and Operations roles, but cannot
  create, modify, revoke, or demote Owner or Admin authority.
* Non-owner administrators cannot change their own Maintley role.
* The final Maintley Owner cannot be revoked.
* New team identities receive a Firebase-managed password-setup link; an
  administrator never selects another person's password.
* A new team identity receives a normal, empty homeowner workspace. Its
  `maintley_role` controls Maintley employment authority only and does not
  pre-populate customer data or assign a customer-level administrator role.
* Invitations, updates, and revocations write immutable before/after audit
  records with actor, target, reason, request ID, and role metadata.

Support and Operations are employment classifications and do not independently
grant access to the admin portal. Additional portal permissions remain an
explicit, server-managed decision.

## Internal manual and warranty scan testing

General Property Knowledge Acquisition does not scan documents categorized as
manuals or warranties. A Maintley Owner or Maintley Admin who also has normal
access to the property may explicitly test the restricted scan path from the
customer application. The Cloud Function verifies the server-managed
`maintley_role`; customer account ownership, property ownership, and customer
administrator roles do not grant this override. The override does not bypass
plan entitlements, produces reviewable suggestions only, and records the
internal actor and role in acquisition event metadata.

## User activity timestamps

`lastActiveAt` records customer application activity, not administrator
inspection. The authenticated app requests a throttled heartbeat that writes
only to the caller's own user document with a server timestamp. The callable
accepts no target user identifier, so viewing or troubleshooting another user
cannot update the inspected customer's activity.

---

# Authentication vs Authorization

Firebase Authentication provides:

```text
request.auth.uid
```

Authentication identifies users.

Authorization is determined through:

* Account membership
* Roles
* Property assignments
* Firestore Rules
* Cloud Function checks

Authentication alone does not grant access to Maintley resources.

---

# Account Scope

Maintley uses an account-centric authorization model.

Primary hierarchy:

```text
User
  ↓
Account Membership
  ↓
Account
  ↓
Properties
```

Preferred membership record:

```text
accountMemberships/{accountId}_{uid}
```

Important fields:

* accountId
* userId
* roles
* status

Active membership is required for account-scoped access unless a legacy compatibility path applies.
For legacy membership records, a missing membership `status` is treated as active
by both Firestore and Storage rules; explicit disabled or inactive statuses should
continue to deny access.

See FIREBASE_STRUCTURE.md for detailed account architecture.

---

# Property Assignment Philosophy

Portfolio and team workflows may further restrict access through property assignments.

Preferred model:

```text
Account Access
  ↓
Property Assignment
  ↓
Resource Visibility
```

Examples:

```text
Portfolio User
  ↓
Assigned Property
  ↓
Task Access
```

```text
Portfolio User
  ↓
Assigned Property
  ↓
Maintenance History Access
```

Property assignment should reduce visibility before restricting actions whenever possible.

Client data slices resolve account and property assignment through:

```text
src/Redux/API/accountContext.ts
```

`resolveAccountAccessContext` is the shared normalization boundary for account
IDs, the effective account, team-member scope, assigned property IDs, and role
capabilities. Property, Task, Equipment, Contractor, Unit, and Maintenance
queries use this context instead of independently resolving team membership.
Firestore and Storage Rules remain authoritative; the client context prevents
inconsistent visibility and unnecessary unauthorized queries.

Legacy account-link fallbacks remain inside the shared resolver until migration
inventory and parity validation show they can be removed safely. New data
slices must not call the lower-level accessible-account helper directly or
recreate team-member lookup logic.

---

# UI Roles

Defined in:

```text
src/constants/roles.ts
```

Current roles:

* admin
* property_manager
* assistant_manager
* maintenance_lead
* maintenance
* accounting
* leasing
* contractor
* tenant
* property_guest

Role display helpers and capability helpers live in:

```text
src/utils/permissions.ts
```

---

# Role Capability Model

## Administrative Roles

Roles:

* admin
* property_manager
* assistant_manager

Typical capabilities:

* Manage properties
* Manage tasks
* Manage maintenance history
* Manage equipment & systems
* Manage contractors
* Manage tenants
* Manage team members
* Manage financial information

---

## Maintenance Roles

Roles:

* maintenance_lead
* maintenance

Typical capabilities:

* Create tasks
* Complete tasks
* Manage maintenance history
* Manage equipment & systems
* Manage contractors

Typically restricted:

* Team management
* Account management
* Billing management

---

## Leasing Roles

Role:

* leasing

Typical capabilities:

* Manage tenants
* Submit maintenance requests
* Manage contractor relationships

Typically restricted:

* Maintenance operations
* Team administration

---

## Accounting Roles

Role:

* accounting

Typical capabilities:

* Financial visibility
* Financial management

Generally more view-oriented outside financial workflows.

---

## Restricted Roles

Roles:

* tenant
* contractor
* property_guest

Typical capabilities:

* Submit maintenance requests
* Limited property visibility
* Restricted access to account resources

---

# Full vs Limited Access

## Full Access Roles

* admin
* property_manager
* assistant_manager
* maintenance_lead

These roles generally operate across assigned account resources.

---

## Limited Access Roles

* maintenance
* accounting
* leasing
* contractor
* tenant
* property_guest

These roles should be restricted by:

* Property assignment
* Workflow responsibility
* Account context

---

# Subscription Integration

Permissions and subscriptions are related but independent.

Permissions determine:

* Access
* Visibility
* Resource ownership

Subscriptions determine:

* Limits
* Feature availability
* Plan capabilities

Plan definitions are maintained in:

* MAINTLEY_PLAN_FEATURE_MATRIX.md
* BILLING.md

Permissions should consume plan definitions rather than duplicate them.

---

# Firestore Rule Model

Live rules are maintained in:

```text
firestore.rules
```

Important helper concepts:

* isAuthenticated()
* isOwner(userId)
* callerMembershipId(accountId)
* hasMembership(accountId)
* membershipData(accountId)
* hasLegacyAccountLink(accountId)
* hasLegacyManageRole(accountId)
* isActiveMember(accountId)
* hasAnyRole(accountId, roles)
* canReadAccount(accountId)
* canManageAccount(accountId)

---

## Account Reading

```text
canReadAccount(accountId)
```

Allows:

* Active account members
* Legacy-linked users

Used to protect account-scoped resources.

---

## Account Management

```text
canManageAccount(accountId)
```

Allows:

* account_owner
* admin
* manager

Includes legacy compatibility paths where required.

Used to protect account-management operations.

---

# Collection-Level Permissions

## users

Read:

* Own user document

Update:

* Own user document
* Limited managed profile fields by authorized account managers

Delete:

* Own user document

---

## properties

Read:

* Account readers

Create:

* Account managers

Update:

* Authorized server processes only

Delete:

* Authorized server processes only

Canonical event corrections and deletions use callable functions that write an
immutable revision in the same batch.

---

## propertySpaces

Read:

* Account readers through an account- and property-scoped query

Create and update:

* Account managers

Remove and restore:

* Account managers through a trusted callable

Create and update rules validate that the referenced Property exists in the
same account, validate the Space field contract, keep `accountId`,
`propertyId`, creation attribution, and source immutable, and require the
referenced Property to exist within the same account. Spaces do not create a
separate permission boundary.

Generated Space creation discovers an existing `generationKey` through the
same authorized account- and property-scoped query used by the Space reader,
then writes the deterministic document id when no match exists. It does not
read a missing deterministic document directly because a nonexistent resource
has no account fields with which the rules can authorize that read. A
concurrent-create retry reuses only a matching Space visible through the scoped
query; Firestore read permissions are not broadened for idempotency.

The removal callable deletes an unreferenced Space and archives a referenced
Space. The restore callable reactivates an archived Space within the same
account boundary. Direct client deletion is denied.

---

## propertyKnowledgeLinks

Read:

* Account readers

Create, update, delete:

* Authorized server processes only

Trusted relationship writes support Equipment `located_in` Space for account
managers and Task `occurs_in` Space for users with task-management permission.
Each callable validates that the Property, source record, and Space share the
same account and property boundary and rejects new links to archived Spaces.
Recurring Task generation may copy already accepted Task-to-Space links through
the trusted writer. Task deletion removes its outgoing links.

Account managers may replace one-level Equipment `part_of` Equipment links.
The trusted callable validates both Equipment records against the same account
and Property, permits only one primary connection per physical record, and
rejects self-reference, recursive nesting, and combined Equipment as an
attached record. Direct relationship writes remain denied.

Trusted Supply relationship writes support Equipment, Space, or Task `uses`
Supply for account managers. The callable validates the Property, Supply, and
every selected endpoint against the same account and property and rejects new
links to archived Supplies or Spaces.

Trusted Document relationship writes support Document `documents` Equipment,
Space, Task, or Supply for account managers. The callable validates the
first-class or compatible embedded Document and every selected endpoint against
the same account and Property. Existing archived Space or Supply connections
may be preserved during editing, but new connections to archived records are
rejected. Direct client writes remain denied.

---

## propertyDocuments

Read:

* Account readers through an account- and property-scoped query

Create, update, delete:

* Account managers

Rules validate that the referenced Property belongs to the same account and
keep `accountId` and `propertyId` immutable after creation. Property Manager and
Assistant Manager roles use the same Property Knowledge capability exposed by
the Document UI. Relationship records remain function-owned even when the user
may edit Document metadata.

---

## propertySupplies

Read:

* Account readers through an account- and property-scoped query

Create and update:

* Account managers

Remove and restore:

* Account managers through a trusted callable

Rules validate the Supply field contract, immutable ownership and creation
fields, and the referenced Property account. The removal callable deletes an
unreferenced Supply and archives a referenced Supply. Direct client deletion is
denied.

Supply access is not a premium-plan boundary. Every active plan may use the
Property Supplies page and barcode capture. Account role capabilities determine
whether the signed-in user may change records or connections; account readers
retain visibility.

---

## maintenanceEventRevisions

Read:

* Account readers

Create, update, delete:

* Authorized server processes only

Revisions contain correction metadata and changed field names, not copies of
previous field values.

Subscription limits are enforced separately.

---

## devices

Read:

* Account readers

Create:

* Account managers

Update:

* Authorized server processes only

Delete:

* Authorized server processes only

Authenticated account managers initiate corrections through callable
functions. The server validates account and property scope, writes the event
change, and appends an immutable revision atomically. Delete requests require a
reason and mark the event deleted without erasing its historical record.

Subscription limits are enforced separately.

---

## tasks

Read:

* Account readers

Create:

* Account managers
* Maintenance roles with task management access

Update:

* Account managers
* Maintenance roles with task management access

Delete:

* Account managers

Maintenance roles with task management access include `maintenance_lead` and
`maintenance`. Deletes remain limited to account managers.

Task authorization resolves the account scope from `accountId`. Legacy task
records that still only have `userId` may be updated when `userId` resolves to
the same account scope; updates should backfill `accountId` rather than preserve
the legacy-only shape.

---

## maintenanceEvents

Read:

* Account readers

Create:

* Authorized server processes only

Clients must use the Maintenance Event callable functions. This ensures
`recordedBy`, `recordedAt`, account scope, and creation timestamps are derived
from authenticated server context and cannot be forged.

Update:

* Account managers
* After downgrade, account managers may still update retained profile, contact,
  notes, and file fields; access, roles, groups, and property assignments cannot
  be expanded through this compatibility path.

Delete:

* Account managers
* Removal and login-access revocation remain available after downgrade because
  they reduce access rather than expand plan capabilities.

---

## maintenanceHistory

Legacy compatibility collection.

Read:

* Account readers

Write:

* Account managers

Migration efforts should favor maintenanceEvents.

---

## teamMembers

Read:

* Account readers

Create:

* Account managers

Update:

* Account managers

Delete:

* Account managers

---

## teamGroups

Read:

* Account readers

Create:

* Account managers

Update:

* Account managers

Delete:

* Account managers

---

## familyAccounts

Read:

* Account readers

Update:

* Account managers
* Restricted counter updates

Create/Delete:

* Managed by controlled workflows

### entitlementGrants

Path:

```text
familyAccounts/{accountId}/entitlementGrants/{grantId}
```

Read, create, update, delete:

* Cloud Functions and Admin SDK only

Clients cannot read or write authoritative grant records. Effective access is
resolved by trusted code. Customer-facing access summaries use the constrained
`familyAccounts.effectiveEntitlementProjection`, which clients may read through
normal account access but cannot create or modify. Grant issuance, eligibility,
program consumption, and audit events remain server-only.

### accessLifecycleDeliveries

Path:

```text
familyAccounts/{accountId}/accessLifecycleDeliveries/{deliveryId}
```

Read, create, update, delete:

* Cloud Functions and Admin SDK only

The admin customer troubleshooting callable may return a minimized operational
timeline to authenticated Maintley staff. Direct client access is denied. The
test-send callable is also restricted by the server-managed `maintley_role` and
does not write production delivery markers.

---

## accountMemberships

Read:

* Membership owner
* Authorized account administrators

Create/Update/Delete:

* Cloud Functions
* Admin SDK

Direct client modification is not allowed.

---

## notifications

Read:

* Recipient

Create:

* Recipient
* Authorized server processes

Update:

* Recipient

Delete:

* Recipient

---

## tenantInvitationCodes

Read:

* Authorized account users

Write:

* Cloud Functions
* Admin SDK

---

## teamMemberInvitationCodes

Read:

* Authorized account users

Write:

* Cloud Functions
* Admin SDK

---

## tenantProfiles

Read:

* Account readers
* Associated tenant

Create:

* Account managers

Update:

* Account managers

Delete:

* Account managers

---

## contractors

Read:

* Account readers

Create:

* Account managers

Update:

* Account managers

Delete:

* Account managers

---

## favorites

Read:

* Owning user

Create:

* Owning user

Delete:

* Owning user

---

## appConfig

Read:

* Authenticated users

Write:

* Denied from client

---

# Cloud Function Authorization

Shared authorization helpers:

```text
functions/accountAuthz.ts
```

Important helpers:

* resolveAccountIdForUser(uid)
* getMembership(accountId, uid)
* hasAnyRole(membership, roles)
* assertAccountRole(uid, accountId, roles)

Cloud Functions should use shared authorization helpers whenever possible.

---

# Protected Workflows

Typical protected workflows include:

* Family account management
* Family invitations
* Team invitations
* Tenant invitations
* Maintenance event creation
* Account deletion
* Billing operations
* Subscription management

These workflows should never rely solely on client-side authorization.

After the trusted account-deletion workflow succeeds, the client treats the
account as deleted even if its final Firebase sign-out request fails. Maintley
clears account-scoped client state, ends the local authenticated session, and
resolves authentication loading before routing away. Web users return to the
public landing page with a deletion confirmation. Native users continue through
the existing root-route welcome and sign-in experience.

The callable builds a deletion manifest before mutation, commits Firestore
writes in batches below the platform limit, and deletes documented user-,
account-, and Property-scoped Storage prefixes. It verifies that every managed
Firestore target and Storage prefix is clear before deleting the Firebase Auth
user. A verification failure preserves the Auth record and reports failure for
support follow-up; partial Firestore or Storage cleanup is never presented as a
completed deletion.

The resumable manifest context is stored in server-only
`accountDeletionJobs/{userId}`. Clients cannot read or write deletion jobs, and
the job is removed only after the Auth user is deleted successfully.

---

# Team Member Rules

Team member accounts are invitation-based linked users.

Expected behavior:

* Access assigned properties
* Operate within assigned role
* Do not manage subscriptions
* Do not manage billing
* Do not own account resources

Account administrators manage:

* Roles
* Property assignments
* Profile information
* Access revocation

---

# Tenant Rules

Tenant accounts are invitation-based and property-scoped.

Expected behavior:

* View tenant-related experiences
* Submit maintenance requests
* Access assigned property information where permitted

Tenants should not manage:

* Account resources
* Billing
* Team structures
* Administrative settings

---

# Current Limitations

Known areas of technical debt include:

* UI role capabilities remain more granular than some Firestore rule implementations.
* Legacy sharing structures coexist with the account membership model.
* Some userId-based ownership paths remain for compatibility.
* Units and suites remain supported in portions of the backend while hidden from active user workflows.

These limitations should not be treated as desired architecture.

Future work should continue consolidating authorization around:

* accountMemberships
* account-scoped ownership
* property-scoped visibility
* shared authorization helpers

---

# Guiding Principles

Maintley permissions should remain:

* Account-centric
* Property-aware
* Role-driven
* Server-enforced

Authorization should always be enforced through Firestore Rules and Cloud Functions.

The UI should improve usability but should never be treated as a security boundary.

When permissions and subscriptions intersect:

* Permissions determine access.
* Subscriptions determine capabilities.

These responsibilities should remain separate.

# Personal assistant credentials

Personal-assistant setup requires the server-managed Maintley Owner role; customer account ownership does not grant access. Credential, rate-limit, and API audit collections deny all direct client reads and writes. Only the Owner-gated callable manages credentials, and every API request is independently constrained by its stored property allowlist and read scopes.
