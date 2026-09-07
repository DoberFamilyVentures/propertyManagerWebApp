const fs = require('fs');
const path = require('path');
const {
	assertFails,
	assertSucceeds,
	initializeTestEnvironment,
} = require('@firebase/rules-unit-testing');

const PROJECT_ID = 'maintley-rules-test';
const RULES_PATH = path.join(__dirname, '..', 'firestore.rules');

const accountId = 'account-owner';
const ownerUid = 'account-owner';
const legacyOwnerUid = 'legacy-account-owner';
const propertyManagerUid = 'property-manager-user';
const maintenanceLeadUid = 'maintenance-lead-user';
const maintenanceUid = 'maintenance-user';
const inactiveLeadUid = 'inactive-maintenance-lead-user';
const outsiderUid = 'outsider-user';
const homeownerPlusAccountId = 'homeowner-plus-account';
const homeownerPlusUid = homeownerPlusAccountId;
const maliciousNewUserUid = 'malicious-new-user';
const trialOwnerUid = 'trial-owner';
const expiredTrialOwnerUid = 'expired-trial-owner';
const portfolioGrantOwnerUid = 'portfolio-grant-owner';
const downgradedOwnerUid = 'downgraded-owner';

const membershipId = (uid) => `${accountId}_${uid}`;

const baseTask = {
	accountId,
	propertyId: 'property-1',
	title: 'Test smoke and carbon monoxide detectors',
	status: 'Open',
	priority: 'Urgent',
	createdAt: '2026-07-01T12:00:00.000Z',
	updatedAt: '2026-07-01T12:00:00.000Z',
};

const createTask = (overrides = {}) => ({
	...baseTask,
	...overrides,
});

const createNotification = (overrides = {}) => ({
	userId: ownerUid,
	type: 'task_updated',
	title: 'Task updated',
	message: 'A task was updated.',
	status: 'unread',
	createdAt: '2026-07-01T12:00:00.000Z',
	updatedAt: '2026-07-01T12:00:00.000Z',
	...overrides,
});

const createPropertyDocument = (overrides = {}) => ({
	id: 'property-document-owned',
	accountId,
	propertyId: 'property-1',
	name: 'HVAC invoice',
	fileName: 'hvac-invoice.pdf',
	fileUrl: 'https://example.com/hvac-invoice.pdf',
	fileType: 'application/pdf',
	category: 'invoice',
	uploadedAt: '2026-07-01T12:00:00.000Z',
	updatedAt: '2026-07-01T12:00:00.000Z',
	...overrides,
});

const createPropertyKnowledgeSuggestion = (overrides = {}) => ({
	id: 'property-suggestion-owned',
	accountId,
	propertyId: 'property-1',
	sourceDocumentId: 'property-document-owned',
	status: 'pending',
	confidence: 0.9,
	createdAt: '2026-07-01T12:00:00.000Z',
	updatedAt: '2026-07-01T12:00:00.000Z',
	suggestedData: {
		documents: [],
	},
	...overrides,
});

const createPropertySpace = (overrides = {}) => ({
	accountId,
	propertyId: 'property-1',
	name: 'Living Room',
	type: 'interior',
	notes: 'Main gathering Space',
	sortOrder: 10,
	isArchived: false,
	source: 'manual',
	createdBy: ownerUid,
	updatedBy: ownerUid,
	createdAt: '2026-07-01T12:00:00.000Z',
	updatedAt: '2026-07-01T12:00:00.000Z',
	...overrides,
});

const createPropertySupply = (overrides = {}) => ({
	accountId,
	propertyId: 'property-1',
	name: '16 x 25 x 1 air filter',
	type: 'filter',
	manufacturer: 'Example Filters',
	modelOrSku: 'EF-16251',
	barcodeValue: '012345678905',
	partNumber: 'EF-16251',
	size: '16 x 25 x 1',
	mervRating: '11',
	replacementInterval: 'Every 3 months',
	notes: 'MERV 11',
	isArchived: false,
	source: 'manual',
	createdBy: ownerUid,
	updatedBy: ownerUid,
	createdAt: '2026-07-01T12:00:00.000Z',
	updatedAt: '2026-07-01T12:00:00.000Z',
	...overrides,
});

