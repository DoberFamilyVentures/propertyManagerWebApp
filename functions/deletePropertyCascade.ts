import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { assertAccountRole } from './accountAuthz';

if (!admin.apps.length) {
	admin.initializeApp();
}

const db = admin.firestore();

const PROPERTY_DELETE_ROLES = ['account_owner', 'admin', 'manager'];
const DELETE_BATCH_LIMIT = 450;

type CascadeDeleteRequest = {
	propertyId?: string;
};

type CascadeDeleteResult = {
	success: boolean;
	propertyId: string;
	accountId: string;
	deleted: Record<string, number>;
	updated: Record<string, number>;
};

const toString = (value: unknown): string => String(value || '').trim();

const chunk = <T>(items: T[], size: number): T[][] => {
	const chunks: T[][] = [];
	for (let index = 0; index < items.length; index += size) {
		chunks.push(items.slice(index, index + size));
	}
	return chunks;
};

const queryByPropertyId = async (
	collectionName: string,
	propertyId: string,
	accountId?: string,
) => {
	const base = db.collection(collectionName).where('propertyId', '==', propertyId);
	const scoped = accountId ? base.where('accountId', '==', accountId) : base;
	const snapshot = await scoped.get();
	return snapshot.docs;
};

const queryByNestedPropertyId = async (
	collectionName: string,
	propertyId: string,
	accountId?: string,
) => {
	const base = db
		.collection(collectionName)
		.where('location.propertyId', '==', propertyId);
	const scoped = accountId ? base.where('accountId', '==', accountId) : base;
	const snapshot = await scoped.get();
	return snapshot.docs;
};

const queryByNestedDataPropertyId = async (
	collectionName: string,
	propertyId: string,
) => {
	const snapshot = await db
		.collection(collectionName)
		.where('data.propertyId', '==', propertyId)
		.get();
	return snapshot.docs;
};

const queryByPropertyTitle = async (
	collectionName: string,
	propertyTitle: string,
	accountId: string,
) => {
	if (!propertyTitle) return [];
	const snapshot = await db
		.collection(collectionName)
		.where('accountId', '==', accountId)
		.where('propertyTitle', '==', propertyTitle)
		.get();
	return snapshot.docs;
};

const deleteDocs = async (
	docs: FirebaseFirestore.QueryDocumentSnapshot[],
	deleted: Record<string, number>,
	label: string,
) => {
	if (docs.length === 0) return;

	for (const docsChunk of chunk(docs, DELETE_BATCH_LIMIT)) {
		const batch = db.batch();
		docsChunk.forEach((doc) => batch.delete(doc.ref));
		await batch.commit();
		deleted[label] = (deleted[label] || 0) + docsChunk.length;
	}
};

const updateDocs = async (
	updates: Array<{
		ref: FirebaseFirestore.DocumentReference;
		data: Record<string, unknown>;
	}>,
	updated: Record<string, number>,
	label: string,
) => {
	if (updates.length === 0) return;

	for (const updatesChunk of chunk(updates, DELETE_BATCH_LIMIT)) {
		const batch = db.batch();
		updatesChunk.forEach((update) => batch.update(update.ref, update.data));
		await batch.commit();
		updated[label] = (updated[label] || 0) + updatesChunk.length;
	}
};

const deletePropertyScopedCollections = async (
	propertyId: string,
	accountId: string,
	propertyTitle: string,
	deleted: Record<string, number>,
) => {
	const propertyScopedCollections = [
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
		'serviceWorkRequests',
		'workRequestReports',
		'workRequestEvents',
		'workRequestShares',
	];

	for (const collectionName of propertyScopedCollections) {
		const docs = await queryByPropertyId(collectionName, propertyId);
		if (collectionName === 'tasks') {
			await deleteTaskReminderDeliveriesForTasks(
				docs.map((doc) => doc.id),
				deleted,
			);
		}
		await deleteDocs(docs, deleted, collectionName);
	}

	await deleteDocs(
		await queryByNestedDataPropertyId('notifications', propertyId),
		deleted,
		'notifications',
	);

	for (const collectionName of ['maintenanceEvents', 'maintenanceHistory']) {
		await deleteDocs(
			await queryByPropertyTitle(collectionName, propertyTitle, accountId),
			deleted,
			`${collectionName}ByTitle`,
		);
	}
};

const deleteTaskReminderDeliveriesForTasks = async (
	taskIds: string[],
	deleted: Record<string, number>,
) => {
	for (const taskIdChunk of chunk(taskIds, 10)) {
		if (taskIdChunk.length === 0) continue;
		const snapshot = await db
			.collection('taskReminderEmailDeliveries')
			.where('taskId', 'in', taskIdChunk)
			.get();
		await deleteDocs(snapshot.docs, deleted, 'taskReminderEmailDeliveries');
	}
};

