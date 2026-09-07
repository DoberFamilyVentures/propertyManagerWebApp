/**
 * Email verification is a production security boundary. The default is
 * intentionally strict so a missing or unrecognized build value cannot disable
 * verification. Beta and local builds must opt out explicitly with `false`.
 */
export const isEmailVerificationRequired = (): boolean => {
	const projectId = String(process.env.REACT_APP_FIREBASE_PROJECT_ID || '').trim();
	return !(
		projectId === 'maintleybeta' &&
		process.env.REACT_APP_REQUIRE_EMAIL_VERIFICATION === 'false'
	);
};
