# Deployment

Last reviewed: 2026-07-23

This document describes Maintley's current build, deployment, environment, and release validation process.

Maintley includes:

* React web app in the repository root.
* Firebase Functions in `functions/`.
* Firestore rules in `firestore.rules`.
* Capacitor Android project in `android/`.

---

# Deployment Philosophy

Deployments should be small, intentional, and easy to validate.

Avoid broad deployments when a targeted deployment is safer.

Preferred order:

1. Build and test locally.
2. Deploy backend/rules first when frontend depends on them.
3. Deploy frontend after backend support exists.
4. Validate owner, team member, tenant, and billing-sensitive flows after deployment.

---

# Project Pieces

## React Web App

Location:

```text
/
```

Build output:

```text
build/
```

## Firebase Functions

Location:

```text
functions/
```

Compiled output:

```text
functions/lib/
```

`functions/lib/` is generated and ignored. Firebase predeploy runs the
TypeScript build before validating the upload package. Deployments do not rely
on compiled JavaScript stored in Git.

The source export contract is recorded in
`functions/function-exports.json` and validated before deployment. Update that
inventory only after reviewing the deployed-function and rollback impact.

## Firestore Rules

Rules source:

```text
firestore.rules
```

## Android

Capacitor Android project:

```text
android/
```

---

# Web Build

Build the React production app:

```bash
npm run build
```

The production build is written to:

```text
build/
```

The root `package.json` retains `deploy` and `deploy:gh-pages` as retirement
guards. Both commands intentionally exit with an error before publishing
anything.

No repository-supported command may update the `gh-pages` branch. Production
web traffic is served by Firebase Hosting on `maintleyapp.com`; Firebase Hosting
release versions, not a new Pages publication, are the web rollback boundary.

Release identity is verified from GitHub pull-request metadata rather than from
one merge-subject format. The merge must belong to a merged `Release vX.Y.Z`
pull request from `release/next` into `main`, its merge SHA must equal the build
source, and repository-controlled versions must agree. This accepts GitHub's
standard `Merge pull request #N from ...` subject without weakening the release
boundary.

---

# Firebase Hosting

Firebase Hosting is the release-gated web deployment path. Stable Beta builds
deploy to `hosting:beta`. A metadata-validated `Release vX.Y.Z` PR merge into
`main` deploys the uploaded production artifact to `hosting:prod`.

Production Hosting must not be deployed through the generic manual backend
target input. The release merge, synchronized version files, production build,
and production environment approval form its deployment boundary.

The production custom domain and Firebase default hostname serve the same
BrowserRouter artifact. Function-generated links and callbacks use canonical
clean routes for Stripe returns, lifecycle messages, reminders, and support
links. The packaged Android profile remains the only temporary HashRouter
consumer.

---

# GitHub Pages Retirement Guard

GitHub Pages is no longer Maintley's production host. Publishing remains
disabled so historical repository commands cannot accidentally restore the
retired hosting path.

The former automatic workflow has been removed:

```text
.github/workflows/deploy-web.yml
```

The `deploy` and `deploy:gh-pages` package commands invoke
`scripts/assertGitHubPagesFrozen.cjs` and exit unsuccessfully. Do not bypass the
guard or update the `gh-pages` branch manually. Web rollback uses Firebase
Hosting release history and the documented production deployment process.

PWA files live in `public/` and are copied to the root of `build/` during
`npm run build`:

* `manifest.json`
* `service-worker.js`
* `offline.html`
* `favicon.ico`
* `favicon.svg`
* `apple-touch-icon.png`
* `mstile-150x150.png`
* `icons/*`

The service worker intentionally caches only the app shell, static build
assets, icons, and the offline fallback page. It should not cache Firebase,
Firestore, Storage, document, invoice, or private property-data responses.

---

# Firebase Functions Build

Build Functions:

```bash
yarn --cwd functions build
```

Compiled output is written to:

```text
functions/lib/
```

---

# Firebase Functions Deploy

Deploy all functions:

```bash
firebase deploy --only functions
```

or:

```bash
npm --prefix functions run deploy
```

Prefer deploying specific functions when possible:

```bash
firebase deploy --only functions:sendPushOnNotificationCreate
```

Targeted function deploys reduce risk when changing isolated backend behavior.

---

# Firestore Rules Deploy

Deploy Firestore rules:

```bash
firebase deploy --only firestore:rules
```

Rules source:

```text
firestore.rules
```

Run rule tests before deploying broad rules changes.

---

# Firebase Project Configuration

`firebase.json` currently configures:

* `functions.source`: `functions`
* `firestore.rules`: `firestore.rules`
* `storage.default`: `storage.rules`

The shared Storage target is resolved to a project-specific bucket through
`.firebaserc`; deployments must not hard-code one environment's bucket into
`firebase.json`.

---

# Environment Files

Common local files:

* `.env`
* `.env.local`
* `.env.example`

Do not commit secrets.

The repository should ignore:

* `.env*`
* service account keys
* Android release artifact outputs
* keystores
* private signing files

Important frontend variables include:

* Firebase public config
* Stripe public config
* Stripe price identifiers where needed by frontend flows
* `REACT_APP_FIREBASE_WEB_PUSH_VAPID_KEY`, required for browser push
  notification registration
* `REACT_APP_FIREBASE_MEASUREMENT_ID`, optional for Firebase Analytics / GA4
* `REACT_APP_ENABLE_ANALYTICS`, optional; set to `true` only when production
  analytics collection is intended
* `REACT_APP_FIREBASE_FUNCTIONS_EMULATOR_HOST`, optional for local development
  when routing callable Functions to the emulator, such as `localhost:5001`

Important backend configuration includes:

* Stripe secrets
* Stripe webhook secret
* Email provider credentials
* Firebase Functions params/secrets
* Plan price identifiers

The GitHub `production` environment owns non-sensitive production build and
Functions configuration as environment variables. Important variables include:

* Frontend Firebase config:
  * `PROD_REACT_APP_FIREBASE_API_KEY`
  * `PROD_REACT_APP_FIREBASE_AUTH_DOMAIN`
  * `PROD_REACT_APP_FIREBASE_PROJECT_ID`
  * `PROD_REACT_APP_FIREBASE_STORAGE_BUCKET`
  * `PROD_REACT_APP_FIREBASE_MESSAGING_SENDER_ID`
  * `PROD_REACT_APP_FIREBASE_APP_ID`
  * `PROD_REACT_APP_FIREBASE_MEASUREMENT_ID`, optional for analytics
  * `PROD_REACT_APP_ENABLE_ANALYTICS`, optional; set to `true` to enable
    production analytics
* `PROD_FIREBASE_PROJECT_ID` for Firebase deploy targeting; if omitted, the
  deploy workflow falls back to `PROD_REACT_APP_FIREBASE_PROJECT_ID`
