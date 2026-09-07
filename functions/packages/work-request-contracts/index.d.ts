export const WORK_REQUEST_CONTRACT_VERSION: '0.1.0';
export const WORK_REQUEST_SCHEMA_VERSION: 'service_work_request_v1alpha1';
export const WORK_REQUEST_REPORT_SCHEMA_VERSION: 'work_request_report_v1alpha1';
export const WORK_REQUEST_EVENT_SCHEMA_VERSION: 'work_request_event_v1alpha1';
export const HVAC_QUESTION_POLICY_VERSION: 'hvac_intake_v1alpha1';
export const WORK_REQUEST_SAFETY_POLICY_VERSION: 'work_request_safety_v1alpha1';

export const WORK_REQUEST_MODES: readonly [
	'guide_me',
	'some_details',
	'know_what_is_needed',
];

export const WORK_REQUEST_STATES: readonly [
	'draft',
	'screening_safety',
	'safety_stopped',
	'confirming_context',
	'collecting_details',
	'reviewing_context',
	'reviewing_report',
	'approved',
	'shared',
];

export const WORK_REQUEST_COMMAND_NAMES: readonly [
	'startServiceWorkRequest',
	'recordWorkRequestAnswer',
	'confirmAffectedContext',
	'generateWorkRequestReport',
	'approveWorkRequestReport',
	'createWorkRequestShare',
];

export const WORK_REQUEST_EVENT_NAMES: readonly [
	'WorkRequestStarted',
	'SafetySignalDetected',
	'AffectedContextConfirmed',
	'WorkRequestIntakeCompleted',
	'WorkRequestContextAssembled',
	'WorkRequestReportGenerated',
	'WorkRequestReportApproved',
	'WorkRequestShared',
	'ContractorResponseReceived',
];

export type IsoDateTime = string;
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
	| JsonPrimitive
	| readonly JsonValue[]
	| { readonly [key: string]: JsonValue };

export type WorkRequestMode = (typeof WORK_REQUEST_MODES)[number];
export type WorkRequestState = (typeof WORK_REQUEST_STATES)[number];
export type WorkRequestCommandName =
	(typeof WORK_REQUEST_COMMAND_NAMES)[number];
export type WorkRequestEventName = (typeof WORK_REQUEST_EVENT_NAMES)[number];
export type WorkRequestServiceCategory = 'hvac';

export interface WorkRequestVersions {
	contractVersion: string;
	sessionSchemaVersion: string;
	reportSchemaVersion: string;
	eventSchemaVersion: string;
	questionPolicyVersion: string;
	safetyPolicyVersion: string;
	contextPolicyVersion?: string;
	intelligenceVersion?: string;
	promptVersion?: string;
	modelVersion?: string;
}

export type WorkRequestActorType =
	| 'homeowner'
	| 'account_member'
	| 'system'
	| 'contractor'
	| 'assistant';

export type WorkRequestChannel =
	| 'maintley_home'
	| 'server'
	| 'assistant'
	| 'secure_share';

export interface WorkRequestActorReference {
	actorId: string;
	actorType: WorkRequestActorType;
	channel: WorkRequestChannel;
	displayName?: string;
}

export type IntakeQuestionStage =
	| 'issue_description'
	| 'safety'
	| 'affected_context'
	| 'details'
	| 'context_review'
	| 'report_review';

export type IntakeAnswerType =
	| 'text'
	| 'single_choice'
	| 'multiple_choice'
	| 'yes_no'
	| 'number'
	| 'date';

export interface IntakeQuestionChoice {
	id: string;
	label: string;
	helpText?: string;
}

export interface IntakeQuestion {
	id: string;
	policyVersion: string;
	stage: IntakeQuestionStage;
	prompt: string;
	reason: string;
	answerType: IntakeAnswerType;
	required: boolean;
	safetyCritical: boolean;
	choices?: readonly IntakeQuestionChoice[];
	dependsOnObservationIds?: readonly string[];
}

export type IntakeAnswerValue =
	| string
	| number
	| boolean
	| readonly string[]
	| null;

export interface IntakeAnswer {
	id: string;
	questionId: string;
	value: IntakeAnswerValue;
	answeredBy: WorkRequestActorReference;
	answeredAt: IsoDateTime;
	revision: number;
}

export type WorkRequestEvidenceClass =
	| 'homeowner_observation'
	| 'property_memory_fact'
	| 'uploaded_evidence'
	| 'troubleshooting'
	| 'intelligence_guidance'
	| 'possible_interpretation'
	| 'unknown';

export type IntakeObservationKind =
	| 'symptom'
	| 'timing'
	| 'measurement'
	| 'environment'
	| 'troubleshooting'
	| 'requested_outcome'
	| 'other';

