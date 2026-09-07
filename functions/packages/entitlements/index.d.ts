export type PlanId =
	| 'homeowner'
	| 'homeowner_plus'
	| 'property'
	| 'portfolio'
	| 'guest'
	| 'team'
	| 'tenant';

export type PaidPlanId =
	| 'homeowner_plus'
	| 'property'
	| 'portfolio';

export type CapabilityId =
	| 'properties.create'
	| 'properties.manage'
	| 'team.manage'
	| 'team.advanced'
	| 'residents.manage'
	| 'residents.view'
	| 'maintenance_requests.submit'
	| 'reports.view'
	| 'data.export'
	| 'audit.advanced'
	| 'multi_unit.manage'
	| 'warranties.track'
	| 'parts.link'
	| 'portfolio.reporting'
	| 'analytics.advanced'
	| 'property_groups.manage'
	| 'support.priority'
	| 'maintenance_packages.suggested'
	| 'recurring_tasks.use'
	| 'notifications.use'
	| 'property_intelligence.use'
	| 'property_knowledge.acquire'
	| 'property_types.business'
	| 'rental_management.use'
	| 'service_work_requests.use';

export type LimitId =
	| 'properties'
	| 'devices'
	| 'files'
	| 'storage_gb'
	| 'suggested_maintenance_packages';

export type ComplimentaryTransitionMode =
	| 'none'
	| 'checkout_required'
	| 'automatic';

export type AdminAuditAction =
	| 'grant.created'
	| 'grant.extended'
	| 'grant.revoked'
	| 'grant.converted'
	| 'grant.lifetime_created'
	| 'program.applied'
	| 'program.configured'
	| 'access_code.created'
	| 'program.redemption_failed'
	| 'program.redemption_replayed'
	| 'billing_transition.linked'
	| 'billing_transition.updated'
	| 'billing_transition.opted_out'
	| 'billing.stripe_linkage_cleared'
	| 'access_email.sent'
	| 'user_email.sent'
	| 'maintley_team.invited'
	| 'maintley_role.updated'
	| 'maintley_team.revoked'
	| 'stripe_migration.started'
	| 'stripe_migration.completed'
	| 'admin_action.failed'
	| 'admin_action.replayed';

export type EntitlementCapabilities = Readonly<Record<CapabilityId, boolean>>;
export type EntitlementLimits = Readonly<Record<LimitId, number>>;

export interface PlanPreset {
	readonly id: PlanId;
	readonly bundleVersion: string;
	readonly kind: 'base' | 'legacy_role';
	readonly capabilities: EntitlementCapabilities;
	readonly limits: EntitlementLimits;
}

export interface SubscriptionEntitlementLike {
	status?: string;
	plan?: string;
	trialEndsAt?: number | null;
	hasScheduledSubscription?: boolean;
	scheduledPlan?: string;
	pendingCheckoutPlan?: string;
	stripeSubscriptionId?: string;
}

export type EntitlementGrantKind = 'temporary' | 'permanent';
export type EntitlementGrantState =
	| 'scheduled'
	| 'active'
	| 'expired'
	| 'revoked'
	| 'converted';

export type EntitlementGrantSource =
	| 'trial'
	| 'promotion'
	| 'lifetime'
	| 'beta'
	| 'partner'
	| 'support'
	| 'migration';

export interface EntitlementGrant {
	grantId: string;
	programId: string;
	accountId: string;
	kind: EntitlementGrantKind;
	state: EntitlementGrantState;
	bundleId?: string;
	bundleVersion?: string;
	capabilityOverrides?: Partial<Record<CapabilityId | string, boolean>>;
	/** Replaces limits contributed by this grant's bundle before additive account merging. */
	bundleLimitOverrides?: Partial<Record<LimitId | string, number>>;
	/** Adds account-level limits after the grant bundle is merged. */
	limitOverrides?: Partial<Record<LimitId | string, number>>;
	startsAtMs: number;
	endsAtMs?: number | null;
	source: EntitlementGrantSource;
	beneficiaryUserId?: string;
	idempotencyKey?: string;
	issuedByUserId?: string;
	issuedAtMs?: number;
	auditReason?: string;
	policyVersion?: string;
	terminalReason?: string;
	terminalAtMs?: number;
	transition?: ComplimentaryPaidTransition;
}

export interface ComplimentaryPaidTransition<TTimestamp = unknown> {
	mode: ComplimentaryTransitionMode;
	targetPlanId?: PlanId;
	billingCycle?: 'monthly' | 'annual';
	currency?: string;
	recurringAmountMinor?: number;
	firstChargeAt?: TTimestamp;
	paymentMethodStatus?: 'not_required' | 'missing' | 'usable' | 'requires_action';
	disclosureVersion?: string;
	termsVersion?: string;
	consentAt?: TTimestamp;
	consentActorUserId?: string;
	consentSource?: string;
	stripeCustomerId?: string;
	stripeSubscriptionId?: string;
	stripeSubscriptionScheduleId?: string;
	stripeCheckoutSessionId?: string;
	status?: 'not_configured' | 'scheduled' | 'opted_out' | 'converted' | 'failed';
	failureReason?: string;
}

export interface AdminAuditEvent<TTimestamp = unknown> {
	eventId: string;
	action: AdminAuditAction;
	actorUserId: string;
	targetAccountId: string;
	targetUserId?: string;
	grantId?: string;
	programId?: string;
	stripeCustomerId?: string;
	stripeSubscriptionId?: string;
	reason: string;
	requestId: string;
	createdAt: TTimestamp;
	before?: Readonly<Record<string, unknown>>;
	after?: Readonly<Record<string, unknown>>;
	metadata?: Readonly<Record<string, unknown>>;
}