* `PROD_REACT_APP_FIREBASE_WEB_PUSH_VAPID_KEY` for browser push builds
Repository secrets remain limited to credentials such as
`FIREBASE_SERVICE_ACCOUNT_JSON` for Firebase rules and Functions deployment.
* Stripe price IDs for non-interactive Functions deploy:
  * `PROD_STRIPE_HOMEOWNER_PLUS_MONTHLY_PRICE_ID`
  * `PROD_STRIPE_HOMEOWNER_PLUS_ANNUAL_PRICE_ID`
  * `PROD_STRIPE_PROPERTY_MONTHLY_PRICE_ID`
  * `PROD_STRIPE_PROPERTY_ANNUAL_PRICE_ID`
  * `PROD_STRIPE_PORTFOLIO_MONTHLY_PRICE_ID`
  * `PROD_STRIPE_PORTFOLIO_ANNUAL_PRICE_ID`

The Firebase deploy workflow reads the six backend price identifiers directly
from the GitHub `production` environment. Browser Firebase configuration and
publishable Stripe configuration also live there as `PROD_REACT_APP_*`
variables. Retired plan identifiers must be removed rather than retained as
fallback configuration.

The GitHub `release-validation` environment mirrors only the declared
`PROD_REACT_APP_*` browser variables from `.env.prod`. It allows pull requests
targeting Main to compile the production frontend without granting access to
the protected `production` environment, deployment identity, Functions
configuration, or secrets. Main push builds use `production` so the released
commit reports the required production `build` status before Beta alignment.
Synchronize the browser-only validation environment with:

```bash
yarn github-env:sync --environment release-validation
yarn github-env:sync --environment release-validation --apply
```

## GitHub Actions rollout variables

Rollout flags and non-sensitive rollout dates belong in:

```text
GitHub repository
  > Settings
  > Secrets and variables
  > Actions
  > Variables
  > New repository variable
```

Do not add these values under **Secrets**. The workflows read them through the
GitHub Actions `vars` context and apply safe disabled defaults when a variable
is absent.

| Repository variable | Value format | Workflow destination | Purpose |
| --- | --- | --- | --- |
| `ENABLE_HOMEOWNER_PLUS_PRODUCT_TRIAL` | `true` or `false` | Web: `REACT_APP_ENABLE_HOMEOWNER_PLUS_PRODUCT_TRIAL`; Functions: `ENABLE_HOMEOWNER_PLUS_PRODUCT_TRIAL` | Enables the Homeowner+ internal trial surfaces and issuance path. |
| `ENABLE_INTERNAL_ENTITLEMENT_GRANT_ISSUANCE` | `true` or `false` | Web: `REACT_APP_ENABLE_INTERNAL_ENTITLEMENT_GRANT_ISSUANCE`; Functions: `ENABLE_INTERNAL_ENTITLEMENT_GRANT_ISSUANCE` | Enables internal entitlement-grant administration and server issuance. |
| `ENABLE_COMPLIMENTARY_PAID_TRANSITIONS` | `true` or `false` | Functions: same name | Enables grant-aware Checkout timing and audited conversion. Keep false until deployed Checkout, webhook, cancellation, and first-charge validation passes. |
| `ENABLE_ACCESS_LIFECYCLE_COMMUNICATION` | `true` or `false` | Functions: `ENABLE_ACCESS_LIFECYCLE_COMMUNICATION` | Enables lifecycle delivery processing. |
| `HOMEOWNER_PLUS_TRIAL_ELIGIBILITY_START_AT` | ISO 8601 timestamp, for example `2026-08-01T00:00:00-04:00` | Functions: same name | Sets the first-property trial eligibility boundary. Leave empty until a launch boundary is approved. |
| `ENABLE_TRUSTED_SETUP_PLAN_ACTIVATION` | `true` or `false` | Web: `REACT_APP_ENABLE_TRUSTED_SETUP_PLAN_ACTIVATION` | Routes setup-plan activation through the trusted callable after its backend deployment is verified. |
| `ENABLE_TRUSTED_RECURRING_TASK_WRITES` | `true` or `false` | Web: `REACT_APP_ENABLE_TRUSTED_RECURRING_TASK_WRITES` | Routes recurring-task creation, schedule edits, and next-occurrence generation through `manageRecurringTask` after the callable is deployed and verified. |
| `ENABLE_COMPLIMENTARY_ACCESS_CODES` | `true` or `false` | Web: `REACT_APP_ENABLE_COMPLIMENTARY_ACCESS_CODES`; Functions: `ENABLE_COMPLIMENTARY_ACCESS_CODES` | Enables customer preview and redemption of pre-provisioned internal access-code programs. It never enables Stripe billing. |
| `ENABLE_TRUSTED_STORAGE_QUOTA` | `true` or `false` | Web: `REACT_APP_ENABLE_TRUSTED_STORAGE_QUOTA`; Functions: `ENABLE_TRUSTED_STORAGE_QUOTA` | Routes uploads and usage displays through server quota reservations. Storage-rule enforcement is activated separately after compatible clients deploy. |
| `STRIPE_CUSTOMER_PORTAL_URL` | Public Stripe-hosted portal URL | Web: `REACT_APP_STRIPE_CUSTOMER_PORTAL_URL` | Sends customers to Stripe's hosted billing-management login. This is a repository variable, not a secret. |

`ENABLE_TRUSTED_SETUP_PLAN_ACTIVATION` must remain `false` or absent until
`activatePropertySetupMaintenancePlan` is deployed and authorization has been
validated. Enable it by setting the repository variable to `true`, then run a
new web build. Roll back by setting it to `false` and rebuilding the web app.

`ENABLE_TRUSTED_RECURRING_TASK_WRITES` must remain `false` or absent until
`manageRecurringTask` is deployed and authorization has been validated. After a
successful observation period, remove the direct client recurrence fallback,
make the trusted writer mandatory, tighten rules to reject every direct client
recurrence write, and remove the rollout flag. Client entitlement checks may
remain only for contextual interface messaging.

Production rollout state approved on 2026-07-30 enables the Homeowner+ product
trial, internal entitlement-grant issuance, grant-aware paid transitions,
access-lifecycle communication, trusted setup-plan activation, trusted recurring
task writes, and trusted storage quota. The first-property trial eligibility
boundary is `2026-07-25T16:19:46-04:00`; accounts created before that instant are
not automatically enrolled. Customer-entered complimentary access-code
redemption remains disabled because Maintley uses the admin grant flow.
`ENTITLEMENT_COMPARE_MODE` also remains disabled because it is diagnostic only.

These enabled flags are migration controls, not permanent configuration. After
the Firebase migration is stable, remove each completed rollout flag and its
obsolete fallback so the validated trusted path becomes standard behavior.

`.env.example` is the committed environment contract. Each entry includes
`@maintley-env` metadata defining its scope, delivery system, applicable
environments, required status, optional source, and safe environment defaults.
Real values never belong in that file.

Section headings and declaration order in `.env.example` also control the
organization of generated browser, operations, and Functions dotenv files.
Generated templates retain empty declared entries so missing configuration is
visible and can be completed without manually discovering variable names.

Run `yarn env:contract:validate` whenever the application, Functions, scripts,
or workflows introduce environment configuration. The validation fails when a
Maintley-owned runtime variable is referenced without a contract declaration.
The ignored root `.env` is the single local control file for actual non-secret
values. It is organized into `LOCAL_`, `BETA_`, and `PROD_` sections. Run
`yarn env:organize --apply` to preserve those values while regenerating the
standard target files for both the application and Functions:

```text
.env.local
.env.beta
.env.prod
functions/.env.beta
functions/.env.prod
functions/.env.local
```

