'use strict';

const BUNDLE_VERSION = 'v1';

const PLAN_IDS = Object.freeze([
	'homeowner',
	'homeowner_plus',
	'property',
	'portfolio',
	'guest',
	'team',
	'tenant',
]);

const PAID_PLAN_IDS = Object.freeze([
	'homeowner_plus',
	'property',
	'portfolio',
]);

const CAPABILITY_IDS = Object.freeze([
	'properties.create',
	'properties.manage',
	'team.manage',
	'team.advanced',
	'residents.manage',
	'residents.view',
	'maintenance_requests.submit',
	'reports.view',
	'data.export',
	'audit.advanced',
	'multi_unit.manage',
	'warranties.track',
	'parts.link',
	'portfolio.reporting',
	'analytics.advanced',
	'property_groups.manage',
	'support.priority',
	'maintenance_packages.suggested',
	'recurring_tasks.use',
	'notifications.use',
	'property_intelligence.use',
	'property_knowledge.acquire',
	'property_types.business',
	'rental_management.use',
	'service_work_requests.use',
]);

const LIMIT_IDS = Object.freeze([
	'properties',
	'devices',
	'files',
	'storage_gb',
	'suggested_maintenance_packages',
]);

const COMPLIMENTARY_TRANSITION_MODES = Object.freeze([
	'none',
	'checkout_required',
	'automatic',
]);

const ENTITLEMENT_GRANT_KINDS = Object.freeze(['temporary', 'permanent']);
const ENTITLEMENT_GRANT_STATES = Object.freeze([
	'scheduled',
	'active',
	'expired',
	'revoked',
	'converted',
]);
const ENTITLEMENT_GRANT_SOURCES = Object.freeze([
	'trial',
	'promotion',
	'lifetime',
	'beta',
	'partner',
	'support',
	'migration',
]);

const ADMIN_AUDIT_ACTIONS = Object.freeze([
	'grant.created',
	'grant.extended',
	'grant.revoked',
	'grant.converted',
	'grant.lifetime_created',
	'program.applied',
	'program.configured',
	'access_code.created',
	'program.redemption_failed',
	'program.redemption_replayed',
	'billing_transition.linked',
	'billing_transition.updated',
	'billing_transition.opted_out',
	'billing.stripe_linkage_cleared',
	'access_email.sent',
	'user_email.sent',
	'maintley_team.invited',
	'maintley_role.updated',
	'maintley_team.revoked',
	'stripe_migration.started',
	'stripe_migration.completed',
	'admin_action.failed',
	'admin_action.replayed',
]);

const DEFAULT_ENTITLEMENT_FEATURE_FLAGS = Object.freeze({
	homeownerPlusProductTrial: false,
	internalEntitlementGrantIssuance: false,
	complimentaryPaidTransitions: false,
	accessLifecycleCommunication: false,
});

const ADMIN_AUDIT_ACTION_SET = new Set(ADMIN_AUDIT_ACTIONS);
const ENTITLEMENT_GRANT_SOURCE_SET = new Set(ENTITLEMENT_GRANT_SOURCES);

const getAdminAuditEventId = (action, requestId) => {
	if (!ADMIN_AUDIT_ACTION_SET.has(action)) {
		throw new Error('Unknown administrative audit action.');
	}
	const normalizedRequestId = String(requestId || '').trim();
	if (!normalizedRequestId || normalizedRequestId.length > 200) {
		throw new Error('Administrative audit requestId must be 1-200 characters.');
	}
	return `${action}__${encodeURIComponent(normalizedRequestId)}`;
};

