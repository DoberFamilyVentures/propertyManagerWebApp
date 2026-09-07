# Features

Last reviewed: 2026-06

## Purpose

This document describes the current user-facing capabilities available within Maintley.

It answers:

> What can users do in Maintley?

This document focuses on product capabilities rather than implementation details, subscription limits, or future roadmap decisions.

For related documentation:

* PRODUCT_DIRECTION.md — Product goals and direction
* PROPERTY_INTELLIGENCE.md — Recommendation and intelligence systems
* MAINTLEY_PLAN_FEATURE_MATRIX.md — Plan availability and limits
* DATA_MODEL.md — Underlying data structures
* TECHNICAL_ARCHITECTURE.md — System implementation

---

# Accounts and Email Verification

In production, new email-and-password registrations verify their email address
before entering checkout, onboarding, or the working application. Users can
resend the message, sign out, and resume the same registration after
verification. A later login recognizes an already-verified address and completes
activation automatically. Existing accounts remain available when they predate
this requirement, and an unverified existing user can request verification from
Profile. Maintley does not automatically delete an account because its email is
unverified. Isolated Beta and local environments explicitly bypass verification
and email delivery while retaining a trusted server-side profile transition.

---

# Core Maintenance Loop

Maintley is centered around a simple maintenance record workflow:

1. Add a property.
2. Add equipment.
3. Create maintenance tasks.
4. Complete maintenance tasks.
5. Build maintenance history.
6. Store supporting records and documentation.

The product should help users understand and complete this workflow without requiring extensive training or setup.

---

# Properties

Properties are the primary organizational object within Maintley.

Current capabilities:

* Create properties.
* Edit property details.
* Duplicate properties.
* Delete properties.
* Organize properties into groups.
* Drag and drop property groups into a preferred order.
* Rename and manage each group from its contextual menu.
* Add a short description and choose whether a group starts collapsed.
* Customize group icons and colors.
* Use the same group settings when creating or editing a group.
* Move properties between groups before deleting an empty group.
* Mark properties as favorites.
* Hide properties from dashboard views.
* Track property-level information and notes.
* Associate equipment with properties.
* Associate tasks with properties.
* Associate maintenance history with properties.
* Associate contractors with properties.
* Associate tenants with properties.
* Track property type classifications.
* Add and manage Spaces such as interior areas, utility locations, exterior
  surfaces, grounds, and amenities from Property Details.
* Save Supplies such as filters, paint, parts, and property-care products from
  the first-class Property Supplies page.

Homeowner plans keep property setup focused on personal and family homes. They
may choose a residential classification but cannot create Multi-unit or
Commercial properties or newly enable rental management. Property and Portfolio
plans unlock those business workflows. After a downgrade, existing restricted
records remain visible and ordinary descriptive edits remain available, while
the restricted broad type and rental setting stay locked.

Supported property types:

* Residential
* Multi-unit
* Commercial

Residential classifications are Single-family home, Condo, Townhome, and
Apartment. Multi-unit and Commercial use their own building classifications.
Classification describes the physical property; `isRental` independently
controls rental-management behavior. A residential Apartment classification
does not activate resident or business workflows.

Spaces are descriptive property locations rather than access or occupancy
boundaries. They use consistent Space terminology so places such as a Roof,
Lawn, Exterior, or Pool fit alongside interior areas without being described as
rooms. Account managers can connect Equipment to one or more Spaces. Users who
manage Tasks can connect each Task to one or more Spaces. The previous singular
Task Location field is no longer shown or written by the current Task
experience. A Space shows its connected equipment and Tasks, and Task search
and filtering resolve accepted Space connections. Recurring Tasks inherit those
connections. Referenced Spaces are archived when removed so saved context stays
visible; account managers can review and restore archived Spaces. Existing Task
location values remain stored during a conservative exact-match migration
period rather than being discarded or guessed.

Property Details presents each Space as a connected snapshot. Cards summarize
Equipment, open Tasks, Supplies, and Documents and call attention to overdue or
next scheduled work. The fixed-size Space detail view provides direct access to
linked Equipment and Tasks, opens connected Supplies and Documents through
their canonical Property experiences, and derives recent Maintenance History
from explicitly connected Equipment and Tasks. These summaries do not copy
records into the Space or create another source of truth.