Local application and Functions configuration inherits the complete Beta/test
baseline. By default, the localhost application uses the deployed Maintley Beta
Authentication, Firestore, Storage, and callable Functions so primary workflows
match the stable Beta environment. The `LOCAL_` section contains only values
that differ from Beta or exist solely for opt-in local tooling. Backend values
with a declared browser `source` are entered once in the control file and
derived into the matching Functions target. The generic
`.env.production` and `.env.development.local` are legacy migration inputs only
and must not be used by new workflows. The ambiguous `functions/.env` file is
prohibited because Firebase can merge it into project-specific deployments; it
must be removed after the standardized files are generated. Every real `.env*`
file is ignored and must not be committed.

The control file includes commented inventories for secrets without storing
their values. Beta and Production Firebase secrets belong in the matching
Firebase Secret Manager project. E2E secrets belong in the GitHub development
environment. Android keystore passwords remain in `.env.operations.local`
because signing is local. Service-account and sandbox credentials are optional
local tooling inputs needed only when running their related administrative
scripts.

Firebase Secret Manager values must never be copied into `functions/.env*`.
The Functions deploy-package validator rejects any declared Firebase secret
with a non-empty dotenv assignment. Run `yarn env:functions:sanitize` to remove
legacy plaintext assignments without printing their contents. Emulator-only
secret overrides belong in `functions/.secret.local`, using test credentials.

Firebase emulators remain available for isolated rules, integration, E2E, and
Functions development. To route callable Functions to a running local emulator,
set `REACT_APP_FIREBASE_FUNCTIONS_EMULATOR_HOST=localhost:5001` for that
development process or add the matching `LOCAL_` override to the ignored root
`.env` control file and rerun `yarn env:organize --apply`. Clear the override and
restart the development server to return localhost to the deployed Beta
Functions. Automated Firestore and Storage rules tests continue to manage their
own emulator configuration independently.

Analytics is the intentional exception to the shared Beta baseline. Stable Beta
uses the Beta Analytics property, while localhost defaults
`REACT_APP_ENABLE_ANALYTICS=false` so developer navigation does not affect Beta
reporting or require analytics scripts during local work. The environment
contract's `localDefault` metadata records this difference and the organizer
persists it as a generated local override.

Email verification is also environment-specific. Set both
`REACT_APP_REQUIRE_EMAIL_VERIFICATION` and `REQUIRE_EMAIL_VERIFICATION` to
`false` for Beta/local and `true` for production. Both application and Functions
implementations fail closed when the value is missing or unrecognized. The
browser flag controls email prompts and route gates; the Functions flag remains
the authority for activating a profile without Firebase Auth verification.

`COMPLIMENTARY_ACCESS_CODE_PEPPER` is a Firebase Functions secret, not a GitHub
Actions variable and not a normal dotenv value in production. Create it with
`firebase functions:secrets:set COMPLIMENTARY_ACCESS_CODE_PEPPER` using at least
32 random characters before deploying the access-code callables. `RESEND_API_KEY`
remains the Firebase Functions secret used by lifecycle delivery. Do not copy
either value into repository Variables.

`FUNCTIONS_CONFIG_EXPORT` is a required JSON secret retained only as a
compatibility fallback for legacy `functions.config()` Stripe values. New
environments using the dedicated Stripe secrets and price parameters must set it
to an empty JSON object (`{}`); do not duplicate current Stripe credentials into
the compatibility payload.

Trusted storage quota rollout has three deliberate steps: deploy the callable,
triggers, and compatible clients while both rollout controls are disabled; set
`ENABLE_TRUSTED_STORAGE_QUOTA=true` and validate reservations internally; then
set `appConfig/entitlementRollout.trustedStorageQuotaRequired=true` only after
all supported clients use reservations. The Firestore setting is server-managed
operational configuration, not a GitHub Actions variable. Reverting it to
`false` immediately restores the compatibility rule without deleting usage
state or files.

Account quota covers property documents and photos, equipment and maintenance
files, and account team files. Authentication profile avatars are identity UI
assets and are intentionally outside the property-record quota.

Frontend builds run `scripts/validateFrontendEnv.cjs` before `react-scripts
build`. Missing values or placeholder values such as `YOUR_STORAGE_BUCKET`
block the build so production cannot publish a bundle pointed at a placeholder
Firebase project or Storage bucket.

During production CI, the contract-managed Functions values are written into a
temporary `functions/.env.prod` file before `firebase deploy --project prod`
runs. Firebase loads the project-alias-specific file during non-interactive
deployment. Beta Functions deployments use `functions/.env.beta`; emulator
overrides use `functions/.env.local`. Local application builds use the matching
root `.env.prod`, `.env.beta`, or `.env.local` file through Maintley's build and
runtime helpers rather than relying on framework-specific naming differences.

`yarn github-env:sync --environment <development|production>` performs a
values-hidden dry run against the corresponding GitHub environment. Add
`--apply` to upsert declared non-secret values. Pruning additionally requires
`--prune --confirm-prune <environment>`. The tool derives its managed variable
set from `.env.example`, validates Firebase project and Stripe mode boundaries,
and retries GitHub verification while environment-variable writes propagate.

`yarn env:bootstrap --environment all --strict --check-secrets` provides the
full readiness gate. It checks required non-secret values and verifies required
secret names in each Firebase project without displaying secret contents.
Before a Beta Functions deployment, CI also reads the Beta
`STRIPE_SECRET_KEY` without printing it and requires the `sk_test_` prefix. A
live Stripe secret blocks the deployment.

The shared `@maintley/entitlements` package is stored at
`functions/packages/entitlements`. Firebase uploads only the configured
Functions source directory, so local file dependencies used by Functions must
remain inside that boundary. Run `yarn validate:functions-package` before a
Functions deployment. The Firebase predeploy hook and GitHub Actions workflow
also run this validation automatically.

Review environment setup before deploying billing, email, or notification changes.

## GitHub Actions Firebase Deploy Authentication

Stable Firebase Hosting, rules, and Functions deploy through:

```text
.github/workflows/firebase-deploy-environments.yml
```

Merges into `beta` use keyless Workload Identity Federation and the GitHub
`development` environment. The existing production path on `main` continues to
authenticate with `google-github-actions/auth` using the
`FIREBASE_SERVICE_ACCOUNT_JSON` repository secret while the staged production
identity migration is validated. Production WIF has a dedicated read-only
canary identity; it is not yet authorized or selected for deployment.

Every merge into `beta` builds and deploys the stable `hosting:beta` target.
Backend selection remains source-based: `functions/` changes deploy Functions,
`firestore.rules` changes deploy Firestore rules, and `storage.rules` changes
deploy Storage rules. The stable build artifact must complete before the deploy
job can authenticate. Deployments are serialized so two merges cannot update
the shared development environment concurrently. The same lock serializes
opt-in pull-request backend previews and abandoned-preview restoration. A
successful stable Beta deployment clears any remaining pull-request backend
ownership label. If any PR owns the backend when a merge reaches `beta`, the
stable deployment ignores source-based backend selection for that run and
reclaims the complete Functions, Firestore-rules, and Storage-rules state from
the merged `beta` commit before clearing ownership.

### One-way branch promotion

Repository changes move in one direction:

```text
feature branch -> beta -> release/next -> main
```

