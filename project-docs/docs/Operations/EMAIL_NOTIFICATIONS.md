# Email Notifications

Last reviewed: 2026-07-24

## Purpose

Maintley supports multiple email notification types.

Each email serves a different purpose, follows different delivery rules, and may have different subscription requirements.

This document defines:

* Email types
* Recipients
* Frequency
* Preference flags
* Delivery responsibilities

This document does not define recommendation logic or Maintley Intelligence behavior.

---

# Email System Responsibilities

The email system is responsible for:

* Recipient selection
* Scheduling
* Frequency enforcement
* Preference enforcement
* Email formatting
* Delivery

The email system is not responsible for:

* Recommendation generation
* Observation prioritization
* Property completeness evaluation
* Equipment profile definitions

Those responsibilities belong to:

* PROPERTY_INTELLIGENCE.md
* RECOMMENDATION_ENGINE.md
* APPLIANCE_PROFILES.md

Shared email presentation belongs in `functions/emailBrand.ts`. Maintley email
surfaces use the primary palette (`#047857`, `#3FCC7C`, `#009E71`, `#036151`,
`#1F2937`, `#FAFAF8`, and white) and the Manrope-first font stack. Semantic
status colors may be used for a real warning or error, but must not replace the
Maintley palette as the message's brand treatment.

Application links in new lifecycle templates must use
`functions/emailLinks.ts`. Templates must not hard-code HashRouter syntax.

---

# Monthly Property Summary

Purpose:

Answer:

"What is currently recorded in Maintley?"

Availability:

* All authenticated user plans
* Free
* Homeowner+
* Property
* Portfolio
* Promotional users
* Former subscribers

Default:

Enabled unless:

```text
emailPreferences.monthlyDigest === false
```

Behavior:

* Runs monthly
* Summarizes existing recorded data
* Uses factual language
* Does not generate recommendations
* Does not perform record analysis

Appropriate content:

* Upcoming tasks
* Overdue tasks
* Completed maintenance
* Property counts
* Equipment counts
* Links back to Maintley

---

# Team Member Task Reports

Purpose:

Answer:

"What work is coming up, overdue, or completed for my team?"

Availability:

* Portfolio and team-enabled accounts

Preference Flags:

```text
emailPreferences.teamMemberReports.enabled
emailPreferences.teamMemberReports.frequency
emailPreferences.teamMemberReports.teamMemberIds
```

Supported Frequencies:

* Weekly
* Biweekly
* Monthly

Behavior:

* Runs daily
* Sends only when frequency conditions are met
* Uses delivery tracking to prevent duplicates

Appropriate content:

* Upcoming tasks
* Overdue tasks
* Completed maintenance
* Property names
* Due dates
* Completion dates

Do not include Maintley Intelligence recommendations.

---

# Property Insights

Purpose:

Answer:

"What opportunities has Maintley identified within my records?"

Availability:

* Homeowner+
* Property
* Portfolio

Preference Flag:

```text
emailPreferences.propertyInsights
```

Default:

Disabled

Behavior:

* Runs on an insight schedule
* Delivers Maintley Intelligence observations
* Displays a limited number of recommendations
* Links back to Maintley for additional recommendations

Property Insights consume Maintley Intelligence outputs.

Recommendation generation, prioritization, and observation creation are defined in:

PROPERTY_INTELLIGENCE.md

---

# Preference Flags

Monthly Summary

```text
emailPreferences.monthlyDigest
emailPreferences.monthlyDigestFamilyRecipients
```

Property Insights

```text
emailPreferences.propertyInsights
```

Team Reports

```text
emailPreferences.teamMemberReports.enabled
emailPreferences.teamMemberReports.frequency
emailPreferences.teamMemberReports.teamMemberIds
```

These preferences should remain independent.

---

# Access Lifecycle Communications

Purpose:

Communicate account state, complimentary access, access expiration, and billing
transition facts without surprising the customer.

Classification:

* Account state, complimentary-access, payment-status, and renewal-behavior
  messages are operational.
* Product education and marketing remain separate and must not be smuggled into
  an operational message.

The first implemented program is the internal Homeowner+ first-property trial.
It has four milestones:

* Activation / Day 0: congratulates the homeowner on the successfully committed
  first property and confirms the 30-day period, absence of a payment method,
  no automatic charge, end date, and Free fallback.
* Day 7: factual progress using saved-record counts; it is not a certification
  or physical inspection.
* Day 21: explains the end date and which automation stops.
* Day 30: confirms Free fallback and preservation of existing property memory.

Activation satisfies the 30-day notice for this 30-day program. It must not be
duplicated by a second 30-day reminder. The existing signup welcome email and
the later grant-activation message describe different events.

In production, the signup welcome email is held until a new registration transitions from
`pending_email_verification` to `active` and Firebase Authentication confirms
the address. Access-lifecycle delivery also checks the Firebase Auth recipient
before calling Resend. Unverified recipients are recorded as deferred with
`recipient_email_unverified`; no provider attempt is made while the address is
unverified. Existing unverified accounts are not deleted and may request
verification from Profile. Pending registrations confirm Firebase's current
verification state before leaving the verification screen. If the user finishes
later, the next login automatically completes the trusted activation when
Firebase already reports the address as verified.

Maintley Beta and local development explicitly disable required email
verification because those environments do not provide customer email delivery.
They skip Firebase verification messages and Profile prompts, then use the
trusted registration finalizer to activate new profiles without recording an
`emailVerifiedAt` value. This exemption does not make the profile eligible for
welcome or lifecycle email delivery. Production defaults to requiring
verification when configuration is absent or invalid.

Each delivery uses a deterministic account-scoped provider identity based on
account, program, grant, milestone, and template version. The stored delivery
identifier remains scoped beneath its account. Operational state records sent,
skipped, failed, retry, provider, and terminal outcome information under the
account. Later milestones
supersede unseen earlier messages rather than sending a stale sequence. Paid
conversion and terminal grant states suppress obsolete delivery immediately.

Paid conversion suppression requires authoritative Stripe subscription evidence:
an eligible paid base plan, an entitled billing status, and a non-empty Stripe
subscription ID. Product capabilities and internal entitlement grants are not
proof of payment. An authorized admin send may recover a delivery previously
skipped specifically as `suppressed_paid_conversion` when current billing data
does not confirm paid access. Sent deliveries and all other terminal skip reasons
remain protected from replay.

Milestones are evaluated against UTC instants and rendered in the account or
owner time zone, with `America/New_York` retained only as the current fallback
for accounts that do not yet store a configured zone.

Access lifecycle delivery is disabled unless
`ENABLE_ACCESS_LIFECYCLE_COMMUNICATION=true`. This flag is independent of trial
grant issuance so rollout and rollback do not revoke effective access.

Key milestones also publish persistent in-app Maintley Events. Automated email
delivery results are operational logs, not administrative decisions and not
entries in the immutable admin audit trail. Admin-requested sends remain
high-value audited actions. The admin user-detail page may send approved
operational support, account, or billing/access messages. It requires a message
preview, administrative reason, stable request ID, provider idempotency, and an
immutable `user_email.sent` audit record. This tool is not a marketing composer;
marketing remains subject to separate consent and preference handling.

---

# Email Design Principles

## Keep Email Actionable

Emails should encourage users to return to Maintley.

Avoid overwhelming users with large reports.

---

## Keep Email Short

Email should summarize.

Maintley should contain the full details.

---

## Respect Preferences

Users should control:

* Which email types they receive
* Which recipients receive reports
* Which frequencies are used

---

## Separate Summary From Intelligence

Monthly Property Summary:

Reports existing information.

Property Insights:

Reports Maintley Intelligence observations.

These email types should remain separate even if delivered on similar schedules.

They answer different product questions and provide different types of value.
