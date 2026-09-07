import {
	signInWithEmailAndPassword,
	createUserWithEmailAndPassword,
	signOut,
	updateProfile,
	sendPasswordResetEmail,
	fetchSignInMethodsForEmail,
} from 'firebase/auth';
import {
	collection,
	doc,
	getDocs,
	query,
	serverTimestamp,
	setDoc,
	updateDoc,
	where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db } from '../config/firebase';
import { getFirebaseFunctions } from '../config/firebaseFunctions';
import { clearUserLocalStorage } from '../utils/localStorageCleanup';
import { User } from '../Redux/Slices/userSlice';
import { USER_ROLES } from '../constants/roles';
import { SUBSCRIPTION_STATUS } from '../constants/subscriptions';
import { createLegalAgreementDocuments } from '../constants/legal';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '../utils/notificationPreferences';
import { DEFAULT_EMAIL_PREFERENCES } from '../utils/emailPreferences';
import { getUserProfile } from './userProfileService';
import { reconcileCurrentUserEmailVerification } from './emailVerificationService';
import { isEmailVerificationRequired } from '../config/emailVerificationPolicy';

export { getUserProfile } from './userProfileService';
export { onAuthStateChange } from './authSession';

const getAuthCallable = async <RequestData, ResponseData>(name: string) => {
	const functions = await getFirebaseFunctions();
	return httpsCallable<RequestData, ResponseData>(functions, name);
};

export interface FamilyInvite {
	id: string;
	accountId: string;
	email: string;
	firstName: string;
	lastName: string;
	role?: string;
	status: 'pending' | 'accepted' | 'revoked' | 'expired';
	createdAt: string | number;
	updatedAt?: string | number;
	expiresAt?: string | number;
	lastSentAt?: string | number;
	sentCount?: number;
}

const isBlockedByClientError = (error: any): boolean => {
	const rawMessage = String(error?.message || '').toLowerCase();
	const rawCode = String(error?.code || '').toLowerCase();

	return (
		rawMessage.includes('err_blocked_by_client') ||
		rawMessage.includes('blocked by client') ||
		rawMessage.includes('firestore.googleapis.com') ||
		rawMessage.includes('/listen/channel') ||
		rawCode.includes('err_blocked_by_client')
	);
};

const isExpectedAuthTeardownError = (error: any): boolean => {
	const rawMessage = String(error?.message || '').toLowerCase();
	const rawCode = String(error?.code || '').toLowerCase();

	return (
		!auth.currentUser ||
		rawCode.includes('unauthenticated') ||
		rawMessage.includes('unauthenticated') ||
		rawMessage.includes('user not authenticated')
	);
};

/**
 * Sign in with email and password
 */
export const signInWithEmail = async (
	email: string,
	password: string,
): Promise<User> => {
	try {
		const userCredential = await signInWithEmailAndPassword(
			auth,
			email,
			password,
		);

		try {
			const syncTenantAccess = await getAuthCallable<
				Record<string, never>,
				{ success: boolean }
			>('syncTenantAccessFromInvites');
			await syncTenantAccess({});
		} catch (tenantSyncError) {
			console.warn('Tenant access sync skipped:', tenantSyncError);
		}

		const user = await getUserProfile(userCredential.user.uid);
		return reconcileCurrentUserEmailVerification(user);
	} catch (error: any) {
		console.error('Sign in error:', error);
		if (isBlockedByClientError(error)) {
			throw new Error(
				'Your browser blocked required login requests. Please disable ad/privacy blockers for this site (and firestore.googleapis.com), then try again.',
			);
		}
		throw new Error(getAuthErrorMessage(error?.code));
	}
};

/**
 * Check if an email address is already registered
 */
export const checkEmailExists = async (email: string): Promise<boolean> => {
	try {
		// Registration is unauthenticated, so this check must stay within Firebase
		// Auth. Querying the protected users collection here creates a permission
		// warning for every new email and would weaken email privacy if allowed.
		const signInMethods = await fetchSignInMethodsForEmail(auth, email);
		return signInMethods.length > 0;
	} catch (error: any) {
		// Account creation remains the authoritative duplicate-email check. A
		// transient lookup failure should not block a legitimate registration.
		console.info('Email availability pre-check was unavailable.', error);
		return false;
	}
};