### Beta version sequence

Every feature PR targeting Beta receives a projected prerelease version such
as `v2.15.0-beta.1`. The number after `beta` counts PRs accumulated since the
latest production release. Additional commits to the same open PR rebuild its
preview under the same version; the next PR becomes `.2`.

The Firebase preview comment and Beta navigation footer display this label.
The stable Beta deployment recalculates it from merged PRs, so the deployed
application always identifies the newest accumulated candidate. Git commit
details remain available in GitHub internally but are intentionally omitted
from the homeowner-facing Beta label.

Beta labels do not modify `package.json`, Android `versionName`, tags, or GitHub
Releases. Those remain owned by Release Prep and production finalization.
Release Prep carries the latest accumulated Beta label into the top of the
`release/next` PR description so reviewers can see which Beta build produced
the candidate.

Do not open synchronization PRs from `main` back into `beta`. After a normal
release is deployed, tagged, and published, the finalizer verifies that the
released commit contains the current Beta tip and advances the `beta` reference
to that exact Main release commit using a non-forced fast-forward. This creates
no reverse merge commit and introduces no code that was not already promoted
from Beta.

If Beta advances after a release candidate is prepared, production deployment
fails before publishing and the release PR must be refreshed. If Beta has
diverged when alignment runs, alignment fails without changing either branch.
Force updates are never allowed.

The Beta ruleset does not enforce a pull-request-only update rule. That rule
would also reject the finalizer's direct reference fast-forward. Feature work
still targets Beta through pull requests as the normal operating policy so it
receives preview, review, and required-check coverage. Direct Beta updates are
reserved for the guarded alignment workflow. Required checks remain enabled;
force updates and branch deletion remain blocked. Before release finalization
updates Beta, the Main deployment workflow reports `Beta backend readiness` on
the exact released commit using the GitHub `development` environment and the
Maintley Beta read-only configuration check. Finalization depends on that job,
so the incoming Main commit satisfies Beta's required readiness context without
granting the workflow token a branch-protection bypass.

`.github/workflows/align-beta-with-main.yml` provides an explicit Main-only
alignment command for exceptional operational fixes that landed directly in
Main. It applies the same ancestry checks and is not a substitute for the normal
feature promotion path. It establishes `Beta backend readiness` on the current
Main commit before GitHub's workflow token performs the reference update, so
the update satisfies the same required check as normal release alignment. A
workflow-token reference update does not trigger a second Beta deployment or
release-prep run.

An authenticated release-PR merge into `main` always deploys `hosting:prod`. Functions,
Firestore rules, and Storage rules retain source-based target detection and are
added only when their owned files changed. Hosting-only releases therefore
cannot redeploy Functions or rules. The matching tag and GitHub Release are
created idempotently only after every selected Firebase target succeeds and
the deployed production Hosting origin returns the Maintley app shell for `/`,
`/login`, `/registration`, and `/forgot-password`. The static `/legal/` public
resource is intentionally outside this BrowserRouter app-shell check. The smoke
check uses the default Firebase `web.app` hostname derived from the verified
production project ID, so it validates the new deployment even while
custom-domain DNS still points at a previous host. A failed route check blocks
tag and GitHub Release creation.

The release PR's marked `Customer release notes preview` is the approved source
for the published GitHub Release body. Finalization validates that its heading
matches the prepared package version, preserves separately generated engineering
metadata, and creates or reconciles the GitHub Release only after deployment.
This prevents the merge commit from being reclassified as a new patch release
and keeps recovery reruns idempotent after the tag already exists.

If a valid release merge passes its build but Hosting fails before deployment,
the same workflow supports an explicit recovery dispatch. Set
`deploy_targets` to only `hosting:prod` and `release_recovery_sha` to the exact
failed release merge SHA. The workflow checks out and rebuilds that immutable
commit, validates its release PR through GitHub, deploys only production
Hosting, and finalizes the tag and GitHub Release against that same SHA. A
manual Hosting dispatch without both constraints is rejected.

A non-release operational merge into `main` still runs the production build
checks but selects no Firebase targets and does not invoke release finalization.
This permits a deployment-workflow repair to land without accidentally
publishing that repair commit as an application release.

The production default Hosting hostname is intentionally populated before DNS
cutover. This does not move customer traffic: the custom domain continues to
resolve to the frozen GitHub Pages deployment until the later DNS phase.

External GitHub Actions are pinned to immutable 40-character upstream commit
SHAs with their reviewed release versions retained as comments. Dependabot
opens grouped weekly GitHub Actions updates against `beta`; those updates use
the same PR checks and promotion path as other repository changes. Workflow
defaults remain read-only, and write or OpenID Connect permissions belong only
to the jobs that require them.

Recommended setup:

1. Create a dedicated Google Cloud service account for GitHub deploys.
2. Grant only the roles needed to deploy Firestore rules and Cloud Functions.
3. Create a JSON key for that service account.
4. Add the minified JSON value as the GitHub Actions repository secret:

```text
FIREBASE_SERVICE_ACCOUNT_JSON
```

Treat this JSON like a password. Do not commit it to the repository.

`FIREBASE_TOKEN` is no longer used by the active Firebase deploy workflow.

### Development deployment identity

The Firebase Hosting migration uses keyless Workload Identity Federation for
the development environment. GitHub environment variables identify the
development project, provider, and service account:

```text
DEV_FIREBASE_PROJECT_ID
DEV_GOOGLE_WORKLOAD_IDENTITY_PROVIDER
DEV_GOOGLE_SERVICE_ACCOUNT
```

The public Firebase browser configuration is stored in the same environment as
`DEV_REACT_APP_FIREBASE_*` variables. These values identify the development
Firebase app and are embedded in browser builds; they are not service-account
credentials. A separate Stripe test publishable key is still required before a
functional development frontend can be built and deployed. Never substitute
the production Stripe publishable key in a development build.

The Workload Identity provider admits tokens only from
`DoberFamilyVentures/propertyManagerWebApp` jobs that declare the GitHub
`development` environment. The dedicated service account is scoped to the
`maintleybeta` project. Its baseline permissions are Firebase Hosting Admin,
API Keys Viewer, Secret Manager Viewer, and Service Usage Viewer. The read-only
Secret Manager and Service Usage roles allow readiness checks to confirm
required secret metadata and API availability without printing secret values.

Stable backend deployment extends that same identity only within
`maintleybeta`. Grant Firebase Rules Admin and Cloud Storage for Firebase Admin
before the workflow must publish those rule targets. Functions deployment also
requires the applicable Cloud Functions deployment permissions, Service Account
User on the runtime service account, and the targeted supporting roles described
below for Scheduler, Extensions, billing inspection, and secret access. These
roles do not grant access to the production project.

Do not create or store a JSON key for this development identity. Add further
roles only when a changed Beta target requires them. The current production
workflow continues using its existing credential path until the production
identity migration gates are completed.

Keyless authentication is checked by:

```text
.github/workflows/verify-development-deployment-identity.yml
```

The workflow performs no deployment. On relevant pushes to `beta`, or
when manually dispatched after it exists on the default branch, it verifies
that GitHub can impersonate the development service account and that the
expected Maintley Beta Hosting site is visible. It intentionally avoids loading
application code or printing access tokens.

