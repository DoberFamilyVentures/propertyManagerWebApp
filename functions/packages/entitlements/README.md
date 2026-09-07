# Maintley Entitlements

This workspace-local package is the runtime-neutral entitlement boundary shared
by the web application and Firebase Functions.

It currently owns:

* stable plan, capability, and quantitative-limit identifiers
* versioned presets for existing plans and legacy access types
* temporary and permanent internal-grant contracts
* complimentary-to-paid transition and admin-audit type contracts
* default-off rollout flags
* the pure account entitlement resolver
* default-deny `hasCapability` and `getEntitlementLimit` accessors

The resolver has two billing modes:

* `compatibility` preserves existing paid-plan records while synthetic Stripe
  access is reviewed and migrated manually.
* `strict` requires Stripe confirmation before a paid plan contributes access.

Pending Checkout never grants paid access in either mode. Grant merging is
account-scoped and additive: Boolean capabilities use logical OR and numeric
limits use the greatest approved value. Unknown plans, versions, bundles,
capabilities, and limits fall back safely and emit diagnostics.

`service_work_requests.use` is intentionally absent from every plan preset. It
is a private-pilot capability that can be enabled only by an active, trusted
account grant with an explicit capability override. Expired, revoked, unknown,
or client-authored grants do not enable it.

Plans are capability bundles, not a single inheritance ladder. Homeowner+ and
Property represent parallel homeowner and business tracks; neither bundle
implicitly includes the other. Portfolio combines the advanced business and
Property Intelligence capabilities needed at the top of the business track.

The frontend compatibility wrapper explicitly supports legacy records that have
a plan but no subscription status. Functions do not enable that exception.

The package does not issue grants, initiate Stripe billing, or send lifecycle
communications. Those workflows remain disabled until later implementation
phases add trusted persistence and server operations.