const createFirebaseAuthUser = async (email: string, password: string) => {
	try {
		return await createUserWithEmailAndPassword(auth, email, password);
	} catch (error: any) {
		const currentAuthUser = auth.currentUser;
		const requestedEmail = email.trim().toLowerCase();
		const currentEmail = String(currentAuthUser?.email || '').trim().toLowerCase();
		const errorCode = String(error?.code || '').toLowerCase();
		const canResumeProvisioning =
			Boolean(currentAuthUser) &&
			currentEmail === requestedEmail &&
			errorCode === 'auth/network-request-failed';

		if (!canResumeProvisioning || !currentAuthUser) {
			throw error;
		}

		console.warn(
			'Firebase Auth created the account but signup did not finish. Resuming profile provisioning for the current user.',
		);
		return { user: currentAuthUser };
	}
};

const findActiveTenantPromoCode = async (promoCode: string, email: string) => {
	const validateInvite = await getAuthCallable<
		{ promoCode: string; tenantEmail: string },
		{ valid: boolean }
	>('validateTenantInvitationCode');
	const result = await validateInvite({
		promoCode,
		tenantEmail: email,
	});
	return result.data.valid ? { valid: true } : null;
};

const findActiveTeamMemberPromoCode = async (
	promoCode: string,
	email: string,
) => {
	const validateInvite = await getAuthCallable<
		{ promoCode: string; teamMemberEmail: string },
		{
			valid: boolean;
			teamMemberId?: string | null;
			accountId?: string | null;
			role?: string | null;
		}
	>('validateTeamMemberInvitationCode');

	const result = await validateInvite({
		promoCode,
		teamMemberEmail: email,
	});

	return result.data.valid ? result.data : null;
};

export const validateTenantInviteForRegistration = async (
	promoCode: string,
	email: string,
): Promise<boolean> => {
	if (!promoCode?.trim() || !email?.trim()) {
		return false;
	}

	try {
		const promoDoc = await findActiveTenantPromoCode(
			promoCode.trim(),
			email.trim().toLowerCase(),
		);
		return !!promoDoc;
	} catch (error) {
		console.error('Tenant invite validation failed:', error);
		return false;
	}
};

export const validateTeamInviteForRegistration = async (
	promoCode: string,
	email: string,
): Promise<{ valid: boolean; role?: string | null }> => {
	if (!promoCode?.trim() || !email?.trim()) {
		return { valid: false };
	}

	try {
		const inviteDoc = await findActiveTeamMemberPromoCode(
			promoCode.trim(),
			email.trim().toLowerCase(),
		);

		if (!inviteDoc) {
			return { valid: false };
		}

		return {
			valid: true,
			role: inviteDoc.role || null,
		};
	} catch (error) {
		console.error('Team invite validation failed:', error);
		return { valid: false };
	}
};

/**
 * Create subscription for new user
 */
const createPendingCheckoutSubscription = (
	selectedPlan: string,
	promoCode?: string,
) => {
	const now = Math.floor(Date.now() / 1000);
	const normalizedPromoCode = promoCode?.trim() || undefined;
	const normalizedPendingPlan = String(selectedPlan || '')
		.trim()
		.toLowerCase();

	return {
		status: SUBSCRIPTION_STATUS.ACTIVE,
		plan: 'homeowner',
		currentPeriodStart: now,
		currentPeriodEnd: now + 365 * 24 * 60 * 60,
		trialEndsAt: null,
		...(normalizedPendingPlan && normalizedPendingPlan !== 'homeowner'
			? {
					pendingCheckoutPlan: normalizedPendingPlan,
					pendingCheckoutStartedAt: now,
				}
			: {}),
		...(normalizedPromoCode ? { promoCode: normalizedPromoCode } : {}),
	};
};

const createFreeSubscription = (
	plan: string = 'homeowner',
): NonNullable<User['subscription']> => {
	const now = Math.floor(Date.now() / 1000);

	return {
		status: SUBSCRIPTION_STATUS.ACTIVE,
		plan,
		currentPeriodStart: now,
		currentPeriodEnd: now + 365 * 24 * 60 * 60,
		trialEndsAt: null,
	};
};

type CreateUserSubscriptionResult = {
	subscription: NonNullable<User['subscription']> & {
		promoCode?: string;
	};
};

const NON_BILLABLE_SIGNUP_PLANS = new Set([
	'homeowner',
	'guest',
	'team',
	'tenant',
]);


const isNonBillableSignupPlan = (plan: string): boolean =>
	NON_BILLABLE_SIGNUP_PLANS.has(
		String(plan || '')
			.trim()
			.toLowerCase(),
	);

