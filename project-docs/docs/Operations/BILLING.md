# Billing and Stripe

Last reviewed: 2026-07

This document describes Maintley's billing architecture, subscription lifecycle, Stripe integration, and resource enforcement.

This document is implementation-focused.

For customer-facing plan definitions, feature availability, storage limits, upgrade messaging, and subscription comparisons, see:

MAINTLEY_PLAN_FEATURE_MATRIX.md

---

# Purpose

Billing is responsible for:

* Stripe integration
* Subscription lifecycle management
* Checkout creation
* Subscription synchronization
* Upgrade and downgrade workflows
* Resource enforcement

Billing is not the source of truth for:

* Feature availability
* Plan comparisons
* Upgrade messaging
* Product positioning

Those definitions belong in MAINTLEY_PLAN_FEATURE_MATRIX.md.

---

# Current Plan Model

Source files:

* functions/packages/entitlements
* src/constants/subscriptions.ts
* src/utils/subscriptionUtils.ts
* functions/subscriptionEntitlements.ts
* functions/stripeFunctions.ts
* src/services/stripeService.ts

Current plans:

| Plan           | Purpose                          |
| -------------- | -------------------------------- |
| homeowner      | Free homeowner plan              |
| homeowner_plus | Paid homeowner plan              |
| property       | Small portfolio plan             |
| portfolio      | Advanced portfolio and team plan |

Special non-subscription access types:

* guest
* tenant

Detailed plan limits and capabilities are defined in:

MAINTLEY_PLAN_FEATURE_MATRIX.md

## Entitlement foundation

The web application and Firebase Functions now share the pure resolver in
`functions/packages/entitlements`. Client and server feature helpers resolve typed
capabilities and limits from that package. Compatibility wrappers preserve
existing subscription records. Internal grant issuance remains independently
launch-gated.

Compatibility mode preserves existing paid-plan records while synthetic Stripe
access is reviewed manually. Strict mode requires Stripe confirmation before a
paid plan supplies paid access. Pending Checkout never supplies paid access.
Unknown entitlement values emit structured default-deny diagnostics from the
Functions boundary. Setting `ENTITLEMENT_COMPARE_MODE=true` emits structured
stored-plan versus resolved-plan comparison events during a controlled rollout;
it does not change the access result.

Public plan flags determine whether a customer can start a new Checkout for a
plan. They do not invalidate an already active Stripe-confirmed subscription.
Profile and Settings surfaces continue to resolve the existing canonical plan
while purchase surfaces honor the acquisition flag.

Admin Billing lists current active Stripe coupons and complimentary access
codes by default. Administrators may explicitly enable `Show inactive and
expired` within either section to review historical or exhausted records.

The package defines temporary and permanent grant, billing-transition,
administrative-audit, and rollout-flag contracts. The Homeowner+ first-property
trial is the first persisted generic grant workflow. It remains disabled unless
both `ENABLE_HOMEOWNER_PLUS_PRODUCT_TRIAL` and
`ENABLE_INTERNAL_ENTITLEMENT_GRANT_ISSUANCE` are true and
`HOMEOWNER_PLUS_TRIAL_ELIGIBILITY_START_AT` is a valid launch boundary. Existing
grants continue resolving when issuance is disabled. No internal trial creates
a Stripe customer, subscription, payment method, schedule, or automatic charge.
When an otherwise eligible account was created while issuance was temporarily
disabled, first-property issuance may recover the missing eligibility marker
from the account creation date, launch boundary, owner status, and canonical
Free subscription. The server remains authoritative and the grant id remains
idempotent, so retries cannot restart or duplicate the trial.

Lifecycle email and in-app delivery has its own server flag,
`ENABLE_ACCESS_LIFECYCLE_COMMUNICATION`. Enabling grant issuance does not enable
messages automatically, and disabling messages does not revoke a grant. The
current internal trial always states that no payment method is connected and
that paid continuation requires intentional Checkout. Internal delivery data
cannot initiate billing; Stripe remains the only authority for whether a charge
can occur.

The admin customer view separates **Stripe Billing**, **Internal Access
Grants**, and **Resolved Product Access**. Paid plan changes update an existing
Stripe subscription first. When no Stripe subscription exists, choosing a paid
plan creates a Checkout link and does not grant paid access until Stripe
confirms the subscription. "Stripe trial days" can extend only an existing
trialing Stripe subscription. Complimentary access without billing belongs in
the separately authorized and audited internal-grant workflow; it must never be
represented by a local paid-plan or trial edit.

