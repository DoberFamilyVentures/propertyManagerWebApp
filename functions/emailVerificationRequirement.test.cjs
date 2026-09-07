const test = require('node:test');
const assert = require('node:assert/strict');
const {
	isEmailVerificationRequired,
} = require('./lib/emailVerificationRequirement');

test('email verification requirement fails closed', () => {
	assert.equal(isEmailVerificationRequired(undefined, undefined), true);
	assert.equal(isEmailVerificationRequired('true', 'development'), true);
	assert.equal(isEmailVerificationRequired('unexpected', 'development'), true);
	assert.equal(isEmailVerificationRequired('false', 'production'), true);
});

test('email verification is disabled only by an explicit development false value', () => {
	assert.equal(isEmailVerificationRequired('false', 'development'), false);
});