export type ObservationSourceKind =
	| 'homeowner_answer'
	| 'deterministic_policy'
	| 'language_model_candidate';

export interface IntakeObservationSource {
	kind: ObservationSourceKind;
	answerId?: string;
	modelUsageId?: string;
}

export interface IntakeObservation {
	id: string;
	kind: IntakeObservationKind;
	statement: string;
	evidenceClass: 'homeowner_observation' | 'troubleshooting';
	source: IntakeObservationSource;
	reviewStatus: 'candidate' | 'confirmed' | 'rejected';
	observedAt?: IsoDateTime;
	confirmedAt?: IsoDateTime;
	confirmedBy?: WorkRequestActorReference;
	createdAt: IsoDateTime;
}

export type SafetySignalCode =
	| 'fire_or_smoke'
	| 'gas_odor'
	| 'sparking_or_exposed_electrical'
	| 'carbon_monoxide_alert'
	| 'active_flooding'
	| 'dangerous_structural_movement'
	| 'critical_system_loss_extreme_weather'
	| 'other_immediate_danger';

export interface SafetySignal {
	id: string;
	code: SafetySignalCode;
	severity: 'urgent' | 'emergency';
	disposition: 'stop_intake';
	policyVersion: string;
	evidenceObservationIds: readonly string[];
	escalationMessageKey: string;
	detectedAt: IsoDateTime;
	detectedBy: 'deterministic_policy';
	acknowledgedAt?: IsoDateTime;
	acknowledgedBy?: WorkRequestActorReference;
}

export interface WorkRequestSafetyReview {
	status: 'pending' | 'clear' | 'stopped';
	policyVersion: string;
	answeredQuestionIds: readonly string[];
	signals: readonly SafetySignal[];
	completedAt?: IsoDateTime;
}

export type AffectedContextKind =
	| 'property'
	| 'space'
	| 'system'
	| 'equipment';

export interface AffectedContextSelection {
	kind: AffectedContextKind;
	referenceId?: string;
	displayName: string;
	source: 'maintley_candidate' | 'homeowner_entered';
}

export interface AffectedContext {
	propertyId: string;
	selections: readonly AffectedContextSelection[];
	confirmedBy: WorkRequestActorReference;
	confirmedAt: IsoDateTime;
}

export interface WorkRequestAttachmentEvidence {
	id: string;
	fileName: string;
	mediaType: string;
	sizeBytes: number;
	caption?: string;
	uploadedBy: WorkRequestActorReference;
	uploadedAt: IsoDateTime;
}

export type WorkRequestContextItemKind =
	| 'equipment'
	| 'space'
	| 'maintenance_event'
	| 'task'
	| 'document_metadata'
	| 'intelligence_finding';

export type WorkRequestContextSelectionReason =
	| 'affected_context'
	| 'category_match'
	| 'recent_related_history'
	| 'open_related_task'
	| 'homeowner_selected'
	| 'intelligence_relevance';

export interface WorkRequestSourceReference {
	recordType: WorkRequestContextItemKind;
	recordId: string;
	recordedAt?: IsoDateTime;
}

export interface WorkRequestContextFact {
	fieldId: string;
	label: string;
	value: JsonPrimitive;
}

export interface WorkRequestContextItem {
	id: string;
	kind: WorkRequestContextItemKind;
	subjectId: string;
	summary: string;
	facts: readonly WorkRequestContextFact[];
	source: WorkRequestSourceReference;
	selectionReasons: readonly WorkRequestContextSelectionReason[];
	selectionStatus: 'included' | 'excluded';
	selectedBy: 'policy' | 'homeowner';
	reviewedAt?: IsoDateTime;
}

export interface WorkRequestContextPackage {
	id: string;
	workRequestId: string;
	accountId: string;
	propertyId: string;
	policyVersion: string;
	affectedContextConfirmedAt: IsoDateTime;
	items: readonly WorkRequestContextItem[];
	createdAt: IsoDateTime;
	createdBy: WorkRequestActorReference;
}

export interface WorkRequestConfidence {
	kind: 'deterministic' | 'extraction' | 'professional';
	level?: 'low' | 'medium' | 'high';
	value?: number;
	reason: string;
}

export interface WorkRequestReportStatement<
	TClassification extends Exclude<
		WorkRequestEvidenceClass,
		'property_memory_fact' | 'uploaded_evidence'
	> = Exclude<
		WorkRequestEvidenceClass,
		'property_memory_fact' | 'uploaded_evidence'
	>,
> {
	id: string;
	text: string;
	classification: TClassification;
	sourceReferenceIds: readonly string[];
	confidence?: WorkRequestConfidence;
}