The web equivalents are `REACT_APP_ENABLE_HOMEOWNER_PLUS_PRODUCT_TRIAL` and
`REACT_APP_ENABLE_INTERNAL_ENTITLEMENT_GRANT_ISSUANCE`; these describe rollout
state but do not revoke an already-issued grant.

Grant-aware voluntary Checkout is independently controlled by the server-only
`ENABLE_COMPLIMENTARY_PAID_TRANSITIONS` flag. When enabled, the highest active
grant bundle defines whether a paid selection is equivalent, lower, or higher:

* an equivalent or lower selection under temporary Checkout-required access
  creates the Stripe subscription now and sets its first charge for the end of
  the controlling complimentary period
* a higher selection starts paid access immediately and converts only temporary
  grants whose program explicitly permits Checkout conversion
* an equivalent or lower selection already covered by permanent access is
  rejected as redundant

The client may explain this policy, but it cannot choose the timing. Functions
load authoritative grants, derive the policy, configure Stripe, and append the
high-value transition audit. Stripe remains authoritative for subscription
state and whether a charge can occur. Disabling the flag prevents new
grant-aware transitions without changing existing grants or Stripe schedules.

Clients cannot create a user with a paid base plan or rewrite authoritative
subscription fields after signup. Firestore permits only non-billable initial
plans and narrowly scoped pending-checkout or promo-code changes. Stripe
Functions, webhooks, and approved admin operations remain responsible for paid
plan, billing status, period, customer, and subscription identifiers.

Complimentary access codes are internal grant credentials, not Stripe coupons.
They are independently gated by `ENABLE_COMPLIMENTARY_ACCESS_CODES`, store only
a keyed verifier, and can use `none` or `checkout_required` continuation. They
cannot configure automatic billing. Programs are provisioned with
`npm --prefix functions run provision:access-code -- ...`; the plaintext code
and matching pepper are supplied only through the operator's local environment.
Eligible primary account holders redeem a code from Settings under Billing &
Subscription. Maintley validates and previews the access duration and end
behavior first; the user must then explicitly activate the complimentary
access. Activation is not offered before a successful preview.

Standard registration may also collect a complimentary code separately from
Stripe coupons and invitation codes. Maintley first commits the Free account,
then performs authenticated review and explicit activation before onboarding.
An invalid or skipped code leaves the account on Free and remains retryable in
Settings. Recipient-restricted codes require the authenticated account-owner
email to match and be verified.

The admin Billing area keeps Stripe Coupons and Complimentary Access Codes in
separate collapsed sections. Creating a complimentary code requires one
specific access level, duration, maximum redemptions, label, transition mode,
and administrative reason; redemption expiration and recipient email are
optional. The server generates the plaintext code, returns it once, stores only
its keyed verifier, and writes the immutable high-value audit event.

---

# Subscription Shape

Subscription records may exist on user and family account records.

Important fields:

* status
* plan
* currentPeriodStart
* currentPeriodEnd
* trialEndsAt
* canceledAt
* stripeCustomerId
* stripeSubscriptionId
* cancelAtPeriodEnd
* billingDisclosure
* billingSyncIssue
* promoCode
* hasScheduledSubscription
* scheduledPlan

Supported statuses:

* trial
* active
* cancelled
* expired
* past_due

`billingDisclosure` is a server-written, sanitized projection of the Stripe
subscription facts needed by Maintley's account surfaces. It may include the
list price and interval, discount duration, current-period end, cancellation
state, and next invoice amount and date. It must not contain a raw Stripe
object, card details, payment-method details, or secrets.

Stripe webhooks are the primary synchronization path. Authenticated application
initialization also performs one non-blocking, account-owner synchronization as
a recovery check when the profile has a Stripe customer. The callable verifies
that the requested subscription belongs to the authenticated user, retrieves
the current state from Stripe, writes the same projection to the user and
family-account records, and returns that projection so the active client state
can update immediately. This recovery check never creates, renews, converts, or
charges a subscription.

The initialization recovery check evaluates the Stripe customer's subscription
set even when Firestore already contains a subscription ID. One current Stripe
subscription (`active`, `trialing`, `past_due`, or `unpaid`) supersedes an older
cancelled or deleted stored reference, allowing an existing configured Maintley
plan assigned directly in Stripe to repair local state. If Stripe reports more
than one current subscription, Maintley must not guess which subscription owns
access. It preserves the last resolved plan, writes a
`multiple_current_subscriptions` billing sync issue to the user and
family-account subscription records, and requires operational review. A later
successful single-subscription synchronization clears that issue.

