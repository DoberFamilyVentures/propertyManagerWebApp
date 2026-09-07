# Data Model

Last reviewed: 2026-06

## Purpose

This document describes the Firestore-facing data model used by Maintley.

It serves as the source of truth for:

* Collection structures
* Document relationships
* Persisted field definitions
* Ownership boundaries
* Resource hierarchy

TypeScript interfaces remain the best field-level reference for client-facing object shapes.

---

## Data Model Philosophy

This document describes persisted data structures and collection relationships.

It should answer:

* What collections exist?
* What fields exist?
* How collections relate to one another?
* What data is considered authoritative?

This document should not define:

* Product behavior
* Feature availability
* Recommendation logic
* Navigation structure
* User-facing workflows
* Subscription plan capabilities

Those topics belong in product documentation.

The collections described here represent Maintley's source-of-truth data model.

---

## Conventions

* Most timestamps are ISO strings in client-created records.
* Some records may contain Firestore `Timestamp` values from older or server-created data; `docToData` in `src/Redux/API/apiSlice.ts` sanitizes those to ISO strings for RTK Query responses.
* Newer account-scoped records use `accountId`.
* Older records and some compatibility paths still use `userId`.
* `id` is generally the Firestore document id, even when a document also stores an `id` field.
* Undefined values are stripped in several server-side paths before Firestore writes.

---

## Core Relationships

Maintley is organized around properties.

Primary hierarchy:

Account
└── Properties
├── Equipment
├── Tasks
├── Maintenance Events
├── Contractors
├── Files & Documentation
├── Tenants
└── Team Assignments

### Relationship Overview

Properties serve as the primary organizational object.

Equipment belongs to properties.

Tasks belong to properties and may optionally reference one or more equipment records.

Maintenance Events may reference:

* Properties
* Tasks
* Equipment
* Contractors

Contractors may be associated with one or more properties.

Team members may be assigned access to one or more properties.

Property access fields such as `coOwners`, `administrators`, and `viewers`
store user IDs for access checks. Property records may also store
`accessSnapshots`, keyed by user ID, with display name, email, and source. These
snapshots preserve readable property access labels when family or team member
records are unavailable or change later.

Notifications are generated from changes within these records.

---

### Global vs Property Views

Maintley may expose information through:

* Property-centric views
* Global portfolio views

These are presentation concerns only.

The underlying data model remains property-centered regardless of navigation structure.

---

## Derived Models

Certain platform capabilities are generated from persisted data rather than acting as primary collections.

Examples include:

* Maintley Intelligence
* Recommendations
* Setup Progress
* Maintley Intelligence summaries
* Dashboard Insights
* Attention Center summaries

These concepts should be treated as derived views of existing records.

Source records remain:

* Properties
* Equipment
* Tasks
* Maintenance Events
* Contractors
* Files & Documentation

Derived features may cache results for performance purposes, but the underlying source of truth should remain the core collections.

### Recommendation Data

Recommendations are expected to be generated from:

* Equipment Profiles
* Existing equipment metadata
* Maintenance history
* Task history
* Documentation availability

Recommendations exist to guide users toward improving records rather than replacing those records.

Recommendation data should not become the authoritative source of property information.

---

## Core Collections

Maintley is built around a small number of authoritative collections.

These collections represent the primary source of truth for platform data.

Core collections include:

* familyAccounts
* accountMemberships
* properties
* propertySpaces
* propertySupplies
* propertyKnowledgeLinks
* serviceWorkRequests
* workRequestReports
* workRequestEvents
* workRequestShares
* devices
* tasks
* maintenanceEvents
* maintenanceEventRevisions
* contractors
* tenantProfiles
* teamMembers
* notifications
* favorites

Additional collections may exist for operational, billing, invitation, and compatibility purposes.

`accountDeletionJobs/{userId}` is a server-only operational recovery record for
self-service deletion. It stores only deletion state, account and Property IDs,
and aggregate operation counts needed to resume a partially completed cleanup.
It is removed after managed Firestore and Storage verification and Firebase Auth
deletion succeed.

---

# Account Model

Maintley uses an account-centric ownership model.

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

Users may belong to one or more accounts.

Accounts own properties and associated records.

Properties remain the primary organizational object throughout the platform.

## User Preferences

User records may store lightweight presentation preferences.

Typical fields:

* dashboardPreferences.scope

Supported values:

```text
my_focus
all_visible_properties
```

Purpose:

Controls Dashboard presentation for the current user. This preference does not
change account permissions, property ownership, task assignment, or source
records.

---

## familyAccounts

Represents an account.

Examples:

* Homeowner account
* Family account
* Property management account

Typical fields:

* id
* name
* ownerId
* createdAt
* updatedAt
* subscriptionStatus
* subscriptionPlan
* entitlementPrograms
* effectiveEntitlementProjection

Purpose:

Defines ownership boundaries for all account-scoped resources.

### entitlementGrants subcollection

Reserved path:

```text
familyAccounts/{accountId}/entitlementGrants/{grantId}
```

The shared contract supports temporary and permanent grants with stable grant
and program IDs, lifecycle state, versioned bundle or capability overrides,
authoritative timestamps, source, idempotency, beneficiary, and audit metadata.
Grants belong to the family account and are additive.

This collection is server-written and client-inaccessible. The first persisted
program is `homeowner_plus_first_property_trial_v1`. Eligible new Free owner
accounts receive its deterministic temporary grant only after the first
property commit. The account stores a constrained, server-written
`effectiveEntitlementProjection` for client capability resolution; that
projection is derived and never becomes independent authority.

Trial eligibility is stored under `entitlementPrograms` when the family account
is first created. Issuance records the program as consumed, so trigger retries,
duplicate property events, profile recreation, and later property creation
cannot restart the program.

Approved admin-grant programs use the same generic documents. Create, extend,
and revoke operations are server-only, request-idempotent, and rebuild the
derived account projection in the same transaction. The admin interface does
not accept arbitrary bundles or program IDs. Current program IDs cover support,
beta, legacy-outreach, and Maintley-owner-only lifetime Homeowner+ access.
Permanent lifetime access is not a Stripe subscription and does not establish a
billing relationship.

