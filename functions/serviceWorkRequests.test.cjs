const assert = require('node:assert/strict');
const test = require('node:test');
const {
	createStartServiceWorkRequestHandler,
	workRequestEventId,
	workRequestIdForStart,
} = require('./lib/serviceWorkRequests.js');

const clone = (value) => {
	if (value === undefined) return undefined;
	return JSON.parse(JSON.stringify(value));
};

class FakeSnapshot {
	constructor(id, data) {
		this.id = id;
		this.exists = data !== undefined;
		this._data = data;
	}

	data() {
		return clone(this._data);
	}
}

class FakeDocRef {
	constructor(database, collectionName, id) {
		this.database = database;
		this.collectionName = collectionName;
		this.id = id;
		this.path = `${collectionName}/${id}`;
	}
}

class FakeCollectionRef {
	constructor(database, name) {
		this.database = database;
		this.name = name;
	}

	doc(id) {
		return new FakeDocRef(this.database, this.name, id);
	}
}

class FakeTransaction {
	constructor(database) {
		this.database = database;
		this.creates = [];
	}

	async get(ref) {
		return new FakeSnapshot(ref.id, this.database.documents.get(ref.path));
	}

	create(ref, data) {
		if (this.database.failCreateCollection === ref.collectionName) {
			throw new Error(`Simulated create failure for ${ref.collectionName}.`);
		}
		if (
			this.database.documents.has(ref.path) ||
			this.creates.some((candidate) => candidate.ref.path === ref.path)
		) {
			throw new Error(`Document ${ref.path} already exists.`);
		}
		this.creates.push({ ref, data: clone(data) });
	}

	commit() {
		for (const create of this.creates) {
			this.database.documents.set(create.ref.path, create.data);
		}
	}
}

class FakeFirestore {
	constructor() {
		this.documents = new Map();
		this.transactionCount = 0;
		this.failCreateCollection = '';
	}

	collection(name) {
		return new FakeCollectionRef(this, name);
	}

	seed(path, data) {
		this.documents.set(path, clone(data));
	}

	get(path) {
		return clone(this.documents.get(path));
	}

	async runTransaction(callback) {
		this.transactionCount += 1;
		const transaction = new FakeTransaction(this);
		const result = await callback(transaction);
		transaction.commit();
		return result;
	}
}

const validCommand = (overrides = {}) => ({
	commandName: 'startServiceWorkRequest',
	propertyId: 'property-1',
	idempotencyKey: 'request-123',
	mode: 'guide_me',
	serviceCategory: 'hvac',
	initialDescription: 'The heat pump is running but the house is still cold.',
	...overrides,
});

const createHarness = (overrides = {}) => {
	const database = overrides.database || new FakeFirestore();
	const calls = {
		resolvedUids: [],
		roleAssertions: [],
		capabilityAccounts: [],
	};
	const handler = createStartServiceWorkRequestHandler({
		db: database,
		resolveAccountIdForUser: async (uid) => {
			calls.resolvedUids.push(uid);
			return overrides.accountId || 'account-1';
		},
		assertAccountRole: async (uid, accountId, roles) => {
			calls.roleAssertions.push({ uid, accountId, roles });
			if (overrides.roleError) throw overrides.roleError;
		},
		hasPilotCapability: async (accountId) => {
			calls.capabilityAccounts.push(accountId);
			return overrides.entitled !== false;
		},
		now: () => '2026-09-07T14:00:00.000Z',
	});

	return { database, calls, handler };
};

const assertCode = (expectedCode) => (error) => {
	assert.equal(error.code, expectedCode);
	return true;
};

test('start IDs are stable, scoped, and do not expose request text', () => {
	const id = workRequestIdForStart(
		'account-1',
		'property-1',
		'owner-1',
		'sensitive homeowner text',
	);
	assert.equal(
		id,
		workRequestIdForStart(
			'account-1',
			'property-1',
			'owner-1',
			'sensitive homeowner text',
		),
	);
	assert.notEqual(
		id,
		workRequestIdForStart(
			'account-1',
			'property-2',
			'owner-1',
			'sensitive homeowner text',
		),
	);
	assert.match(id, /^work_request_[a-f0-9]{40}$/);
	assert.doesNotMatch(id, /sensitive|homeowner|text/);
	assert.match(
		workRequestEventId(id, 'WorkRequestStarted', 'request-123'),
		/^work_request_event_[a-f0-9]{40}$/,
	);
});

test('unauthenticated and malformed commands fail before authorization or writes', async () => {
	const { database, calls, handler } = createHarness();

	await assert.rejects(
		() => handler(validCommand(), {}),
		assertCode('unauthenticated'),
	);
	await assert.rejects(
		() =>
			handler(validCommand({ accountId: 'spoofed-account' }), {
				auth: { uid: 'owner-1' },
			}),
		assertCode('invalid-argument'),
	);
	await assert.rejects(
		() =>
			handler(validCommand({ serviceCategory: 'plumbing' }), {
				auth: { uid: 'owner-1' },
			}),
		assertCode('invalid-argument'),
	);

	assert.deepEqual(calls.resolvedUids, []);
	assert.equal(database.documents.size, 0);
});