const deleteDeviceScopedCollections = async (
	propertyId: string,
	_accountId: string,
	deleted: Record<string, number>,
) => {
	const devices = await queryByNestedPropertyId('devices', propertyId);
	await deleteDocs(devices, deleted, 'devices');
};

const deleteGroupMemberships = async (
	propertyId: string,
	accountId: string,
	deleted: Record<string, number>,
) => {
	const docs = await queryByPropertyId(
		'propertyGroupMemberships',
		propertyId,
		accountId,
	);
	await deleteDocs(docs, deleted, 'propertyGroupMemberships');
};

const removePropertyFromTeamMembers = async (
	propertyId: string,
	accountId: string,
	updated: Record<string, number>,
) => {
	const teamMembersSnapshot = await db
		.collection('teamMembers')
		.where('accountId', '==', accountId)
		.where('linkedProperties', 'array-contains', propertyId)
		.get();

	const updates = teamMembersSnapshot.docs.map((doc) => {
		const data = doc.data();
		const linkedProperties = Array.isArray(data.linkedProperties)
			? data.linkedProperties.filter((id) => id !== propertyId)
			: [];

		return {
			ref: doc.ref,
			data: {
				linkedProperties,
				updatedAt: new Date().toISOString(),
			},
		};
	});

	await updateDocs(updates, updated, 'teamMembers');
};

const removePropertyFromTeamMemberInvites = async (
	propertyId: string,
	accountId: string,
	updated: Record<string, number>,
) => {
	const inviteSnapshot = await db
		.collection('teamMemberInvitationCodes')
		.where('accountId', '==', accountId)
		.where('linkedProperties', 'array-contains', propertyId)
		.get();

	const updates = inviteSnapshot.docs.map((doc) => {
		const data = doc.data();
		const linkedProperties = Array.isArray(data.linkedProperties)
			? data.linkedProperties.filter((id) => id !== propertyId)
			: [];

		return {
			ref: doc.ref,
			data: {
				linkedProperties,
				updatedAt: new Date().toISOString(),
			},
		};
	});

	await updateDocs(updates, updated, 'teamMemberInvitationCodes');
};

const updateAccountCounters = async (
	accountId: string,
	deletedDeviceCount: number,
) => {
	const accountRef = db.collection('familyAccounts').doc(accountId);
	await db.runTransaction(async (transaction) => {
		const snapshot = await transaction.get(accountRef);
		if (!snapshot.exists) return;

		const data = snapshot.data() || {};
		const propertyCount = Number(data.propertyCount || 0);
		const deviceCount = Number(data.deviceCount || 0);

		transaction.update(accountRef, {
			propertyCount: Math.max(0, propertyCount - 1),
			deviceCount: Math.max(0, deviceCount - deletedDeviceCount),
			updatedAt: new Date().toISOString(),
		});
	});
};

export const deletePropertyCascade = functions
	.region('us-central1')
	.https.onCall(
		async (
			data: CascadeDeleteRequest,
			context,
		): Promise<CascadeDeleteResult> => {
			const uid = toString(context.auth?.uid);
			if (!uid) {
				throw new functions.https.HttpsError(
					'unauthenticated',
					'You must be signed in to delete a property.',
				);
			}

			const propertyId = toString(data?.propertyId);
			if (!propertyId) {
				throw new functions.https.HttpsError(
					'invalid-argument',
					'propertyId is required.',
				);
			}

			const propertyRef = db.collection('properties').doc(propertyId);
			const propertySnapshot = await propertyRef.get();
			if (!propertySnapshot.exists) {
				return {
					success: true,
					propertyId,
					accountId: '',
					deleted: {},
					updated: {},
				};
			}

			const propertyData = propertySnapshot.data() || {};
			const accountId =
				toString(propertyData.accountId) || toString(propertyData.userId);
			const propertyTitle = toString(propertyData.title);
			if (!accountId) {
				throw new functions.https.HttpsError(
					'failed-precondition',
					'Property is missing account ownership data.',
				);
			}

			await assertAccountRole(uid, accountId, PROPERTY_DELETE_ROLES);

			const deleted: Record<string, number> = {};
			const updated: Record<string, number> = {};

			await deletePropertyScopedCollections(
				propertyId,
				accountId,
				propertyTitle,
				deleted,
			);
			await deleteDeviceScopedCollections(propertyId, accountId, deleted);
			await deleteGroupMemberships(propertyId, accountId, deleted);
			await removePropertyFromTeamMembers(propertyId, accountId, updated);
			await removePropertyFromTeamMemberInvites(propertyId, accountId, updated);

			await propertyRef.delete();
			deleted.properties = (deleted.properties || 0) + 1;

			await updateAccountCounters(accountId, deleted.devices || 0);

			functions.logger.info('Property cascade delete complete', {
				propertyId,
				accountId,
				deleted,
				updated,
			});

			return {
				success: true,
				propertyId,
				accountId,
				deleted,
				updated,
			};
		},
	);