Grant decisions are recorded separately in `admin_audit_logs` with actor,
target account and user, grant and program IDs, request ID, reason,
before-and-after state, and policy metadata. The audit record is append-only;
lower-level resolver execution remains in operational logs.

### accessLifecycleDeliveries subcollection

Reserved path:

```text
familyAccounts/{accountId}/accessLifecycleDeliveries/{deliveryId}
```

Stores server-written operational evidence for access lifecycle messages. The
deterministic delivery ID includes program, grant, milestone, and template
version. Typical fields include `accountId`, `grantId`, `programId`,
`milestone`, `templateVersion`, `targetAtMs`, `status`, `outcome`, `attempts`,
lease timestamps, recipient, provider message ID, rendered time zone, and
terminal timestamps.

This is not customer activity history and is not the immutable administrative
decision audit. Clients cannot read or write these records. Admin
troubleshooting may expose a minimized delivery timeline through a trusted
callable without exposing message content.

---

## accountMemberships

Represents user access to an account.

Typical fields:

* accountId
* userId
* roles
* status
* createdAt

Purpose:

Controls account-level access and permissions.

Preferred ownership model:

```text
Account
    ↓
Membership
    ↓
User
```

This model replaces older userId ownership patterns over time.

---

# Property Model

Properties are the primary organizational record in Maintley.

Properties provide context for:

* Spaces
* Equipment
* Tasks
* Maintenance Events
* Contractors
* Documentation
* Recommendations

Properties should remain the central organizing object throughout the platform.

---

## properties

Represents a property record.

Examples:

* Primary Residence
* Rental Property
* Vacation Home

Typical fields:

* id
* accountId
* name
* address
* addressDetails
* propertyType
* propertyClassification
* photoUrl
* notes
* createdAt
* updatedAt

`address` remains the formatted, display-ready address used by existing views,
exports, document matching, and older records. New or edited addresses may also
store `addressDetails` with `streetAddress`, optional `unit`, `city`, two-letter
`state`, `postalCode`, and `countryCode`. Maintley derives the formatted
`address` from these structured fields. Older records that only contain
`address` remain valid and are not automatically rewritten from guessed
components.

Optional fields may include:

* squareFootage
* yearBuilt
* lotSize
* utility information
* occupancy information

Properties should store descriptive information rather than operational history.

`propertyType` uses the canonical values `residential`, `multi_unit`, and
`commercial`. `propertyClassification` refines the physical form within that
broad type. `isRental` is independent behavioral state and is not inferred from
either taxonomy field. Legacy values are normalized at application boundaries;
the ADR 0033 migration writes canonical values without guessing an unknown
Multi-unit or Commercial classification.

Operational history belongs in Maintenance Events.

## propertySpaces

Represents a descriptive physical place within one property. Spaces are
independent property-owned records and do not create tenancy, access, billing,
door-count, or Unit boundaries.

Required fields:

* accountId
* propertyId
* name
* type
* isArchived
* source
* createdBy
* updatedBy
* createdAt
* updatedAt

Optional fields:

* notes
* sortOrder
* generationKey, stable key for a reviewed generated Space

Supported `type` values:

```text
interior
utility
storage
exterior
grounds
amenity
other
```

`name` remains flexible and homeowner-readable. Examples include Living Room,
Garage, Mechanical Room, Roof, Lawn, and Pool. `sortOrder` provides stable
display ordering without making ordering part of ownership. `isArchived`
allows a future linked Space to remain available after removal from ordinary
views.

Residential Property creation and later profile edits may create reviewed,
repeat-safe generated Spaces for each Bedroom, full Bathroom, and Half
Bathroom. Every save checks current active and archived Spaces before creating
missing records. Setup may create or reuse Kitchen,
Bathroom, Laundry Room, Garage, and Exterior Spaces before connecting accepted
Equipment and Tasks. Generation is idempotent: `generationKey` is checked
first, followed by a property-wide normalized name match. An explicit
user-created Space keeps its selected type and is reused instead of generating
a duplicate with the same name. Archived matches require review and are
neither restored nor duplicated automatically. Utility Systems and Safety
records do not infer Spaces.

A user who explicitly adds a Space from inside Setup creates an ordinary
`manual` Space without a `generationKey`. The Setup context may connect that
record immediately, but it does not convert an explicit user record into a
generated Space.

Setup progress may retain an `instances` array for a Present item. Each draft
instance has a stable setup ID, homeowner-readable name, optional Equipment
`deviceId`, optional `assetVariant`, and optional accepted `spaceIds`. The
legacy item-level `deviceId` remains as a compatibility pointer to the first
instance. Instance preparation is not a competing Equipment model: after save,
the `devices` record is authoritative and every Equipment `located_in` Space
connection is stored in `propertyKnowledgeLinks`.

Several physical assets of the same type are represented by several Equipment
records. This is especially important for distributed safety devices. One
Equipment record may connect to several Spaces only when it represents one
physical system associated with those Spaces. Setup-generated Tasks may connect
to the combined accepted Spaces and Equipment records for the reviewed item.
Independent physical Equipment may also be presented through one combined
Equipment record under ADR 0039. The physical records remain Property-owned;
their one-level relationship is derived from canonical `part_of` links rather
than embedded Equipment IDs.

Spaces are stored in the top-level `propertySpaces` collection. Firestore rules
validate that the referenced Property exists and carries the same `accountId`.
Account readers may view Spaces; account managers may create and edit them.
Space removal uses a trusted callable: unreferenced Spaces are deleted, while
referenced Spaces are archived so accepted relationships remain resolvable.
Account managers can review and restore archived Spaces through a trusted
restore action.

Existing task location text and equipment `unitId` or `suiteId` fields remain
temporary compatibility fields. The Task field is deprecated and hidden from
current forms, cards, search, and filters; new manual Task writes omit it.
Stored legacy values remain readable by compatibility and historical paths.
Accepted Equipment-to-Space and Task-to-Space locations use canonical
relationship records.