Account and profile billing language must use `billingDisclosure` when a Stripe
billing relationship exists. Internal grant transition language applies only
to internal grants; it must not be used to describe a paid or discounted Stripe
subscription.

---

# Billing Lifecycle

## Free Plan

Users may use the free homeowner plan without creating a Stripe subscription.

No Stripe customer is required until entering a paid plan flow.

Free registration creates the Firebase user and a pending Firestore profile. In
production, it then requires Firebase email verification before opening
onboarding. The authenticated session remains available while the user verifies
the address. After trusted finalization changes the profile to active, Maintley
continues to onboarding without requiring another registration. Beta and local
development skip the email step and activate through the same trusted callable.
Existing profiles without a registration status remain active for compatibility.

---

## Paid Plans

Paid plans are purchased through Stripe Checkout.

The embedded registration selector and the authenticated Plans page share the
same responsive pricing-card system. Each card keeps the plan name, price,
billing cycle, intended audience, four feature highlights, and selection action
visible. Remaining features use progressive disclosure so users can review the
complete plan without making the initial comparison unnecessarily tall. The
selector also states that checkout is handled by Stripe, card details are not
stored by Maintley, and the final total can be reviewed before payment.

Expected flow:

1. User selects plan.
2. Maintley creates the Firebase account with the Free plan as its entitlement
   and records the selected paid plan as pending checkout intent.
3. After any required email verification, the browser opens the protected
   `/checkout/start` route outside the main application layout.
4. That route requests a Stripe Checkout session and redirects the browser to
   the returned Stripe URL.
5. Stripe processes payment and returns the authenticated user to
   `/checkout/complete`.
6. Maintley verifies that the Checkout session belongs to the signed-in user.
7. Firestore user and family-account subscription records are synchronized.
8. Maintley reloads the authoritative user profile and then opens the dashboard.

Current clients submit a stable paid plan ID and `month` or `year` billing
cycle. The Function selects the Stripe price from server-owned configuration;
a client-provided price ID is not normal checkout authority. The temporary
price-only compatibility path accepts only prices already present in that
server catalog, emits a structured warning when used, and is scheduled for
removal in release `2.10.0`.

Checkout launch has a 30-second request timeout. A timeout or launch failure
must replace the loading screen with actions to retry secure checkout or
continue using the Free plan. Authenticated users with pending checkout intent
are routed back through `/checkout/start`, allowing interrupted registrations
and later logins to recover without entering onboarding or the dashboard first.

Paid registration returns after the authenticated user profile, accepted legal
documents, Free entitlement, and pending checkout intent are durable. It does
not wait on a separate `ensureFamilyAccount` callable. The
`createCheckoutSession` function initializes or synchronizes the family account
and owner membership within the same server invocation before creating the
Stripe session. This avoids an additional callable cold start while preserving
account consistency. Free registration still completes family-account setup,
but production opens onboarding only after required email verification because
it has no checkout step to perform that work. Beta and local environments
continue directly.

Checkout completion runs outside the primary application layout. The dashboard
and onboarding flow must not mount until any required verification and profile
refresh finish.
Checkout completion must not use a full-page reload to discover the paid plan.
If verification is temporarily unavailable, the completion page provides retry
and return-to-plans actions while preserving the user's account.

If Stripe checkout is cancelled or checkout creation fails, Maintley clears the
pending checkout intent and leaves the account on the Free plan. The Plans page
shows Free as the current plan; the user does not need to select it again and
may continue on Free or start another upgrade. Cancellation must synchronize
the confirmed Free subscription to both the user and family-account records so
a later profile refresh cannot restore stale pending-checkout intent.

Checkout intent is not paid-plan access. If a user starts Stripe Checkout and
backs out before Stripe confirms the subscription, Maintley may keep billing
context such as `stripeCustomerId`, `promoCode`, `pendingCheckoutPlan`, and
`pendingCheckoutStartedAt`, but the current entitlement remains the free
Homeowner plan until Stripe confirms an active or trialing subscription.

Feature gates, resource limits, push/email delivery gates, and account usage
widgets should use the current entitled plan, not a pending checkout plan or
future scheduled plan.

Paid-plan setup records, such as default property groups or team groups, should
be created only after Stripe confirms an active or trialing subscription. A
pending checkout may store intent metadata, but it must not create paid-plan
operational structure.

---

## Upgrade Flow

Expected behavior:

* Reuse existing Stripe customer.
* Update or replace existing subscription.
* Avoid creating duplicate active subscriptions.

Verify:

* stripeCustomerId reuse
* stripeSubscriptionId handling
* webhook synchronization

