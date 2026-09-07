'use strict';

const WORK_REQUEST_CONTRACT_VERSION = '0.1.0';
const WORK_REQUEST_SCHEMA_VERSION = 'service_work_request_v1alpha1';
const WORK_REQUEST_REPORT_SCHEMA_VERSION = 'work_request_report_v1alpha1';
const WORK_REQUEST_EVENT_SCHEMA_VERSION = 'work_request_event_v1alpha1';
const HVAC_QUESTION_POLICY_VERSION = 'hvac_intake_v1alpha1';
const WORK_REQUEST_SAFETY_POLICY_VERSION = 'work_request_safety_v1alpha1';

const WORK_REQUEST_MODES = Object.freeze([
	'guide_me',
	'some_details',
	'know_what_is_needed',
]);

const WORK_REQUEST_STATES = Object.freeze([
	'draft',
	'screening_safety',
	'safety_stopped',
	'confirming_context',
	'collecting_details',
	'reviewing_context',
	'reviewing_report',
	'approved',
	'shared',
]);

const WORK_REQUEST_COMMAND_NAMES = Object.freeze([
	'startServiceWorkRequest',
	'recordWorkRequestAnswer',
	'confirmAffectedContext',
	'generateWorkRequestReport',
	'approveWorkRequestReport',
	'createWorkRequestShare',
]);

const WORK_REQUEST_EVENT_NAMES = Object.freeze([
	'WorkRequestStarted',
	'SafetySignalDetected',
	'AffectedContextConfirmed',
	'WorkRequestIntakeCompleted',
	'WorkRequestContextAssembled',
	'WorkRequestReportGenerated',
	'WorkRequestReportApproved',
	'WorkRequestShared',
	'ContractorResponseReceived',
]);

const WORK_REQUEST_START_TRANSITION = Object.freeze({
	command: 'startServiceWorkRequest',
	to: 'draft',
	events: Object.freeze(['WorkRequestStarted']),
});

const freezeTransition = (to, events = []) =>
	Object.freeze({ to, events: Object.freeze([...events]) });

const WORK_REQUEST_TRANSITIONS = Object.freeze({
	draft: Object.freeze({
		recordWorkRequestAnswer: Object.freeze([
			freezeTransition('screening_safety'),
		]),
	}),
	screening_safety: Object.freeze({
		recordWorkRequestAnswer: Object.freeze([
			freezeTransition('screening_safety'),
			freezeTransition('safety_stopped', ['SafetySignalDetected']),
			freezeTransition('confirming_context'),
		]),
	}),
	safety_stopped: Object.freeze({}),
	confirming_context: Object.freeze({
		confirmAffectedContext: Object.freeze([
			freezeTransition('collecting_details', ['AffectedContextConfirmed']),
		]),
	}),
	collecting_details: Object.freeze({
		recordWorkRequestAnswer: Object.freeze([
			freezeTransition('collecting_details'),
			freezeTransition('reviewing_context', ['WorkRequestIntakeCompleted']),
		]),
	}),
	reviewing_context: Object.freeze({
		recordWorkRequestAnswer: Object.freeze([
			freezeTransition('collecting_details'),
			freezeTransition('reviewing_context'),
		]),
		generateWorkRequestReport: Object.freeze([
			freezeTransition('reviewing_report', [
				'WorkRequestContextAssembled',
				'WorkRequestReportGenerated',
			]),
		]),
	}),
	reviewing_report: Object.freeze({
		generateWorkRequestReport: Object.freeze([
			freezeTransition('reviewing_report', [
				'WorkRequestContextAssembled',
				'WorkRequestReportGenerated',
			]),
		]),
		approveWorkRequestReport: Object.freeze([
			freezeTransition('approved', ['WorkRequestReportApproved']),
		]),
	}),
	approved: Object.freeze({
		createWorkRequestShare: Object.freeze([
			freezeTransition('shared', ['WorkRequestShared']),
		]),
	}),
	shared: Object.freeze({
		createWorkRequestShare: Object.freeze([
			freezeTransition('shared', ['WorkRequestShared']),
		]),
	}),
});

const isOneOf = (value, values) =>
	typeof value === 'string' && values.includes(value);

const isWorkRequestMode = (value) => isOneOf(value, WORK_REQUEST_MODES);
const isWorkRequestState = (value) => isOneOf(value, WORK_REQUEST_STATES);
const isWorkRequestCommandName = (value) =>
	isOneOf(value, WORK_REQUEST_COMMAND_NAMES);
const isWorkRequestEventName = (value) =>
	isOneOf(value, WORK_REQUEST_EVENT_NAMES);

const getWorkRequestTransition = (from, command, to) => {
	if (
		!isWorkRequestState(from) ||
		!isWorkRequestCommandName(command) ||
		!isWorkRequestState(to)
	) {
		return undefined;
	}

	const commandTransitions = WORK_REQUEST_TRANSITIONS[from][command] || [];
	return commandTransitions.find((transition) => transition.to === to);
};

const canTransitionWorkRequestState = (from, command, to) =>
	Boolean(getWorkRequestTransition(from, command, to));

module.exports = {
	WORK_REQUEST_CONTRACT_VERSION,
	WORK_REQUEST_SCHEMA_VERSION,
	WORK_REQUEST_REPORT_SCHEMA_VERSION,
	WORK_REQUEST_EVENT_SCHEMA_VERSION,
	HVAC_QUESTION_POLICY_VERSION,
	WORK_REQUEST_SAFETY_POLICY_VERSION,
	WORK_REQUEST_MODES,
	WORK_REQUEST_STATES,
	WORK_REQUEST_COMMAND_NAMES,
	WORK_REQUEST_EVENT_NAMES,
	WORK_REQUEST_START_TRANSITION,
	WORK_REQUEST_TRANSITIONS,
	isWorkRequestMode,
	isWorkRequestState,
	isWorkRequestCommandName,
	isWorkRequestEventName,
	getWorkRequestTransition,
	canTransitionWorkRequestState,
};