The Space overview is derived rather than stored. It resolves connected
Equipment, Tasks, Supplies, and Documents from `propertyKnowledgeLinks` and
legacy-compatible Document readers. Recent Maintenance History is shown only
when a record explicitly references Equipment or a Task connected to that
Space, or when a future canonical Maintenance Event-to-Space relationship
exists. Counts, next-work labels, overdue state, and presentation icons are not
persisted on `propertySpaces`.

## propertySupplies

Represents a material, part, consumable, or product specification used by one
property. Supplies are property knowledge rather than inventory records.

Required fields:

* accountId
* propertyId
* name
* type
* isArchived
* source
* createdBy
* updatedBy
* createdAt
* updatedAt

Optional fields:

* manufacturer
* modelOrSku
* barcodeValue
* partNumber
* size
* details
* material
* voltage
* mervRating
* compatibility
* replacementInterval
* notes

Supported `type` values:

```text
filter
paint_and_finish
lawn_and_garden
pool_and_spa
electrical
plumbing
hardware
cleaning
other
```

Supplies are stored in the top-level `propertySupplies` collection. Firestore
rules validate that the referenced Property belongs to the same account.
Account readers may view Supplies; account managers may create and edit them.
The first-class Property Supplies page is available on every active plan and
includes reviewed barcode capture. A scan first checks the Property for an
existing barcode, part number, or SKU before prefilling a new record. Barcode
capture does not silently create property knowledge.
Removal uses a trusted callable: unreferenced Supplies are deleted, while
referenced Supplies are archived so their accepted context remains available.
Archived Supplies may be restored by account managers.

Equipment, Spaces, and Tasks connect to Supplies through canonical `uses`
relationships. These many-to-many connections are stored only in
`propertyKnowledgeLinks`; inverse lists shown on a Supply are derived.
Equipment pages show this derived connected set and do not write embedded
Supply records. Legacy `device.serviceItems` arrays are temporary read-only
compatibility fields. A dry-run-first migration creates canonical Supplies and
deterministic Equipment `uses` links while preserving the embedded source data
until validation is complete.

Equipment create and edit experiences may stage reviewed Supply drafts and
existing Supply connections. The Equipment record is saved first; new Supplies
then become Property-owned records and canonical relationships are applied
without replacing the Supply's other accepted endpoint relationships.

## propertyKnowledgeLinks

Represents one accepted connection between independent property-owned records.
The first supported relationships are:

* Equipment `located_in` Space
* Task `occurs_in` Space
* Equipment, Space, or Task `uses` Supply
* Document `documents` Equipment, Space, Task, or Supply
* Physical Equipment `part_of` combined Equipment

Required fields:

* accountId
* propertyId
* fromType (`equipment`, `space`, `task`, or `document`, constrained by the relationship)
* fromId
* relationshipType (`located_in`, `occurs_in`, `uses`, `documents`, or `part_of`)
* toType (`equipment`, `space`, `task`, or `supply`, constrained by the relationship)
* toId
* source (`manual` or `migration` for an explicitly reviewed backfill)
* createdAt
* createdBy
* updatedAt
* updatedBy

Links are stored in the top-level `propertyKnowledgeLinks` collection. The
document ID is deterministic for the property, relationship type, and both
endpoints. Account readers may read links. Direct client writes are denied;
trusted callable functions validate the Property, source record, Space,
account boundary, archived state, and required role before replacing links.
Account managers connect Equipment and manage Supply connections; users with
task-management permission connect Tasks to Spaces. Inverse Space and Supply
lists are derived from these records rather than stored separately.

Task links are many-to-many. A dry-run-first migration may link a legacy Task
location only when it exactly and uniquely matches one active Space in the same
account and Property. It does not clear the legacy field, infer partial matches,
or choose between duplicate names. A new recurring Task inherits accepted Space
links from the Task that generated it. Deleting a Task removes its outgoing
relationship records.

Equipment `part_of` links are one-level and always connect a physical Equipment
record to a combined Equipment record in the same account and Property. An
Equipment record may be attached to only one combined record. Self-reference,
recursive nesting, attaching a combined record, and cross-Property links are
rejected by the trusted callable. Removing the link returns the physical record
to ordinary standalone presentation without deleting its history.

Document links are many-to-many and always originate from a first-class
Property Document. Account managers replace the accepted Equipment, Space,
Task, and Supply connections through a trusted callable that validates every
endpoint against the same account and Property. Contextual screens derive their
Document lists from these records. A compatibility adapter also recognizes
legacy Document arrays and singular assignment fields until backfill is
complete. Deleting a Document removes its canonical links; deleting an
Equipment or Task removes links to that endpoint. Referenced Spaces and Supplies
are archived rather than deleted.

Maintley Intelligence may resolve these canonical links as bounded supporting
evidence for an existing finding. Quick Scan and Property Review can explain an
affected Equipment record or Task using its accepted Space, Supply, or Document
connections. This derived evidence is stored only with the Intelligence
snapshot metadata; it does not duplicate relationship authority, generate a
finding on its own, change priority, or accept a proposed relationship.

## Property Groups

Property groups organize existing property records for portfolio navigation.
They do not own or duplicate property data.

Optional presentation fields include:

* description
* sortOrder
* defaultCollapsed
* groupIconKey
* groupIconColor
* groupIconBgColor

These fields control organization and display only. Properties remain the
authoritative records, and group membership continues to reference them.

---

# Equipment Model

Equipment records represent maintainable assets associated with a property.

Examples:

* HVAC Systems
* Water Heaters
* Roofs
* Refrigerators
* Generators
* Water Softeners
* Well Systems
* Pool Equipment

Maintley uses the term:

```text
Equipment
```

for user-facing communication.

The underlying collection currently remains:

```text
devices
```

for compatibility reasons.

Equipment Hub grouping is derived presentation logic. Group names such as
Comfort, Safety, Exterior, Utilities, Appliances, and Other should be inferred
from existing equipment metadata and should not become a competing ownership or
classification model unless a future ADR explicitly introduces one.

---

## devices