test('the callable derives account authority, requires owner role, and fails closed without the pilot capability', async () => {
	const { database, calls, handler } = createHarness({ entitled: false });
	database.seed('properties/property-1', {
		accountId: 'account-1',
		userId: 'owner-1',
	});

	await assert.rejects(
		() => handler(validCommand(), { auth: { uid: 'owner-1' } }),
		assertCode('permission-denied'),
	);

	assert.deepEqual(calls.resolvedUids, ['owner-1']);
	assert.deepEqual(calls.roleAssertions, [
		{
			uid: 'owner-1',
			accountId: 'account-1',
			roles: ['account_owner'],
		},
	]);
	assert.deepEqual(calls.capabilityAccounts, ['account-1']);
	assert.equal(database.transactionCount, 0);
	assert.equal(database.documents.size, 1);
});

test('a non-owner role is denied before capability resolution or persistence', async () => {
	const roleError = Object.assign(new Error('Owner role required.'), {
		code: 'permission-denied',
	});
	const { database, calls, handler } = createHarness({ roleError });
	database.seed('properties/property-1', {
		accountId: 'account-1',
		userId: 'owner-1',
	});

	await assert.rejects(
		() => handler(validCommand(), { auth: { uid: 'member-1' } }),
		assertCode('permission-denied'),
	);
	assert.deepEqual(calls.capabilityAccounts, []);
	assert.equal(database.transactionCount, 0);
	assert.equal(database.documents.size, 1);
});

test('cross-account Properties fail inside the atomic persistence boundary', async () => {
	const { database, handler } = createHarness();
	database.seed('properties/property-1', {
		accountId: 'different-account',
		userId: 'different-owner',
	});

	await assert.rejects(
		() => handler(validCommand(), { auth: { uid: 'owner-1' } }),
		assertCode('permission-denied'),
	);
	assert.equal(database.transactionCount, 1);
	assert.equal(database.documents.size, 1);
});

test('an accepted start writes one resumable session and one append-only event atomically', async () => {
	const { database, handler } = createHarness();
	database.seed('properties/property-1', {
		accountId: 'account-1',
		userId: 'owner-1',
	});

	const result = await handler(validCommand(), { auth: { uid: 'owner-1' } });
	assert.deepEqual(result, {
		workRequestId: result.workRequestId,
		state: 'draft',
		revision: 1,
		replayed: false,
	});

	const session = database.get(`serviceWorkRequests/${result.workRequestId}`);
	assert.equal(session.accountId, 'account-1');
	assert.equal(session.propertyId, 'property-1');
	assert.equal(session.mode, 'guide_me');
	assert.equal(session.serviceCategory, 'hvac');
	assert.equal(session.state, 'draft');
	assert.equal(session.safetyReview.status, 'pending');
	assert.equal(session.createdBy.actorId, 'owner-1');
	assert.equal(session.createdBy.actorType, 'homeowner');
	assert.equal(session.versions.sessionSchemaVersion, 'service_work_request_v1alpha1');
	assert.deepEqual(session.questions, []);
	assert.deepEqual(session.answers, []);
	assert.deepEqual(session.modelUsage, []);

	const events = Array.from(database.documents.entries()).filter(([path]) =>
		path.startsWith('workRequestEvents/'),
	);
	assert.equal(events.length, 1);
	const event = events[0][1];
	assert.equal(event.name, 'WorkRequestStarted');
	assert.equal(event.workRequestId, result.workRequestId);
	assert.equal(event.accountId, 'account-1');
	assert.equal(event.propertyId, 'property-1');
	assert.equal(event.toState, 'draft');
	assert.equal(event.payload.serviceCategory, 'hvac');
	assert.match(event.idempotencyKey, /^idempotency_[a-f0-9]{40}$/);
	assert.notEqual(event.idempotencyKey, 'request-123');
	assert.doesNotMatch(JSON.stringify(event), /heat pump|house is still cold/);
	assert.equal(
		event.correlationId,
		`service-work-request:${result.workRequestId}`,
	);
});

test('start retries are idempotent and return the current resumable revision', async () => {
	const { database, handler } = createHarness();
	database.seed('properties/property-1', {
		accountId: 'account-1',
		userId: 'owner-1',
	});

	const created = await handler(validCommand(), { auth: { uid: 'owner-1' } });
	const sessionPath = `serviceWorkRequests/${created.workRequestId}`;
	const advancedSession = database.get(sessionPath);
	advancedSession.state = 'screening_safety';
	advancedSession.revision = 2;
	database.seed(sessionPath, advancedSession);

	const replay = await handler(validCommand(), { auth: { uid: 'owner-1' } });
	assert.deepEqual(replay, {
		workRequestId: created.workRequestId,
		state: 'screening_safety',
		revision: 2,
		replayed: true,
	});
	assert.equal(
		Array.from(database.documents.keys()).filter((path) =>
			path.startsWith('workRequestEvents/'),
		).length,
		1,
	);

	await assert.rejects(
		() =>
			handler(validCommand({ mode: 'some_details' }), {
				auth: { uid: 'owner-1' },
			}),
		assertCode('failed-precondition'),
	);
});

test('a failed event create leaves neither the session nor event behind', async () => {
	const { database, handler } = createHarness();
	database.seed('properties/property-1', {
		accountId: 'account-1',
		userId: 'owner-1',
	});
	database.failCreateCollection = 'workRequestEvents';

	await assert.rejects(
		() => handler(validCommand(), { auth: { uid: 'owner-1' } }),
		/Simulated create failure/,
	);
	assert.equal(
		Array.from(database.documents.keys()).some((path) =>
			path.startsWith('serviceWorkRequests/'),
		),
		false,
	);
	assert.equal(
		Array.from(database.documents.keys()).some((path) =>
			path.startsWith('workRequestEvents/'),
		),
		false,
	);
});