### Production deployment identity migration

Production Workload Identity Federation is intentionally staged. The GitHub
`production` environment provides:

```text
PROD_FIREBASE_PROJECT_ID
PROD_GOOGLE_WORKLOAD_IDENTITY_PROVIDER
PROD_GOOGLE_SERVICE_ACCOUNT
```

The provider admits tokens only from
`DoberFamilyVentures/propertyManagerWebApp` jobs that declare the GitHub
`production` environment and run from `refs/heads/main`. The GitHub production
environment permits `main` and `release/next` because release validation needs
production build variables. The provider's independent Main-ref condition
prevents release candidates from receiving the cloud identity. During the
first gate, the dedicated identity has only project metadata and Firebase
Hosting read access. It cannot deploy or act as a Functions runtime service
account.

Keyless production access is checked by:

```text
.github/workflows/verify-production-deployment-identity.yml
```

The workflow performs no deployment. It verifies the exact project, provider,
service account, active authenticated identity, and expected production Hosting
site. The production deploy workflow must not switch from
`FIREBASE_SERVICE_ACCOUNT_JSON` until this read-only check passes from Main and
the exact deploy-role expansion is separately approved. See
`project-docs/reports/2026-08-02-production-wif-migration.md` for the migration
gates and rollback sequence.

Pull requests targeting `beta` use:

```text
.github/workflows/firebase-hosting-preview.yml
```

The preview workflow builds against only `DEV_REACT_APP_*` configuration,
requires the Stripe publishable key to start with `pk_test_`, disables staged
server-owned feature flags, and deploys only the `beta` Hosting target to a
seven-day preview channel. The workflow also verifies required non-secret
Functions configuration from the GitHub `development` environment and required
secret names in the Maintley Beta project before deploying the preview. Values
and secret contents are never printed. Pull requests from forks are not
deployed. The build job has no Google identity token; the deploy job downloads
the static artifact, uses the trusted Hosting configuration from the PR base
commit, and authenticates only immediately before the Firebase CLI deployment.
It does not deploy Functions, Firestore Rules, or Storage Rules unless a trusted
maintainer separately activates the guarded Beta backend-preview lifecycle.

### Pull request backend previews

Trusted same-repository pull requests that need real backend validation may use:

```text
.github/workflows/firebase-beta-backend-preview.yml
```

Add the `deploy-backend-to-beta` label after the PR's required checks are
available. The workflow waits for those checks while excluding its own required
deployment check so the gate cannot wait on itself. This preparation occurs
before the workflow acquires the shared Beta deployment lock. After the lock is
acquired, the workflow revalidates the exact PR SHA, repository, state, and base
branch so a queued stale request cannot overwrite a newer Beta backend. It then
reruns the Functions build and Firebase emulator rule suites, verifies the
development project and Stripe test boundary, and deploys the pull request's
complete Functions, Firestore-rules, and Storage-rules state through the `beta`
Firebase alias to `maintleybeta`.
Using the alias ensures Firebase loads the generated `functions/.env.beta`
file during non-interactive deployment. Successful activation replaces the
request label with `beta-backend-active`. Exactly one PR may carry the active
label, and all backend preview and stable Beta deployments share one concurrency
lock.

The shared pull-request preview does not redeploy Firestore indexes. Indexes are
project-wide infrastructure rather than an isolated preview artifact and remain
owned by the stable Beta deployment workflow. A PR that changes
`firestore.indexes.json` may validate the contract in CI, but the index change
becomes active only after the approved change merges into `beta`.

When stable Beta reclaims an active pull-request backend, it redeploys only the
same shared preview targets: Functions, Firestore Rules, and Storage Rules.
Firestore indexes are included only when `firestore.indexes.json` itself changed.
This keeps project-wide index infrastructure outside the preview restoration
lifecycle and requires Firestore index-administration access only for an
intentional index deployment.

While the label is active, later pushes redeploy automatically after required
checks pass. An older queued request fails safely if a later push changes the PR
head before it obtains the deployment lock. Localhost and every Hosting preview
configured for Beta continue to point directly at `maintleybeta`; there is no
per-PR backend copy. Merging the PR allows the normal stable Beta deployment to
make the state durable. Closing the PR without merging deploys the complete
backend from the current `beta` branch
and removes ownership. Neither restoration nor merge cleanup deletes test users,
Firestore records, Storage objects, Stripe test records, or other side effects
created during validation.

Only repository maintainers should apply the request label. Fork pull requests
are rejected before checkout, production project identifiers and live Stripe
keys are rejected, and backend preview deployment never includes Hosting or any
production target. Emulator suites remain required because negative permission
tests and destructive scenarios should not depend on shared Beta data.

After a pull request merges, `firebase-deploy-environments.yml` rebuilds the
approved `beta` commit and promotes that artifact to the stable Maintley Beta
Hosting site. The job refuses to continue unless both Firebase project IDs are
exactly `maintleybeta` and the Stripe browser key is a test key. Functions use a
generated `functions/.env.beta` file from contract-managed GitHub development
variables; required Firebase secret names are checked without exposing their
contents. When Functions deploy, the workflow enforces infrastructure-level
public invocation only for HTTPS and callable Functions, then verifies
`recordUserActivity` and `getFamilyMembers` return a valid callable preflight
from `https://maintleybeta.web.app`. Application authentication and permission
checks remain inside each callable. Ordinary `beta` merges cannot select the
`prod` Firebase alias.

The E2E workflow runs for pull requests targeting either `beta` or `main`.
Require its `e2e` status on both protected branches only after the workflow has
reported successfully at least once for that target branch.

The workflow updates one bot comment on the pull request with the preview URL.
The development customer-portal URL remains pointed at a safe Maintley Beta
support route until Stripe test Customer Portal behavior is configured.

The GitHub deploy service account must also be allowed to act as the Cloud
Functions runtime service account. If deploy fails with:

```text
Missing permissions required for functions deploy. You must have permission iam.serviceAccounts.ActAs
```

grant the GitHub deploy service account the IAM role:

```text
Service Account User
```

on the runtime service account shown in the error, commonly:

```text
PROJECT_ID@appspot.gserviceaccount.com
```

This permission should be granted to the GitHub deploy service account, not to
the runtime service account itself.

The development deploy identity must also be able to update IAM policy on
Maintley Beta HTTPS Functions. Grant a role containing
`cloudfunctions.functions.getIamPolicy` and
`cloudfunctions.functions.setIamPolicy`; `Cloud Functions Admin` is the
practical predefined role. Generation 2 HTTPS Functions additionally require
permission to update Cloud Run service IAM. The workflow grants only
`roles/cloudfunctions.invoker` or `roles/run.invoker` to `allUsers`, which lets
the Firebase callable protocol reach the handler; it does not bypass Maintley's
Firebase Auth, role, ownership, or token checks.

If the browser reports a callable CORS failure, probe the endpoint before
adding application CORS code. An infrastructure `403` without an
`Access-Control-Allow-Origin` header means the invoker policy is missing. The
post-deploy preflight gate treats that state as a failed deployment.

Firestore rules deployment also requires permission to test and release rules
through the Firebase Rules API. If deploy fails with:

```text
Request to https://firebaserules.googleapis.com/...:test had HTTP Error: 403
```