Represents a maintainable asset.

Typical fields:

* id
* accountId
* propertyId
* name
* type
* assetType
* assetVariant
* manufacturer
* model
* serialNumber
* installDate
* warrantyExpiration
* notes
* createdAt
* updatedAt

Optional `recordScope` is `physical` or `combined`. Missing values retain
legacy `physical` behavior. A combined record presents related Equipment but
does not own or embed it. Physical records retain their own identity, Space,
status, Documents, Supplies, Tasks, and Maintenance History.

Optional fields may include:

* filterSize
* capacity
* fuelType
* voltage
* location
* photoUrl

Device records should contain descriptive information about the asset itself.

Older Equipment records may contain embedded `serviceItems`. These entries are
read-only compatibility data. Current Equipment forms do not carry or write
the field; new and edited Supply knowledge belongs in `propertySupplies` and
connects to Equipment through canonical `uses` relationships. Compatibility
readers remain until report-only inventory and migration evidence demonstrate
parity.

`type` remains the homeowner-facing display label stored on the device record.

`assetType` stores the canonical asset classification Maintley Intelligence should reason over, such as:

* HVAC
* Water Heater
* Dryer
* Stove/Oven
* Refrigerator
* Safety Device

`assetVariant` stores the more specific pattern when known, such as:

* Furnace
* Tankless Gas
* Tank Electric
* Smoke Detector

Older records may only contain `type`. Those records remain valid and may be backfilled to `assetType` and `assetVariant` when safe inference is available.

Maintenance activity belongs in:

```text
maintenanceEvents
```

---

## Device Relationships

Devices may be associated with:

* Properties
* Tasks
* Maintenance Events
* Files & Documentation
* Recommendations

Relationship example:

```text
Property
    ↓
HVAC System
    ↓
Maintenance Events
```

Devices are expected to accumulate useful information over time.

---

# Task Model

Tasks represent work that should be completed.

Examples:

* Replace HVAC Filter
* Flush Water Heater
* Inspect Roof
* Replace Refrigerator Filter
* Repair Faucet

Tasks focus on future or pending work.

Completed work should ultimately be represented through Maintenance Events.

The Maintenance Profile is the task-centered product surface for understanding
a maintenance activity over time. It is derived from existing task, property,
equipment, document, and Maintenance Event records. It must not create a new
Firestore collection or duplicate historical data simply to power the profile.

---

## tasks

Represents a maintenance activity.

Typical fields:

* id
* accountId
* propertyId
* title
* description
* dueDate
* priority
* status
* recurrence
* assignee
* assignedTo
* createdAt
* updatedAt

Optional fields may include:

* linkedDeviceIds
* contractorId
* notes
* attachments
* estimatedCost
* actualCost

Tasks may exist independently or be associated with one or more devices.

Maintenance Profile views may group task records by origin, linked equipment,
related documents, and linked Maintenance Events. The profile should stay
task-centered and should not duplicate the property or equipment timeline.
Those relationships should be resolved from existing source records and links
whenever possible.
When direct task links are unavailable, profile views may use conservative
same-property maintenance-topic matching, such as connecting `Change HVAC
Filters` to `Replace HVAC Filter`. These inferred relationships should remain
derived, visible, and explainable rather than creating duplicate historical
state.

Task assignment stores both:

* An `assignee` record ID used only as an internal reference.
* An `assignedTo` display snapshot containing the assignee name, optional email,
  and optional assignee type.

The display snapshot should be preserved when a team member, family member, or
contractor loses access so historical and active tasks never expose a raw record
ID in the interface.

Current assignment types may include:

* `user`
* `team_member`
* `family_member`
* `contractor`
* `unknown`

Task assignment options should be resolved through Maintley's shared task
assignment resolver rather than rebuilt independently by each task surface. This
keeps eligible people and contractors consistent across Dashboard, Tasks,
property tasks, device tasks, and mobile task editing.

Recurring-task creation, recurrence schedule edits, and next-occurrence
generation are trusted operations. The server resolves the account's current
`recurring_tasks.use` capability from paid access and authoritative internal
grants, validates the property relationship and recurrence shape, and uses a
stable request ID for idempotent creation. Firestore rules independently reject
active recurrence metadata for an account without current access. A temporary
default-off web rollout flag preserves the previous entitled-user path only
until the callable has been deployed and observed; it is not a permanent second
implementation and must be removed after rollout.

---

# Task Status Model

Task status is intentionally simplified.

Maintley should minimize persisted status values and derive presentation states whenever possible.

---

## Stored Status Values

Preferred stored statuses:

```text
Initiated
Completed
```

These represent actual task state.

---

## Legacy Status Values

Older records may contain:

```text
pending
in_progress
awaiting_approval
rejected
hold
overdue
```

These remain supported for compatibility purposes.

New development should favor simplified status handling.

---

## Derived Display Status

User-facing status may be calculated from:

* stored status
* dueDate
* completion date

Examples:

```text
Initiated
    ↓
Upcoming
```

```text
Initiated
    ↓
Due Soon
```

```text
Initiated + Past Due Date
    ↓
Overdue
```

```text
Completed
    ↓
Completed
```

Overdue should be treated as a derived state rather than a persisted state whenever possible.

---

## Overdue Handling

Maintley treats overdue status as a derived state rather than a primary persisted status.

Preferred model:

Stored Status
    ↓
initiated

Due Date
    ↓
Past Due

Display Status
    ↓
overdue

The due date remains the authoritative source for overdue calculations.

Task timing has three explicit modes:

- `scheduled`: the task has a calendar due date and can become due soon or overdue.
- `asap`: the task has no calendar date but should be addressed as soon as capacity allows.
- `unscheduled`: the task remains visible, but its timing has not been decided and it does not receive date-based reminders.

The optional `scheduleMode` field preserves this distinction. For backward compatibility, an older task with no `scheduleMode` and no due date is interpreted as `asap`, matching the behavior users saw before this field existed. New document-derived recommendations without a stated date default to `unscheduled`; Maintley should not infer urgency from missing information.

New development should avoid persisting:

- overdue

