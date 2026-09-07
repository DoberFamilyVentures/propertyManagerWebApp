import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { defineSecret } from 'firebase-functions/params';
import Stripe from 'stripe';
import {
	buildAccountDeletionStoragePrefixes,
	chunkItems,
	mergeAccessRemovalUpdates,
	removeIdFromArray,
} from './accountDeletionCore';

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();
const storage = admin.storage();
const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');

const PAID_SUBSCRIPTION_PLANS = new Set([
	'homeowner_plus',
	'property',
	'portfolio',
]);

type DeleteOperation = {
	kind: 'delete';
	ref: FirebaseFirestore.DocumentReference;
	label: string;
};

type UpdateOperation = {
	kind: 'update';
	ref: FirebaseFirestore.DocumentReference;
	data: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>;
	label: string;
	removedUserFields: string[];
};

type DeletionOperation = DeleteOperation | UpdateOperation;

type DeletionManifest = {
	operations: Map<string, DeletionOperation>;
	storagePrefixes: string[];
	propertyIds: string[];
	accountIds: string[];
	wasOwner: boolean;
};

type StoredDeletionContext = {
	wasOwner?: boolean;
	propertyIds?: string[];
	accountIds?: string[];
};

const getStripeClient = (): Stripe =>
	new Stripe(STRIPE_SECRET_KEY.value(), { apiVersion: '2023-10-16' });

const normalizeId = (value: unknown): string => String(value || '').trim();

const addDelete = (
	manifest: DeletionManifest,
	ref: FirebaseFirestore.DocumentReference,
	label: string,
) => {
	manifest.operations.set(ref.path, { kind: 'delete', ref, label });
};

const addUpdate = (
	manifest: DeletionManifest,
	ref: FirebaseFirestore.DocumentReference,
	data: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>,
	label: string,
	removedUserFields: string[],
) => {
	const existing = manifest.operations.get(ref.path);
	if (existing?.kind === 'delete') return;
	if (existing?.kind === 'update') {
		const merged = mergeAccessRemovalUpdates(
			{
				data: existing.data,
				removedUserFields: existing.removedUserFields,
			},
			{ data, removedUserFields },
		);
		manifest.operations.set(ref.path, {
			...existing,
			data: merged.data,
			removedUserFields: merged.removedUserFields,
		});
		return;
	}
	manifest.operations.set(ref.path, {
		kind: 'update',
		ref,
		data,
		label,
		removedUserFields,
	});
};

const queryDocs = async (
	collectionName: string,
	field: string,
	operator: FirebaseFirestore.WhereFilterOp,
	value: unknown,
) => {
	const snapshot = await db
		.collection(collectionName)
		.where(field, operator, value)
		.get();
	return snapshot.docs;
};

const addQueryDeletes = async (
	manifest: DeletionManifest,
	collectionName: string,
	field: string,
	operator: FirebaseFirestore.WhereFilterOp,
	value: unknown,
	label = collectionName,
) => {
	const docs = await queryDocs(collectionName, field, operator, value);
	docs.forEach((document) => addDelete(manifest, document.ref, label));
	return docs;
};

const resolveOwnedProperties = async (
	userId: string,
	userData: FirebaseFirestore.DocumentData,
) => {
	const properties = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
	for (const document of await queryDocs('properties', 'userId', '==', userId)) {
		properties.set(document.id, document);
	}

	const accountIds = [userData.accountId, userData.familyAccountId]
		.map(normalizeId)
		.filter(Boolean);
	const isAccountOwner = userData.isAccountOwner === true;
	if (isAccountOwner) {
		for (const accountId of accountIds) {
			for (const document of await queryDocs(
				'properties',
				'accountId',
				'==',
				accountId,
			)) {
				properties.set(document.id, document);
			}
		}
	}

	return Array.from(properties.values());
};