export interface WorkRequestReportFact {
	id: string;
	label: string;
	value: JsonPrimitive;
	contextItemId: string;
	source: WorkRequestSourceReference;
}

export interface RecommendedServiceCategory {
	category: WorkRequestServiceCategory;
	displayName: string;
	explanation: string;
	confidence: WorkRequestConfidence;
}

export interface WorkRequestReportCorrection {
	id: string;
	sectionId: string;
	previousText?: string;
	correctedText?: string;
	removedSourceReferenceIds?: readonly string[];
	correctedBy: WorkRequestActorReference;
	correctedAt: IsoDateTime;
}

export interface WorkRequestReport {
	id: string;
	workRequestId: string;
	accountId: string;
	propertyId: string;
	versionNumber: number;
	status: 'draft' | 'approved' | 'superseded';
	schemaVersion: string;
	title: string;
	requestedOutcome: string;
	affectedContext: AffectedContext;
	homeownerObservations: readonly WorkRequestReportStatement<'homeowner_observation'>[];
	propertyMemoryFacts: readonly WorkRequestReportFact[];
	uploadedEvidence: readonly WorkRequestAttachmentEvidence[];
	troubleshootingPerformed: readonly WorkRequestReportStatement<'troubleshooting'>[];
	intelligenceGuidance: readonly WorkRequestReportStatement<'intelligence_guidance'>[];
	possibleInterpretations: readonly WorkRequestReportStatement<'possible_interpretation'>[];
	unknowns: readonly WorkRequestReportStatement<'unknown'>[];
	recommendedServiceCategory: RecommendedServiceCategory;
	contractorQuestions: readonly string[];
	safetyReview: WorkRequestSafetyReview;
	disclaimerKeys: readonly string[];
	corrections: readonly WorkRequestReportCorrection[];
	contextPackageId: string;
	versions: WorkRequestVersions;
	generatedAt: IsoDateTime;
	generatedBy: 'deterministic' | 'language_model';
	modelUsageId?: string;
	approvedAt?: IsoDateTime;
	approvedBy?: WorkRequestActorReference;
}

export interface WorkRequestModelUsage {
	id: string;
	workRequestId: string;
	stage: 'observation_extraction' | 'question_wording' | 'report_drafting';
	provider: string;
	model: string;
	promptVersion: string;
	inputTokens: number;
	outputTokens: number;
	latencyMs: number;
	estimatedCostMinorUnits: number;
	currency: string;
	retryCount: number;
	outcome: 'succeeded' | 'rejected' | 'failed' | 'fallback_used';
	createdAt: IsoDateTime;
}

export interface ServiceWorkRequestSession {
	id: string;
	accountId: string;
	propertyId: string;
	serviceCategory: WorkRequestServiceCategory;
	mode: WorkRequestMode;
	state: WorkRequestState;
	revision: number;
	initialDescription?: string;
	currentQuestionId?: string;
	questions: readonly IntakeQuestion[];
	answers: readonly IntakeAnswer[];
	observations: readonly IntakeObservation[];
	safetyReview: WorkRequestSafetyReview;
	affectedContext?: AffectedContext;
	attachments: readonly WorkRequestAttachmentEvidence[];
	contextPackageIds: readonly string[];
	currentReportVersionId?: string;
	modelUsage: readonly WorkRequestModelUsage[];
	versions: WorkRequestVersions;
	createdBy: WorkRequestActorReference;
	updatedBy: WorkRequestActorReference;
	createdAt: IsoDateTime;
	updatedAt: IsoDateTime;
}

export interface WorkRequestCommandContext {
	propertyId: string;
	idempotencyKey: string;
	correlationId?: string;
}

export interface ExistingWorkRequestCommandContext
	extends WorkRequestCommandContext {
	workRequestId: string;
	expectedRevision: number;
}

export interface StartServiceWorkRequestCommand
	extends WorkRequestCommandContext {
	commandName: 'startServiceWorkRequest';
	mode: WorkRequestMode;
	serviceCategory: 'hvac';
	initialDescription?: string;
}

export interface RecordWorkRequestAnswerCommand
	extends ExistingWorkRequestCommandContext {
	commandName: 'recordWorkRequestAnswer';
	answer: IntakeAnswer;
}

export interface ConfirmAffectedContextCommand
	extends ExistingWorkRequestCommandContext {
	commandName: 'confirmAffectedContext';
	affectedContext: AffectedContext;
}

export interface GenerateWorkRequestReportCommand
	extends ExistingWorkRequestCommandContext {
	commandName: 'generateWorkRequestReport';
	includedContextItemIds: readonly string[];
	excludedContextItemIds: readonly string[];
	corrections?: readonly WorkRequestReportCorrection[];
}