as a primary task status whenever possible.

Instead, overdue presentation should be derived from:

- stored task status
- due date
- completion date

This approach reduces status synchronization issues and simplifies task lifecycle management.

---

## Task Lifecycle

Typical flow:

```text
Task Created
    ↓
Initiated
    ↓
Completed
    ↓
Maintenance Event Created
```

Tasks track planned work.

Maintenance Events preserve historical work.

When a recurring task is completed, Maintley first preserves the completed work
as a Maintenance Event. It then evaluates the account's current recurring-task
access before creating the next `Initiated` task and removing the completed task
from the active task list. Expired access returns `not_entitled`: completion
still succeeds, history remains intact, and no next occurrence is generated.
Other recurrence outcomes are `created`, `not_recurring`,
`invalid_recurrence`, and `failed`. Built-in recurrence options include daily,
weekly, biweekly, monthly, quarterly, and yearly schedules; custom schedules
use an interval and unit.

---

# Maintenance Event Model

Maintenance Events are the historical source of truth for completed maintenance activity.

This is one of the most important collections in Maintley.

Maintenance Events preserve:

* Repairs
* Inspections
* Replacements
* Service Calls
* Completed Tasks
* Historical Documentation

Maintenance Events should remain useful regardless of future changes to tasks, equipment, or recommendations.

---

## maintenanceEvents

Represents completed maintenance activity.

Typical fields:

* id
* accountId
* propertyId
* title
* description
* completedDate
* maintenanceType
* contractorId
* createdAt
* updatedAt
* serviceDate
* recordedBy
* recordedAt
* performedBy
* eventSource

Optional fields may include:

* linkedTaskId
* linkedDeviceIds
* cost
* attachments
* notes

Maintenance Events should be treated as historical records rather than active workflows.

Corrections and removals are function-managed. Removal is a soft deletion so
the historical event and its immutable `maintenanceEventRevisions` audit record
remain available for authorized support and dispute handling.

During the legacy dual-read period, corrections use the same server boundary.
If a visible `maintenanceHistory` record has no canonical event with the same
ID, the server promotes it into `maintenanceEvents` with source provenance and
a creation revision before applying the correction or soft deletion. The
legacy source is retained unchanged for parity review.

---

## Historical Source of Truth

Maintley follows this model:

```text
Task
    ↓
Maintenance Event
```

Tasks represent intended work.

Maintenance Events represent completed work.

Historical reporting should favor Maintenance Events whenever possible.

---

## Legacy Maintenance History

Some portions of the platform still reference:

```text
maintenanceHistory
```

This collection exists for compatibility.

Normal property, equipment, recurring-task, and Quick Log workflows do not
write or rewrite this collection or embedded property/equipment history.
Legacy reads remain temporarily available until migration parity is proven.

Future development should favor:

```text
maintenanceEvents
```

as the canonical maintenance history collection.

---

# Contractor Model

Contractors represent service providers associated with one or more properties.

Examples:

* HVAC Companies
* Electricians
* Plumbers
* Roofers
* Landscapers
* Pest Control Providers

Contractors serve as reference records and historical relationships.

They are not system users.

---

## contractors

Represents a service provider.

Typical fields:

* id
* accountId
* name
* companyName
* email
* phone
* website
* portalUrl
* notes
* createdAt
* updatedAt

Optional fields may include:

* serviceCategories
* preferredVendor
* emergencyContact
* address

Only the company name is required to create a useful contractor record. Contact
person, phone, email, website, customer portal, address, and notes can be added
later as the property record becomes more complete.

Contractors may be associated with:

* Properties
* Tasks
* Maintenance Events

---

## Contractor Relationships

Example:

```text id="8c3o8z"
Property
    ↓
Contractor
    ↓
Maintenance Event
```

Contractor records help preserve service history and contact information over time.

---

# Team Model

Team members represent users who assist with property operations.

Examples:

* Property Managers
* Maintenance Staff
* Administrative Staff
* External Assistants

Team members are authenticated users with account-level access.

---

## teamMembers

Represents a team relationship.

Typical fields:

* id
* accountId
* userId
* role
* status
* createdAt
* updatedAt

Optional fields may include:

* assignedPropertyIds
* teamGroupIds
* notes

Team Members should be linked through:

```text id="y17m4u"
accountMemberships
```

whenever possible.

The teamMembers collection primarily supports operational workflows and compatibility needs.

---

## Team Relationships

Example:

```text id="um7g2m"
Account
    ↓
Team Member
    ↓
Assigned Properties
```

Property assignments may further restrict visibility and workflow access.

---

# Tenant Model

Tenants represent occupants associated with a property.

Tenants are intentionally limited in scope.

Maintley is not intended to be a lease management platform.

Tenant functionality primarily supports maintenance communication.

---

## tenantProfiles

Represents a tenant relationship.

Typical fields:

* id
* accountId
* propertyId
* name
* email
* phone
* status
* createdAt
* updatedAt

Optional fields may include:

* leaseEnd

Tenant records should remain maintenance-focused.

Maintley does not collect or manage tenant-screening, rental-application,
financial, employment, credit, identification, reference, pet, vehicle, or
background-check information. Legacy `tenantProfiles` records are read-only
while tenant relationships are consolidated around basic property access.

---

## Tenant Relationships

Example:

```text id="1c73lq"
Property
    ↓
Tenant
    ↓
Maintenance Requests
```

Tenant records should not become the source of lease, payment, or accounting information.

---

# Service Work Request Model

Service Work Requests are homeowner-controlled, Property-scoped guided intake
records for preparing to contact an outside service professional. They are a
separate domain from resident or tenant `maintenanceRequests`; neither domain
reuses the other's canonical records, lifecycle, recipients, or permissions.

The initial private HVAC pilot reserves four top-level collections:

```text
serviceWorkRequests/{workRequestId}
workRequestReports/{reportVersionId}
workRequestEvents/{eventId}
workRequestShares/{shareId}
```

