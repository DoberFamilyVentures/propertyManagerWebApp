import { createHash } from 'crypto';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { hasCapability } from '@maintley/entitlements';
import {
	HVAC_QUESTION_POLICY_VERSION,
	isWorkRequestMode,
	isWorkRequestState,
	WORK_REQUEST_CONTRACT_VERSION,
	WORK_REQUEST_EVENT_SCHEMA_VERSION,
	WORK_REQUEST_REPORT_SCHEMA_VERSION,
	WORK_REQUEST_SAFETY_POLICY_VERSION,
	WORK_REQUEST_SCHEMA_VERSION,
	WORK_REQUEST_START_TRANSITION,
	ServiceWorkRequestSession,
	StartServiceWorkRequestCommand,
	WorkRequestActorReference,
	WorkRequestEventEnvelope,
	WorkRequestMode,
} from '@maintley/work-request-contracts';
import { assertAccountRole, resolveAccountIdForUser } from './accountAuthz';
import { resolveEntitlementsForAccount } from './subscriptionEntitlements';

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();

export const SERVICE_WORK_REQUESTS_COLLECTION = 'serviceWorkRequests';
export const WORK_REQUEST_EVENTS_COLLECTION = 'workRequestEvents';
export const SERVICE_WORK_REQUEST_CAPABILITY = 'service_work_requests.use' as const;

const START_COMMAND_KEYS = new Set([
	'commandName',
	'propertyId',
	'idempotencyKey',
	'correlationId',
	'mode',
	'serviceCategory',
	'initialDescription',
]);

const HOMEOWNER_WORK_REQUEST_ROLES = ['account_owner'];
const START_EVENT_NAME = WORK_REQUEST_START_TRANSITION.events[0];

type CallableContextLike = {
	auth?: { uid?: string } | null;
};

export type StartServiceWorkRequestResult = {
	workRequestId: string;
	state: ServiceWorkRequestSession['state'];
	revision: number;
	replayed: boolean;
};

type StartServiceWorkRequestDependencies = {
	db: FirebaseFirestore.Firestore;
	resolveAccountIdForUser: (uid: string) => Promise<string>;
	assertAccountRole: (
		uid: string,
		accountId: string,
		roles: string[],
	) => Promise<void>;
	hasPilotCapability: (accountId: string) => Promise<boolean>;
	now: () => string;
};

const defaultDependencies: StartServiceWorkRequestDependencies = {
	db,
	resolveAccountIdForUser,
	assertAccountRole,
	hasPilotCapability: async (accountId) =>
		hasCapability(
			await resolveEntitlementsForAccount(accountId),
			SERVICE_WORK_REQUEST_CAPABILITY,
		),
	now: () => new Date().toISOString(),
};

const asRecord = (value: unknown): Record<string, unknown> => {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new functions.https.HttpsError(
			'invalid-argument',
			'A Service Work Request command is required.',
		);
	}
	return value as Record<string, unknown>;
};

const requiredText = (
	value: unknown,
	fieldName: string,
	maxLength: number,
): string => {
	if (typeof value !== 'string') {
		throw new functions.https.HttpsError(
			'invalid-argument',
			`${fieldName} is required.`,
		);
	}
	const normalized = value.trim();
	if (!normalized || normalized.length > maxLength) {
		throw new functions.https.HttpsError(
			'invalid-argument',
			`${fieldName} must be between 1 and ${maxLength} characters.`,
		);
	}
	return normalized;
};

const optionalText = (
	value: unknown,
	fieldName: string,
	maxLength: number,
): string | undefined => {
	if (value === undefined) return undefined;
	return requiredText(value, fieldName, maxLength);
};

const normalizeStartCommand = (
	value: unknown,
): StartServiceWorkRequestCommand => {
	const data = asRecord(value);
	const unknownKeys = Object.keys(data).filter((key) => !START_COMMAND_KEYS.has(key));
	if (unknownKeys.length > 0) {
		throw new functions.https.HttpsError(
			'invalid-argument',
			'The Service Work Request command contains unsupported fields.',
		);
	}

	if (data.commandName !== 'startServiceWorkRequest') {
		throw new functions.https.HttpsError(
			'invalid-argument',
			'commandName must be startServiceWorkRequest.',
		);
	}
	if (!isWorkRequestMode(data.mode)) {
		throw new functions.https.HttpsError(
			'invalid-argument',
			'Select a supported Service Work Request mode.',
		);
	}
	if (data.serviceCategory !== 'hvac') {
		throw new functions.https.HttpsError(
			'invalid-argument',
			'Only the HVAC pilot category is currently available.',
		);
	}

	const propertyId = requiredText(data.propertyId, 'propertyId', 160);
	if (propertyId.includes('/')) {
		throw new functions.https.HttpsError(
			'invalid-argument',
			'propertyId must identify one Property document.',
		);
	}
	const idempotencyKey = requiredText(
		data.idempotencyKey,
		'idempotencyKey',
		200,
	);
	const correlationId = optionalText(data.correlationId, 'correlationId', 200);
	if (!/^[a-zA-Z0-9:_-]{8,200}$/.test(idempotencyKey)) {
		throw new functions.https.HttpsError(
			'invalid-argument',
			'idempotencyKey must be an opaque identifier using letters, numbers, colons, underscores, or hyphens.',
		);
	}
	if (correlationId && !/^[a-zA-Z0-9:_-]{8,200}$/.test(correlationId)) {
		throw new functions.https.HttpsError(
			'invalid-argument',
			'correlationId must be an opaque identifier using letters, numbers, colons, underscores, or hyphens.',
		);
	}
	const initialDescription = optionalText(
		data.initialDescription,
		'initialDescription',
		4000,
	);

	return {
		commandName: 'startServiceWorkRequest',
		propertyId,
		idempotencyKey,
		...(correlationId ? { correlationId } : {}),
		mode: data.mode as WorkRequestMode,
		serviceCategory: 'hvac',
		...(initialDescription ? { initialDescription } : {}),
	};
};