const getComplimentaryTransitionIssues = (transition) => {
	if (!transition || !COMPLIMENTARY_TRANSITION_MODES.includes(transition.mode)) {
		return Object.freeze(['invalid_transition_mode']);
	}
	if (transition.mode !== 'automatic') return Object.freeze([]);

	const issues = [];
	if (
		!String(transition.stripeSubscriptionId || '').trim() &&
		!String(transition.stripeSubscriptionScheduleId || '').trim()
	) {
		issues.push('missing_stripe_authority');
	}
	if (transition.paymentMethodStatus !== 'usable') {
		issues.push('payment_method_not_usable');
	}
	if (
		!transition.consentAt ||
		!String(transition.consentActorUserId || '').trim() ||
		!String(transition.disclosureVersion || '').trim() ||
		!String(transition.termsVersion || '').trim()
	) {
		issues.push('missing_versioned_consent');
	}
	if (!transition.firstChargeAt) issues.push('missing_first_charge');
	if (!PLAN_ID_SET.has(normalizeRawPlanId(transition.targetPlanId))) {
		issues.push('invalid_target_plan');
	}
	if (!['monthly', 'annual'].includes(transition.billingCycle)) {
		issues.push('invalid_billing_cycle');
	}
	if (
		!String(transition.currency || '').trim() ||
		!Number.isFinite(Number(transition.recurringAmountMinor)) ||
		Number(transition.recurringAmountMinor) < 0
	) {
		issues.push('invalid_recurring_price');
	}
	return Object.freeze(issues);
};

const isFirstPropertyTrialEligible = (input = {}) => {
	const subscription = input.subscription || {};
	const createdAtMs = Number(input.accountCreatedAtMs);
	const eligibilityStartMs = Number(input.eligibilityStartMs);
	return Boolean(
		input.homeownerPlusProductTrial === true &&
			input.internalEntitlementGrantIssuance === true &&
			Number.isFinite(createdAtMs) &&
			Number.isFinite(eligibilityStartMs) &&
			createdAtMs >= eligibilityStartMs &&
			String(subscription.plan || '').trim().toLowerCase() === 'homeowner' &&
			String(subscription.status || '').trim().toLowerCase() === 'active' &&
			!String(subscription.pendingCheckoutPlan || '').trim() &&
			!String(subscription.stripeCustomerId || '').trim() &&
			!String(subscription.stripeSubscriptionId || '').trim(),
	);
};

const PLAN_ID_SET = new Set(PLAN_IDS);
const PAID_PLAN_ID_SET = new Set(PAID_PLAN_IDS);
const CAPABILITY_ID_SET = new Set(CAPABILITY_IDS);
const LIMIT_ID_SET = new Set(LIMIT_IDS);

const capabilityRecord = (enabled) => {
	const enabledSet = new Set(enabled);
	return Object.freeze(
		Object.fromEntries(CAPABILITY_IDS.map((id) => [id, enabledSet.has(id)])),
	);
};

const createPreset = (id, kind, enabled, limits) =>
	Object.freeze({
		id,
		bundleVersion: BUNDLE_VERSION,
		kind,
		capabilities: capabilityRecord(enabled),
		limits: Object.freeze({ ...limits }),
	});

const HOMEOWNER_CAPABILITIES = [
	'properties.create',
	'properties.manage',
	'reports.view',
	'data.export',
	'warranties.track',
	'parts.link',
	'maintenance_packages.suggested',
	'recurring_tasks.use',
	'notifications.use',
];

const HOMEOWNER_PLUS_CAPABILITIES = [
	...HOMEOWNER_CAPABILITIES,
	'audit.advanced',
	'property_intelligence.use',
	'property_knowledge.acquire',
	'property_groups.manage',
];

const PROPERTY_CAPABILITIES = [
	...HOMEOWNER_CAPABILITIES,
	'team.manage',
	'residents.manage',
	'residents.view',
	'property_groups.manage',
	'property_types.business',
	'rental_management.use',
];

const PORTFOLIO_CAPABILITIES = [
	...PROPERTY_CAPABILITIES,
	'audit.advanced',
	'property_intelligence.use',
	'property_knowledge.acquire',
	'team.advanced',
	'multi_unit.manage',
	'portfolio.reporting',
	'analytics.advanced',
	'support.priority',
];

const ZERO_LIMITS = Object.freeze({
	properties: 0,
	devices: 0,
	files: 0,
	storage_gb: 0,
	suggested_maintenance_packages: 0,
});