`serviceWorkRequests` stores the resumable workflow session. Each session is
owned by one account and Property and stores its contract and policy versions,
state, revision, structured answers and observations, safety review, selected
context references, model-usage metadata, and creation/update attribution. It
does not store an unrestricted conversation transcript or copied Property
Memory.

`workRequestEvents` is an append-only domain-event ledger. The initial server
operation writes one `WorkRequestStarted` event atomically with the new session.
Document IDs and the stored idempotency value are one-way server-generated
fingerprints, so caller text does not become an event identifier or payload.
Later accepted transitions may add only the events declared by the versioned
work-request contract.

`workRequestReports` is reserved for immutable, versioned homeowner-reviewed
reports. `workRequestShares` is reserved for expiring, revocable,
minimum-disclosure share records. Neither collection is written by the initial
start operation, and external sharing is not yet enabled.

All four collections are server-written. Account owners may directly read
their session, report, and event records when the record's account and Property
still agree. Share records remain inaccessible to clients because they may hold
credential verifiers and disclosure selections. Property and owner-account
deletion includes all four collections in its managed cleanup.

The first callable, `startServiceWorkRequest`, derives the account from the
authenticated user, requires the account-owner role and an active internal
`service_work_requests.use` capability grant, revalidates Property ownership in
the same transaction, and creates the session plus start event together.
Retries with the same command identity return the existing session without
adding another event. No plan preset enables the pilot capability.

---

# Notification Model

Maintley Events represent meaningful workflow milestones generated by platform activity.

Notifications are delivery records derived from Maintley Events or other
existing workflow changes.

Examples:

* Task reminders
* Maintenance completion alerts
* Team activity
* Tenant requests
* Maintley Intelligence observations
* Property document scan lifecycle updates

---

## maintleyEvents

Represents the lifecycle source record for a meaningful workflow milestone.

Typical fields:

* id
* accountId
* userId
* recipientIds
* propertyId
* relatedDocumentId
* relatedTicketId
* relatedScanId
* type
* workflowKey
* entityKey
* title
* message
* status
* priority
* actionLabel
* actionUrl
* createdAt
* updatedAt
* readAt
* archivedAt
* metadata

`workflowKey` and `entityKey` aggregate one logical workflow into one event
record when practical. Examples include one document review event per document,
one support ticket event per ticket, and one Quick Scan event per scan.

Maintley Events are platform-independent. Consumers decide whether an event
becomes an in-app notification, Android push notification, future web push
notification, future email, Intelligence History item, or activity feed entry.

---

## notifications

Represents an in-app notification delivery record.

Typical fields:

* id
* userId
* accountId
* type
* title
* message
* createdAt
* readAt

Optional fields may include:

* propertyId
* taskId
* maintenanceEventId
* documentId
* actionUrl
* maintleyEventId
* maintleyEventType

Notifications should remain lightweight and user-focused.
For event-backed workflows, notification records should be updated in place
using the event workflow/entity key instead of creating repeated duplicates.

---

## Notification Relationships

Notifications may originate from:

* Tasks
* Maintenance Events
* Team Activity
* Tenant Requests
* Maintley Intelligence
* Property Knowledge Acquisition

Example:

```text id="5ydn2x"
Task Due
    ↓
Notification
```

Notifications are delivery records rather than sources of truth.

The originating record should remain authoritative.
For event-backed workflows, the Maintley Event is the notification lifecycle
source, and the domain record remains the business source of truth.

---

# Favorites Model

Favorites allow users to quickly access frequently used records.

Favorites are user-specific convenience records.

---

## favorites

Represents a user bookmark.

Typical fields:

* id
* userId
* resourceType
* resourceId
* createdAt

Supported resources may include:

* Properties
* Equipment
* Tasks
* Contractors

Favorites should never own business data.

They simply reference existing records.

---

# File & Documentation Model

Files provide supporting documentation for properties and maintenance records.

Examples:

* Manuals
* Warranties
* Receipts
* Photos
* Inspection Reports
* Service Documentation

Files should support records rather than replace them.

---

## File Ownership

Files may be associated with:

* Properties
* Equipment
* Tasks
* Maintenance Events

Example:

```text id="c2kjwq"
Property
    ↓
Water Heater
    ↓
Warranty PDF
```

---

## File Metadata

Typical metadata may include:

* fileName
* contentType
* fileSize
* uploadedBy
* uploadedAt
* storagePath

Actual file content resides in:

```text id="0uwu1w"
Firebase Storage
```

Metadata should remain lightweight and reference-based.

---

# Reporting Model

Reports are generated from existing records.

Reports are derived data rather than authoritative records.

Primary reporting sources:

* Properties
* Equipment
* Tasks
* Maintenance Events
* Contractors

Reports should not introduce new sources of truth.

The underlying records remain authoritative.

---

## Reporting Relationships

Example:

```text id="m2n5f4"
Maintenance Events
    ↓
Report
```

Example:

```text id="udw8h4"
Tasks
    ↓
Report
```

Reports are views of existing data rather than independent datasets.

---

# Property Knowledge Acquisition Model

Property Knowledge Acquisition is a reviewed acquisition layer that sits before Maintley Intelligence.

It turns documents and other sources into suggested structured Property Memory.

Current storage:

* `propertyDocuments/{documentId}`
* `propertyKnowledgeSuggestions/{suggestionId}`
* `properties/{propertyId}.documents`, compatibility mirror during migration
* `properties/{propertyId}.knowledgeSuggestions`, compatibility mirror during migration
* `properties/{propertyId}.propertyKnowledgeProvenance`
* `devices/{deviceId}.propertyKnowledgeProvenance`

Property documents are the canonical source documents for acquisition.

Document records should be property-scoped first-class records and link outward
to the records they support. The embedded property arrays are compatibility
mirrors while older surfaces and triggers finish moving to the collection-backed
model. New workflows should read collection-backed records and merge embedded
records only as a fallback.

Active UI code must cross the shared property-memory adapter before reading an
embedded document or knowledge-suggestion mirror. This keeps the compatibility
fallback explicit and allows collection-backed records to replace it without
another screen-specific migration. Aggregate compatibility metrics that still
use embedded records also call the adapter rather than reading the arrays
directly.