New residential Properties preview numbered Bedroom, Bathroom, and Half
Bathroom Spaces before saving. Later Property Profile edits reconcile those
same generated Spaces whenever bedroom or bathroom counts increase. Creation
and edit flows fetch current active and archived Spaces first, reuse stable or
matching records, and surface archived conflicts instead of duplicating them.
The Setup Assistant previews whether it will
create or reuse applicable Kitchen, Bathroom, Laundry Room, Garage, and
Exterior Spaces before connecting accepted Equipment and Tasks. Reopening setup
reuses the stable generated Space or an active matching manual Space instead of
creating duplicates. Archived matches require review.

Within a Setup Assistant area, one unambiguous active matching Space is selected
by default for new Equipment, including a Space added earlier in that step.
Users may change the selection. Multiple matching Spaces remain unselected for
explicit review.

Before saving, the Setup Assistant presents a compact summary of Equipment,
Spaces, and selected recurring tasks. Detailed records are available in
collapsed sections, while the dialog keeps Back and Save setup visible as the
details scroll. Archived-Space conflicts remain visible because they require
review before saving. A separate Quick Setup Review confirms what was saved.

The Setup Assistant entry screen prioritizes two guided choices: nine
10-minute essentials and the complete 28-item room-by-room review. Each choice
shows its saved reviewed count and progress bar. Both derive from the same
responses, so essential progress also counts toward full setup. Existing report
upload remains available as a secondary action below the guided choices.

Guidance-relevant Equipment subtypes refine Setup Assistant recurring-task
suggestions. Tank water heaters keep tank-flush guidance, while tankless water
heaters replace it with a descaling or manufacturer-service review. For mixed
Equipment, each accepted Task connects only to its applicable Equipment and
Spaces.

Supplies preserve the product details a property uses without introducing
inventory management. Account managers may record product identifiers,
specifications, replacement details, and notes, or use reviewed barcode capture
to prefill them. Supplies are available on every active plan and may connect to
multiple Equipment records, Spaces, and Tasks. Equipment pages show their
derived connected Supplies rather than owning copies. Referenced Supplies are
archived when removed and may be restored later.

Equipment create and edit reviews can connect existing Property Supplies or
stage new Supplies, including reviewed barcode input. New records are saved as
Property Supplies only after Equipment succeeds, and removing a connection does
not remove the shared Supply.

Property Documents may connect to multiple Equipment records, Spaces, Tasks,
and Supplies without being copied into those features. Account managers edit
these connections from the Property Documents experience. Equipment, Space,
Task, and Supply views show the derived connected Documents while legacy
Document assignments remain visible during migration. If a Document upload or
metadata edit succeeds but its connection update fails, Maintley keeps the
Document available and tells the user to reopen it and retry the connections.

---

# Property Setup Assistant

The Property Setup Assistant helps users create initial property records more efficiently.

Current capabilities:

* Choose a focused 10-minute essentials review, the full room-by-room review,
  or an existing inspection/service report upload.
* Review common rooms and property areas.
* Identify systems and equipment present at a property.
* Create equipment and system records.
* Generate suggested maintenance tasks.
* Support progressive setup over time.
* Provide quick recommendations after setup completion.

Matching Equipment records may be identified as helpful context, but they do
not count as reviewed until the user explicitly confirms the item. Each
reviewed area explains the Equipment, recurring-task suggestions, and Space
connections that will be prepared before the user saves.

Items marked Present expand in place for optional detail. Users can distinguish
multiple physical records of the same type, choose a guidance-relevant subtype,
connect each record to one or more existing Spaces, or quickly add a missing
Space. Distributed records such as smoke detectors remain separate Equipment
records so their location and maintenance history are not combined. The final
review lists the exact Equipment and Space connections that will be created or
reused.

The assistant is intended to reduce onboarding effort while keeping setup optional and flexible.

Initial onboarding is intended for account owners setting up their own account.
Its first-Property dialog includes only Basics and Property Profile. Access and
Sharing and the separate Review step remain outside onboarding, while bedroom
and bathroom counts are captured early enough to create the initial Spaces.
Linked family members and invited team members enter an existing account context
and should not be forced through the onboarding flow.

---

# Maintley Intelligence

Maintley Intelligence reviews what Maintley knows about a property and highlights the few things most worth the user's attention.

Recommendations are explainable guidance based on saved property records. They are not physical inspections, condition assessments, or property grades.

Current capabilities:

* Suggested maintenance tasks.
* Setup recommendations.
* Quick Scan recommendations.
* Dashboard recommendations.
* Property Insight observations.
* Missing-information recommendations.
* Record completeness guidance.