export interface EntitlementFeatureFlags {
	homeownerPlusProductTrial: boolean;
	internalEntitlementGrantIssuance: boolean;
	complimentaryPaidTransitions: boolean;
	accessLifecycleCommunication: boolean;
}

export type ComplimentaryTransitionIssue =
	| 'invalid_transition_mode'
	| 'missing_stripe_authority'
	| 'payment_method_not_usable'
	| 'missing_versioned_consent'
	| 'missing_first_charge'
	| 'invalid_target_plan'
	| 'invalid_billing_cycle'
	| 'invalid_recurring_price';

export type EntitlementDiagnosticCode =
	| 'unknown_plan'
	| 'disabled_plan'
	| 'pending_checkout_ignored'
	| 'unconfirmed_paid_subscription'
	| 'legacy_paid_access'
	| 'legacy_missing_subscription_status'
	| 'unknown_bundle_version'
	| 'invalid_grant'
	| 'invalid_permanent_grant'
	| 'invalid_grant_kind'
	| 'invalid_grant_source'
	| 'unknown_capability'
	| 'restrictive_override_ignored'
	| 'unknown_limit'
	| 'duplicate_grant'
	| 'unknown_grant_bundle'
	| 'missing_account_scope'
	| 'grant_account_mismatch';

export interface EntitlementDiagnostic {
	code: EntitlementDiagnosticCode;
	message: string;
	metadata?: Readonly<Record<string, unknown>>;
}

export interface ResolveAccountEntitlementsInput {
	accountId?: string;
	subscription?: SubscriptionEntitlementLike | null;
	grants?: readonly EntitlementGrant[];
	fallbackPlanId?: PlanId | string;
	baseBundleVersion?: string;
	nowMs?: number;
	mode?: 'compatibility' | 'strict';
	allowLegacyPlanWithoutStatus?: boolean;
	featureFlags?: Partial<EntitlementFeatureFlags>;
}

export interface ResolvedAccountEntitlements {
	basePlanId: PlanId;
	baseBundleVersion: string;
	capabilities: EntitlementCapabilities;
	limits: EntitlementLimits;
	activeGrantIds: readonly string[];
	appliedBundleIds: readonly string[];
	diagnostics: readonly EntitlementDiagnostic[];
	billing: Readonly<{
		status: string;
		planId: string;
		hasConfirmedStripeSubscription: boolean;
	}>;
}

export interface LegacyPermissions {
	canManageTeam: boolean;
	canManageTenants: boolean;
	canViewReports: boolean;
	canExportData: boolean;
	canAdvancedAuditTrail: boolean;
	canManageMultiUnit: boolean;
	canTrackWarranties: boolean;
	canLinkParts: boolean;
	canPortfolioReporting: boolean;
	canAdvancedAnalytics: boolean;
	canPropertyGroups: boolean;
	prioritySupport: boolean;
	canCreateProperties: boolean;
	canManageProperties: boolean;
	canSubmitMaintenanceRequests: boolean;
	canViewTenantInfo: boolean;
	canUseSuggestedMaintenancePackages: boolean;
	canUseRecurringTasks: boolean;
	canUseNotifications: boolean;
	suggestedMaintenancePackageLimit: number;
}

export const BUNDLE_VERSION: string;
export const PLAN_IDS: readonly PlanId[];
export const PAID_PLAN_IDS: readonly PaidPlanId[];
export const CAPABILITY_IDS: readonly CapabilityId[];
export const LIMIT_IDS: readonly LimitId[];
export const COMPLIMENTARY_TRANSITION_MODES: readonly ComplimentaryTransitionMode[];
export const ENTITLEMENT_GRANT_KINDS: readonly EntitlementGrantKind[];
export const ENTITLEMENT_GRANT_STATES: readonly EntitlementGrantState[];
export const ENTITLEMENT_GRANT_SOURCES: readonly EntitlementGrantSource[];
export const ADMIN_AUDIT_ACTIONS: readonly AdminAuditAction[];
export const DEFAULT_ENTITLEMENT_FEATURE_FLAGS: Readonly<EntitlementFeatureFlags>;
export const PLAN_PRESETS: Readonly<Record<PlanId, PlanPreset>>;

export function getAdminAuditEventId(
	action: AdminAuditAction,
	requestId: string,
): string;
export function getComplimentaryTransitionIssues(
	transition?: ComplimentaryPaidTransition | null,
): readonly ComplimentaryTransitionIssue[];
export function isFirstPropertyTrialEligible(input: {
	homeownerPlusProductTrial?: boolean;
	internalEntitlementGrantIssuance?: boolean;
	accountCreatedAtMs?: number;
	eligibilityStartMs?: number;
	subscription?: SubscriptionEntitlementLike | null;
}): boolean;

export function normalizePlanId(
	planId?: unknown,
	fallbackPlanId?: PlanId | string,
): PlanId;
export function isPlanEnabled(
	planId?: unknown,
	featureFlags?: Partial<EntitlementFeatureFlags>,
): boolean;
export function getPlanPreset(planId?: unknown): PlanPreset;
export function isSubscriptionCurrentlyEntitled(
	subscription?: SubscriptionEntitlementLike | null,
	nowMs?: number,
): boolean;
export function resolveAccountEntitlements(
	input?: ResolveAccountEntitlementsInput,
): ResolvedAccountEntitlements;
export function hasCapability(
	presetOrResult: Pick<PlanPreset, 'capabilities'> | null | undefined,
	capabilityId: CapabilityId,
): boolean;
export function getEntitlementLimit(
	presetOrResult: Pick<PlanPreset, 'limits'> | null | undefined,
	limitId: LimitId,
): number;
export function toLegacyPermissions(
	presetOrResult: Pick<PlanPreset, 'capabilities' | 'limits'>,
): LegacyPermissions;