const addOwnedPropertyData = async (
	manifest: DeletionManifest,
	property: FirebaseFirestore.QueryDocumentSnapshot,
) => {
	const propertyId = property.id;
	const propertyData = property.data() || {};
	const accountId = normalizeId(propertyData.accountId || propertyData.userId);
	manifest.propertyIds.push(propertyId);
	if (accountId) manifest.accountIds.push(accountId);

	const propertyCollections = [
		'tasks',
		'suites',
		'units',
		'contractors',
		'maintenanceEvents',
		'maintenanceHistory',
		'propertyShares',
		'userInvitations',
		'tenantInvitationCodes',
		'tenantProfiles',
		'favorites',
		'maintenanceRequests',
		'propertyDocuments',
		'propertyKnowledgeSuggestions',
		'propertySpaces',
		'propertySupplies',
		'propertyKnowledgeLinks',
		'propertyGroupMemberships',
		'serviceWorkRequests',
		'workRequestReports',
		'workRequestEvents',
		'workRequestShares',
	];

	for (const collectionName of propertyCollections) {
		const documents = await addQueryDeletes(
			manifest,
			collectionName,
			'propertyId',
			'==',
			propertyId,
		);
		if (collectionName === 'tasks') {
			for (const documentChunk of chunkItems(documents, 10)) {
				await addQueryDeletes(
					manifest,
					'taskReminderEmailDeliveries',
					'taskId',
					'in',
					documentChunk.map((document) => document.id),
				);
			}
		}
		if (collectionName === 'maintenanceEvents') {
			for (const documentChunk of chunkItems(documents, 10)) {
				await addQueryDeletes(
					manifest,
					'maintenanceEventRevisions',
					'maintenanceEventId',
					'in',
					documentChunk.map((document) => document.id),
				);
			}
		}
	}

	await addQueryDeletes(
		manifest,
		'devices',
		'location.propertyId',
		'==',
		propertyId,
	);
	await addQueryDeletes(
		manifest,
		'notifications',
		'data.propertyId',
		'==',
		propertyId,
	);
	addDelete(manifest, property.ref, 'properties');
};

const addAccessRemoval = async (
	manifest: DeletionManifest,
	userId: string,
) => {
	for (const field of ['coOwners', 'administrators', 'viewers']) {
		const documents = await queryDocs('properties', field, 'array-contains', userId);
		for (const document of documents) {
			const current = document.data() || {};
			addUpdate(
				manifest,
				document.ref,
				{ [field]: removeIdFromArray(current[field], userId) },
				'properties',
				[field],
			);
		}
	}

	await addQueryDeletes(
		manifest,
		'propertyShares',
		'sharedWithUserId',
		'==',
		userId,
	);
};

const buildDeletionManifest = async ({
	userId,
	userData,
	email,
	recovery,
}: {
	userId: string;
	userData: FirebaseFirestore.DocumentData;
	email: string;
	recovery?: StoredDeletionContext;
}): Promise<DeletionManifest> => {
	const manifest: DeletionManifest = {
		operations: new Map(),
		storagePrefixes: [],
		propertyIds: [...(recovery?.propertyIds || [])].map(normalizeId).filter(Boolean),
		accountIds: [
			userData.accountId,
			userData.familyAccountId,
			...(recovery?.accountIds || []),
		]
			.map(normalizeId)
			.filter(Boolean),
		wasOwner: recovery?.wasOwner === true,
	};

	const ownedPropertyMap = new Map(
		(await resolveOwnedProperties(userId, userData)).map((property) => [
			property.id,
			property,
		]),
	);
	for (const propertyId of recovery?.propertyIds || []) {
		const property = await db.collection('properties').doc(propertyId).get();
		if (property.exists) {
			ownedPropertyMap.set(
				property.id,
				property as FirebaseFirestore.QueryDocumentSnapshot,
			);
		}
	}
	const ownedProperties = Array.from(ownedPropertyMap.values());
	manifest.wasOwner = manifest.wasOwner || ownedProperties.length > 0;
	for (const property of ownedProperties) {
		await addOwnedPropertyData(manifest, property);
	}
	// A user can own one Property while retaining shared access to another.
	// Remove those references for every deletion; owned Property deletes take
	// precedence over these updates in the manifest.
	await addAccessRemoval(manifest, userId);

	for (const collectionName of [
		'propertyGroups',
		'teamGroups',
		'teamMembers',
		'notifications',
		'contractors',
		'maintenanceHistory',
		'favorites',
		'tasks',
		'userPreferences',
		'activityLogs',
		'recentlyViewed',
		'deviceSubscriptions',
		'accountMemberships',
		'storageUploadReservations',
	]) {
		await addQueryDeletes(manifest, collectionName, 'userId', '==', userId);
	}

	if (email) {
		await addQueryDeletes(
			manifest,
			'userInvitations',
			'toEmail',
			'==',
			email,
		);
	}

	addDelete(manifest, db.collection('users').doc(userId), 'users');
	manifest.propertyIds = Array.from(new Set(manifest.propertyIds)).sort();
	manifest.accountIds = Array.from(new Set(manifest.accountIds)).sort();
	manifest.storagePrefixes = buildAccountDeletionStoragePrefixes({
		userId,
		accountIds: manifest.wasOwner ? manifest.accountIds : [],
		propertyIds: manifest.propertyIds,
	});
	return manifest;
};