const PLAN_PRESETS = Object.freeze({
	homeowner: createPreset('homeowner', 'base', HOMEOWNER_CAPABILITIES, {
		properties: 1,
		devices: 999,
		files: 999999999,
		storage_gb: 1,
		suggested_maintenance_packages: 999,
	}),
	homeowner_plus: createPreset(
		'homeowner_plus',
		'base',
		HOMEOWNER_PLUS_CAPABILITIES,
		{
			properties: 5,
			devices: 999,
			files: 999999999,
			storage_gb: 10,
			suggested_maintenance_packages: 999,
		},
	),
	property: createPreset('property', 'base', PROPERTY_CAPABILITIES, {
		properties: 7,
		devices: 999,
		files: 999999999,
		storage_gb: 15,
		suggested_maintenance_packages: 999,
	}),
	portfolio: createPreset('portfolio', 'base', PORTFOLIO_CAPABILITIES, {
		properties: 15,
		devices: 999,
		files: 999999999,
		storage_gb: 25,
		suggested_maintenance_packages: 999,
	}),
	guest: createPreset('guest', 'legacy_role', [], ZERO_LIMITS),
	team: createPreset('team', 'legacy_role', [], ZERO_LIMITS),
	tenant: createPreset(
		'tenant',
		'legacy_role',
		['maintenance_requests.submit', 'residents.view'],
		ZERO_LIMITS,
	),
});

const normalizeRawPlanId = (planId) =>
	String(planId || '')
		.trim()
		.toLowerCase();

const normalizePlanId = (planId, fallbackPlanId = 'homeowner') => {
	const normalized = normalizeRawPlanId(planId);
	if (PLAN_ID_SET.has(normalized)) return normalized;
	const fallback = normalizeRawPlanId(fallbackPlanId);
	return PLAN_ID_SET.has(fallback) ? fallback : 'homeowner';
};

const isPlanEnabled = (planId, featureFlags = DEFAULT_ENTITLEMENT_FEATURE_FLAGS) => {
	const normalizedPlanId = normalizeRawPlanId(planId);
	if (!PLAN_ID_SET.has(normalizedPlanId)) return false;
	return true;
};

const getPlanPreset = (planId) => PLAN_PRESETS[normalizePlanId(planId)];

const isSubscriptionCurrentlyEntitled = (subscription, nowMs = Date.now()) => {
	if (!subscription || !subscription.status) return false;
	if (subscription.status === 'active') return true;
	if (subscription.status !== 'trial') return false;
	if (!subscription.trialEndsAt) return true;
	return Number(subscription.trialEndsAt) * 1000 > nowMs;
};

const createDiagnostic = (code, message, metadata) => ({
	code,
	message,
	...(metadata ? { metadata } : {}),
});

const resolveBasePlan = ({
	subscription,
	fallbackPlanId,
	nowMs,
	mode,
	allowLegacyPlanWithoutStatus,
	featureFlags,
	diagnostics,
}) => {
	const fallback = normalizePlanId(fallbackPlanId);
	const rawPlanId = normalizeRawPlanId(subscription && subscription.plan);

	if (rawPlanId && !PLAN_ID_SET.has(rawPlanId)) {
		diagnostics.push(
			createDiagnostic('unknown_plan', 'Unknown plan defaulted to Free access.', {
				planId: rawPlanId,
			}),
		);
	}
	if (
		rawPlanId &&
		PLAN_ID_SET.has(rawPlanId) &&
		!isPlanEnabled(rawPlanId, featureFlags) &&
		!isSubscriptionCurrentlyEntitled(subscription, nowMs)
	) {
		diagnostics.push(
			createDiagnostic('disabled_plan', 'Disabled plan defaulted to Free access.', {
				planId: rawPlanId,
			}),
		);
		return fallback;
	}
	if (rawPlanId && PLAN_ID_SET.has(rawPlanId) && !isPlanEnabled(rawPlanId, featureFlags)) {
		diagnostics.push(
			createDiagnostic(
				'disabled_plan_preserved',
				'An existing entitled subscription remains recognized while new plan acquisition is disabled.',
				{ planId: rawPlanId },
			),
		);
	}

	const usesLegacyPlanWithoutStatus = Boolean(
		allowLegacyPlanWithoutStatus &&
			subscription &&
			!subscription.status &&
			rawPlanId,
	);
	if (!isSubscriptionCurrentlyEntitled(subscription, nowMs) && !usesLegacyPlanWithoutStatus) {
		return fallback;
	}
	if (usesLegacyPlanWithoutStatus) {
		diagnostics.push(
			createDiagnostic(
				'legacy_missing_subscription_status',
				'Compatibility mode preserved a plan whose subscription status is missing.',
				{ planId: rawPlanId },
			),
		);
	}

	const planId = normalizePlanId(rawPlanId, fallback);
	const pendingPlanId = normalizeRawPlanId(
		subscription && subscription.pendingCheckoutPlan,
	);
	if (
		PAID_PLAN_ID_SET.has(pendingPlanId) &&
		!String((subscription && subscription.stripeSubscriptionId) || '').trim()
	) {
		diagnostics.push(
			createDiagnostic(
				'pending_checkout_ignored',
				'Pending Checkout does not provide paid access.',
				{ planId: pendingPlanId },
			),
		);
		return fallback;
	}

	if (
		mode === 'strict' &&
		PAID_PLAN_ID_SET.has(planId) &&
		!String((subscription && subscription.stripeSubscriptionId) || '').trim()
	) {
		diagnostics.push(
			createDiagnostic(
				'unconfirmed_paid_subscription',
				'Stripe did not confirm the paid subscription.',
				{ planId },
			),
		);
		return fallback;
	}

	if (
		mode === 'compatibility' &&
		PAID_PLAN_ID_SET.has(planId) &&
		!String((subscription && subscription.stripeSubscriptionId) || '').trim()
	) {
		diagnostics.push(
			createDiagnostic(
				'legacy_paid_access',
				'Compatibility mode preserved paid access without Stripe confirmation.',
				{ planId },
			),
		);
	}

	return planId;
};