async function seedFirestore(env) {
	await env.withSecurityRulesDisabled(async (context) => {
		const db = context.firestore();
		for (const uid of [trialOwnerUid, expiredTrialOwnerUid]) {
			await db.doc(`users/${uid}`).set({
				id: uid,
				accountId: uid,
				isAccountOwner: true,
				subscription: { status: 'active', plan: 'homeowner' },
			});
			await db.doc(`accountMemberships/${uid}_${uid}`).set({
				accountId: uid,
				userId: uid,
				roles: ['account_owner'],
				status: 'active',
			});
			await db.doc(`familyAccounts/${uid}`).set({
				id: uid,
				ownerId: uid,
				memberIds: [uid],
				propertyCount: 1,
				deviceCount: 15,
				subscription: { status: 'active', plan: 'homeowner' },
				effectiveEntitlementProjection: {
					activeBundleIds: ['homeowner_plus'],
					bundleExpirationsMs: {
						homeowner_plus: uid === trialOwnerUid ? 4102444800000 : 1,
					},
					nextTransitionAtMs: uid === trialOwnerUid ? 4102444800000 : 1,
				},
			});
			await db
				.doc(
					`familyAccounts/${uid}/entitlementGrants/homeowner_plus_first_property_trial`,
				)
				.set({
					grantId: 'homeowner_plus_first_property_trial',
					programId: 'homeowner_plus_first_property_trial_v1',
					accountId: uid,
					state: 'active',
				});
			for (let index = 1; index <= 15; index += 1) {
				await db.doc(`devices/${uid}-device-${index}`).set({
					accountId: uid,
					userId: uid,
					propertyId: `${uid}-property`,
					name: `Equipment ${index}`,
				});
			}
		}

		await db.doc(`users/${portfolioGrantOwnerUid}`).set({
			id: portfolioGrantOwnerUid,
			accountId: portfolioGrantOwnerUid,
			isAccountOwner: true,
			subscription: { status: 'active', plan: 'homeowner' },
		});
		await db
			.doc(
				`accountMemberships/${portfolioGrantOwnerUid}_${portfolioGrantOwnerUid}`,
			)
			.set({
				accountId: portfolioGrantOwnerUid,
				userId: portfolioGrantOwnerUid,
				roles: ['account_owner'],
				status: 'active',
			});
		await db.doc(`familyAccounts/${portfolioGrantOwnerUid}`).set({
			id: portfolioGrantOwnerUid,
			ownerId: portfolioGrantOwnerUid,
			memberIds: [portfolioGrantOwnerUid],
			propertyCount: 1,
			deviceCount: 0,
			subscription: { status: 'active', plan: 'homeowner' },
			effectiveEntitlementProjection: {
				activeBundleIds: ['portfolio'],
				bundleExpirationsMs: { portfolio: 4102444800000 },
				nextTransitionAtMs: 4102444800000,
			},
		});
		await db.doc(`properties/${portfolioGrantOwnerUid}-property`).set({
			accountId: portfolioGrantOwnerUid,
			userId: portfolioGrantOwnerUid,
			title: 'Granted portfolio property',
		});

		await db.doc(`users/${downgradedOwnerUid}`).set({
			id: downgradedOwnerUid,
			accountId: downgradedOwnerUid,
			isAccountOwner: true,
			subscription: { status: 'active', plan: 'homeowner' },
		});
		await db
			.doc(`accountMemberships/${downgradedOwnerUid}_${downgradedOwnerUid}`)
			.set({
				accountId: downgradedOwnerUid,
				userId: downgradedOwnerUid,
				roles: ['account_owner'],
				status: 'active',
			});
		await db.doc(`familyAccounts/${downgradedOwnerUid}`).set({
			id: downgradedOwnerUid,
			ownerId: downgradedOwnerUid,
			memberIds: [downgradedOwnerUid],
			propertyCount: 2,
			deviceCount: 0,
			subscription: { status: 'active', plan: 'homeowner' },
			effectiveEntitlementProjection: {
				activeBundleIds: ['portfolio'],
				bundleExpirationsMs: { portfolio: 1 },
				nextTransitionAtMs: 1,
			},
		});
		for (const propertyNumber of [1, 2]) {
			await db
				.doc(`properties/${downgradedOwnerUid}-property-${propertyNumber}`)
				.set({
					accountId: downgradedOwnerUid,
					userId: downgradedOwnerUid,
					title: `Retained property ${propertyNumber}`,
					...(propertyNumber === 1 && {
						propertyType: 'commercial',
						propertyClassification: 'commercial_suite',
						isRental: true,
					}),
				});
		}
		await db.doc('teamMembers/downgraded-existing-member').set({
			accountId: downgradedOwnerUid,
			firstName: 'Existing',
			lastName: 'Member',
			role: 'maintenance_lead',
			groupId: 'retained-group',
			linkedProperties: [`${downgradedOwnerUid}-property-1`],
		});

		await db.doc(`users/${ownerUid}`).set({
			id: ownerUid,
			accountId,
			role: 'admin',
			isAccountOwner: true,
			subscription: {
				status: 'active',
				plan: 'portfolio',
				pendingCheckoutPlan: 'homeowner_plus',
				pendingCheckoutStartedAt: 1,
			},
		});

		await db.doc(`users/${maintenanceLeadUid}`).set({
			id: maintenanceLeadUid,
			accountId,
			role: 'maintenance_lead',
			isTeamMemberAccount: true,
		});

		await db.doc(`users/${propertyManagerUid}`).set({
			id: propertyManagerUid,
			accountId,
			role: 'property_manager',
			isTeamMemberAccount: true,
		});

		await db.doc(`users/${legacyOwnerUid}`).set({
			id: legacyOwnerUid,
			accountId,
			role: 'admin',
			isAccountOwner: true,
		});

		await db.doc(`users/${maintenanceUid}`).set({
			id: maintenanceUid,
			accountId,
			role: 'maintenance',
			isTeamMemberAccount: true,
		});

		await db.doc(`users/${inactiveLeadUid}`).set({
			id: inactiveLeadUid,
			accountId,
			role: 'maintenance_lead',
			isTeamMemberAccount: true,
		});

		await db.doc(`users/${outsiderUid}`).set({
			id: outsiderUid,
			accountId: outsiderUid,
			role: 'admin',
			isAccountOwner: true,
		});

		await db.doc(`users/${homeownerPlusUid}`).set({
			id: homeownerPlusUid,
			accountId: homeownerPlusAccountId,
			role: 'admin',
			isAccountOwner: true,
			subscription: { status: 'active', plan: 'homeowner_plus' },
		});

		await db.doc(`accountMemberships/${membershipId(ownerUid)}`).set({
			accountId,
			userId: ownerUid,
			roles: ['account_owner', 'admin', 'member'],
			status: 'active',
		});

		await db.doc(`accountMemberships/${membershipId(legacyOwnerUid)}`).set({
			accountId,
			userId: legacyOwnerUid,
			roles: ['account_owner', 'admin', 'member'],
		});

		await db.doc(`accountMemberships/${membershipId(maintenanceLeadUid)}`).set({
			accountId,
			userId: maintenanceLeadUid,
			roles: ['maintenance_lead', 'member'],
			status: 'active',
		});

		await db.doc(`accountMemberships/${membershipId(propertyManagerUid)}`).set({
			accountId,
			userId: propertyManagerUid,
			roles: ['property_manager', 'member'],
			status: 'active',
		});

		await db.doc(`accountMemberships/${membershipId(maintenanceUid)}`).set({
			accountId,
			userId: maintenanceUid,
			roles: ['maintenance', 'member'],
			status: 'active',
		});

		await db.doc(`accountMemberships/${membershipId(inactiveLeadUid)}`).set({
			accountId,
			userId: inactiveLeadUid,
			roles: ['maintenance_lead', 'member'],
			status: 'inactive',
		});

		await db
			.doc(`accountMemberships/${homeownerPlusAccountId}_${homeownerPlusUid}`)
			.set({
				accountId: homeownerPlusAccountId,
				userId: homeownerPlusUid,
				roles: ['account_owner', 'admin', 'member'],
				status: 'active',
			});

		await db.doc('familyAccounts/account-owner').set({
			ownerId: ownerUid,
			memberIds: [
				propertyManagerUid,
				maintenanceLeadUid,
				maintenanceUid,
				inactiveLeadUid,
			],
			propertyCount: 1,
			deviceCount: 0,
		});

		await db.doc(`familyAccounts/${homeownerPlusAccountId}`).set({
			ownerId: homeownerPlusUid,
			memberIds: [],
			propertyCount: 4,
			deviceCount: 0,
		});

		await db
			.doc('familyAccounts/account-owner/entitlementGrants/grant-existing')
			.set({
				grantId: 'grant-existing',
				programId: 'program-existing',
				accountId,
				kind: 'temporary',
				state: 'active',
			});

		await db.doc('properties/property-1').set({
			accountId,
			userId: ownerUid,
			title: 'Sand Oak Drive',
			address: '123 Sand Oak Drive, Apt A',
		});

		await db.doc('properties/outsider-property').set({
			accountId: outsiderUid,
			userId: outsiderUid,
			title: 'Outsider Property',
		});

		await db
			.doc('propertyDocuments/property-document-owned')
			.set(createPropertyDocument());

		await db.doc('propertyDocuments/property-document-outsider').set(
			createPropertyDocument({
				id: 'property-document-outsider',
				accountId: outsiderUid,
				propertyId: 'outsider-property',
			}),
		);

		await db
			.doc('propertyKnowledgeSuggestions/property-suggestion-owned')
			.set(createPropertyKnowledgeSuggestion());

		await db
			.doc('propertyKnowledgeSuggestions/property-suggestion-outsider')
			.set(
				createPropertyKnowledgeSuggestion({
					id: 'property-suggestion-outsider',
					accountId: outsiderUid,
					propertyId: 'outsider-property',
					sourceDocumentId: 'property-document-outsider',
				}),
			);

		await db.doc('propertySpaces/space-owned').set(createPropertySpace());
		await db.doc('propertySupplies/supply-owned').set(createPropertySupply());
		await db.doc('propertyKnowledgeLinks/link-owned').set({
			accountId,
			propertyId: 'property-1',
			fromType: 'equipment',
			fromId: 'device-owned',
			relationshipType: 'located_in',
			toType: 'space',
			toId: 'space-owned',
			source: 'manual',
			createdAt: '2026-07-01T12:00:00.000Z',
			createdBy: ownerUid,
			updatedAt: '2026-07-01T12:00:00.000Z',
			updatedBy: ownerUid,
		});

		await db.doc('tasks/task-existing').set(
			createTask({
				id: 'task-existing',
				title: 'Existing maintenance task',
			}),
		);

		await db.doc('tasks/task-legacy-user-id').set({
			userId: accountId,
			propertyId: 'property-1',
			title: 'Legacy account-scoped task',
			status: 'Open',
			priority: 'Normal',
			createdAt: '2026-07-01T12:00:00.000Z',
			updatedAt: '2026-07-01T12:00:00.000Z',
		});

		await db.doc('notifications/notification-owned').set(
			createNotification({
				id: 'notification-owned',
			}),
		);

		await db.doc('notifications/notification-outsider').set(
			createNotification({
				id: 'notification-outsider',
				userId: outsiderUid,
			}),
		);

		await db.doc('maintleyEvents/event-owned').set({
			id: 'event-owned',
			accountId,
			userId: ownerUid,
			recipientIds: [ownerUid],
			type: 'suggested_details_ready',
			workflowKey: 'property-knowledge-acquisition',
			entityKey: 'document:doc-1',
			title: 'Suggested details ready',
			message: 'Maintley found suggested details in this document.',
			status: 'ready',
			priority: 'normal',
			createdAt: '2026-07-01T12:00:00.000Z',
			updatedAt: '2026-07-01T12:00:00.000Z',
		});

		await db.doc('maintleyEvents/event-recipient').set({
			id: 'event-recipient',
			accountId,
			userId: ownerUid,
			recipientIds: [maintenanceLeadUid],
			type: 'ticket_in_progress',
			workflowKey: 'support-ticket',
			entityKey: 'ticket:feedback-owned',
			title: 'Ticket in progress',
			message: 'Maintley is investigating this ticket.',
			status: 'in_progress',
			priority: 'high',
			createdAt: '2026-07-01T12:00:00.000Z',
			updatedAt: '2026-07-01T12:00:00.000Z',
		});

		await db.doc('maintleyEvents/event-outsider').set({
			id: 'event-outsider',
			accountId: outsiderUid,
			userId: outsiderUid,
			recipientIds: [outsiderUid],
			type: 'quick_scan_completed',
			workflowKey: 'maintley-intelligence',
			entityKey: 'scan:outsider-scan',
			title: 'Quick Scan complete',
			message: 'Maintley found items to review.',
			status: 'completed',
			priority: 'normal',
			createdAt: '2026-07-01T12:00:00.000Z',
			updatedAt: '2026-07-01T12:00:00.000Z',
		});

		for (const collectionName of [
			'serviceWorkRequests',
			'workRequestReports',
			'workRequestEvents',
		]) {
			await db.doc(`${collectionName}/work-request-record-owned`).set({
				id: 'work-request-record-owned',
				accountId,
				propertyId: 'property-1',
				workRequestId: 'work-request-owned',
				createdAt: '2026-09-07T14:00:00.000Z',
				updatedAt: '2026-09-07T14:00:00.000Z',
			});
			await db.doc(`${collectionName}/work-request-record-outsider`).set({
				id: 'work-request-record-outsider',
				accountId: outsiderUid,
				propertyId: 'outsider-property',
				workRequestId: 'work-request-outsider',
				createdAt: '2026-09-07T14:00:00.000Z',
				updatedAt: '2026-09-07T14:00:00.000Z',
			});
		}

		await db.doc('workRequestShares/work-request-share-owned').set({
			id: 'work-request-share-owned',
			accountId,
			propertyId: 'property-1',
			workRequestId: 'work-request-owned',
			credentialHash: 'server-only-hash',
			createdAt: '2026-09-07T14:00:00.000Z',
			updatedAt: '2026-09-07T14:00:00.000Z',
		});

		await db.doc('feedback/feedback-owned').set({
			accountId,
			userId: ownerUid,
			userEmail: 'owner@example.com',
			ticketNumber: 'MNT-000001',
			type: 'bug_report',
			status: 'in_progress',
			subject: 'Owned support request',
			message: 'Support request body',
			createdAt: '2026-07-01T12:00:00.000Z',
			updatedAt: '2026-07-01T12:00:00.000Z',
		});

		await db.doc('admin_users/admin-record').set({
			email: 'admin@example.com',
			role: 'support',
			status: 'active',
		});

		await db.doc('admin_sessions/session-record').set({
			adminUserId: 'admin-record',
			createdAt: '2026-07-01T12:00:00.000Z',
		});

		await db.doc('admin_audit_logs/audit-record').set({
			action: 'ticket_status_changed',
			adminUserId: 'admin-record',
			createdAt: '2026-07-01T12:00:00.000Z',
		});

		await db.doc('tenantProfiles/legacy-resident').set({
			accountId,
			propertyId: 'property-1',
			userId: 'legacy-resident',
			firstName: 'Legacy',
			lastName: 'Resident',
			email: 'legacy-resident@example.com',
			creditScore: 700,
		});

		await db.doc('maintenanceEvents/server-created-event').set({
			accountId,
			propertyId: 'property-1',
			title: 'Server-created event',
			eventType: 'maintenance_recorded',
			eventSource: 'manual_entry',
			recordedBy: { userId: ownerUid },
			recordedAt: '2026-07-01T12:00:00.000Z',
		});

		await db.doc('maintenanceEventRevisions/revision-existing').set({
			accountId,
			propertyId: 'property-1',
			eventId: 'server-created-event',
			action: 'created',
			actor: { userId: ownerUid },
			changedFields: ['title'],
			createdAt: '2026-07-01T12:00:00.000Z',
		});
	});
}