grant the GitHub deploy service account a role that includes Firebase Rules
permissions. The practical project-level role is:

```text
Firebase Rules Admin
```

This lets the deploy workflow validate and publish `firestore.rules`.

Cloud Storage rules use the shared `default` deploy target in `firebase.json`.
`.firebaserc` resolves that target independently for each Firebase project:

```text
maintleybeta -> maintleybeta.firebasestorage.app
mypropertymanager-cda42 -> mypropertymanager-cda42.firebasestorage.app
```

This explicit mapping prevents CI from depending on Firebase's default-bucket
discovery endpoint and keeps Beta and production deployments isolated while
using the same `storage.rules` source. Cloud Storage rules deployment still
requires the deploy service account to read and manage the selected Firebase
Storage bucket. If deploy fails with:

```text
Permission 'firebasestorage.defaultBucket.get' denied
```

grant the GitHub deploy service account:

```text
Cloud Storage for Firebase Viewer
```

If CI should deploy `storage.rules`, grant:

```text
Cloud Storage for Firebase Admin
```

The deploy workflow only includes the `storage` target on push when
`storage.rules` or `firebase.json` changes. Manual workflow runs can include it
by setting deploy targets to:

```text
functions,firestore:rules,storage
```

Firebase Functions deploy may also ask the Firebase Extensions API about
installed extension instances while analyzing the project. If deploy fails with:

```text
Request to https://firebaseextensions.googleapis.com/.../instances had HTTP Error: 403
```

grant the GitHub deploy service account:

```text
Firebase Extensions Viewer
```

If the project later manages extensions through CI, use:

```text
Firebase Extensions Admin
```

For the current Maintley deploy workflow, viewer access is enough because the
workflow only needs Firebase CLI analysis to list extension instances.

Cloud Functions deploy may also check project billing state through the Cloud
Billing API. If deploy fails with:

```text
cloudbilling.googleapis.com/.../billingInfo had HTTP Error: 403
Cloud Billing API has not been used ... or it is disabled
```

enable the Cloud Billing API for the Firebase/GCP project. If the API is
enabled and deploy still fails, grant the GitHub deploy service account a
read-only billing role that can inspect project billing state, such as:

```text
Billing Account Viewer
```

The deploy workflow does not need to manage billing accounts.

Scheduled Cloud Functions require Cloud Scheduler job permissions during
deploy. If deploy fails with:

```text
lacks IAM permission "cloudscheduler.jobs.update"
```

grant the GitHub deploy service account:

```text
Cloud Scheduler Admin
```

This is required for Firebase CLI to create or update scheduler jobs for
scheduled Functions such as task reminders, monthly summaries, seasonal
guidance, and cleanup jobs.

Functions that use Firebase/Google Secret Manager params require the deploy
service account to read secret metadata and versions during deploy analysis. If
deploy fails with:

```text
Permission 'secretmanager.secrets.get' denied
```

grant the GitHub deploy service account:

```text
Secret Manager Secret Accessor
```

### Personal Assistant API secret

Before deploying `managePersonalAssistantCredentials` or `personalAssistantApi`, set a high-entropy HMAC pepper:

```text
firebase functions:secrets:set PERSONAL_ASSISTANT_TOKEN_PEPPER
```

Use at least 32 random bytes and do not reuse or commit the value. Deploy both Functions together. Changing this secret invalidates every existing personal-assistant token, so normal credential rotation should use Settings instead.

For least privilege, grant this on the specific secrets used by deployed
Functions, such as `STRIPE_WEBHOOK_SECRET`. A project-level grant is simpler
but broader.

---

# Deployment Order

## Frontend-Only Changes

Examples:

* UI layout
* copy changes
* dashboard display changes
* client-side filters

Recommended flow:

```bash
npm run build
```

Publish the generated build through the active web hosting channel.

---

## Functions-Only Changes

Examples:

* email workers
* Stripe functions
* notification functions
* scheduled jobs

Recommended flow:

```bash
yarn --cwd functions build
firebase deploy --only functions
```

Prefer targeted deployment when practical.

---

## Firestore Rules Changes

Examples:

* permission changes
* account access changes
* resource limit changes
* collection write rules

Recommended flow:

```bash
npm run test:rules
firebase deploy --only firestore:rules
```

After deploying rules, manually verify:

* account owner access
* team member access
* tenant access
* free plan limits
* paid plan limits

---

## Backend + Frontend Changes

When frontend code depends on new functions, rules, or backend behavior:

1. Deploy Functions and/or Rules.
2. Confirm backend deployment succeeded.
3. Deploy the frontend through the active web hosting channel.

Example:

```bash
yarn --cwd functions build
firebase deploy --only functions
npm run build
```

---

# Android Build

Capacitor commands:

```bash
npm run build:apk
npm run cap:sync
npm run cap:open
```

Manual flow:

```bash
npm run build
npx cap sync android
npx cap open android
```

Signed build helper:

```bash
npm run build:signed
```

The repository contains:

```text
build-signed-apk.sh
```

`build:signed` remains the local signed Android artifact helper while Android
signing secrets stay local. Release notes, version preparation, and app-version
publication are moving into GitHub Actions so source changes remain
PR-reviewable.

Release notes are generated by the `Release Notes` GitHub Action. The action
uses `scripts/generateReleaseNotes.cjs`, reads the git range from the latest
`v*` tag to `HEAD`, and uploads customer-facing notes, engineering notes, and
structured metadata as workflow artifacts. When GitHub metadata is available,
merged PR titles, labels, and files are preferred over raw commit messages.
Direct commits are still included but reported as warnings so releases can move
toward a PR-based pattern.

Pull requests into `beta` use Conventional Commit prefixes as the shared release
classification contract. `feat:` produces a minor release and a **New
Features** entry, `fix:` produces a patch release and a **Fixes** entry, and
`perf:` produces a patch release and an **Improvements** entry. `feat!:` marks a
breaking feature and produces a major release. `refactor:`, `docs:`, `chore:`,
`ci:`, `build:`, and `test:` remain visible in engineering notes but are omitted
from customer notes by default.

The PR-summary workflow resolves the classification from the `Release type:`
declaration in the PR body, an existing PR-title prefix, or the highest-impact
Conventional Commit prefix in the PR. The body declaration takes priority so an
author can correct an earlier automated classification. The workflow then normalizes the PR title so the
summary, release-note category, and semantic-version calculation consume the
same signal. If no classification is available, the workflow fails with an
actionable message instead of guessing from file paths. Explicit
`release:major`, `release:minor`, `release:patch`, and `release:none` labels may
override version impact for exceptional cases.

The release generator treats only explicit breaking markers as major-version
signals. Instructions or ordinary prose that mention the words "breaking
change" do not override a declared `fix:`, `perf:`, or `feat:` classification.

The generator produces two release note layers:

* Customer-facing notes for the public GitHub Release body.
* Engineering notes for technical review, traceability, and release artifacts.

PR authors may add a customer-ready note to the PR body using one of these
headings or inline labels:

```text
Release note: Clearer dashboard focus controls help each user reduce noise.

## Customer Release Note
Maintley now shows clearer dashboard focus controls for each user.
```

Maintley's pull request template includes a `Customer Release Note` section so
user-visible changes can be captured before merge. It also includes a `Release
Classification` declaration for PRs whose title and commits do not already use
Conventional Commit prefixes.