const createUserSubscription = async (
	selectedPlan: string,
	promoCode: string | undefined,
): Promise<CreateUserSubscriptionResult> => {
	const normalizedPromoCode = promoCode?.trim() || undefined;
	const isNonBillablePlan = isNonBillableSignupPlan(selectedPlan);

	if (isNonBillablePlan) {
		return {
			subscription: {
				...createFreeSubscription(selectedPlan),
				...(normalizedPromoCode ? { promoCode: normalizedPromoCode } : {}),
			},
		};
	}

	return {
		subscription: createPendingCheckoutSubscription(
			selectedPlan,
			normalizedPromoCode,
		),
	};
};

/**
 * Create new user account
 */
export const signUpWithEmail = async (
	email: string,
	password: string,
	firstName: string,
	lastName: string,
	role: string = USER_ROLES.ADMIN,
	selectedPlan: string = 'homeowner',
	promoCode?: string,
	legalAgreement?: {
		agreedToTerms: boolean;
		agreedVersion: string;
		documents?: {
			termsOfService?: {
				accepted: boolean;
				agreedVersion: string;
				fileName: string;
				title: string;
			};
			privacyPolicy?: {
				accepted: boolean;
				agreedVersion: string;
				fileName: string;
				title: string;
			};
			maintenanceDisclaimer?: {
				accepted: boolean;
				agreedVersion: string;
				fileName: string;
				title: string;
			};
			subscriptionTerms?: {
				accepted: boolean;
				agreedVersion: string;
				fileName: string;
				title: string;
			};
			eula?: {
				accepted: boolean;
				agreedVersion: string;
				fileName: string;
				title: string;
			};
		};
	},
	inviteType?: 'tenant' | 'team',
): Promise<{ user: User }> => {
	try {
		let shouldRedeemTenantInvite = false;
		let shouldRedeemTeamInvite = false;
		let resolvedRole = role;
		let teamInviteAccountId: string | null = null;
		let teamInviteMemberId: string | null = null;

		// Handle tenant invite registration (requires promo code)
		if (inviteType === 'tenant') {
			if (!promoCode?.trim()) {
				throw new Error('Tenant promo code is required');
			}
			const promoDoc = await findActiveTenantPromoCode(promoCode, email);
			if (!promoDoc) {
				throw new Error('Invalid or expired tenant promo code');
			}
			shouldRedeemTenantInvite = true;
		}

		// Handle team member invite registration (requires promo code)
		if (inviteType === 'team') {
			if (!promoCode?.trim()) {
				throw new Error('Team invitation code is required');
			}
			const inviteDoc = await findActiveTeamMemberPromoCode(promoCode, email);
			if (!inviteDoc) {
				throw new Error('Invalid or expired team member invitation code');
			}
			if (inviteDoc.role) {
				resolvedRole = inviteDoc.role;
			}
			teamInviteAccountId = inviteDoc.accountId || null;
			teamInviteMemberId = inviteDoc.teamMemberId || null;
			shouldRedeemTeamInvite = true;
		}

		// For property guests, use a special "guest" plan
		if (resolvedRole === USER_ROLES.PROPERTY_GUEST) {
			selectedPlan = 'guest';
		}

		// For tenants, use a special "tenant" plan
		if (resolvedRole === USER_ROLES.TENANT) {
			selectedPlan = 'tenant';
		}

		if (inviteType === 'team') {
			selectedPlan = 'team';
		}

		// Create Firebase Auth user
		const userCredential = await createFirebaseAuthUser(
			email.trim().toLowerCase(),
			password,
		);

		// Update display name in Firebase Auth
		await updateProfile(userCredential.user, {
			displayName: `${firstName} ${lastName}`,
		});

		// Create user profile in Firestore
		const isTeamInviteSignup = inviteType === 'team';
		const registrationMode: NonNullable<User['registrationMode']> =
			inviteType === 'team'
				? 'team_invite'
				: inviteType === 'tenant'
					? 'tenant_invite'
					: resolvedRole === USER_ROLES.TENANT
						? 'tenant'
						: 'standard';
		const userProfile: User = {
			id: userCredential.user.uid,
			firstName,
			lastName,
			email: email.trim().toLowerCase(),
			registrationStatus: 'pending_email_verification',
			registrationMode,
			role: resolvedRole as any,
			title: getRoleTitleFromRole(resolvedRole),
			image: `https://ui-avatars.com/api/?name=${firstName}+${lastName}&background=22c55e&color=fff`,
			...(teamInviteAccountId
				? { accountId: teamInviteAccountId }
				: { accountId: userCredential.user.uid }),
			isAccountOwner: !isTeamInviteSignup,
			...(isTeamInviteSignup && {
				isTeamMemberAccount: true,
				...(teamInviteMemberId ? { teamMemberId: teamInviteMemberId } : {}),
			}),
			notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
			emailPreferences: DEFAULT_EMAIL_PREFERENCES,
		};

		const { subscription } = await createUserSubscription(
			selectedPlan,
			promoCode,
		);

		// Prepare legal agreement data
		const agreedAt = new Date().toISOString();
		const legalDocuments = legalAgreement
			? legalAgreement.documents
				? {
						termsOfService: legalAgreement.documents.termsOfService
							? {
									...legalAgreement.documents.termsOfService,
									agreedAt,
								}
							: undefined,
						privacyPolicy: legalAgreement.documents.privacyPolicy
							? {
									...legalAgreement.documents.privacyPolicy,
									agreedAt,
								}
							: undefined,
						maintenanceDisclaimer: legalAgreement.documents
							.maintenanceDisclaimer
							? {
									...legalAgreement.documents.maintenanceDisclaimer,
									agreedAt,
								}
							: undefined,
						subscriptionTerms: legalAgreement.documents.subscriptionTerms
							? {
									...legalAgreement.documents.subscriptionTerms,
									agreedAt,
								}
							: undefined,
						eula: legalAgreement.documents.eula
							? {
									...legalAgreement.documents.eula,
									agreedAt,
								}
							: undefined,
					}
				: createLegalAgreementDocuments(agreedAt, legalAgreement.agreedVersion)
			: undefined;
		const legalAgreementData = legalAgreement
			? {
					legalAgreement: {
						agreedToTerms: legalAgreement.agreedToTerms,
						agreedAt,
						agreedVersion: legalAgreement.agreedVersion,
						documents: legalDocuments,
					},
				}
			: {};

		await setDoc(doc(db, 'users', userCredential.user.uid), {
			...userProfile,
			...legalAgreementData,
			createdAt: serverTimestamp(),
			updatedAt: serverTimestamp(),
			subscription,
		});

		if (!isTeamInviteSignup && isNonBillableSignupPlan(selectedPlan)) {
			const ensureFamilyAccountCallable = await getAuthCallable<
				{
					accountId?: string;
					syncSubscription?: boolean;
					subscription?: Record<string, unknown>;
				},
				{
					id: string;
					subscription?: Record<string, unknown>;
				}
			>('ensureFamilyAccount');

			await ensureFamilyAccountCallable({
				accountId: userCredential.user.uid,
				syncSubscription: true,
				subscription: subscription as unknown as Record<string, unknown>,
			});
		}

		// Auto-accept pending guest invitations for property guests
		if (resolvedRole === USER_ROLES.PROPERTY_GUEST) {
			await autoAcceptGuestInvitations(
				userCredential.user.uid,
				email.trim().toLowerCase(),
			);
		}

		if (shouldRedeemTenantInvite && promoCode?.trim()) {
			const redeemTenantInvite = await getAuthCallable<
				{ promoCode: string },
				{ success: boolean }
			>('redeemTenantInvitationCode');
			await redeemTenantInvite({ promoCode });
		}

		if (shouldRedeemTeamInvite && promoCode?.trim()) {
			const redeemTeamInvite = await getAuthCallable<
				{ promoCode: string; teamMemberEmail: string },
				{ success: boolean }
			>('redeemTeamMemberInvitationCode');
			await redeemTeamInvite({
				promoCode,
				teamMemberEmail: email.trim().toLowerCase(),
			});
		}

		const finalUser =
			shouldRedeemTeamInvite && teamInviteMemberId
				? await getUserProfile(userCredential.user.uid)
				: ({
						...userProfile,
						subscription,
						...(legalAgreement && {
							legalAgreement: {
								agreedToTerms: legalAgreement.agreedToTerms,
								agreedAt,
								agreedVersion: legalAgreement.agreedVersion,
								documents: legalDocuments,
							},
						}),
					} as User);

		return {
			user: isEmailVerificationRequired()
				? finalUser
				: await reconcileCurrentUserEmailVerification(finalUser),
		};
	} catch (error: any) {
		console.error('Sign up error:', error);
		if (isBlockedByClientError(error)) {
			throw new Error(
				'Your browser blocked required signup requests. Please disable ad/privacy blockers for this site (and firestore.googleapis.com), then try again.',
			);
		}
		const authErrorMessage = getAuthErrorMessage(error?.code);
		if (authErrorMessage !== 'Authentication failed. Please try again') {
			throw new Error(authErrorMessage);
		}
		throw new Error(
			error?.message || 'Authentication failed. Please try again',
		);
	}
};