function authedDb(env, uid, email = `${uid}@example.com`) {
	return env.authenticatedContext(uid, { email }).firestore();
}

async function run() {
	const rules = fs.readFileSync(RULES_PATH, 'utf8');
	const env = await initializeTestEnvironment({
		projectId: PROJECT_ID,
		firestore: {
			rules,
		},
	});

	try {
		await seedFirestore(env);

		const ownerDb = authedDb(env, ownerUid);
		const legacyOwnerDb = authedDb(env, legacyOwnerUid);
		const propertyManagerDb = authedDb(env, propertyManagerUid);
		const maintenanceLeadDb = authedDb(env, maintenanceLeadUid);
		const maintenanceDb = authedDb(env, maintenanceUid);
		const inactiveLeadDb = authedDb(env, inactiveLeadUid);
		const outsiderDb = authedDb(env, outsiderUid);
		const homeownerPlusDb = authedDb(env, homeownerPlusUid);
		const maliciousNewUserDb = authedDb(env, maliciousNewUserUid);
		const trialOwnerDb = authedDb(env, trialOwnerUid);
		const expiredTrialOwnerDb = authedDb(env, expiredTrialOwnerUid);
		const portfolioGrantOwnerDb = authedDb(env, portfolioGrantOwnerUid);
		const downgradedOwnerDb = authedDb(env, downgradedOwnerUid);

		await assertSucceeds(
			trialOwnerDb.doc(`familyAccounts/${trialOwnerUid}`).get(),
		);
		await assertFails(
			trialOwnerDb
				.doc(
					`familyAccounts/${trialOwnerUid}/entitlementGrants/homeowner_plus_first_property_trial`,
				)
				.get(),
		);
		await assertFails(
			trialOwnerDb.doc(`familyAccounts/${trialOwnerUid}`).update({
				effectiveEntitlementProjection: {
					activeBundleIds: ['portfolio'],
					bundleExpirationsMs: { portfolio: 4102444800000 },
					nextTransitionAtMs: 4102444800000,
				},
			}),
		);

		const activeTrialDeviceBatch = trialOwnerDb.batch();
		activeTrialDeviceBatch.set(
			trialOwnerDb.doc('devices/trial-owner-device-16'),
			{
				accountId: trialOwnerUid,
				userId: trialOwnerUid,
				propertyId: `${trialOwnerUid}-property`,
				name: 'Equipment 16',
			},
		);
		activeTrialDeviceBatch.update(
			trialOwnerDb.doc(`familyAccounts/${trialOwnerUid}`),
			{ deviceCount: 16 },
		);
		await assertSucceeds(activeTrialDeviceBatch.commit());

		const expiredTrialDeviceBatch = expiredTrialOwnerDb.batch();
		expiredTrialDeviceBatch.set(
			expiredTrialOwnerDb.doc('devices/expired-trial-owner-device-16'),
			{
				accountId: expiredTrialOwnerUid,
				userId: expiredTrialOwnerUid,
				propertyId: `${expiredTrialOwnerUid}-property`,
				name: 'Equipment 16',
			},
		);
		expiredTrialDeviceBatch.update(
			expiredTrialOwnerDb.doc(`familyAccounts/${expiredTrialOwnerUid}`),
			{ deviceCount: 16 },
		);
		await assertFails(expiredTrialDeviceBatch.commit());

		await assertFails(
			homeownerPlusDb.doc(`users/${homeownerPlusUid}`).update({
				subscription: { status: 'active', plan: 'portfolio' },
			}),
		);
		await assertFails(
			homeownerPlusDb.doc(`users/${homeownerPlusUid}`).update({
				maintley_role: 'owner',
			}),
		);
		await assertFails(
			maliciousNewUserDb.doc(`users/${maliciousNewUserUid}`).set({
				id: maliciousNewUserUid,
				subscription: { status: 'active', plan: 'portfolio' },
			}),
		);
		await assertSucceeds(
			maliciousNewUserDb.doc(`users/${maliciousNewUserUid}`).set({
				id: maliciousNewUserUid,
				email: `${maliciousNewUserUid}@example.com`,
				registrationStatus: 'pending_email_verification',
				registrationMode: 'standard',
				subscription: { status: 'active', plan: 'homeowner' },
			}),
		);
		await assertFails(
			maliciousNewUserDb.doc(`users/${maliciousNewUserUid}`).update({
				registrationStatus: 'active',
				emailVerifiedAt: '2026-09-04T12:00:00.000Z',
			}),
		);
		await assertFails(
			maliciousNewUserDb.doc(`users/${maliciousNewUserUid}`).set({
				id: maliciousNewUserUid,
				maintley_role: 'owner',
				subscription: { status: 'active', plan: 'homeowner' },
			}),
		);
		await assertSucceeds(
			ownerDb.doc(`users/${ownerUid}`).update({
				subscription: { status: 'active', plan: 'portfolio' },
			}),
		);

		const fifthPropertyBatch = homeownerPlusDb.batch();
		fifthPropertyBatch.set(
			homeownerPlusDb.doc('properties/homeowner-plus-property-5'),
			{
				accountId: homeownerPlusAccountId,
				userId: homeownerPlusUid,
				title: 'Fifth family home',
			},
		);
		fifthPropertyBatch.update(
			homeownerPlusDb.doc(`familyAccounts/${homeownerPlusAccountId}`),
			{ propertyCount: 5 },
		);
		await assertSucceeds(fifthPropertyBatch.commit());

		const sixthPropertyBatch = homeownerPlusDb.batch();
		sixthPropertyBatch.set(
			homeownerPlusDb.doc('properties/homeowner-plus-property-6'),
			{
				accountId: homeownerPlusAccountId,
				userId: homeownerPlusUid,
				title: 'Sixth family home',
			},
		);
		sixthPropertyBatch.update(
			homeownerPlusDb.doc(`familyAccounts/${homeownerPlusAccountId}`),
			{ propertyCount: 6 },
		);
		await assertFails(sixthPropertyBatch.commit());

		await assertSucceeds(
			homeownerPlusDb.doc('propertyGroups/family-homes').set({
				accountId: homeownerPlusAccountId,
				name: 'Family homes',
			}),
		);
		await assertFails(
			homeownerPlusDb.doc('teamMembers/homeowner-plus-team-member').set({
				accountId: homeownerPlusAccountId,
				name: 'Business team member',
				role: 'admin',
			}),
		);
		await assertFails(
			homeownerPlusDb
				.doc('properties/homeowner-plus-property-5')
				.update({ tenants: ['resident-user'] }),
		);
		await assertFails(
			homeownerPlusDb.doc('properties/homeowner-plus-property-5').update({
				propertyType: 'multi_unit',
				propertyClassification: 'duplex',
			}),
		);
		await assertFails(
			homeownerPlusDb
				.doc('properties/homeowner-plus-property-5')
				.update({ isRental: true }),
		);

		await assertSucceeds(maintenanceLeadDb.doc('tasks/task-existing').get());
		await assertFails(outsiderDb.doc('tasks/task-existing').get());

		await assertSucceeds(
			maintenanceLeadDb.doc('tasks/task-created-by-lead').set(
				createTask({
					id: 'task-created-by-lead',
					title: 'Created by maintenance lead',
				}),
			),
		);

		await assertSucceeds(
			maintenanceDb.doc('tasks/task-created-by-maintenance').set(
				createTask({
					id: 'task-created-by-maintenance',
					title: 'Created by maintenance role',
				}),
			),
		);

		await assertSucceeds(
			trialOwnerDb.doc('tasks/trial-recurring-task').set({
				...createTask({
					accountId: trialOwnerUid,
					propertyId: `${trialOwnerUid}-property`,
					title: 'Active grant recurring task',
				}),
				isRecurring: true,
				recurrenceFrequency: 'monthly',
				recurrenceInterval: 1,
			}),
		);

		await assertSucceeds(
			expiredTrialOwnerDb.doc('tasks/expired-recurring-task').set({
				...createTask({
					accountId: expiredTrialOwnerUid,
					propertyId: `${expiredTrialOwnerUid}-property`,
					title: 'Core recurring task after grant expiration',
				}),
				isRecurring: true,
				recurrenceFrequency: 'monthly',
				recurrenceInterval: 1,
			}),
		);

		const grantedSecondPropertyBatch = portfolioGrantOwnerDb.batch();
		grantedSecondPropertyBatch.set(
			portfolioGrantOwnerDb.doc('properties/portfolio-grant-property-2'),
			{
				accountId: portfolioGrantOwnerUid,
				userId: portfolioGrantOwnerUid,
				title: 'Second granted property',
			},
		);
		grantedSecondPropertyBatch.update(
			portfolioGrantOwnerDb.doc(`familyAccounts/${portfolioGrantOwnerUid}`),
			{ propertyCount: 2 },
		);
		await assertSucceeds(grantedSecondPropertyBatch.commit());
		await assertSucceeds(
			portfolioGrantOwnerDb.doc('teamMembers/portfolio-grant-member').set({
				accountId: portfolioGrantOwnerUid,
				firstName: 'Granted',
				lastName: 'Teammate',
				role: 'admin',
			}),
		);
		await assertSucceeds(
			portfolioGrantOwnerDb
				.doc(`properties/${portfolioGrantOwnerUid}-property`)
				.update({
					tenants: [{ firstName: 'Manual', lastName: 'Occupant' }],
					propertyType: 'multi_unit',
					propertyClassification: 'duplex',
					isRental: true,
				}),
		);
		await assertFails(
			portfolioGrantOwnerDb
				.doc(`properties/${portfolioGrantOwnerUid}-property`)
				.update({ propertyClassification: 'condo' }),
		);
		await assertSucceeds(
			downgradedOwnerDb
				.doc(`properties/${downgradedOwnerUid}-property-1`)
				.get(),
		);
		await assertSucceeds(
			downgradedOwnerDb
				.doc(`properties/${downgradedOwnerUid}-property-2`)
				.get(),
		);
		await assertSucceeds(
			downgradedOwnerDb
				.doc(`properties/${downgradedOwnerUid}-property-1`)
				.update({ title: 'Retained commercial property updated' }),
		);
		await assertFails(
			downgradedOwnerDb
				.doc(`properties/${downgradedOwnerUid}-property-1`)
				.update({
					propertyType: 'residential',
					propertyClassification: 'condo',
				}),
		);
		const blockedDowngradeExpansion = downgradedOwnerDb.batch();
		blockedDowngradeExpansion.set(
			downgradedOwnerDb.doc(`properties/${downgradedOwnerUid}-property-3`),
			{
				accountId: downgradedOwnerUid,
				userId: downgradedOwnerUid,
				title: 'Blocked property',
			},
		);
		blockedDowngradeExpansion.update(
			downgradedOwnerDb.doc(`familyAccounts/${downgradedOwnerUid}`),
			{ propertyCount: 3 },
		);
		await assertFails(blockedDowngradeExpansion.commit());
		await assertFails(
			downgradedOwnerDb.doc('teamMembers/downgraded-new-member').set({
				accountId: downgradedOwnerUid,
				firstName: 'New',
				lastName: 'Member',
				role: 'admin',
			}),
		);
		await assertSucceeds(
			downgradedOwnerDb.doc('teamMembers/downgraded-existing-member').update({
				firstName: 'Updated',
				notes: 'Retained profile context',
				updatedAt: '2026-07-27T12:00:00.000Z',
			}),
		);
		await assertFails(
			downgradedOwnerDb.doc('teamMembers/downgraded-existing-member').update({
				role: 'admin',
				updatedAt: '2026-07-27T12:01:00.000Z',
			}),
		);
		await assertSucceeds(
			downgradedOwnerDb.doc('teamMembers/downgraded-existing-member').delete(),
		);

		await assertSucceeds(
			expiredTrialOwnerDb.doc('tasks/expired-non-recurring-task').set({
				...createTask({
					accountId: expiredTrialOwnerUid,
					propertyId: `${expiredTrialOwnerUid}-property`,
					title: 'Expired grant ordinary task',
				}),
				isRecurring: false,
			}),
		);

		await assertSucceeds(
			expiredTrialOwnerDb.doc('tasks/expired-recurring-task-to-disable').set({
				...createTask({
					accountId: expiredTrialOwnerUid,
					propertyId: `${expiredTrialOwnerUid}-property`,
					title: 'Legacy recurring task to disable',
				}),
				isRecurring: false,
			}),
		);
		await assertSucceeds(
			expiredTrialOwnerDb
				.doc('tasks/expired-recurring-task-to-disable')
				.update({
					isRecurring: false,
					updatedAt: '2026-07-01T13:00:00.000Z',
				}),
		);
		await assertSucceeds(
			expiredTrialOwnerDb
				.doc('tasks/expired-recurring-task-to-disable')
				.update({
					isRecurring: true,
					recurrenceFrequency: 'weekly',
					recurrenceInterval: 1,
					updatedAt: '2026-07-01T14:00:00.000Z',
				}),
		);

		await assertFails(
			inactiveLeadDb.doc('tasks/task-created-by-inactive-lead').set(
				createTask({
					id: 'task-created-by-inactive-lead',
					title: 'Created by inactive maintenance lead',
				}),
			),
		);

		await assertFails(
			outsiderDb.doc('tasks/task-created-by-outsider').set(
				createTask({
					id: 'task-created-by-outsider',
					title: 'Created by outsider',
				}),
			),
		);

		await assertSucceeds(
			maintenanceLeadDb.doc('tasks/task-existing').update({
				status: 'In Progress',
				updatedAt: '2026-07-01T13:00:00.000Z',
			}),
		);

		await assertSucceeds(
			maintenanceLeadDb.doc('tasks/task-legacy-user-id').update({
				accountId,
				status: 'In Progress',
				updatedAt: '2026-07-01T13:00:00.000Z',
			}),
		);

		await assertFails(maintenanceLeadDb.doc('tasks/task-existing').delete());
		await assertSucceeds(ownerDb.doc('tasks/task-existing').delete());

		await assertSucceeds(
			ownerDb.doc(`accountMemberships/${membershipId(maintenanceUid)}`).get(),
		);
		await assertSucceeds(
			maintenanceDb
				.doc(`accountMemberships/${membershipId(maintenanceUid)}`)
				.get(),
		);
		await assertFails(
			outsiderDb
				.doc(`accountMemberships/${membershipId(maintenanceUid)}`)
				.get(),
		);
		await assertFails(
			ownerDb.doc(`accountMemberships/${accountId}_new-member`).set({
				accountId,
				userId: 'new-member',
				roles: ['member'],
				status: 'active',
			}),
		);
		await assertFails(
			ownerDb.doc(`accountMemberships/${membershipId(maintenanceUid)}`).update({
				status: 'inactive',
			}),
		);
		await assertFails(
			ownerDb
				.doc(`accountMemberships/${membershipId(maintenanceUid)}`)
				.delete(),
		);

		await assertSucceeds(ownerDb.doc('tenantProfiles/legacy-resident').get());
		await assertFails(outsiderDb.doc('tenantProfiles/legacy-resident').get());
		await assertFails(
			ownerDb.doc('tenantProfiles/new-resident-profile').set({
				accountId,
				propertyId: 'property-1',
				firstName: 'New',
				lastName: 'Resident',
				email: 'new-resident@example.com',
			}),
		);
		await assertFails(
			ownerDb.doc('tenantProfiles/legacy-resident').update({
				creditScore: 750,
			}),
		);
		await assertFails(
			ownerDb.doc('maintenanceEvents/client-created-event').set({
				accountId,
				propertyId: 'property-1',
				title: 'Client-created event',
				eventType: 'maintenance_recorded',
				eventSource: 'manual_entry',
			}),
		);
		await assertSucceeds(
			ownerDb.doc('maintenanceEventRevisions/revision-existing').get(),
		);
		await assertFails(
			outsiderDb.doc('maintenanceEventRevisions/revision-existing').get(),
		);
		await assertFails(
			ownerDb
				.doc('maintenanceEvents/server-created-event')
				.update({ title: 'Forged correction' }),
		);
		await assertFails(
			ownerDb.doc('maintenanceEvents/server-created-event').delete(),
		);
		await assertFails(
			ownerDb.doc('maintenanceEventRevisions/client-revision').set({
				accountId,
				eventId: 'server-created-event',
				action: 'corrected',
			}),
		);
		await assertFails(
			ownerDb
				.doc('maintenanceEventRevisions/revision-existing')
				.update({ action: 'deleted' }),
		);
		await assertFails(
			ownerDb.doc('maintenanceEventRevisions/revision-existing').delete(),
		);

		await assertFails(ownerDb.doc('admin_users/admin-record').get());
		await assertFails(ownerDb.doc('admin_sessions/session-record').get());
		await assertFails(ownerDb.doc('admin_audit_logs/audit-record').get());
		await assertFails(
			ownerDb
				.doc('familyAccounts/account-owner/entitlementGrants/grant-existing')
				.get(),
		);
		await assertFails(
			ownerDb.doc('entitlementAccessPrograms/program-v1').get(),
		);
		await assertFails(ownerDb.doc('entitlementAccessCodes/code-hash').get());
		await assertFails(
			ownerDb.doc('accessCodeRedemptionAttempts/client-attempt').set({
				accountId,
				outcome: 'redeemed',
			}),
		);
		await assertFails(
			ownerDb
				.doc('familyAccounts/account-owner/entitlementGrants/client-grant')
				.set({
					grantId: 'client-grant',
					programId: 'client-program',
					accountId,
					kind: 'permanent',
					state: 'active',
				}),
		);
		await assertFails(
			ownerDb
				.doc(
					'familyAccounts/account-owner/accessLifecycleDeliveries/delivery-existing',
				)
				.get(),
		);
		await assertFails(
			ownerDb
				.doc(
					'familyAccounts/account-owner/accessLifecycleDeliveries/client-delivery',
				)
				.set({
					accountId,
					grantId: 'grant-existing',
					milestone: 'activation',
					status: 'sent',
				}),
		);
		await assertFails(
			ownerDb.doc('admin_users/admin-record').update({
				status: 'inactive',
			}),
		);
		await assertFails(ownerDb.doc('admin_sessions/session-record').delete());
		await assertFails(
			ownerDb.doc('admin_audit_logs/audit-created-by-client').set({
				action: 'client_write_attempt',
				createdAt: '2026-07-01T12:00:00.000Z',
			}),
		);

		await assertFails(ownerDb.doc('feedback/feedback-owned').get());
		await assertFails(outsiderDb.doc('feedback/feedback-owned').get());
		await assertFails(
			ownerDb.doc('feedback/feedback-created-by-client').set({
				accountId,
				userId: ownerUid,
				type: 'bug_report',
				status: 'new',
				subject: 'Client-created support request',
			}),
		);
		await assertFails(
			ownerDb.doc('feedback/feedback-owned').update({
				status: 'closed',
			}),
		);
		await assertFails(ownerDb.doc('feedback/feedback-owned').delete());

		await assertSucceeds(
			ownerDb.doc('propertyDocuments/property-document-owned').get(),
		);
		await assertSucceeds(ownerDb.doc('propertySpaces/space-owned').get());
		await assertSucceeds(
			ownerDb
				.collection('propertySpaces')
				.where('propertyId', '==', 'property-1')
				.where('accountId', '==', accountId)
				.get(),
		);
		await assertSucceeds(
			maintenanceLeadDb.doc('propertySpaces/space-owned').get(),
		);
		await assertSucceeds(
			ownerDb
				.collection('propertySpaces')
				.where('accountId', '==', accountId)
				.get(),
		);
		await assertFails(outsiderDb.doc('propertySpaces/space-owned').get());
		// Generated Space creation must discover existing records through an
		// authorized property-scoped query. Reading a deterministic missing
		// document directly is intentionally denied because no resource data exists.
		await assertFails(
			ownerDb.doc('propertySpaces/property-1__bedroom_1').get(),
		);
		await assertSucceeds(
			ownerDb
				.collection('propertySpaces')
				.where('accountId', '==', accountId)
				.where('propertyId', '==', 'property-1')
				.get(),
		);
		await assertSucceeds(
			ownerDb.doc('propertySpaces/space-created').set(
				createPropertySpace({
					name: 'Lawn',
					type: 'grounds',
					sortOrder: 20,
				}),
			),
		);
		await assertSucceeds(
			ownerDb.doc('propertySpaces/property-1__bedroom_1').set(
				createPropertySpace({
					name: 'Bedroom 1',
					type: 'interior',
					generationKey: 'bedroom:1',
					source: 'property_profile',
				}),
			),
		);
		await assertSucceeds(
			ownerDb.doc('propertySpaces/property-1__setup_kitchen').set(
				createPropertySpace({
					name: 'Kitchen',
					generationKey: 'setup:kitchen',
					source: 'setup_assistant',
				}),
			),
		);
		await assertFails(
			ownerDb.doc('propertySpaces/space-invalid-generation').set(
				createPropertySpace({ generationKey: '', source: 'property_profile' }),
			),
		);
		await assertFails(
			ownerDb.doc('propertySpaces/space-generated-without-key').set(
				createPropertySpace({ source: 'setup_assistant' }),
			),
		);
		await assertFails(
			ownerDb.doc('propertySpaces/space-manual-with-key').set(
				createPropertySpace({ generationKey: 'setup:kitchen', source: 'manual' }),
			),
		);
		await assertFails(
			ownerDb.doc('propertySpaces/property-1__bedroom_1').update({
				generationKey: 'bedroom:2',
				updatedBy: ownerUid,
				updatedAt: '2026-07-01T12:30:00.000Z',
			}),
		);
		await assertFails(
			maintenanceLeadDb.doc('propertySpaces/space-lead-created').set(
				createPropertySpace({
					createdBy: maintenanceLeadUid,
					updatedBy: maintenanceLeadUid,
				}),
			),
		);
		await assertSucceeds(
			propertyManagerDb.doc('propertySpaces/space-manager-created').set(
				createPropertySpace({
					name: 'Mechanical Room',
					type: 'utility',
					createdBy: propertyManagerUid,
					updatedBy: propertyManagerUid,
				}),
			),
		);
		await assertFails(
			ownerDb
				.doc('propertySpaces/space-wrong-property')
				.set(createPropertySpace({ propertyId: 'missing-property' })),
		);
		await assertFails(
			ownerDb
				.doc('propertySpaces/space-invalid-type')
				.set(createPropertySpace({ type: 'room' })),
		);
		await assertSucceeds(
			ownerDb.doc('propertySpaces/space-owned').update({
				name: 'Great Room',
				sortOrder: 15,
				updatedBy: ownerUid,
				updatedAt: '2026-07-01T13:00:00.000Z',
			}),
		);
		await assertSucceeds(
			ownerDb.doc('propertySpaces/space-owned').update({
				isArchived: true,
				updatedBy: ownerUid,
				updatedAt: '2026-07-01T13:30:00.000Z',
			}),
		);
		await assertFails(
			ownerDb.doc('propertySpaces/space-owned').update({
				accountId: outsiderUid,
				updatedBy: ownerUid,
				updatedAt: '2026-07-01T14:00:00.000Z',
			}),
		);
		await assertFails(
			maintenanceLeadDb.doc('propertySpaces/space-owned').delete(),
		);
		await assertFails(ownerDb.doc('propertySpaces/space-created').delete());
		await assertSucceeds(ownerDb.doc('propertySupplies/supply-owned').get());
		await assertSucceeds(
			ownerDb
				.collection('propertySupplies')
				.where('accountId', '==', accountId)
				.where('propertyId', '==', 'property-1')
				.get(),
		);
		await assertSucceeds(
			maintenanceLeadDb.doc('propertySupplies/supply-owned').get(),
		);
		await assertFails(outsiderDb.doc('propertySupplies/supply-owned').get());
		await assertSucceeds(
			ownerDb.doc('propertySupplies/supply-created').set(
				createPropertySupply({
					name: 'Kitchen wall paint',
					type: 'paint_and_finish',
				}),
			),
		);
		await assertFails(
			maintenanceLeadDb.doc('propertySupplies/supply-lead-created').set(
				createPropertySupply({
					createdBy: maintenanceLeadUid,
					updatedBy: maintenanceLeadUid,
				}),
			),
		);
		await assertSucceeds(
			propertyManagerDb.doc('propertySupplies/supply-manager-created').set(
				createPropertySupply({
					name: 'Water filter',
					createdBy: propertyManagerUid,
					updatedBy: propertyManagerUid,
				}),
			),
		);
		await assertFails(
			ownerDb
				.doc('propertySupplies/supply-invalid-type')
				.set(createPropertySupply({ type: 'inventory' })),
		);
		await assertFails(
			ownerDb.doc('propertySupplies/supply-invalid-barcode').set(
				createPropertySupply({ barcodeValue: 'x'.repeat(513) }),
			),
		);
		await assertSucceeds(
			ownerDb.doc('propertySupplies/supply-owned').update({
				modelOrSku: 'EF-16251-NEW',
				updatedBy: ownerUid,
				updatedAt: '2026-07-01T13:00:00.000Z',
			}),
		);
		await assertFails(
			ownerDb.doc('propertySupplies/supply-owned').update({
				propertyId: 'missing-property',
				updatedBy: ownerUid,
				updatedAt: '2026-07-01T14:00:00.000Z',
			}),
		);
		await assertFails(ownerDb.doc('propertySupplies/supply-created').delete());
		await assertSucceeds(
			ownerDb.doc('propertyKnowledgeLinks/link-owned').get(),
		);
		await assertSucceeds(
			ownerDb
				.collection('propertyKnowledgeLinks')
				.where('accountId', '==', accountId)
				.where('propertyId', '==', 'property-1')
				.get(),
		);
		await assertSucceeds(
			maintenanceLeadDb.doc('propertyKnowledgeLinks/link-owned').get(),
		);
		await assertSucceeds(
			ownerDb
				.collection('propertyKnowledgeLinks')
				.where('accountId', '==', accountId)
				.get(),
		);
		await assertFails(
			outsiderDb.doc('propertyKnowledgeLinks/link-owned').get(),
		);
		await assertFails(
			ownerDb.doc('propertyKnowledgeLinks/link-client-created').set({
				accountId,
				propertyId: 'property-1',
				fromType: 'equipment',
				fromId: 'device-owned',
				relationshipType: 'located_in',
				toType: 'space',
				toId: 'space-owned',
				source: 'manual',
				createdAt: '2026-07-01T12:00:00.000Z',
				createdBy: ownerUid,
				updatedAt: '2026-07-01T12:00:00.000Z',
				updatedBy: ownerUid,
			}),
		);
		await assertFails(
			ownerDb.doc('propertyKnowledgeLinks/link-owned').update({
				toId: 'another-space',
			}),
		);
		await assertFails(
			ownerDb.doc('propertyKnowledgeLinks/link-owned').delete(),
		);
		await assertSucceeds(
			ownerDb
				.collection('propertyDocuments')
				.where('propertyId', '==', 'property-1')
				.where('accountId', '==', accountId)
				.get(),
		);
		await assertSucceeds(
			maintenanceLeadDb.doc('propertyDocuments/property-document-owned').get(),
		);
		await assertFails(
			outsiderDb.doc('propertyDocuments/property-document-owned').get(),
		);
		await assertFails(
			ownerDb.doc('propertyDocuments/property-document-outsider').get(),
		);
		await assertSucceeds(
			ownerDb.doc('propertyDocuments/property-document-created').set(
				createPropertyDocument({
					id: 'property-document-created',
					name: 'Water heater warranty',
				}),
			),
		);
		await assertSucceeds(
			propertyManagerDb.doc('propertyDocuments/property-document-manager').set(
				createPropertyDocument({
					id: 'property-document-manager',
					name: 'Manager upload',
				}),
			),
		);
		await assertSucceeds(
			legacyOwnerDb
				.doc('propertyDocuments/property-document-legacy-created')
				.set(
					createPropertyDocument({
						id: 'property-document-legacy-created',
						name: 'Legacy owner upload',
					}),
				),
		);
		await assertFails(
			maintenanceLeadDb
				.doc('propertyDocuments/property-document-lead-created')
				.set(
					createPropertyDocument({
						id: 'property-document-lead-created',
						name: 'Lead upload attempt',
					}),
				),
		);
		await assertFails(
			outsiderDb
				.doc('propertyDocuments/property-document-outsider-created')
				.set(
					createPropertyDocument({
						id: 'property-document-outsider-created',
						name: 'Outsider upload attempt',
					}),
				),
		);
		await assertFails(
			ownerDb.doc('propertyDocuments/property-document-account-mismatch').set(
				createPropertyDocument({
					id: 'property-document-account-mismatch',
					accountId: outsiderUid,
					name: 'Cross-account upload attempt',
				}),
			),
		);
		await assertSucceeds(
			ownerDb.doc('propertyDocuments/property-document-owned').update({
				acquisitionStatus: 'reviewed',
				updatedAt: '2026-07-01T13:00:00.000Z',
			}),
		);
		await assertSucceeds(
			propertyManagerDb
				.doc('propertyDocuments/property-document-manager')
				.update({
					name: 'Manager-renamed upload',
					updatedAt: '2026-07-01T13:10:00.000Z',
				}),
		);
		await assertFails(
			ownerDb.doc('propertyDocuments/property-document-owned').update({
				accountId: outsiderUid,
				updatedAt: '2026-07-01T13:30:00.000Z',
			}),
		);
		await assertFails(
			ownerDb.doc('propertyDocuments/property-document-owned').update({
				propertyId: 'another-property',
				updatedAt: '2026-07-01T13:35:00.000Z',
			}),
		);
		await assertFails(
			maintenanceLeadDb
				.doc('propertyDocuments/property-document-owned')
				.delete(),
		);
		await assertSucceeds(
			ownerDb.doc('propertyDocuments/property-document-created').delete(),
		);
		await assertSucceeds(
			propertyManagerDb
				.doc('propertyDocuments/property-document-manager')
				.delete(),
		);

		await assertSucceeds(
			ownerDb
				.doc('propertyKnowledgeSuggestions/property-suggestion-owned')
				.get(),
		);
		await assertSucceeds(
			ownerDb
				.collection('propertyKnowledgeSuggestions')
				.where('propertyId', '==', 'property-1')
				.where('accountId', '==', accountId)
				.get(),
		);
		await assertSucceeds(
			maintenanceLeadDb
				.doc('propertyKnowledgeSuggestions/property-suggestion-owned')
				.get(),
		);
		await assertFails(
			outsiderDb
				.doc('propertyKnowledgeSuggestions/property-suggestion-owned')
				.get(),
		);
		await assertFails(
			ownerDb
				.doc('propertyKnowledgeSuggestions/property-suggestion-outsider')
				.get(),
		);
		await assertSucceeds(
			ownerDb
				.doc('propertyKnowledgeSuggestions/property-suggestion-created')
				.set(
					createPropertyKnowledgeSuggestion({
						id: 'property-suggestion-created',
						sourceDocumentId: 'property-document-owned',
					}),
				),
		);
		await assertFails(
			maintenanceLeadDb
				.doc('propertyKnowledgeSuggestions/property-suggestion-lead-created')
				.set(
					createPropertyKnowledgeSuggestion({
						id: 'property-suggestion-lead-created',
						sourceDocumentId: 'property-document-owned',
					}),
				),
		);
		await assertSucceeds(
			ownerDb
				.doc('propertyKnowledgeSuggestions/property-suggestion-owned')
				.update({
					status: 'accepted',
					updatedAt: '2026-07-01T13:00:00.000Z',
				}),
		);
		await assertFails(
			ownerDb
				.doc('propertyKnowledgeSuggestions/property-suggestion-owned')
				.update({
					accountId: outsiderUid,
					updatedAt: '2026-07-01T13:30:00.000Z',
				}),
		);
		await assertFails(
			maintenanceLeadDb
				.doc('propertyKnowledgeSuggestions/property-suggestion-owned')
				.delete(),
		);
		await assertSucceeds(
			ownerDb
				.doc('propertyKnowledgeSuggestions/property-suggestion-created')
				.delete(),
		);

		await assertSucceeds(ownerDb.doc('notifications/notification-owned').get());
		await assertFails(outsiderDb.doc('notifications/notification-owned').get());
		await assertFails(ownerDb.doc('notifications/notification-outsider').get());
		await assertSucceeds(
			ownerDb.doc('notifications/notification-created-by-owner').set(
				createNotification({
					id: 'notification-created-by-owner',
					title: 'Owner notification',
				}),
			),
		);
		await assertFails(
			ownerDb.doc('notifications/notification-spoofed-create').set(
				createNotification({
					id: 'notification-spoofed-create',
					userId: outsiderUid,
					title: 'Spoofed notification',
				}),
			),
		);
		await assertSucceeds(
			ownerDb.doc('notifications/notification-owned').update({
				status: 'read',
				updatedAt: '2026-07-01T13:00:00.000Z',
			}),
		);
		await assertFails(
			ownerDb.doc('notifications/notification-owned').update({
				userId: outsiderUid,
				updatedAt: '2026-07-01T13:30:00.000Z',
			}),
		);
		await assertFails(
			outsiderDb.doc('notifications/notification-owned').update({
				status: 'read',
				updatedAt: '2026-07-01T14:00:00.000Z',
			}),
		);
		await assertSucceeds(
			ownerDb.doc('notifications/notification-owned').delete(),
		);
		await assertFails(
			outsiderDb.doc('notifications/notification-created-by-owner').delete(),
		);

		await assertSucceeds(ownerDb.doc('maintleyEvents/event-owned').get());
		await assertSucceeds(
			maintenanceLeadDb.doc('maintleyEvents/event-recipient').get(),
		);
		await assertFails(outsiderDb.doc('maintleyEvents/event-owned').get());
		await assertFails(ownerDb.doc('maintleyEvents/event-outsider').get());
		await assertFails(
			ownerDb.doc('maintleyEvents/event-created-by-client').set({
				accountId,
				userId: ownerUid,
				recipientIds: [ownerUid],
				type: 'quick_scan_completed',
				workflowKey: 'maintley-intelligence',
				entityKey: 'scan:client-created',
				title: 'Quick Scan complete',
				message: 'Client write attempt.',
				status: 'completed',
				createdAt: '2026-07-01T12:00:00.000Z',
				updatedAt: '2026-07-01T12:00:00.000Z',
			}),
		);
		await assertFails(
			ownerDb.doc('maintleyEvents/event-owned').update({
				status: 'completed',
				updatedAt: '2026-07-01T15:00:00.000Z',
			}),
		);
		await assertFails(ownerDb.doc('maintleyEvents/event-owned').delete());

		for (const protectedCollection of [
			'serviceWorkRequests',
			'workRequestReports',
			'workRequestEvents',
		]) {
			await assertSucceeds(
				ownerDb.doc(`${protectedCollection}/work-request-record-owned`).get(),
			);
			await assertSucceeds(
				ownerDb
					.collection(protectedCollection)
					.where('accountId', '==', accountId)
					.where('propertyId', '==', 'property-1')
					.get(),
			);
			await assertFails(
				maintenanceLeadDb
					.doc(`${protectedCollection}/work-request-record-owned`)
					.get(),
			);
			await assertFails(
				outsiderDb
					.doc(`${protectedCollection}/work-request-record-owned`)
					.get(),
			);
			await assertSucceeds(
				outsiderDb
					.doc(`${protectedCollection}/work-request-record-outsider`)
					.get(),
			);
			await assertFails(
				ownerDb.doc(`${protectedCollection}/client-created`).set({
					accountId,
					propertyId: 'property-1',
				}),
			);
			await assertFails(
				ownerDb
					.doc(`${protectedCollection}/work-request-record-owned`)
					.update({ updatedAt: '2026-09-07T15:00:00.000Z' }),
			);
			await assertFails(
				ownerDb
					.doc(`${protectedCollection}/work-request-record-owned`)
					.delete(),
			);
		}

		await assertFails(
			ownerDb.doc('workRequestShares/work-request-share-owned').get(),
		);
		await assertFails(
			ownerDb.doc('workRequestShares/client-created').set({
				accountId,
				propertyId: 'property-1',
			}),
		);
		await assertFails(
			ownerDb.doc('workRequestShares/work-request-share-owned').update({
				revokedAt: '2026-09-07T15:00:00.000Z',
			}),
		);
		await assertFails(
			ownerDb.doc('workRequestShares/work-request-share-owned').delete(),
		);

		for (const protectedCollection of [
			'personalAssistantCredentials',
			'personalAssistantRateLimits',
			'personalAssistantAccessAudits',
		]) {
			await assertFails(
				ownerDb.doc(`${protectedCollection}/client-attempt`).get(),
			);
			await assertFails(
				ownerDb
					.doc(`${protectedCollection}/client-attempt`)
					.set({ ownerUserId: ownerUid }),
			);
		}

		console.log('Firestore rules permission boundary tests passed.');
	} finally {
		await env.cleanup();
	}
}

run().catch((error) => {
	console.error('Firestore rules permission boundary tests failed.');
	console.error(error);
	process.exit(1);
});