Pull requests targeting `beta` receive a deterministic engineering summary from
`.github/workflows/pull-request-summary.yml`. The workflow updates only the
content between `maintley-pr-summary` markers and preserves every manually
written section outside that block. It derives the summary from GitHub's changed
file metadata and commit subjects; it does not read changed-file contents or
dotenv values. The generated block reports release type, version impact,
customer-note destination, and the source of that classification. The same
workflow normalizes the PR-title prefix. Live build and test conclusions remain
authoritative in the PR's required checks.

The updater uses `pull_request_target` so the write-capable job runs trusted
workflow and generator code rather than code from the feature branch. It checks
out the exact Beta base commit and does not check out or execute the PR head.
Because GitHub evaluates `pull_request_target` workflows from the repository's
default branch, the automation becomes active after this workflow has reached
`main`; its branch filter still limits updates to PRs whose base is `beta`.

`build:signed` does not regenerate release notes. It downloads the successful
`release-notes.yml` artifact for the current `main` commit and reads release
metadata from:

```text
tmp/release-notes.json
```

and uses the customer release note artifact as the GitHub Release body:

```text
tmp/release-notes.customer.md
```

The customer release note artifact is customer-facing. Engineering notes are written to:

```text
tmp/release-notes.engineering.md
```

The action also generates release note previews for pull requests into `main`
and release note artifacts after merges to `main`. When a release has no
customer-facing entries, the customer notes use a short behind-the-scenes
improvement message instead of publishing a blank GitHub Release body.
Pull request previews read the live pull request body from the GitHub Actions
event payload so the `Customer Release Note` section can be previewed before the
PR is merged. Engineering previews also include bullets from the PR body's
`Engineering Summary` section under the related PR entry.
Release-prep PRs such as `Release v2.7.23` are excluded from generated release
notes so they do not appear as customer-facing improvements.

Release version changes are prepared by:

```text
.github/workflows/release-prep.yml
```

The stable development deployment calls Release Prep only after a merged
`beta` commit has built and deployed successfully. Release Prep computes the
highest required bump across the unreleased range and opens or updates the
single `release/next` PR targeting `main`. The release branch is rebuilt from
the exact deployed Beta commit before these version files are updated:

* `package.json`
* `client/package.json`
* `android/app/build.gradle` `versionName`
* `android/app/build.gradle` `versionCode`

The workflow uses `scripts/prepareReleaseVersion.cjs` and
`scripts/validateReleaseVersion.cjs`. If PR `release/next` already exists, its
branch, title, body, version, and release-note preview are updated. Otherwise
the workflow creates it. A later successfully deployed Beta feature or breaking
change updates that same PR with the higher required bump; it does not create a
second release PR or reset the release boundary merely because a new Beta merge
arrived.

Firebase deployment jobs install both the root validation dependencies and the
Functions deployment dependencies. Firestore and Storage emulator gates use
the root rules-testing package, while Functions builds and callable emulator
tests use `functions/node_modules`; neither dependency set may be omitted from
the deployment job merely because the earlier build-check job installed it in a
separate runner. Root dependencies are installed under Node 24 to satisfy the
current web and Capacitor tooling engines; the job then switches to Node 22 for
the Functions package. `firebase.json` declares `nodejs22` as the authoritative
deployed Functions runtime, while the Functions package accepts Node 22 or newer
so root workspace tooling can continue to run under Node 24.

If `package.json` is already ahead of the latest `v*` tag because a release was
prepared but not tagged locally yet, the highest versioned reachable
`Release v...` commit is used as the release-note boundary. Boundary discovery
examines merged ancestry rather than only the first-parent chain so a preserved
release merge cannot make prior release work appear new again. New releaseable
changes are then bumped from that prepared package version.

## Web and Android routing build profiles

`yarn build` and `yarn build:beta` produce Firebase Hosting artifacts with
`BrowserRouter`, `PUBLIC_URL=/`, and clean application routes. `yarn
build:android` produces the transitional Capacitor artifact with `HashRouter`
and relative assets. `cap:sync`, `build:apk`, and `build:signed` invoke the
Android profile explicitly; they must not reuse a previously generated web
artifact.

The Android hash profile is a migration boundary, not a second permanent web
routing system. It will be removed only after App Links, callback handling,
hardware back navigation, and the Play-installed candidate pass the Android
gate in ADR 0028.

When the current `main` commit is the matching release-preparation merge, the
release-note generator keeps that prepared package version. It only bumps from
the prepared version after another product change lands. This allows
`build:signed` to consume the release-notes artifact from the release merge
without requesting an additional, empty version-preparation cycle.

`release/next` promotes the complete approved Beta state, so it is not treated
as a version-only administrative PR. It runs the production-configured build,
unit and rules tests, Functions validation, E2E smoke test, release-note
preview, entitlement-package policy, and `yarn version:validate`. A failed
stable Beta deployment cannot update the release branch.

Release Prep explicitly dispatches those validation workflows after pushing
`release/next`. GitHub intentionally prevents a branch push made by the default
Actions token from recursively triggering other workflows, so relying on the
pull-request synchronization event would leave the updated release commit with
no checks. The dispatches run against the exact `release/next` head and retain
the normal check names used by branch protection.

### Main and Beta branch alignment

Do not open a Main-to-Beta synchronization PR. The normal release finalizer
advances Beta directly to the published Main release only when Git proves the
move is a fast-forward. The update uses GitHub's reference API with
`force=false`; divergence therefore fails without overwriting Beta work.

Feature work continues to target `beta` through pull requests and may use the
normal squash policy even though Beta does not enforce PR-only updates at the
ruleset level. Never force-push either protected branch to repair ancestry. Use
the explicit alignment workflow only for an exceptional operational Main
change and only while Beta remains an ancestor of Main.

Feature pull requests targeting `beta` run the same required Build Check jobs
as ordinary pull requests targeting `main`: entitlement-package policy, unit
and rules tests, environment-appropriate frontend build validation, and the
Functions build. A Beta pull request compiles with the GitHub `development`
environment; a release candidate compiles with `production`. Release-note
previews also run for both targets and derive their comparison boundary from
the pull request's actual base branch, so a feature PR reports only its changes
against `beta` while a release PR is evaluated against `main`.

`Beta PR Gate` and `Release Gate` are the permanent aggregate contexts being
canaried before the branch rulesets stop depending on individual job names.
See [CI_RELEASE_GATES.md](CI_RELEASE_GATES.md) for the current gate contract and
safe ruleset rollout order.

The current app version used by update notifications is derived from
`package.json` through:

```text
src/config/appVersion.ts
```

This prevents the landing page, feedback metadata, and in-app update checks from
drifting away from the package version.

Firestore app-version publication is handled by:

```text
.github/workflows/publish-app-version.yml
```

Android updates are distributed through Google Play. The Publish App Version
workflow writes `appConfig/version` with the current release version, release
notes, and Maintley's Google Play listing URL. Native Android update prompts use
that Play Store URL rather than a direct APK download.

If the dispatch step fails, run it manually after confirming the Google Play
release is ready for users:

```bash
gh workflow run publish-app-version.yml --repo DoberFamilyVentures/propertyManagerWebApp --ref main -f version=2.9.16
```