/**
 * Sign out current user
 */
export const signOutUser = async (): Promise<void> => {
	try {
		const userId = auth.currentUser?.uid;
		await signOut(auth);
		clearUserLocalStorage(userId);
	} catch (error: any) {
		console.error('Sign out error:', error);
		throw new Error('Failed to sign out');
	}
};

/**
 * Add a family member to an existing account (creates user immediately with password reset email)
 */
export const addFamilyMember = async (
	accountId: string,
	email: string,
	firstName: string,
	lastName: string,
	role: 'owner' | 'admin' | 'member' = 'admin',
): Promise<{ userId: string; message: string }> => {
	try {
		const createFamilyInviteFunction = await getAuthCallable<
			{
				accountId: string;
				email: string;
				firstName: string;
				lastName: string;
				role: 'owner' | 'admin' | 'member';
			},
			{ success: boolean; userId: string; message: string }
		>('createFamilyInvite');

		const result = await createFamilyInviteFunction({
			accountId,
			email,
			firstName,
			lastName,
			role,
		});

		return {
			userId: result.data.userId,
			message: result.data.message || 'Family member added successfully',
		};
	} catch (error: any) {
		console.error('Failed to add family member:', error);
		// Re-throw the error message from the cloud function
		if (error.message) {
			throw new Error(error.message);
		}
		throw error;
	}
};

