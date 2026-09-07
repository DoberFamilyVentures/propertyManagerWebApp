import { isEmailVerificationRequired } from './emailVerificationPolicy';

describe('email verification environment policy', () => {
	const originalValue = process.env.REACT_APP_REQUIRE_EMAIL_VERIFICATION;
	const originalProjectId = process.env.REACT_APP_FIREBASE_PROJECT_ID;

	afterEach(() => {
		if (originalValue === undefined) {
			delete process.env.REACT_APP_REQUIRE_EMAIL_VERIFICATION;
		} else {
			process.env.REACT_APP_REQUIRE_EMAIL_VERIFICATION = originalValue;
		}
		if (originalProjectId === undefined) {
			delete process.env.REACT_APP_FIREBASE_PROJECT_ID;
		} else {
			process.env.REACT_APP_FIREBASE_PROJECT_ID = originalProjectId;
		}
	});

	it('requires verification when configuration is missing', () => {
		delete process.env.REACT_APP_REQUIRE_EMAIL_VERIFICATION;
		expect(isEmailVerificationRequired()).toBe(true);
	});

	it('disables verification only for an explicit false value', () => {
		process.env.REACT_APP_FIREBASE_PROJECT_ID = 'maintleybeta';
		process.env.REACT_APP_REQUIRE_EMAIL_VERIFICATION = 'false';
		expect(isEmailVerificationRequired()).toBe(false);

		process.env.REACT_APP_REQUIRE_EMAIL_VERIFICATION = 'unexpected';
		expect(isEmailVerificationRequired()).toBe(true);
	});

	it('requires verification for the production project even if its flag is false', () => {
		process.env.REACT_APP_FIREBASE_PROJECT_ID = 'mypropertymanager-cda42';
		process.env.REACT_APP_REQUIRE_EMAIL_VERIFICATION = 'false';
		expect(isEmailVerificationRequired()).toBe(true);
	});
});
