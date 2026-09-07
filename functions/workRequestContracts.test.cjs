const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const contracts = require('./packages/work-request-contracts');

test('work request contracts expose versioned, fail-closed vocabulary', () => {
	assert.equal(contracts.WORK_REQUEST_CONTRACT_VERSION, '0.1.0');
	assert.equal(contracts.isWorkRequestMode('guide_me'), true);
	assert.equal(contracts.isWorkRequestMode('expert'), false);
	assert.equal(contracts.isWorkRequestState('reviewing_report'), true);
	assert.equal(contracts.isWorkRequestState('completed'), false);
	assert.equal(contracts.isWorkRequestEventName('WorkRequestShared'), true);
	assert.equal(contracts.isWorkRequestEventName('maintenance_request_created'), false);
});

test('every declared transition uses known commands, states, and events', () => {
	for (const [from, commands] of Object.entries(contracts.WORK_REQUEST_TRANSITIONS)) {
		assert.equal(contracts.isWorkRequestState(from), true);
		for (const [command, transitions] of Object.entries(commands)) {
			assert.equal(contracts.isWorkRequestCommandName(command), true);
			for (const transition of transitions) {
				assert.equal(contracts.isWorkRequestState(transition.to), true);
				for (const eventName of transition.events) {
					assert.equal(contracts.isWorkRequestEventName(eventName), true);
				}
			}
		}
	}
});

test('safety stops intake and sharing requires an approved report', () => {
	assert.equal(
		contracts.canTransitionWorkRequestState(
			'screening_safety',
			'recordWorkRequestAnswer',
			'safety_stopped',
		),
		true,
	);
	assert.deepEqual(contracts.WORK_REQUEST_TRANSITIONS.safety_stopped, {});
	assert.equal(
		contracts.canTransitionWorkRequestState(
			'reviewing_report',
			'createWorkRequestShare',
			'shared',
		),
		false,
	);
	assert.equal(
		contracts.canTransitionWorkRequestState(
			'approved',
			'createWorkRequestShare',
			'shared',
		),
		true,
	);
});

test('the contracts package has no product, persistence, or provider dependencies', () => {
	const packageDirectory = path.join(__dirname, 'packages', 'work-request-contracts');
	const packageJson = JSON.parse(
		fs.readFileSync(path.join(packageDirectory, 'package.json'), 'utf8'),
	);
	const source = [
		fs.readFileSync(path.join(packageDirectory, 'index.js'), 'utf8'),
		fs.readFileSync(path.join(packageDirectory, 'index.d.ts'), 'utf8'),
	].join('\n');

	assert.equal(packageJson.dependencies, undefined);
	assert.doesNotMatch(
		source,
		/from ['"](?:react|react-redux|@reduxjs|firebase|firebase-admin|openai|@jobber)/,
	);
});
