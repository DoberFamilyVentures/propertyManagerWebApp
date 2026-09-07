# Service Work Request State Transitions

Status: accepted initial persistence contract. `startServiceWorkRequest` is the
only implemented command; the remaining transitions stay unavailable until
their deterministic policies and typed mutation handlers are implemented.

Every accepted mutation must authorize the account and Property, validate the
expected session revision and idempotency key, update the session, and append
the listed domain event in one server-owned atomic operation. A rejected command
does not update state or append an event. Ordinary answers remain scoped to the
session and are not broad domain events.

| Current state | Accepted command | Next state | Domain events | Condition |
| --- | --- | --- | --- | --- |
| No record | `startServiceWorkRequest` | `draft` | `WorkRequestStarted` | Authenticated actor has access to the account and Property. |
| `draft` | `recordWorkRequestAnswer` | `screening_safety` | None | The initial homeowner description is accepted. |
| `screening_safety` | `recordWorkRequestAnswer` | `screening_safety` | None | More deterministic safety answers are required. |
| `screening_safety` | `recordWorkRequestAnswer` | `safety_stopped` | `SafetySignalDetected` | An urgent safety signal requires normal intake to stop. |
| `screening_safety` | `recordWorkRequestAnswer` | `confirming_context` | None | Safety screening is complete without a stop decision. |
| `confirming_context` | `confirmAffectedContext` | `collecting_details` | `AffectedContextConfirmed` | The homeowner confirms at least one allowed Property, system, area, or Equipment reference. |
| `collecting_details` | `recordWorkRequestAnswer` | `collecting_details` | None | More approved intake information is required. |
| `collecting_details` | `recordWorkRequestAnswer` | `reviewing_context` | `WorkRequestIntakeCompleted` | Required intake information is complete. |
| `reviewing_context` | `recordWorkRequestAnswer` | `reviewing_context` | None | The homeowner includes or removes suggested context without creating a new information gap. |
| `reviewing_context` | `recordWorkRequestAnswer` | `collecting_details` | None | A correction creates a required information gap. |
| `reviewing_context` | `generateWorkRequestReport` | `reviewing_report` | `WorkRequestContextAssembled`, `WorkRequestReportGenerated` | Context selection is valid and the new report version is stored. |
| `reviewing_report` | `generateWorkRequestReport` | `reviewing_report` | `WorkRequestContextAssembled`, `WorkRequestReportGenerated` | Homeowner corrections produce a new report version; the prior version is retained. |
| `reviewing_report` | `approveWorkRequestReport` | `approved` | `WorkRequestReportApproved` | The homeowner approves the complete current report version. |
| `approved` | `createWorkRequestShare` | `shared` | `WorkRequestShared` | The homeowner explicitly confirms the minimum-disclosure share. |
| `shared` | `createWorkRequestShare` | `shared` | `WorkRequestShared` | A separately confirmed additional share is created. |

`safety_stopped` has no normal-intake transition. It records the approved
escalation message key and acknowledgement state but never lets an LLM or client
declare the situation safe. A later recovery or correction flow requires a
separate reviewed policy decision.

`approved` and `shared` report versions are immutable. The initial command set
does not revise them. A later approved correction flow must create a new report
version and require a new approval before that version can be shared.

`ContractorResponseReceived` is reserved for a later, authenticated or
share-scoped response operation. It does not change Property Memory and is not
part of the first server-operation set.