Maintley Intelligence focuses on improving records rather than evaluating actual property condition.

See PROPERTY_INTELLIGENCE.md for detailed behavior.

---

# Equipment Records

The platform internally uses the term `devices`, but user-facing language should refer to:

* Equipment
* Equipment Records
* Home equipment

Current capabilities:

* Create equipment records.
* Edit equipment records.
* Duplicate equipment records.
* Delete equipment records.
* Track manufacturer information.
* Track model information.
* Track serial information.
* Track install dates.
* Track service items.
* Track parts and supplies.
* Track filter information.
* Track notes.
* Track status.
* Upload files and documentation.
* Associate tasks.
* Associate maintenance history.
* Browse Equipment Hub groups such as Comfort, Safety, Exterior, Utilities,
  Appliances, and Other.
* Connect several physical Equipment records beneath one primary Equipment
  profile without merging their model, serial, Space, status, or history.
* Add new Equipment from a primary Equipment profile or connect existing
  standalone Equipment.

Connected physical Equipment is omitted from ordinary top-level Equipment
cards and remains available from the primary profile, direct links, reports,
exports, search-backed record resolution, and its own Equipment profile.

Supported statuses:

* Active
* Maintenance
* Broken
* Decommissioned

Users may create minimal records and complete information later.

---

# Tasks

Tasks represent maintenance work that needs to be performed.

Current capabilities:

* Create tasks.
* Edit tasks.
* Delete tasks.
* Complete tasks.
* Assign tasks.
* Link tasks to properties.
* Link tasks to equipment.
* Configure due dates.
* Configure recurring schedules.
* Configure priorities.
* Configure notes.
* Configure work requirements.
* Track task status.
* Identify overdue tasks.
* Open a Maintenance Profile for a task or recurring maintenance program.
* Review related property, equipment, service records, documents, schedule,
  costs, and notes from one task-centered view.

Task completion contributes to maintenance history. The Maintenance Profile is
a derived view of existing task, equipment, property, document, and Maintenance
Event records; it should not introduce a duplicate source of truth.

---

# Maintenance History

Maintenance History serves as the long-term record of completed maintenance activity.

Current capabilities:

* Record completed maintenance.
* Store service notes.
* Store repair notes.
* Store inspections.
* Store contractor visits.
* Store invoices.
* Store attachments.
* Store warranty-related records.
* Create manual maintenance entries.
* Display equipment-specific history.
* Display property-specific history.

Current canonical storage:

* maintenanceEvents

Legacy compatibility remains available where needed.

---

# Documents, Photos, and Files

Maintley supports storing maintenance-related records and supporting documentation.

Current capabilities:

* Property photos.
* Equipment photos.
* Maintenance attachments.
* Task attachments.
* Warranty documents.
* Service records.
* Invoices.
* General supporting files.
* Property-owned Documents connected to Equipment, Spaces, Tasks, and Supplies.
* Contextual Document views derived from accepted relationships.

Photos and documents are treated as distinct user concepts even when stored using the same backend storage services.

---

# Contractors

Contractors provide service-provider tracking and assignment functionality.

Current capabilities:

* Create contractors.
* Edit contractors.
* Delete contractors.
* Associate contractors with properties.
* Assign contractors to tasks.
* Reference contractors in maintenance workflows.
* Track contractor contact information.
* Store contractor website and customer portal links for quick access.

Contractor creation only requires a company name. Contact names, phone numbers,
email addresses, addresses, notes, websites, and customer portal links may be
added later.

---

# Team Members

Team functionality supports collaborative property management.

Current capabilities:

* Create team member records.
* Invite team members.
* Generate invitation codes.
* Link accepted users to team records.
* Assign properties.
* Restrict access by role.
* Revoke access.
* Manage team profiles.

Team members:

* Operate within assigned-property scope.
* Do not own subscriptions.
* Do not manage billing.

---

# Tenants & Maintenance Requests

Tenant functionality supports resident communication and maintenance requests.

Resident information is intentionally limited to basic identity and contact
details, an optional lease end date, property access, and maintenance-request
participation. Maintley is not a tenant-screening or rental-application system.

Current capabilities:

* Add tenants.
* Invite tenants.
* Associate tenants with properties.
* Submit maintenance requests.
* Review maintenance requests.
* Track request activity.

The tenant experience remains intentionally simpler than the owner maintenance workflow.