GitHub Pages publishing is frozen during the migration. The removed Deploy Web
workflow and guarded local deploy commands must not be restored as a temporary
release path.

The release-notes action is not a test workflow. `build:signed` still performs
its local test, build, and asset-budget validation before publishing a release.

The signed Android artifact helper runs `yarn check:asset-budgets` after the
mobile web build. Asset budget target misses up to 15% over target pass with a
warning and make frontend optimization a top priority for the next release.
Asset budget misses more than 15% over target block the release before
Capacitor sync or Android artifact upload proceeds.

Review local signing configuration before running release builds.

Do not commit keystores or signing secrets.

### Android Release Assets

Android build artifacts may still be created for internal validation and app
store maintenance:

```text
maintley-{version}-release.apk
maintley-{version}-release.aab
```

The APK is no longer the public Android distribution path. Public Android users
should install and update Maintley through Google Play:

```text
https://play.google.com/store/apps/details?id=com.maintleyapp
```

Example release asset names for v2.9.16:

```text
maintley-2.9.16-release.apk
maintley-2.9.16-release.aab
```

The Android App Bundle is used for app-store bundle maintenance:

```text
https://github.com/DoberFamilyVentures/propertyManagerWebApp/releases/download/v{version}/maintley-{version}-release.aab
```

The signed release helper derives its repository from `GITHUB_REPOSITORY` when set, or from the authenticated GitHub repository. It should not contain hardcoded organization or download URLs.

The signed Android helper does not create version tags or GitHub Releases. It
requires the matching GitHub Release to exist, then attaches or replaces the APK
and AAB assets without changing the customer release notes. Automatic tag and
GitHub Release creation belongs after a successful production website deploy.
When Firebase Hosting replaces GitHub Pages, that responsibility moves to the
production Firebase Hosting workflow; pull requests use separate preview
channels and must not create version tags or releases.

---

# Pre-Deploy Checks

Recommended checks before most deployments:

```bash
npm run build
npm run check:asset-budgets
yarn --cwd functions build
npm run test:rules
```

For Stripe changes:

```bash
npm run test:stripe:sandbox
npm run test:stripe:cards:sandbox
npm run test:stripe:webhook:sandbox
```

For broad UI confidence:

```bash
npm run e2e
```

For Storage-related changes:

```bash
npm run test:storage
```

Only rely on Storage tests after confirming local Storage rules match deployed Storage rule behavior.

---

# Release Validation Checklist

After deployment, validate the areas affected by the change.

## Core App

* Login works.
* Dashboard loads.
* Properties load.
* Tasks load.
* Equipment load.
* Property detail pages load.
* Mobile navigation works.

## Maintenance Flow

* Create task.
* Complete task.
* Confirm maintenance event is created.
* Confirm completed task appears in history.

## Billing-Sensitive Areas

Validate after billing, plan, rules, or subscription changes:

* Free account limits.
* Homeowner+ access.
* Property plan access.
* Portfolio plan access.
* Upgrade prompts.
* Team member accounts do not see billing ownership UI.
* Tenant accounts do not see billing ownership UI.

## Permission-Sensitive Areas

Validate after rules or role changes:

* Owner access.
* Admin/team member access.
* Limited role access.
* Assigned-property filtering.
* Tenant access.
* Contractor/guest restrictions where applicable.

## Notification Areas

Validate after notification changes:

* In-app notification creation.
* Push token registration.
* Push delivery where supported.
* Notification preferences respected.
* Browser notification permission denial handled calmly.
* Invalid browser push tokens are removed from user records after failed
  delivery.

## Email Areas

Validate after email changes:

* Monthly Property Summary.
* Property Insights.
* Task reminders.
* Team member task reports.
* Seasonal guidance.

---

# Release Notes

Release helper:

```bash
npm run release:notes
npm run release:notes:preview
```

Useful release note options:

```bash
npm run release:notes -- --dry-run
npm run release:notes -- --output RELEASE_NOTES.txt --engineering-output tmp/release-notes.engineering.md --metadata-output tmp/release-notes.json
npm run release:notes -- --bump patch
npm run release:notes -- --version 2.8.0
```

The generator is designed for the PR merge flow: merge feature branches into
`main`, let Release Prep open or update `release/next`, merge the release PR,
then run the signed release from a clean and up-to-date `main` after the Release
Notes artifact for that commit is available. The signed release consumes those
artifacts instead of regenerating notes locally.

`release:notes:preview` writes:

```text
tmp/release-notes.customer.md
tmp/release-notes.engineering.md
tmp/release-notes.json
```

Version helpers exist in:

```text
scripts/initAppVersion.cjs
scripts/prepareReleaseVersion.cjs
scripts/publishAppVersion.cjs
scripts/syncAppVersion.cjs
scripts/updateAppVersion.cjs
scripts/validateReleaseVersion.cjs
```

Use customer release notes to summarize meaningful user-facing changes. Keep
implementation details, dependency updates, and internal release context in the
engineering notes unless they directly affect customers.

---

# Deployment Cautions

* Deploy backend/rules before frontend when frontend depends on new function or rule behavior.
* Deploy frontend after backend changes when UI routes call newly deployed functions.
* Avoid deploying broad rules changes without running rule tests.
* Avoid deploying all functions when a targeted function deploy is sufficient.
* Team member accounts should not be treated as billing owners during deployment validation.
* Tenant accounts should not be treated as billing owners during deployment validation.
* Do not commit secrets, keystores, service account files, or production environment files.
* Verify Firebase project target before deploying.

---

# CI Deployment Gate

The Firebase deployment workflow (`firebase-deploy-environments.yml`) runs a
`build-check` job before deployment. The job installs root dependencies, runs
`yarn test:ci`, and builds the frontend with production Firebase and Stripe
environment variables.

The deploy job requires `build-check` to pass. A failed test or frontend build
therefore prevents the Firebase deployment in that workflow.

## ADR Implementation Tracker Workflow

The ADR tracker workflow lives in:

```text
.github/workflows/adr-implementation-trackers.yml
```

It runs after pushes to `main` that change files in:

```text
project-docs/ADR/
```

The workflow creates or reuses GitHub issues for accepted ADRs that need
implementation tracking. Manual workflow runs default to dry-run mode so the
historical ADR backlog can be audited without creating issues accidentally.

---

# Future Deployment Improvements

Potential improvements:

* Separate staging and production Firebase projects.
* Document environment-specific deploy commands.
* Add deployment checklist automation.
* Wire Storage rules into `firebase.json` if local Storage rules become authoritative.
* Add smoke tests for critical post-deploy flows.


## Approved Future Environment Strategy

Maintley currently deploys directly to the production Firebase project.

ADR 0028 now governs an approved but not-yet-implemented migration to:

* A dedicated development Firebase project
* Feature integration through a protected `beta` branch
* Expiring development Firebase Hosting previews for feature pull requests
* Stable development deployment after merge to `beta`
* Release promotion from `beta` into the production `main` branch
* Production deployment, tag creation, and GitHub Release publication only after
  the release merge passes its production gates
* Separate development Analytics, Stripe test configuration, secrets, and
  synthetic data

Until that migration is implemented and validated, the active production-only
deployment behavior elsewhere in this document remains authoritative.
