/**
 * Server authority for the registration boundary. Missing or invalid values
 * fail closed; non-production environments must opt out explicitly.
 */
export const isEmailVerificationRequired = (
	configuredValue = process.env.REQUIRE_EMAIL_VERIFICATION,
	environment = process.env.MAINTLEY_ENVIRONMENT,
): boolean =>
	!(environment === 'development' && configuredValue === 'false');