const isGrantActive = (grant, nowMs, diagnostics) => {
	if (!grant || grant.state !== 'active') return false;
	if (!grant.grantId || !grant.programId || !grant.accountId) {
		diagnostics.push(
			createDiagnostic(
				'invalid_grant',
				'Grant is missing a stable grant, program, or account identifier.',
			),
		);
		return false;
	}
	if (!ENTITLEMENT_GRANT_SOURCE_SET.has(grant.source)) {
		diagnostics.push(
			createDiagnostic(
				'invalid_grant_source',
				'Unknown grant source was ignored.',
				{ grantId: grant.grantId },
			),
		);
		return false;
	}

	const startsAtMs = Number(grant.startsAtMs);
	if (!Number.isFinite(startsAtMs) || startsAtMs > nowMs) return false;

	if (grant.kind === 'permanent') {
		if (grant.endsAtMs != null) {
			diagnostics.push(
				createDiagnostic(
					'invalid_permanent_grant',
					'Permanent grants cannot define an end timestamp.',
					{ grantId: grant.grantId },
				),
			);
			return false;
		}
		return true;
	}

	if (grant.kind !== 'temporary') {
		diagnostics.push(
			createDiagnostic('invalid_grant_kind', 'Unknown grant kind was ignored.', {
				grantId: grant.grantId,
			}),
		);
		return false;
	}

	const endsAtMs = Number(grant.endsAtMs);
	return Number.isFinite(endsAtMs) && endsAtMs > nowMs;
};

const mergePreset = (capabilities, limits, preset) => {
	for (const capabilityId of CAPABILITY_IDS) {
		if (preset.capabilities[capabilityId]) capabilities[capabilityId] = true;
	}
	for (const limitId of LIMIT_IDS) {
		limits[limitId] = Math.max(limits[limitId], preset.limits[limitId]);
	}
};

const mergeGrantBundle = (capabilities, limits, preset, grant, diagnostics) => {
	for (const capabilityId of CAPABILITY_IDS) {
		if (preset.capabilities[capabilityId]) capabilities[capabilityId] = true;
	}
	const bundleLimitOverrides = grant.bundleLimitOverrides || {};
	for (const [limitId, value] of Object.entries(bundleLimitOverrides)) {
		const numericValue = Number(value);
		if (!LIMIT_ID_SET.has(limitId) || !Number.isFinite(numericValue) || numericValue < 0) {
			diagnostics.push(
				createDiagnostic(
					'unknown_limit',
					'Unknown or invalid grant bundle limit override was ignored.',
					{ grantId: grant.grantId, limitId },
				),
			);
		}
	}
	for (const limitId of LIMIT_IDS) {
		const override = Number(bundleLimitOverrides[limitId]);
		const contributedLimit =
			Object.prototype.hasOwnProperty.call(bundleLimitOverrides, limitId) &&
			Number.isFinite(override) &&
			override >= 0
				? override
				: preset.limits[limitId];
		limits[limitId] = Math.max(limits[limitId], contributedLimit);
	}
};

