# ADR 0040: Verified Email Registration Boundary

Status: Accepted

Date: 2026-09-04

Related ADRs:

* `0030-homeowner-plus-trial-experience.md`
* `0031-homeowner-plus-trial-lifecycle-and-communication.md`
* `0038-product-analytics-and-behavioral-telemetry.md`

## Context

Maintley previously treated successful Firebase Authentication account creation
as a completed registration. The application created the Firestore profile,
provisioned account context, opened checkout or onboarding, and allowed
automated welcome and access-lifecycle email delivery without first proving
that the registrant controlled the address.

Firebase validates the shape and uniqueness of an email address, but those
checks do not prove that the mailbox exists or belongs to the registrant. Invalid
or unattended addresses can therefore become recipients of repeated automated
delivery attempts. They also create account records that appear more complete
than the user's actual registration progress.

Maintley already relies on email for account recovery, invitations, access
notices, and useful maintenance communication. Verified mailbox ownership is
therefore part of a valid new-account lifecycle rather than an optional profile
detail.

Existing accounts predate this boundary. Automatically disabling or deleting
those accounts would create unnecessary continuity risk.

## Decision

All new self-service email-and-password registrations initially enter an
explicit `pending_email_verification` state. Whether that state blocks product
access is controlled by a deploy-time environment policy.

Production requires verification. The browser and trusted callable both fail
closed when their configuration is missing or unrecognized. Maintley Beta and
local development explicitly disable the requirement because those environments
do not provide customer email delivery and are intended for isolated testing.

When verification is required, Maintley sends a Firebase-managed verification
message after creating the Firebase Auth identity and Firestore profile, then
routes the authenticated user to a dedicated verification screen. The screen
keeps confirmation in one focused experience: the user may confirm that the
link has been used, request another message, or sign out and finish later.

When the user signs in again, Maintley refreshes the Firebase Authentication
record. If Firebase already reports the email as verified, Maintley completes
the trusted profile transition automatically before routing. Otherwise, the
user returns to the verification screen.

When verification is required, the user may not enter checkout, onboarding, or
the working application while the profile remains pending. When it is disabled,
the browser does not send a verification message or expose verification gates,
and a trusted transition activates the profile immediately after creation.

Verification is finalized through a trusted callable. In production, the
callable reads the Firebase Authentication user record and changes the
Firestore registration status to `active` only when Firebase reports
`emailVerified: true`. In an explicitly exempt environment, the same callable
may activate the pending profile without claiming that its email was verified.
Clients and account managers cannot directly change registration status,
verification timestamps, or the server environment policy.

Maintley does not automatically delete unverified accounts. Users may return
later, resend verification, and finish registration. Existing users whose
profiles have no registration status remain active for compatibility and receive
an optional verification action in Profile.

## Registration State

New profiles use:

```text
registrationStatus: pending_email_verification | active
registrationMode: standard | tenant | tenant_invite | team_invite
emailVerifiedAt: trusted server timestamp
```

A missing `registrationStatus` means the profile predates this decision. It is
treated as legacy-active for application access and is not silently migrated,
blocked, or deleted.

## Trusted Transition

```text
Firebase Auth account created
        ↓
Firestore profile: pending_email_verification
        ↓
Firebase verification link used
        ↓
Trusted callable reads Firebase Auth user
        ↓
Firestore profile: active
        ↓
Checkout, onboarding, or invited-account destination
```

The transition is idempotent. Rechecking an already verified account may refresh
its trusted verification timestamp without duplicating account records,
entitlements, or email deliveries.

Beta and local builds preserve the same client-write rule: the browser creates
only a pending profile, then requests immediate trusted activation. This avoids
weakening shared Firestore Rules or introducing a client-controlled active-state
write. If trusted activation is temporarily unavailable, the non-production UI
still remains usable and session reconciliation retries the transition later.

## Email Delivery Boundary

The signup welcome email is sent only after a new profile transitions from
pending to active and Firebase Authentication independently confirms the
address. Creating the pending profile does not call the external email provider.

Access-lifecycle delivery also checks the beneficiary's Firebase Authentication
record before calling the provider. An unverified recipient is recorded as
deferred with the explainable outcome `recipient_email_unverified`. Verification
may allow a later eligible scheduler run to deliver the message; no provider
attempt is made while the address remains unverified.