const digestId = (prefix: string, source: string): string =>
	`${prefix}_${createHash('sha256').update(source).digest('hex').slice(0, 40)}`;

export const workRequestIdForStart = (
	accountId: string,
	propertyId: string,
	actorId: string,
	idempotencyKey: string,
): string =>
	digestId(
		'work_request',
		JSON.stringify([accountId, propertyId, actorId, idempotencyKey]),
	);

export const workRequestEventId = (
	workRequestId: string,
	eventName: string,
	idempotencyKey: string,
): string =>
	digestId(
		'work_request_event',
		JSON.stringify([workRequestId, eventName, idempotencyKey]),
	);

const idempotencyFingerprint = (idempotencyKey: string): string =>
	digestId('idempotency', idempotencyKey);

const getPropertyAccountId = (
	data: FirebaseFirestore.DocumentData | undefined,
): string => String(data?.accountId || data?.userId || '').trim();

const isMatchingReplay = (params: {
	session: FirebaseFirestore.DocumentData;
	event: FirebaseFirestore.DocumentData;
	command: StartServiceWorkRequestCommand;
	accountId: string;
	uid: string;
	workRequestId: string;
	correlationId: string;
	idempotencyFingerprint: string;
}): boolean => {
	const {
		session,
		event,
		command,
		accountId,
		uid,
		workRequestId,
		correlationId,
		idempotencyFingerprint: expectedIdempotencyFingerprint,
	} = params;
	return (
		String(session.id || '') === workRequestId &&
		String(session.accountId || '') === accountId &&
		String(session.propertyId || '') === command.propertyId &&
		String(session.serviceCategory || '') === command.serviceCategory &&
		String(session.mode || '') === command.mode &&
		String(session.initialDescription || '') === String(command.initialDescription || '') &&
		String(session.createdBy?.actorId || '') === uid &&
		String(session.versions?.contractVersion || '') === WORK_REQUEST_CONTRACT_VERSION &&
		String(session.versions?.sessionSchemaVersion || '') === WORK_REQUEST_SCHEMA_VERSION &&
		String(event.name || '') === START_EVENT_NAME &&
		String(event.schemaVersion || '') === WORK_REQUEST_EVENT_SCHEMA_VERSION &&
		String(event.workRequestId || '') === workRequestId &&
		String(event.accountId || '') === accountId &&
		String(event.propertyId || '') === command.propertyId &&
		String(event.actor?.actorId || '') === uid &&
		String(event.idempotencyKey || '') === expectedIdempotencyFingerprint &&
		String(event.correlationId || '') === correlationId &&
		String(event.toState || '') === WORK_REQUEST_START_TRANSITION.to &&
		String(event.payload?.mode || '') === command.mode &&
		String(event.payload?.serviceCategory || '') === command.serviceCategory
	);
};

const assertPersistedSessionState = (
	session: FirebaseFirestore.DocumentData,
): { state: ServiceWorkRequestSession['state']; revision: number } => {
	const state = String(session.state || '');
	const revision = session.revision;
	if (
		!isWorkRequestState(state) ||
		typeof revision !== 'number' ||
		!Number.isInteger(revision) ||
		revision < 1
	) {
		throw new functions.https.HttpsError(
			'failed-precondition',
			'The existing Service Work Request is not in a valid resumable state.',
		);
	}
	return {
		state: state as ServiceWorkRequestSession['state'],
		revision,
	};
};