---

## Downgrade Flow

Downgrades should:

* Preserve user data whenever possible.
* Restrict creation of new resources beyond plan limits.
* Avoid destructive data removal.

Existing records should remain accessible unless explicitly required otherwise.

### Non-destructive downgrade contract

Plan limits govern new creation and premium processing. They do not revoke
visibility of customer records created while a higher plan was active.

After a downgrade:

* Existing properties, equipment, tasks, Maintenance History, and files remain
  visible and usable.
* Existing files remain downloadable even when storage usage exceeds the new
  plan quota.
* New resource creation is blocked only while current usage meets or exceeds
  the lower limit.
* Accepted document suggestions remain ordinary customer records.
* Persisted point-in-time Intelligence results remain visible; new premium
  processing stops.
* Existing permission assignments must never widen automatically.
* Retained team-member profiles remain editable and removable. Account managers
  may revoke existing login access after downgrade, but cannot invite new team
  members or change premium roles, groups, or property assignments.
* Account cancellation and account deletion remain separate actions.

Entitlements should distinguish viewing existing data from creating,
processing, automating, inviting, or configuring new premium behavior.

---

## Cancellation Flow

Cancellation should:

* Update Stripe subscription status.
* Synchronize Firestore subscription state.
* Preserve historical account data.

## Admin Support Adjustments

The admin portal separates paid subscription repair from complimentary access.
Stripe Billing actions operate on a real Stripe relationship. Internal Access
Grant actions use Maintley's generic grant model and never create or modify a
Stripe customer, subscription, invoice, payment method, or scheduled charge.

Current Stripe-backed support behavior:

* Plan changes require an existing Stripe subscription and a paid plan.
* Trial extensions require an existing Stripe subscription that is still in trial.
* Coupon codes are applied to the existing Stripe subscription when Stripe sync
  is enabled.
* Refresh from Stripe can repair Firebase subscription records by looking up the
  stored Stripe subscription ID, stored Stripe customer ID, or the user's email
  address in Stripe.
* Cancellations set the existing Stripe subscription to cancel at period end.

If the user does not have a Stripe subscription, selecting a paid plan creates
Checkout rather than writing a local paid plan. Complimentary support, beta,
legacy, or lifetime access must use the separately authorized Internal Access
Grant workflow. Lifetime grants are restricted to Maintley's `owner` role.

Grant changes require a preview of current and proposed access, an audit reason,
a stable request ID, and typed confirmation. Non-owner grant managers cannot
target their own user or account. `maintley_role: owner` is the only self-grant
exception and refers exclusively to the owner of Maintley, never a customer
property owner.

Refresh from Stripe is the preferred support repair when Stripe already has an
active subscription but Firebase does not show the customer as subscribed. The
repair updates the user subscription and family account subscription from the
selected Stripe subscription and writes an admin audit log entry.

## Admin Billing Tools

The admin portal includes a focused Billing Tools area for customer acquisition
and support offers.

Supported admin tools:

* Create Stripe coupons and promotion codes.
* View recent active, expired, and inactive promotion codes.
* Copy coupon codes for support or sales follow-up.
* Create a Stripe Checkout link for a selected user with a selected coupon.
* Open the user's Stripe customer record from the support view when a Stripe
  customer ID exists.

Coupon creation supports:

* Percent off or dollar off.
* Duration: once, repeating, or forever.
* Max redemptions.
* Expiration date.
* Optional plan scoping through the Stripe product attached to the selected
  Maintley plan price.
* Internal support note stored in Stripe metadata and admin audit logs.

Maintley should not manually discount users only in Firestore. Coupons,
promotion codes, redemptions, expiration, and Checkout discounts must remain in
Stripe. Firestore may store Stripe customer identifiers and admin audit records
needed for support traceability.

---

# Stripe Integration

## Functions

Exported functions:

* createCheckoutSession
* validatePromotionCode
* verifyCheckoutSession
* cancelSubscription
* getSubscriptionDetails
* syncSubscriptionFromStripe
* stripeWebhook
* createTrialSubscription
* adminPortalRefreshUserSubscriptionFromStripe
* adminPortalApplyUserBillingActions
* adminPortalCreateBillingCoupon
* adminPortalListBillingCoupons
* adminPortalCreateCheckoutLinkWithCoupon
* adminPortalPreviewEntitlementGrant
* adminPortalMutateEntitlementGrant

Stripe webhook processing lives in:

functions/stripeFunctions.ts

---

## Expected Responsibilities

Stripe integration should:

* Create or reuse customers.
* Create checkout sessions.
* Process subscription updates.
* Synchronize Firestore state.
* Handle cancellations.
* Support future scheduled subscription changes.

---

# Resource Enforcement

Subscription limits are enforced through:

## Client Utilities

Examples:

* canAddProperty
* canAddDevice
* getRemainingPropertySlots
* getRemainingDeviceSlots
* getEffectiveSubscriptionPlanId

`getEffectiveSubscriptionPlanId` delegates to the shared resolver in
compatibility mode. Feature decisions use typed capability helpers and numeric
limits use the shared plan presets.

---

## Firestore Rules

Examples:

* planLimit mirror
* planHasCapability mirror
* property counter validation
* device counter validation

Firestore Rules cannot import the runtime package, so their narrow mirror is
kept centralized in these two functions and covered by emulator parity tests.

---

## Family Account Counters

Counters currently stored on:

familyAccounts/{accountId}

Examples:

* propertyCount
* deviceCount

Counters should remain synchronized with subscription enforcement logic.

---

# Team Member Billing Rules

Team members do not own subscriptions.

Expected behavior:

* No billing management access.
* No upgrade prompts.
* No subscription ownership.
* No Stripe customer ownership.

Billing remains associated with the account owner.

---

# Tenant Billing Rules

Tenants do not participate in subscription billing.

Expected behavior:

* No billing management access.
* No upgrade prompts.
* No Stripe customer ownership.

---

# Environment Configuration

Frontend requires Stripe public configuration and plan pricing identifiers.

Functions require:

* STRIPE_SECRET_KEY
* STRIPE_WEBHOOK_SECRET

Plan-specific price identifiers are configured through environment variables.

Review deployment configuration before changing billing behavior.

---

# Testing

## Stripe test cards

Stripe test card numbers are public testing data. They belong in this guide,
not in `.env` files, GitHub Secrets, Firebase Secret Manager, or customer-facing
application copy.

| Scenario | Card number | Expected result |
| --- | --- | --- |
| Successful payment | `4242 4242 4242 4242` | Checkout succeeds without a required authentication challenge. |
| Generic decline | `4000 0000 0000 0002` | Checkout reports a declined card and does not grant paid access. |
| 3D Secure authentication | `4000 0025 0000 3155` | Checkout requires the Stripe test authentication flow. |

For interactive Checkout testing, use any future expiration date, any
three-digit CVC, and any valid postal code. Never enter real payment details in
Beta or another Stripe test-mode environment. Consult the
[Stripe test card documentation](https://docs.stripe.com/testing?testing-method=card-numbers)
for additional scenarios and current behavior.

## Beta Checkout validation

Maintley Beta must use Stripe test-mode publishable and secret keys, test-mode
prices, and a Beta webhook endpoint. A complete validation should:

1. Register or sign in to a disposable Beta account on the Free plan.
2. Start a Homeowner+ monthly or annual Checkout.
3. Complete Checkout with the successful test card.
4. Confirm Stripe created a test customer and test subscription.
5. Confirm Maintley records the Stripe customer and subscription identifiers,
   resolves the `homeowner_plus` plan, and exposes Homeowner+ capabilities.
6. Confirm the subscription is visible from the account billing surface.
7. Cancel or delete the test subscription and remove disposable test data.

Checkout intent alone is not a successful subscription. Verification requires
an active or trialing Stripe subscription and synchronized Maintley billing
state.

Useful commands:

npm run test:stripe:sandbox

npm run test:stripe:cards:sandbox

npm run test:stripe:webhook:sandbox

npm run test:stripe:e2e

npm run test:stripe:all

Use Stripe test mode for validation.

---

# Documentation Boundaries

## BILLING.md

Defines:

* Stripe integration
* Subscription lifecycle
* Checkout behavior
* Synchronization logic
* Resource enforcement

---

## MAINTLEY_PLAN_FEATURE_MATRIX.md

Defines:

* Plan positioning
* Feature availability
* Property limits
* Storage limits
* Upgrade messaging
* Customer-facing plan comparisons

If documentation conflicts occur, MAINTLEY_PLAN_FEATURE_MATRIX.md should be treated as the product source of truth and billing implementation should be updated accordingly.

---

# Billing Philosophy

Maintley billing should remain simple and predictable.

Plans should be easy to understand and easy to explain.

Feature gating should follow customer value rather than technical implementation.

Prefer:

* Clear plan differentiation
* Straightforward upgrade paths
* Predictable resource limits

Avoid:

* Excessive feature fragmentation
* Complex add-on packages
* Technical limitations presented as customer-facing value