export interface ApproveWorkRequestReportCommand
	extends ExistingWorkRequestCommandContext {
	commandName: 'approveWorkRequestReport';
	reportVersionId: string;
	approvalAcknowledgementVersion: string;
}

export interface CreateWorkRequestShareCommand
	extends ExistingWorkRequestCommandContext {
	commandName: 'createWorkRequestShare';
	reportVersionId: string;
	expiresAt: IsoDateTime;
	disclosureVersion: string;
	confirmedContextItemIds: readonly string[];
	confirmedAttachmentIds: readonly string[];
}

export type WorkRequestCommand =
	| StartServiceWorkRequestCommand
	| RecordWorkRequestAnswerCommand
	| ConfirmAffectedContextCommand
	| GenerateWorkRequestReportCommand
	| ApproveWorkRequestReportCommand
	| CreateWorkRequestShareCommand;

export interface ContractorResponse {
	id: string;
	workRequestId: string;
	reportVersionId: string;
	shareId: string;
	tradeMatch: 'yes' | 'no' | 'uncertain';
	clarifyingQuestions: readonly string[];
	proposedApproach?: string;
	proposedScope?: string;
	estimateAssumptions: readonly string[];
	estimateExclusions: readonly string[];
	nextStep?: string;
	respondedBy: WorkRequestActorReference;
	respondedAt: IsoDateTime;
	verificationStatus: 'attributed_proposal';
}

export interface WorkRequestEventPayloadMap {
	WorkRequestStarted: {
		mode: WorkRequestMode;
		serviceCategory: WorkRequestServiceCategory;
	};
	SafetySignalDetected: {
		signalId: string;
		code: SafetySignalCode;
		severity: SafetySignal['severity'];
		disposition: 'stop_intake';
	};
	AffectedContextConfirmed: {
		contextKinds: readonly AffectedContextKind[];
		contextReferenceIds: readonly string[];
	};
	WorkRequestIntakeCompleted: {
		confirmedObservationIds: readonly string[];
		answeredQuestionIds: readonly string[];
	};
	WorkRequestContextAssembled: {
		contextPackageId: string;
		includedContextItemIds: readonly string[];
	};
	WorkRequestReportGenerated: {
		reportVersionId: string;
		versionNumber: number;
		generatedBy: WorkRequestReport['generatedBy'];
	};
	WorkRequestReportApproved: {
		reportVersionId: string;
		approvalAcknowledgementVersion: string;
	};
	WorkRequestShared: {
		shareId: string;
		reportVersionId: string;
		expiresAt: IsoDateTime;
	};
	ContractorResponseReceived: {
		contractorResponseId: string;
		reportVersionId: string;
		tradeMatch: ContractorResponse['tradeMatch'];
	};
}

export interface WorkRequestEventEnvelope<
	TName extends WorkRequestEventName,
> {
	id: string;
	name: TName;
	schemaVersion: string;
	workRequestId: string;
	accountId: string;
	propertyId: string;
	actor: Omit<WorkRequestActorReference, 'displayName'>;
	correlationId: string;
	idempotencyKey: string;
	fromState?: WorkRequestState;
	toState: WorkRequestState;
	occurredAt: IsoDateTime;
	payload: WorkRequestEventPayloadMap[TName];
}

export type WorkRequestEvent = {
	[TName in WorkRequestEventName]: WorkRequestEventEnvelope<TName>;
}[WorkRequestEventName];

export interface WorkRequestTransition {
	readonly to: WorkRequestState;
	readonly events: readonly WorkRequestEventName[];
}

export const WORK_REQUEST_START_TRANSITION: Readonly<{
	command: 'startServiceWorkRequest';
	to: 'draft';
	events: readonly ['WorkRequestStarted'];
}>;

export const WORK_REQUEST_TRANSITIONS: Readonly<
	Record<
		WorkRequestState,
		Readonly<
			Partial<
				Record<WorkRequestCommandName, readonly WorkRequestTransition[]>
			>
		>
	>
>;

export function isWorkRequestMode(value: unknown): value is WorkRequestMode;
export function isWorkRequestState(value: unknown): value is WorkRequestState;
export function isWorkRequestCommandName(
	value: unknown,
): value is WorkRequestCommandName;
export function isWorkRequestEventName(
	value: unknown,
): value is WorkRequestEventName;
export function getWorkRequestTransition(
	from: unknown,
	command: unknown,
	to: unknown,
): WorkRequestTransition | undefined;
export function canTransitionWorkRequestState(
	from: unknown,
	command: unknown,
	to: unknown,
): boolean;