const mergeGrantOverrides = (capabilities, limits, grant, diagnostics) => {
	for (const [capabilityId, value] of Object.entries(
		grant.capabilityOverrides || {},
	)) {
		if (!CAPABILITY_ID_SET.has(capabilityId) || typeof value !== 'boolean') {
			diagnostics.push(
				createDiagnostic(
					'unknown_capability',
					'Unknown or invalid capability override was ignored.',
					{ grantId: grant.grantId, capabilityId },
				),
			);
			continue;
		}
		if (value) {
			capabilities[capabilityId] = true;
		} else {
			diagnostics.push(
				createDiagnostic(
					'restrictive_override_ignored',
					'Additive grants cannot remove a capability.',
					{ grantId: grant.grantId, capabilityId },
				),
			);
		}
	}

	for (const [limitId, value] of Object.entries(grant.limitOverrides || {})) {
		const numericValue = Number(value);
		if (
			!LIMIT_ID_SET.has(limitId) ||
			!Number.isFinite(numericValue) ||
			numericValue < 0
		) {
			diagnostics.push(
				createDiagnostic(
					'unknown_limit',
					'Unknown or invalid quantitative limit was ignored.',
					{ grantId: grant.grantId, limitId },
				),
			);
			continue;
		}
		limits[limitId] = Math.max(limits[limitId], numericValue);
	}
};

const resolveAccountEntitlements = (input = {}) => {
	const nowMs = Number.isFinite(input.nowMs) ? Number(input.nowMs) : Date.now();
	const mode = input.mode === 'strict' ? 'strict' : 'compatibility';
	const diagnostics = [];
	const basePlanId = resolveBasePlan({
		subscription: input.subscription,
		fallbackPlanId: input.fallbackPlanId || 'homeowner',
		nowMs,
		mode,
		allowLegacyPlanWithoutStatus: Boolean(input.allowLegacyPlanWithoutStatus),
		featureFlags: input.featureFlags || DEFAULT_ENTITLEMENT_FEATURE_FLAGS,
		diagnostics,
	});
	let basePreset = PLAN_PRESETS[basePlanId];

	if (
		input.baseBundleVersion &&
		input.baseBundleVersion !== basePreset.bundleVersion
	) {
		diagnostics.push(
			createDiagnostic(
				'unknown_bundle_version',
				'Unknown bundle version defaulted to Free access.',
				{ planId: basePlanId, bundleVersion: input.baseBundleVersion },
			),
		);
		basePreset = PLAN_PRESETS.homeowner;
	}

	const capabilities = Object.fromEntries(
		CAPABILITY_IDS.map((capabilityId) => [capabilityId, false]),
	);
	const limits = Object.fromEntries(LIMIT_IDS.map((limitId) => [limitId, 0]));
	mergePreset(capabilities, limits, basePreset);

	const activeGrantIds = [];
	const appliedBundleIds = [];
	const seenGrantIds = new Set();
	const grants = Array.isArray(input.grants) ? input.grants : [];
	const accountId = String(input.accountId || '').trim();

	if (grants.length > 0 && !accountId) {
		diagnostics.push(
			createDiagnostic(
				'missing_account_scope',
				'Grants require an explicit owning account scope.',
			),
		);
	}

	for (const grant of accountId ? grants : []) {
		if (grant && grant.grantId && seenGrantIds.has(grant.grantId)) {
			diagnostics.push(
				createDiagnostic('duplicate_grant', 'Duplicate grant was ignored.', {
					grantId: grant.grantId,
				}),
			);
			continue;
		}
		if (grant && grant.grantId) seenGrantIds.add(grant.grantId);
		if (!grant || grant.accountId !== accountId) {
			diagnostics.push(
				createDiagnostic(
					'grant_account_mismatch',
					'Grant does not belong to the resolved account.',
					{ grantId: grant && grant.grantId, accountId },
				),
			);
			continue;
		}
		if (!isGrantActive(grant, nowMs, diagnostics)) continue;

		if (grant.bundleId) {
			const bundleId = normalizeRawPlanId(grant.bundleId);
			const preset = PLAN_PRESETS[bundleId];
			if (
				!preset ||
				preset.kind !== 'base' ||
				grant.bundleVersion !== BUNDLE_VERSION
			) {
				diagnostics.push(
					createDiagnostic(
						'unknown_grant_bundle',
						'Unknown grant bundle or version was ignored.',
						{
							grantId: grant.grantId,
							bundleId: grant.bundleId,
							bundleVersion: grant.bundleVersion,
						},
					),
				);
			} else {
				mergeGrantBundle(capabilities, limits, preset, grant, diagnostics);
				appliedBundleIds.push(`${preset.id}@${preset.bundleVersion}`);
			}
		}

		mergeGrantOverrides(capabilities, limits, grant, diagnostics);
		activeGrantIds.push(grant.grantId);
	}

	return {
		basePlanId: basePreset.id,
		baseBundleVersion: basePreset.bundleVersion,
		capabilities: Object.freeze({ ...capabilities }),
		limits: Object.freeze({ ...limits }),
		activeGrantIds: Object.freeze(activeGrantIds),
		appliedBundleIds: Object.freeze(appliedBundleIds),
		diagnostics: Object.freeze(diagnostics),
		billing: Object.freeze({
			status: String((input.subscription && input.subscription.status) || ''),
			planId: normalizeRawPlanId(input.subscription && input.subscription.plan),
			hasConfirmedStripeSubscription: Boolean(
				String(
					(input.subscription && input.subscription.stripeSubscriptionId) || '',
				).trim(),
			),
		}),
	};
};