Resident information is limited to basic identity and contact details, an
optional lease end date, property access, and maintenance requests. Maintley
does not provide rental applications, tenant screening, credit checks,
financial profiling, or lease-document management.

---

# Notifications

Maintley supports multiple notification channels.

Current capabilities:

* In-app notifications.
* Mobile push notifications.
* Task reminders.
* Overdue reminders.
* Maintenance activity notifications.
* Document review started notifications.
* Suggested details ready notifications when Property Knowledge Acquisition finds reviewable information.
* Notification preferences.

Notification behavior may vary by platform and subscription level.

---

# Reports

Maintley includes reporting functionality built from recorded maintenance data.

Current capabilities:

* Property reporting.
* Task reporting.
* Maintenance reporting.
* Activity summaries.
* Exportable reporting workflows where supported.

Reports are generated from existing Maintley records and do not act as separate sources of truth.

---

# Customer Support

Authenticated users have a dedicated Support Center at:

```text
/support
```

The Support Center brings together:

* New support, feedback, bug, and feature requests.
* Active, testing-fix, and closed request tracking.
* Customer-visible updates from the Maintley team.
* Standard customer-facing Maintley Updates when support request status changes.
* Admin support actions block interaction while ticket updates are being saved.
* Admin ticket cards keep attachments visible while detailed context and activity can be expanded as needed.
* Request attachments.
* Frequently asked questions.
* Troubleshooting and bug-report guidance.
* A curated feed showing the latest five significant features and major user-facing updates.
* In-depth homeowner-friendly articles covering core Maintley functions and
  account behavior.
* Optional inline screenshots in support articles when a visual example helps explain a feature.
* Automatically derived reading times based on visible article content.
* Related-guide links that keep connected workflows discoverable.
* Selective founder notes when practical product context adds to the guide.

Articles use stable, shareable routes:

```text
/support/articles
/support/articles/:articleSlug
```

Current article topics include:

* Building a useful property record.
* Turning completed tasks into maintenance history.
* Tracking equipment.
* Organizing property documents.
* Reviewing document suggestions before applying them.
* Configuring maintenance reminders.
* Organizing properties with groups.
* Getting started without documenting everything.
* Using Maintley Intelligence recommendations.
* Working with family and team members.
* Preparing property records for a contractor.
* Choosing between a task and a maintenance record.
* Preserving useful information after service work.
* Understanding plans, trials, and complimentary access.
* Managing Stripe billing and subscriptions.
* Understanding what happens after a downgrade.
* Managing team-member access and permissions.
* Creating reports and property exports.
* Understanding storage limits and file management.
* Protecting and deleting an account.

Each article is maintained as an individual structured content module with a
central index. The existing article renderer owns the shared presentation so
content organization does not create parallel page implementations.

In-app Support explains how to use Maintley and how current Maintley behavior
works. General home-maintenance education belongs on public resource pages.

The Support Center shows a featured selection. The full article library is
available through **View all articles**.

Support is a separate navigation destination rather than a Settings category.
Desktop users can open it from the sidebar or profile menu. Tablet and mobile
users can open it from the navigation drawer.

The public Help Center remains available at `/help` for general guidance and
people who cannot access their account.

---

# Billing & Subscription Support

Maintley supports subscription-aware experiences.

Current capabilities:

* Free and paid plans.
* Subscription upgrades.
* Subscription management.
* Resource-limit enforcement.
* Feature availability controls.

Plan definitions and limits are maintained separately.

See:

* MAINTLEY_PLAN_FEATURE_MATRIX.md
* BILLING.md

---

# Native Android Application

Maintley supports a Capacitor-based Android application.

Current capabilities:

* Native Android packaging.
* Push notification registration.
* Mobile-optimized navigation.
* Google Play distribution for Android users.
* Progressive Web App support for browser-based installation where supported.
* Native update metadata support remains available, but the automatic in-app
  update prompt is temporarily disabled until Maintley can verify that the
  advertised release is actually available to the user through Google Play.

The Android application shares the same core functionality and data model as the web application.

---

# Guiding Principles

Maintley should remain approachable for homeowners while supporting larger property portfolios.

User-facing language should prioritize clarity over industry terminology.

Preferred terminology:

* Property
* Equipment
* System
* Task
* Maintenance History
* Property Records

Avoid exposing unnecessary complexity when simpler concepts communicate the same idea.

The primary goal is to help users maintain properties, preserve maintenance history, and improve the quality of their records over time.