Firebase's verification email is intentionally still delivered when verification
is required because it is the mechanism used to establish mailbox ownership.
An environment-exempt activation does not satisfy this email-delivery boundary
and does not create a verification or welcome-email provider attempt.

## Invitations and Complimentary Access

Invited tenant and team registrations use the same verification boundary. Their
validated invitation context may be preserved while access to the working app
remains blocked.

Complimentary access is not activated before verification. If a user supplied a
code during registration, the browser session preserves it long enough to return
to the existing review-and-activate step after verification. The code continues
to use its existing server-side recipient and eligibility checks.

## Profile Experience

In an environment where verification is required, an authenticated legacy user
whose Firebase Authentication email remains unverified can send a verification
email from Profile. Maintley recognizes the updated Firebase verification state
on a later sign-in; Profile does not expose a separate client confirmation
action. Verification remains optional for legacy application access. No
expiration or automatic cleanup is attached to the reminder.

## Analytics

Registration measurement distinguishes identity creation from usable account
activation:

* `signup_started` records registration intent;
* `email_verification_sent` records a registration, verification-page, or
  Profile request;
* `email_verification_completed` records successful trusted confirmation; and
* `signup_completed` records the verified registration entering its next
  destination.

This prevents unverified or mistyped addresses from inflating completed-signup
conversion.

## Security and Compatibility

Firestore Rules require new client-created profiles to use the pending status,
match the authenticated token email, and preserve server-owned registration
fields after creation. Cloud Functions remain the authority for activation.

The application gate is additive for new profiles. Existing accounts with no
status continue to behave as before. There is no bulk migration, cleanup job, or
automatic deletion in this decision.

## Consequences

### Positive

* New active users have demonstrated control of their email address.
* Welcome and lifecycle messages avoid known-unverified recipients.
* Failed-provider attempts and misleading signup conversion are reduced.
* Verification can be resumed rather than forcing a second registration.
* Existing customers retain uninterrupted access.
* The Profile provides a clear path for legacy users to verify voluntarily.

### Costs and risks

* Registration adds an inbox step before the first product experience.
* Verification delivery problems can delay legitimate users.
* Firebase authorized domains and email-action return URLs must remain correct
  in production and in any non-production environment that opts into verification.
* Browser and Functions configuration must agree on the verification policy.
* Invitation, complimentary-access, paid-checkout, and E2E flows must preserve
  their continuation across verification.
* A pending Auth and profile record may remain indefinitely when registration is
  abandoned.

## Deferred

This decision does not introduce:

* automatic deletion of pending or legacy unverified accounts;
* a disposable-email-domain blacklist;
* third-party mailbox validation;
* a public, runtime, or client-controlled verification bypass;
* mandatory verification for legacy application access; or
* Identity Platform reCAPTCHA enforcement.

Bot scoring or reCAPTCHA may be evaluated separately after Beta measurement.

## Implementation Tracking

- [x] Add the pending and active registration states.
- [x] Require pending state for new client-created profiles.
- [x] Add the trusted Firebase Auth verification finalizer.
- [x] Gate new pending registrations before checkout and app access.
- [x] Add a responsive verification screen with resend and confirmation actions.
- [x] Delay welcome email delivery until trusted activation.
- [x] Defer access-lifecycle email delivery for unverified recipients.
- [x] Add optional Profile verification for legacy users.
- [x] Preserve complimentary-access continuation.
- [x] Adapt isolated activation E2E coverage.
- [x] Add a fail-closed environment policy with an explicit Beta/local exemption.
- [x] Keep exempt activation behind the trusted callable and shared Firestore Rules.
- [ ] Validate Firebase email templates and authorized return domains in production.
- [ ] Manually test standard, paid, invitation, and complimentary-access verification flows in production.

## Success Criteria

This decision is complete when production prevents a new unverified registration
from entering checkout or the working app, no client can directly mark itself
active, and unverified registrations do not cause welcome or access-lifecycle
provider delivery. Explicitly exempt Beta/local environments must remain usable
without sending verification email while preserving the trusted profile-write
boundary. Verified production registrations can resume their intended path,
legacy accounts remain available, and an unverified legacy production user can
request verification from Profile.