const hasCapability = (presetOrResult, capabilityId) => {
	if (!CAPABILITY_ID_SET.has(capabilityId)) return false;
	return Boolean(
		presetOrResult &&
			presetOrResult.capabilities &&
			presetOrResult.capabilities[capabilityId],
	);
};

const getEntitlementLimit = (presetOrResult, limitId) => {
	if (!LIMIT_ID_SET.has(limitId)) return 0;
	const value = Number(
		presetOrResult && presetOrResult.limits && presetOrResult.limits[limitId],
	);
	return Number.isFinite(value) && value >= 0 ? value : 0;
};

const LEGACY_PERMISSION_CAPABILITIES = Object.freeze({
	canManageTeam: 'team.manage',
	canManageTenants: 'residents.manage',
	canViewReports: 'reports.view',
	canExportData: 'data.export',
	canAdvancedAuditTrail: 'audit.advanced',
	canManageMultiUnit: 'multi_unit.manage',
	canTrackWarranties: 'warranties.track',
	canLinkParts: 'parts.link',
	canPortfolioReporting: 'portfolio.reporting',
	canAdvancedAnalytics: 'analytics.advanced',
	canPropertyGroups: 'property_groups.manage',
	prioritySupport: 'support.priority',
	canCreateProperties: 'properties.create',
	canManageProperties: 'properties.manage',
	canSubmitMaintenanceRequests: 'maintenance_requests.submit',
	canViewTenantInfo: 'residents.view',
	canUseSuggestedMaintenancePackages: 'maintenance_packages.suggested',
	canUseRecurringTasks: 'recurring_tasks.use',
	canUseNotifications: 'notifications.use',
});

const toLegacyPermissions = (presetOrResult) => {
	const capabilities = presetOrResult.capabilities;
	const limits = presetOrResult.limits;
	const permissions = {};
	for (const [legacyKey, capabilityId] of Object.entries(
		LEGACY_PERMISSION_CAPABILITIES,
	)) {
		permissions[legacyKey] = Boolean(capabilities[capabilityId]);
	}
	permissions.suggestedMaintenancePackageLimit =
		limits.suggested_maintenance_packages;
	return permissions;
};

module.exports = {
	BUNDLE_VERSION,
	PLAN_IDS,
	PAID_PLAN_IDS,
	CAPABILITY_IDS,
	LIMIT_IDS,
	COMPLIMENTARY_TRANSITION_MODES,
	ENTITLEMENT_GRANT_KINDS,
	ENTITLEMENT_GRANT_STATES,
	ENTITLEMENT_GRANT_SOURCES,
	ADMIN_AUDIT_ACTIONS,
	DEFAULT_ENTITLEMENT_FEATURE_FLAGS,
	getAdminAuditEventId,
	getComplimentaryTransitionIssues,
	isFirstPropertyTrialEligible,
	PLAN_PRESETS,
	normalizePlanId,
	isPlanEnabled,
	getPlanPreset,
	isSubscriptionCurrentlyEntitled,
	resolveAccountEntitlements,
	hasCapability,
	getEntitlementLimit,
	toLegacyPermissions,
};