export const createStartServiceWorkRequestHandler = (
	overrides: Partial<StartServiceWorkRequestDependencies> = {},
) => {
	const dependencies = { ...defaultDependencies, ...overrides };

	return async (
		data: unknown,
		context: CallableContextLike,
	): Promise<StartServiceWorkRequestResult> => {
		const uid = String(context.auth?.uid || '').trim();
		if (!uid) {
			throw new functions.https.HttpsError(
				'unauthenticated',
				'Sign in to start a Service Work Request.',
			);
		}

		const command = normalizeStartCommand(data);
		const accountId = await dependencies.resolveAccountIdForUser(uid);
		await dependencies.assertAccountRole(
			uid,
			accountId,
			HOMEOWNER_WORK_REQUEST_ROLES,
		);
		if (!(await dependencies.hasPilotCapability(accountId))) {
			throw new functions.https.HttpsError(
				'permission-denied',
				'Service Work Requests are not enabled for this account.',
			);
		}

		const workRequestId = workRequestIdForStart(
			accountId,
			command.propertyId,
			uid,
			command.idempotencyKey,
		);
		const correlationId =
			command.correlationId || `service-work-request:${workRequestId}`;
		const eventId = workRequestEventId(
			workRequestId,
			START_EVENT_NAME,
			command.idempotencyKey,
		);
		const commandIdempotencyFingerprint = idempotencyFingerprint(
			command.idempotencyKey,
		);
		const now = dependencies.now();
		const actor: WorkRequestActorReference = {
			actorId: uid,
			actorType: 'homeowner',
			channel: 'maintley_home',
		};

		return dependencies.db.runTransaction(async (transaction) => {
			const propertyRef = dependencies.db
				.collection('properties')
				.doc(command.propertyId);
			const sessionRef = dependencies.db
				.collection(SERVICE_WORK_REQUESTS_COLLECTION)
				.doc(workRequestId);
			const eventRef = dependencies.db
				.collection(WORK_REQUEST_EVENTS_COLLECTION)
				.doc(eventId);

			const propertySnapshot = await transaction.get(propertyRef);
			const sessionSnapshot = await transaction.get(sessionRef);
			const eventSnapshot = await transaction.get(eventRef);
			if (
				!propertySnapshot.exists ||
				getPropertyAccountId(propertySnapshot.data()) !== accountId
			) {
				throw new functions.https.HttpsError(
					'permission-denied',
					'This Property is not available in the active account.',
				);
			}

			if (sessionSnapshot.exists || eventSnapshot.exists) {
				if (!sessionSnapshot.exists || !eventSnapshot.exists) {
					throw new functions.https.HttpsError(
						'failed-precondition',
						'The existing Service Work Request could not be resumed safely.',
					);
				}
				const session = sessionSnapshot.data() || {};
				const event = eventSnapshot.data() || {};
				if (
					!isMatchingReplay({
						session,
						event,
						command,
						accountId,
						uid,
						workRequestId,
						correlationId,
						idempotencyFingerprint: commandIdempotencyFingerprint,
					})
				) {
					throw new functions.https.HttpsError(
						'failed-precondition',
						'This idempotency key was already used for a different request.',
					);
				}
				const current = assertPersistedSessionState(session);
				return {
					workRequestId,
					state: current.state,
					revision: current.revision,
					replayed: true,
				};
			}

			const session: ServiceWorkRequestSession = {
				id: workRequestId,
				accountId,
				propertyId: command.propertyId,
				serviceCategory: command.serviceCategory,
				mode: command.mode,
				state: WORK_REQUEST_START_TRANSITION.to,
				revision: 1,
				...(command.initialDescription
					? { initialDescription: command.initialDescription }
					: {}),
				questions: [],
				answers: [],
				observations: [],
				safetyReview: {
					status: 'pending',
					policyVersion: WORK_REQUEST_SAFETY_POLICY_VERSION,
					answeredQuestionIds: [],
					signals: [],
				},
				attachments: [],
				contextPackageIds: [],
				modelUsage: [],
				versions: {
					contractVersion: WORK_REQUEST_CONTRACT_VERSION,
					sessionSchemaVersion: WORK_REQUEST_SCHEMA_VERSION,
					reportSchemaVersion: WORK_REQUEST_REPORT_SCHEMA_VERSION,
					eventSchemaVersion: WORK_REQUEST_EVENT_SCHEMA_VERSION,
					questionPolicyVersion: HVAC_QUESTION_POLICY_VERSION,
					safetyPolicyVersion: WORK_REQUEST_SAFETY_POLICY_VERSION,
				},
				createdBy: actor,
				updatedBy: actor,
				createdAt: now,
				updatedAt: now,
			};
			const event: WorkRequestEventEnvelope<'WorkRequestStarted'> = {
				id: eventId,
				name: START_EVENT_NAME,
				schemaVersion: WORK_REQUEST_EVENT_SCHEMA_VERSION,
				workRequestId,
				accountId,
				propertyId: command.propertyId,
				actor,
				correlationId,
				idempotencyKey: commandIdempotencyFingerprint,
				toState: WORK_REQUEST_START_TRANSITION.to,
				occurredAt: now,
				payload: {
					mode: command.mode,
					serviceCategory: command.serviceCategory,
				},
			};

			transaction.create(sessionRef, session);
			transaction.create(eventRef, event);

			return {
				workRequestId,
				state: WORK_REQUEST_START_TRANSITION.to,
				revision: 1,
				replayed: false,
			};
		});
	};
};

export const startServiceWorkRequest = functions
	.region('us-central1')
	.https.onCall(createStartServiceWorkRequestHandler());
