# Maintley Work Request Contracts

This private, workspace-local package defines the provider-neutral contract for
Maintley's homeowner Service Work Request workflow. It is the shared language
for future first-party UI, callable Functions, model adapters, assistant
channels, and provider adapters.

Status: contract foundation only. No Firestore collections, callable Functions,
LLM provider, contractor integration, or external sharing behavior is enabled
by this package.

## Boundary

The package owns:

- versioned Service Work Request session and report shapes;
- structured observations, answers, safety decisions, and affected context;
- bounded Property Memory context references with selection reasons;
- homeowner review, correction, and approval records;
- provider-neutral commands and minimized domain-event payloads;
- model-usage telemetry without prompts or unrestricted request content; and
- the accepted state-transition vocabulary.

The package intentionally does not depend on React, Redux, Firebase, Firestore,
Maintley plan names, routes, model-provider SDKs, or contractor-provider types.
Authorization, persistence, safety-policy execution, question selection, report
rendering, and all canonical writes remain server or product responsibilities.
Caller command payloads identify the Property and expected workflow revision;
they do not carry account or actor authority. The server must derive both from
the authenticated principal and current Property access on every operation.

## Domain separation

A Service Work Request is not a Maintenance Request. Existing resident request
records, Redux state, permissions, notifications, reporting, and task conversion
must not import this package or silently create Service Work Request records.

## Versioning

The package version identifies the published contract artifact. Persisted
records also carry separate schema, report, event, question-policy, and
safety-policy versions so a workflow can be reconstructed without treating a
package release as the only source of provenance.

The initial `v1alpha1` identifiers are intentionally pre-persistence. They may
change during review; once records are written, compatibility must be explicit.

## State model

See [STATE_TRANSITIONS.md](STATE_TRANSITIONS.md). Runtime constants and
fail-closed transition helpers are exported by `index.js`; TypeScript contracts
are declared in `index.d.ts`.