/**
 * Remove a family member from an account
 */
export const removeFamilyMember = async (
	accountId: string,
	memberId: string,
	currentUserId: string,
): Promise<void> => {
	try {
		if (memberId === currentUserId) {
			throw new Error('Cannot remove yourself from the account');
		}

		const deleteFamilyMember = await getAuthCallable<
			{ memberId: string; accountId: string },
			unknown
		>('deleteFamilyMemberAccount');
		await deleteFamilyMember({ memberId, accountId });
	} catch (error: any) {
		console.error('Failed to remove family member:', error);
		throw error;
	}
};

export const updateFamilyMemberRole = async (
	accountId: string,
	memberId: string,
	role: 'admin' | 'member',
): Promise<void> => {
	const updateRoleFunction = await getAuthCallable<
		{ accountId: string; memberId: string; role: 'admin' | 'member' },
		{ success: boolean; message?: string }
	>('updateFamilyMemberRole');

	await updateRoleFunction({ accountId, memberId, role });
};

export const updateFamilyMember = async (
	accountId: string,
	memberId: string,
	firstName: string,
	lastName: string,
	role: 'admin' | 'member',
): Promise<void> => {
	const updateFamilyMemberFunction = await getAuthCallable<
		{
			accountId: string;
			memberId: string;
			firstName: string;
			lastName: string;
			role: 'admin' | 'member';
		},
		{ success: boolean; message?: string }
	>('updateFamilyMember');

	await updateFamilyMemberFunction({
		accountId,
		memberId,
		firstName,
		lastName,
		role,
	});
};

/**
 * Get family account members
 */
export const getFamilyMembers = async (accountId: string): Promise<User[]> => {
	try {
		if (!accountId || !auth.currentUser) {
			return [];
		}

		const getFamilyMembersCallable = await getAuthCallable<
			{ accountId: string },
			{ members: User[] }
		>('getFamilyMembers');

		const result = await getFamilyMembersCallable({ accountId });
		return Array.isArray(result.data?.members) ? result.data.members : [];
	} catch (error: any) {
		if (isExpectedAuthTeardownError(error)) {
			return [];
		}

		console.error('Failed to get family members:', error);
		return [];
	}
};

export const getFamilyInvites = async (
	accountId: string,
): Promise<FamilyInvite[]> => {
	try {
		const listFamilyInvitesCallable = await getAuthCallable<
			{ accountId: string },
			{ invites: FamilyInvite[] }
		>('listFamilyInvites');

		const result = await listFamilyInvitesCallable({ accountId });
		const invites = Array.isArray(result.data?.invites)
			? result.data.invites
			: [];

		return invites.filter((invite) => invite.status === 'pending');
	} catch (error: any) {
		console.error('Failed to get family invites:', error);
		return [];
	}
};