const executeFirestoreManifest = async (manifest: DeletionManifest) => {
	const operations = Array.from(manifest.operations.values());
	const counts: Record<string, number> = {};

	for (const operationChunk of chunkItems(operations)) {
		const batch = db.batch();
		for (const operation of operationChunk) {
			if (operation.kind === 'delete') batch.delete(operation.ref);
			else batch.update(operation.ref, operation.data);
			counts[operation.label] = (counts[operation.label] || 0) + 1;
		}
		await batch.commit();
	}

	return counts;
};

const deleteStoragePrefixes = async (prefixes: string[]) => {
	const bucket = storage.bucket();
	for (const prefix of prefixes) {
		await bucket.deleteFiles({ prefix, force: true });
	}
};

const verifyDeletion = async (
	manifest: DeletionManifest,
	userId: string,
) => {
	const unresolved: string[] = [];
	for (const operationChunk of chunkItems(
		Array.from(manifest.operations.values()),
		300,
	)) {
		const snapshots = await db.getAll(...operationChunk.map((item) => item.ref));
		snapshots.forEach((snapshot, index) => {
			const operation = operationChunk[index];
			if (operation.kind === 'delete' && snapshot.exists) {
				unresolved.push(`${operation.label}:document_remaining`);
				return;
			}
			if (operation.kind === 'update' && snapshot.exists) {
				const data = snapshot.data() || {};
				for (const field of operation.removedUserFields) {
					if (Array.isArray(data[field]) && data[field].includes(userId)) {
						unresolved.push(`${operation.label}:${field}_still_references_user`);
					}
				}
			}
		});
	}

	const bucket = storage.bucket();
	for (const prefix of manifest.storagePrefixes) {
		const [remaining] = await bucket.getFiles({ prefix, maxResults: 1 });
		if (remaining.length > 0) unresolved.push(`storage:${prefix}`);
	}

	return Array.from(new Set(unresolved)).sort();
};

const enforceSubscriptionDeletionPolicy = async (
	userData: FirebaseFirestore.DocumentData,
) => {
	const subscription = userData.subscription;
	if (!subscription) return;

	const normalizedPlan = normalizeId(subscription.plan).toLowerCase();
	const hasPaidPlan = PAID_SUBSCRIPTION_PLANS.has(normalizedPlan);
	const now = Math.floor(Date.now() / 1000);
	const isInTrial = Boolean(
		subscription.trialEndsAt && subscription.trialEndsAt > now,
	);

	if (
		hasPaidPlan &&
		((subscription.status === 'active' && !isInTrial) ||
			subscription.status === 'past_due')
	) {
		throw new functions.https.HttpsError(
			'failed-precondition',
			'You cannot delete your account while you have an active subscription. Please cancel your subscription first.',
		);
	}

	if (
		(subscription.status === 'trial' || isInTrial) &&
		subscription.stripeSubscriptionId
	) {
		try {
			await getStripeClient().subscriptions.cancel(
				subscription.stripeSubscriptionId,
			);
		} catch (error) {
			functions.logger.warn('Trial cancellation failed during account deletion', {
				userId: userData.id,
				error,
			});
		}
	}
};