Typical property document fields:

* id
* propertyId
* fileName
* fileUrl
* documentType
* uploadedAt
* uploadedBy
* links
* acquisitionStatus
* acquisitionStartedAt
* acquisitionCompletedAt
* acquisitionError
* extractedKnowledgeSuggestionIds

Typical property knowledge suggestion fields:

* id
* accountId
* propertyId
* sourceDocumentId
* sourceDocumentName
* documentType
* extractionMethod
* status
* confidence
* extractedFields
* suggestedParts
* suggestedTasks
* suggestedEquipment
* visitObservations
* acquisitionDiagnostics
* createdAt
* updatedAt

Document acquisition status values:

* `not_reviewed`
* `processing`
* `pending_review`
* `reviewed`
* `applied`
* `failed`

PDF invoice acquisition is backend processed after the canonical document is
saved. The PDF remains the source document; rendered page images, OCR text, and
other intermediate output are derived processing artifacts only.

`links` may reference:

* assetIds
* taskIds
* spaceIds
* supplyIds
* maintenanceEventIds, reserved for future maintenance-event migration
* contractorIds, reserved for future contractor document links
* warrantyIds, reserved for future warranty document links
* partIds, legacy part or Supply compatibility reference

Property, equipment, task, and task-completion document screens upload documents into the property document record. Explicit contextual uploads and user-reviewed changes may create canonical `documents` relationships to Equipment, Spaces, Tasks, or Supplies. Upload context never changes Document ownership, and inferred connections still require review.

The `links` arrays and legacy singular assignment fields are compatibility
mirrors rather than relationship authority. A dry-run-first migration creates
missing first-class Document records and deterministic canonical relationships,
reports missing or cross-property endpoints, and never removes embedded records
or legacy arrays. Maintenance-event, contractor, warranty, and unresolved part
links should be migrated in a later phase.

Legacy document fields such as `name`, `url`, `category`, `assignedDeviceId`, and `assignedTaskId` may remain during migration.

Knowledge suggestions are review records.

`acquisitionDiagnostics` contains processing metadata only, including parser or
interpreter version and source/candidate counts. It must not contain raw
document text. Source-specific intermediate understanding models are ephemeral
processing artifacts and are not a parallel Property Memory store.

Typical fields:

* sourceDocumentId
* propertyId
* relatedSystemId
* documentType
* extractionMethod
* extractedFields
* confidence
* status
* createdAt
* reviewedAt
* appliedAt

Suggestion status values:

* pending
* accepted
* rejected
* applied

Each extracted field should include:

* fieldKey
* label
* value
* confidence, when available
* targetEntity
* targetField
* sourceText, when available
* userEditableValue
* provenance after acceptance

Accepted field provenance should include:

* sourceDocumentId
* sourceDocumentType
* extractionMethod
* confidence, when available
* acceptedByUser
* acceptedAt

Rejected suggestions should be retained rather than deleted.

Accepted or applied suggestions may update Property Memory only after user review.

Maintley Intelligence should consume the resulting structured Property Memory. It should not parse raw document content.

Financial facts from documents, such as invoice totals, labor, parts, taxes, contractor details, and payment dates, are Property Memory. Financial analysis, budgeting, lifecycle cost analysis, replacement recommendations, and repair economics belong in future Maintley Intelligence rules that consume this Property Memory.

Accepted contractor suggestions should become contractor records for the property or fill blank details on an existing matching contractor.

Accepted invoice, financial, service, part, and supply suggestions should become Maintenance Event history when they describe completed work or a received invoice. Incomplete part mentions may be retained in history notes so useful property context is not lost simply because a full model number is unavailable.

Accepted part and supply suggestions that are linked to specific Equipment
become Property Supply records with canonical `uses` relationships after user
review. Legacy `serviceItems` remain read-only compatibility data and are not a
target for new accepted suggestions.

The Part Knowledge Catalog is a taxonomy used by Property Knowledge Acquisition. It should define conservative matches and target fields, but it should not update records directly or generate recommendations.

---

# Maintley Intelligence Model

Maintley Intelligence is a derived system.

Maintley Intelligence does not own source data.

Instead, it analyzes existing records and generates guidance.

Maintley Intelligence consumes:

* Properties
* Equipment
* Tasks
* Maintenance Events
* Documentation Records

Maintley Intelligence generates:

* Recommendations
* Property Insights
* Dashboard Guidance
* Quick Scan Results
* Portfolio Intelligence

Maintley Intelligence should always remain downstream from source records.

## Property Scan Snapshots

Quick Property Scan results are persisted as derived snapshots.

Collections:

* propertyScanLatest
* propertyScanSnapshots

`propertyScanLatest/{snapshotKey}` stores the latest scan snapshot for a property and scan type.

Current latest snapshot keys:

* `{propertyId}` - latest Quick Property Scan, retained for backwards compatibility.
* `{propertyId}__property_audit_v1` - latest Property Audit.

Latest snapshots are separated by scan type so a large Property Audit does not overwrite the latest Quick Scan result.

`propertyScanSnapshots/{snapshotId}` stores append-only Quick Scan history snapshots for the property Insights History view. Property Audit history is intentionally not stored in the current phase; only the latest audit snapshot is retained.

Typical fields:

* accountId
* propertyId
* scanType
* schemaVersion
* planId
* createdAt
* updatedAt
* createdBy
* systemsReviewed
* summary
* recommendations
* auditCategories (optional, Property Audit snapshots)
* auditAssetReviews (optional, Property Audit snapshots)
* premiumPreview (optional)

Saved recommendations include source provenance. `source` determines plan entitlement for newly generated recommendations:

* `property_memory`
* `knowledge_pack`
* `history_inference`
* `context`

`premiumPreview` is an optional derived explanation of additional Homeowner+ guidance that was available when the scan ran. It is stored separately from `recommendations` so upgrade education never changes recommendation counts, priorities, or the Quick Scan result limit.