export const resendPasswordReset = async (
	accountId: string,
	userId: string,
): Promise<void> => {
	const resendFunction = await getAuthCallable<
		{ userId: string; accountId: string },
		{ success: boolean; message?: string }
	>('resendFamilyMemberInvite');

	await resendFunction({ userId, accountId });
};

export const revokeFamilyInvite = async (
	accountId: string,
	inviteId: string,
): Promise<void> => {
	const revokeInviteFunction = await getAuthCallable<
		{ inviteId: string; accountId: string },
		{ success: boolean; message?: string }
	>('revokeFamilyInvite');

	await revokeInviteFunction({ inviteId, accountId });
};

export const acceptFamilyInvite = async (
	inviteId: string,
	token: string,
): Promise<void> => {
	const acceptInviteFunction = await getAuthCallable<
		{ inviteId: string; token: string },
		{ success: boolean; message?: string }
	>('acceptFamilyInvite');

	await acceptInviteFunction({ inviteId, token });
};

/**
 * Send password reset email
 */
export const resetPassword = async (email: string): Promise<void> => {
	try {
		await sendPasswordResetEmail(auth, email);
	} catch (error: any) {
		console.error('Password reset error:', error);

		// Provide more specific error messages
		if (error.code === 'auth/user-not-found') {
			throw new Error(
				'No account found with this email address. Please check your email or sign up for a new account.',
			);
		} else if (error.code === 'auth/invalid-email') {
			throw new Error('Please enter a valid email address.');
		} else if (error.code === 'auth/too-many-requests') {
			throw new Error(
				'Too many password reset requests. Please wait a few minutes before trying again.',
			);
		}

		throw new Error(
			getAuthErrorMessage(error.code) ||
				'Failed to send password reset email. Please check your Firebase Console email template configuration.',
		);
	}
};

/**
 * Convert Firebase error codes to user-friendly messages
 */
const getAuthErrorMessage = (errorCode?: string): string => {
	switch (errorCode) {
		case 'auth/user-not-found':
			return 'No account found with this email address';
		case 'auth/wrong-password':
			return 'Incorrect password';
		case 'auth/invalid-email':
			return 'Invalid email address';
		case 'auth/user-disabled':
			return 'This account has been disabled';
		case 'auth/email-already-in-use':
			return 'An account already exists with this email';
		case 'auth/weak-password':
			return 'Password should be at least 6 characters';
		case 'auth/too-many-requests':
			return 'Too many failed attempts. Please try again later';
		case 'auth/network-request-failed':
			return 'Network error. Please check your connection';
		case 'auth/invalid-credential':
			return 'Invalid email or password';
		default:
			return 'Authentication failed. Please try again';
	}
};

/**
 * Get role title from role constant
 */
const getRoleTitleFromRole = (role: string): string => {
	const roleTitles: { [key: string]: string } = {
		[USER_ROLES.ADMIN]: 'Administrator',
		[USER_ROLES.PROPERTY_MANAGER]: 'Property Manager',
		[USER_ROLES.ASSISTANT_MANAGER]: 'Assistant Manager',
		[USER_ROLES.MAINTENANCE_LEAD]: 'Maintenance Lead',
		[USER_ROLES.MAINTENANCE]: 'Maintenance Technician',
		[USER_ROLES.CONTRACTOR]: 'Contractor',
		[USER_ROLES.TENANT]: 'Tenant',
		[USER_ROLES.PROPERTY_GUEST]: 'Property Guest',
	};
	return roleTitles[role] || 'User';
};

/**
 * Auto-accept pending guest invitations for a newly registered property guest
 */
const autoAcceptGuestInvitations = async (
	userId: string,
	userEmail: string,
) => {
	void userId;
	try {
		// Find all pending guest invitations for this email
		const invitationsQuery = query(
			collection(db, 'userInvitations'),
			where('toEmail', '==', userEmail.toLowerCase()),
			where('status', '==', 'pending'),
			where('isGuestInvitation', '==', true),
		);
		const invitationsSnapshot = await getDocs(invitationsQuery);

		for (const invitationDoc of invitationsSnapshot.docs) {
			// Shared properties feature retired: no propertyShares records are created.

			// Update invitation status
			await updateDoc(invitationDoc.ref, { status: 'accepted' });

			// Create notifications (similar to acceptInvitation mutation)
			// ... notification creation code would go here
		}
	} catch (error) {
		console.error('Error auto-accepting guest invitations:', error);
	}
};