export const deleteUserAccount = functions
	.runWith({ secrets: ['STRIPE_SECRET_KEY'], timeoutSeconds: 540, memory: '1GB' })
	.https.onCall(async (data, context) => {
		if (!context.auth) {
			throw new functions.https.HttpsError(
				'unauthenticated',
				'User must be authenticated',
			);
		}

		const userId = normalizeId(data?.userId);
		if (!userId) {
			throw new functions.https.HttpsError(
				'invalid-argument',
				'Missing userId parameter',
			);
		}
		if (context.auth.uid !== userId) {
			throw new functions.https.HttpsError(
				'permission-denied',
				'You can only delete your own account',
			);
		}

		const deletionJobRef = db.collection('accountDeletionJobs').doc(userId);
		try {
			const userDocument = await db.collection('users').doc(userId).get();
			const userData = { id: userId, ...(userDocument.data() || {}) };
			await enforceSubscriptionDeletionPolicy(userData);
			const existingJob = await deletionJobRef.get();
			const recovery = existingJob.exists
				? (existingJob.data() as StoredDeletionContext)
				: undefined;

			const manifest = await buildDeletionManifest({
				userId,
				userData,
				email: normalizeId(context.auth.token.email),
				recovery,
			});
			await deletionJobRef.set(
				{
					userId,
					status: 'prepared',
					wasOwner: manifest.wasOwner,
					propertyIds: manifest.propertyIds,
					accountIds: manifest.accountIds,
					firestoreOperationCount: manifest.operations.size,
					storagePrefixCount: manifest.storagePrefixes.length,
					createdAt: recovery
						? existingJob.data()?.createdAt || admin.firestore.FieldValue.serverTimestamp()
						: admin.firestore.FieldValue.serverTimestamp(),
					updatedAt: admin.firestore.FieldValue.serverTimestamp(),
				},
				{ merge: true },
			);
			const deleted = await executeFirestoreManifest(manifest);
			await deletionJobRef.set(
				{
					status: 'firestore_complete',
					updatedAt: admin.firestore.FieldValue.serverTimestamp(),
				},
				{ merge: true },
			);
			await deleteStoragePrefixes(manifest.storagePrefixes);
			await deletionJobRef.set(
				{
					status: 'storage_complete',
					updatedAt: admin.firestore.FieldValue.serverTimestamp(),
				},
				{ merge: true },
			);
			const unresolved = await verifyDeletion(manifest, userId);

			if (unresolved.length > 0) {
				functions.logger.error('Account deletion verification failed', {
					userId,
					unresolved,
				});
				throw new Error('Account deletion left managed records unresolved.');
			}

			await auth.deleteUser(userId);
			try {
				await deletionJobRef.delete();
			} catch (jobCleanupError) {
				// Authentication deletion is the terminal privacy boundary. A stale,
				// server-only operational record must not turn a completed deletion
				// into a client-visible failure that the deleted user cannot retry.
				functions.logger.error('Completed account deletion job cleanup failed', {
					userId,
					jobCleanupError,
				});
			}
			functions.logger.info('Account deletion completed and verified', {
				userId,
				wasOwner: manifest.wasOwner,
				propertyCount: manifest.propertyIds.length,
				firestoreOperations: manifest.operations.size,
				storagePrefixCount: manifest.storagePrefixes.length,
				deleted,
			});

			return {
				success: true,
				message: manifest.wasOwner
					? 'Account and all associated data deleted successfully'
					: 'Account access removed successfully. Properties owned by others remain intact.',
				wasOwner: manifest.wasOwner,
				verification: {
					firestoreOperations: manifest.operations.size,
					storagePrefixes: manifest.storagePrefixes.length,
					unresolved: 0,
				},
			};
		} catch (error) {
			if (error instanceof functions.https.HttpsError) throw error;
			try {
				await deletionJobRef.set(
					{
						status: 'failed',
						updatedAt: admin.firestore.FieldValue.serverTimestamp(),
					},
					{ merge: true },
				);
			} catch (jobError) {
				functions.logger.error('Account deletion job status update failed', {
					userId,
					jobError,
				});
			}
			functions.logger.error('Account deletion failed', { userId, error });
			throw new functions.https.HttpsError(
				'internal',
				'Failed to delete account. Please contact support.',
			);
		}
	});