Property scan snapshots are derived records. They preserve what Maintley Intelligence showed at scan time, but they do not replace properties, systems, tasks, maintenance events, or documentation records as the source of truth. Historical Quick Scan snapshot details should remain immutable and should not be recalculated when source records change. The latest Property Audit snapshot may be overwritten by the next Property Audit for the same property.

`auditAssetReviews` is a derived Property Audit view that groups detailed findings by affected asset/system. Each asset review may include category summaries and category groups so the audit can present findings under sections such as Maintenance, Equipment Records, Documentation, and Lifecycle. It exists so the audit can present completeness by asset while preserving flat recommendations and category summaries for compatibility and browsing.

---

## Maintley Intelligence Relationships

Example:

```text id="vzq2yw"
Property
    ↓
HVAC System
    ↓
Missing Filter Size
    ↓
Recommendation
```

Example:

```text id="1zl2lc"
Maintenance History
    ↓
No Recorded Filter Changes
    ↓
Recommendation
```

Maintley Intelligence should improve records rather than replace them.

---

# Recommendation Model

Recommendations are derived records.

Recommendations identify opportunities to improve records or maintenance outcomes.

Recommendations may originate from:

* Equipment Profiles
* Property Records
* Maintenance Events
* Task Records
* Documentation Records
* Setup Assistant Responses

Recommendations should never become authoritative records.

The underlying source record remains the source of truth.

---

## Recommendation Categories

Recommendations may belong to:

### Maintenance

Examples:

* Replace HVAC Filter
* Flush Water Heater
* Inspect Roof

---

### Information

Examples:

* Add Install Date
* Add Filter Size
* Add Capacity

---

### Parts & Supplies

Examples:

* Add HVAC Filter Information
* Add Refrigerator Water Filter Information

---

### Documentation

Examples:

* Upload Manual
* Upload Warranty
* Upload Receipt

---

## Recommendation Relationships

Example:

```text id="u8l7o2"
Device
    ↓
Recommendation
```

Example:

```text id="5sqbvu"
Maintenance Event History
    ↓
Recommendation
```

Recommendations should be regenerated from source records whenever possible rather than maintained independently.

---

# Setup Progress Model

Setup Progress is a derived concept.

It should not become an independent source of truth.

Setup Progress may evaluate:

* Property Information
* Equipment Records
* Maintenance Records
* Documentation Records

Example:

```text id="ztw7zb"
Property
    ↓
Recommended Systems
    ↓
Setup Progress
```

The purpose of Setup Progress is guidance.

It should not be treated as validation.

---

# Dashboard Model

Dashboard content is primarily derived.

The dashboard should aggregate:

* Tasks
* Maintenance Events
* Recommendations
* Maintley Intelligence

Dashboard records should not become long-term storage.

The dashboard exists to surface information from authoritative records.

---

## Dashboard Relationships

Example:

```text id="s1z9m4"
Tasks
    ↓
Dashboard
```

Example:

```text id="d4mxp6"
Recommendations
    ↓
Dashboard
```

Dashboard content should be regenerated from source records whenever possible.

---

# Costs View

The property Costs tab is a derived view.

It should read from existing source records such as:

* Maintenance Events
* Task financials

It should not introduce a competing financial source of truth.

Costs surfaced from invoices, contractor work, labor, parts, taxes, or task estimates should remain attached to the maintenance event or task that produced them.

When a task is completed and creates a Maintenance Event, the completed work's final financials should live on the linked Maintenance Event. The Costs tab may still centralize visibility, but it should read the completed cost through the Maintenance Event and avoid showing a duplicate task cost row for the same completed work.

Document-based Property Knowledge Acquisition should resolve whether invoice or service costs belong to an existing Maintenance Event before creating a new event. If the reviewer confirms the existing event match, the cost stays attached to that Maintenance Event and the Costs tab continues to derive centralized visibility from the source record.

---

# Source of Truth Model

Maintley uses layered ownership.

```text id="u3xnnf"
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

Each layer has a distinct responsibility.

---

## Organizational Layer

Primary records:

* Properties
* Equipment
* Contractors
* Tenants

Purpose:

Provide context.

---

## Historical Layer

Primary records:

* Maintenance Events

Purpose:

Preserve completed work and historical activity.

---

## Recommendation Layer

Primary records:

* Recommendations
* Property Insights
* Setup Progress
* Dashboard Guidance

Purpose:

Help users decide what to do next.

Recommendation records should remain derived from authoritative records.

---

# Derived Data Philosophy

Maintley intentionally separates source records from derived records.

Source records should be authoritative.

Derived records should be replaceable.

Examples of source records:

* Properties
* Devices
* Tasks
* Maintenance Events
* Contractors

Examples of derived records:

* Recommendations
* Property Insights
* Dashboard Summaries
* Maintenance Profiles
* Setup Progress
* Portfolio Intelligence

If a derived record becomes inaccurate, it should be possible to regenerate it from source records.

---

# Data Ownership Rules

When designing new features, ask:

1. What is the source record?
2. Is this information already stored elsewhere?
3. Should this be persisted or derived?
4. Can this be regenerated?

Prefer:

```text id="w2wqv6"
Source Record
    ↓
Derived View
```

Avoid:

```text id="yl4m8j"
Source Record
    ↓
Derived Record
    ↓
Secondary Source Of Truth
```

Maintley should minimize competing sources of truth.

---

# Future Direction

The Maintley data model should continue moving toward:

* Account-centric ownership
* Property-centric organization
* Maintenance Event-centric history
* Maintley Intelligence-driven guidance

Future development should favor:

```text id="fw7d7w"
Properties
    ↓
Maintenance Events
    ↓
Maintley Intelligence
    ↓
User Action
```

over creating additional ownership models or duplicate records.

The long-term objective is to keep the data model understandable, maintainable, and capable of supporting increasingly sophisticated Maintley Intelligence features without introducing competing sources of truth.

---

# Guiding Principles

Maintley data should remain:

* Account-centric
* Property-centric
* Event-driven
* Explainable
* Regenerable

Properties provide context.

Maintenance Events preserve history.

Maintley Intelligence provides guidance.

These responsibilities should remain distinct as the platform evolves.
