import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import {
	Input,
	Wrapper,
	Submit,
	Title,
	BackButton,
	RegisterWrapper,
	ErrorMessage,
	LoadingSpinner,
	PasswordInputWrapper,
	PasswordToggleButton,
	SectionLabel,
	PasswordMatchText,
	EmailStatusText,
	TrialNotice,
	InviteModePanel,
	InviteModeTitle,
	InviteModeDescription,
	InviteModeActionButton,
	LegalAgreementSection,
	LegalAgreementLabel,
	LegalDocumentButton,
} from './RegistrationCard.styles';
import { faArrowCircleLeft } from '@fortawesome/free-solid-svg-icons';
import { faEye, faEyeSlash } from '@fortawesome/free-regular-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
	signUpWithEmail,
	checkEmailExists,
	validateTenantInviteForRegistration,
	validateTeamInviteForRegistration,
} from '../../services/authService';
import { USER_ROLES } from '../../constants/roles';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { setCurrentUser } from '../../Redux/Slices/userSlice';
import { PaywallPage } from '../../pages/PaywallPage/PaywallPage';
import DocumentViewer from '../DocumentViewer';
import { TRIAL_DURATION_DAYS } from '../../constants/subscriptions';
import {
	LEGAL_AGREEMENT_VERSION,
	createLegalAgreementDocuments,
} from '../../constants/legal';
import { auth } from '../../config/firebase';
import {
	complimentaryAccessCodesEnabled,
	ComplimentaryAccessCodePreview,
	previewComplimentaryAccessCode,
	redeemComplimentaryAccessCode,
} from '../../services/complimentaryAccessCodeService';
import {
	getAnalyticsErrorCode,
	trackAnalyticsEvent,
} from '../../analytics/analytics';
import {
	finalizeCurrentUserEmailVerification,
	sendCurrentUserEmailVerification,
} from '../../services/emailVerificationService';
import { isEmailVerificationRequired } from '../../config/emailVerificationPolicy';

// Map selected account type to appropriate role
const getRoleFromAccountType = (accountType: string): string => {
	const roleMapping: { [key: string]: string } = {
		homeowner: USER_ROLES.ADMIN, // Homeowners are admins of their properties
		propertyManager: USER_ROLES.PROPERTY_MANAGER,
		tenant: USER_ROLES.TENANT, // Tenants are self-registered tenants
		tenantInvite: USER_ROLES.TENANT,
	};
	return roleMapping[accountType] || USER_ROLES.ADMIN; // Default to admin
};

export const RegistrationCard = () => {
	const navigate = useNavigate();
	const location = useLocation();
	const dispatch = useDispatch();
	const isContinuingComplimentaryAccess =
		new URLSearchParams(location.search).get('continue') ===
		'complimentary-access';
	const savedComplimentaryCode = isContinuingComplimentaryAccess
		? sessionStorage.getItem('pendingComplimentaryAccessCode') || ''
		: '';
	const [step, setStep] = useState<number>(
		isContinuingComplimentaryAccess ? 4 : 1,
	);
	const [firstName, setFirstName] = useState<string>('');
	const [lastName, setLastName] = useState<string>('');
	const [email, setEmail] = useState<string>('');
	const [emailChecking, setEmailChecking] = useState<boolean>(false);
	const [emailExists, setEmailExists] = useState<boolean>(false);
	const [password, setPassword] = useState<string>('');
	const [passwordConfirm, setPasswordConfirm] = useState<string>('');
	const [confirmed, setConfirmed] = useState<boolean>(false);
	const [error, setError] = useState<string>('');
	const [loading, setLoading] = useState<boolean>(false);
	const [showPassword, setShowPassword] = useState<boolean>(false);
	const [showPasswordConfirm, setShowPasswordConfirm] =
		useState<boolean>(false);
	const [accountType, setAccountType] = useState<string>('homeowner');
	const [selectedPlan, setSelectedPlan] = useState<string>('');
	const [promoCode, setPromoCode] = useState<string>('');
	const [showComplimentaryCode, setShowComplimentaryCode] = useState(false);
	const [complimentaryCode, setComplimentaryCode] = useState(
		savedComplimentaryCode,
	);
	const [complimentaryPreview, setComplimentaryPreview] =
		useState<ComplimentaryAccessCodePreview | null>(null);
	const [complimentaryError, setComplimentaryError] = useState('');
	const [complimentaryBusy, setComplimentaryBusy] = useState(false);
	const [inviteCodeInput, setInviteCodeInput] = useState<string>('');
	const [inviteMode, setInviteMode] = useState<boolean>(false);
	const [inviteType, setInviteType] = useState<'tenant' | 'team'>('tenant');
	const [inviteRole, setInviteRole] = useState<string | null>(null);
	const [inviteEmailLocked, setInviteEmailLocked] = useState<boolean>(false);
	const [inviteValidationState, setInviteValidationState] = useState<
		'idle' | 'checking' | 'valid' | 'invalid'
	>('idle');
	const [inviteValidationMessage, setInviteValidationMessage] =
		useState<string>('');
	const [agreedToTerms, setAgreedToTerms] = useState<boolean>(false);
	const [selectedDocument, setSelectedDocument] = useState<{
		name: string;
		title: string;
	} | null>(null);
	const hasTrackedSignupStartedRef = useRef(false);

	const handleViewDocument = (filename: string, title: string) => {
		setSelectedDocument({ name: filename, title });
	};

	const handleCloseDocumentViewer = () => {
		setSelectedDocument(null);
	};

	// Tenants skip plan selection, invite mode skips plan selection
	const isTenantSignup = accountType === 'tenant';
	const skipsPlanSelection = inviteMode || isTenantSignup;
	const isPaidCheckoutSelection =
		!skipsPlanSelection &&
		['homeowner_plus', 'property', 'portfolio'].includes(selectedPlan);
	const totalSteps = skipsPlanSelection ? 2 : 3;
	const displayStep = step;
	const hasRegistrationAccessCode =
		complimentaryAccessCodesEnabled &&
		!inviteMode &&
		!isTenantSignup &&
		complimentaryCode.trim().length > 0;
	const registrationMode = inviteMode
		? inviteType === 'tenant'
			? 'tenant_invite'
			: 'team_invite'
		: isTenantSignup
			? 'tenant'
			: 'standard';

	const trackSignupBlocked = (stage: string, reasonCode: string) => {
		void trackAnalyticsEvent('workflow_validation_blocked', {
			workflow_name: 'signup',
			workflow_stage: stage,
			reason_code: reasonCode,
		});
	};

	const enableInviteMode = () => {
		setInviteMode(true);
		setAccountType('tenantInvite');
		setSelectedPlan('tenant');
		setInviteType('tenant');
		setInviteRole(null);
		setInviteEmailLocked(false);
		setInviteValidationState('idle');
		setInviteValidationMessage('');
		setError('');
	};

	const disableInviteMode = () => {
		setInviteMode(false);
		setInviteCodeInput('');
		setInviteType('tenant');
		setInviteRole(null);
		setInviteValidationState('idle');
		setInviteValidationMessage('');
		setInviteEmailLocked(false);
		setAccountType('homeowner');
		setSelectedPlan('');
		setPromoCode('');
		setError('');
	};

	const validateInvite = async (
		codeOverride?: string,
		emailOverride?: string,
	) => {
		const codeToCheck = (codeOverride ?? inviteCodeInput).trim();
		const emailToCheck = (emailOverride ?? email).trim().toLowerCase();

		if (!inviteMode || !codeToCheck || !emailToCheck) {
			setInviteValidationState('idle');
			setInviteValidationMessage('');
			return false;
		}

		setInviteValidationState('checking');
		setInviteValidationMessage('Validating invitation code...');

		const isTenantValid = await validateTenantInviteForRegistration(
			codeToCheck,
			emailToCheck,
		);

		if (isTenantValid) {
			setInviteType('tenant');
			setInviteRole(USER_ROLES.TENANT);
			setSelectedPlan('tenant');
			setInviteValidationState('valid');
			setInviteValidationMessage('Invite code validated successfully.');
			return true;
		}

		const teamInvite = await validateTeamInviteForRegistration(
			codeToCheck,
			emailToCheck,
		);

		if (teamInvite.valid) {
			setInviteType('team');
			setInviteRole(teamInvite.role || null);
			setSelectedPlan('team');
			setInviteValidationState('valid');
			setInviteValidationMessage('Invite code validated successfully.');
			return true;
		}

		setInviteValidationState('invalid');
		setInviteValidationMessage(
			'Invitation code is invalid, expired, or does not match this email.',
		);
		return false;
	};

	useEffect(() => {
		const params = new URLSearchParams(location.search);
		const inviteCodeParam = (params.get('invite') || params.get('code') || '')
			.trim()
			.toUpperCase();
		const inviteTypeParam = (params.get('inviteType') || '')
			.trim()
			.toLowerCase();
		const inviteEmailParam = (
			params.get('email') ||
			params.get('tenantEmail') ||
			params.get('teamMemberEmail') ||
			''
		)
			.trim()
			.toLowerCase();

		if (!inviteCodeParam) {
			return;
		}

		setInviteMode(true);
		setAccountType('tenantInvite');
		setInviteType(inviteTypeParam === 'team' ? 'team' : 'tenant');
		setSelectedPlan(inviteTypeParam === 'team' ? 'team' : 'tenant');
		setInviteCodeInput(inviteCodeParam);

		if (inviteEmailParam) {
			setEmail(inviteEmailParam);
			setInviteEmailLocked(true);
		}
	}, [location.search]);

	const handleEmailBlur = async () => {
		if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			return;
		}
		setEmailChecking(true);
		setEmailExists(false);
		try {
			const exists = await checkEmailExists(email.trim());
			setEmailExists(exists);
		} catch (error) {
			console.error('Error checking email existence:', error);
		} finally {
			setEmailChecking(false);
		}

		if (inviteMode && inviteCodeInput.trim()) {
			await validateInvite(inviteCodeInput, email);
		}
	};

	const validateStep1 = () => {
		if (!firstName.trim()) {
			trackSignupBlocked('profile', 'first_name_required');
			setError('Please enter your first name');
			return false;
		}
		if (!lastName.trim()) {
			trackSignupBlocked('profile', 'last_name_required');
			setError('Please enter your last name');
			return false;
		}
		return true;
	};

	const validateStep2 = async () => {
		if (!email.trim()) {
			trackSignupBlocked('account', 'email_required');
			setError('Please enter your email address');
			return false;
		}
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			trackSignupBlocked('account', 'email_invalid');
			setError('Please enter a valid email address');
			return false;
		}
		if (emailExists) {
			trackSignupBlocked('account', 'email_already_registered');
			setError(
				'This email is already registered. Please use a different email or sign in instead.',
			);
			return false;
		}
		if (password.length < 8) {
			trackSignupBlocked('account', 'password_too_short');
			setError('Password must be at least 8 characters long');
			return false;
		}
		if (!confirmed) {
			trackSignupBlocked('account', 'password_confirmation_mismatch');
			setError('Passwords do not match');
			return false;
		}
		if (!agreedToTerms) {
			trackSignupBlocked('account', 'legal_agreement_required');
			setError(
				'You must agree to the Terms of Service, Privacy Policy, Maintenance Disclaimer, Subscription Terms, and EULA to continue',
			);
			return false;
		}

		if (inviteMode) {
			if (!inviteCodeInput.trim()) {
				trackSignupBlocked('account', 'invitation_code_required');
				setError('Invitation code is required for invite registration');
				return false;
			}

			const inviteValid = await validateInvite();
			if (!inviteValid) {
				trackSignupBlocked('account', 'invitation_invalid');
				setError(
					'This invitation is invalid or expired. Please verify the code and email.',
				);
				return false;
			}
		}

		return true;
	};

	const validateStep3 = () => {
		if (inviteMode) {
			return true;
		}
		// Plan selection is handled by the embedded paywall
		// User must select a plan to proceed
		if (!selectedPlan) {
			trackSignupBlocked('plan', 'plan_required');
			setError('Please select a subscription plan');
			return false;
		}
		return true;
	};

	const handleNext = async () => {
		setError('');
		if (step === 1 && validateStep1()) {
			if (!hasTrackedSignupStartedRef.current) {
				hasTrackedSignupStartedRef.current = true;
				void trackAnalyticsEvent('signup_started', {
					registration_mode: registrationMode,
					has_access_code: hasRegistrationAccessCode,
					starting_audience: isTenantSignup ? 'tenant' : accountType,
				});
			}
			setStep(2);
		} else if (step === 2 && (await validateStep2())) {
			if (inviteMode || isTenantSignup) {
				setSelectedPlan(inviteMode && inviteType === 'tenant' ? 'tenant' : isTenantSignup ? 'tenant' : 'team');
				await signup();
			} else if (hasRegistrationAccessCode) {
				await signup('homeowner');
			} else {
				setStep(3);
			}
		}
	};

	const handleBack = () => {
		setError('');
		if (step > 1) {
			setStep(step - 1);
		}
	};

	const handleTopBack = () => {
		if (step === 4) {
			navigate('/dashboard', { replace: true });
			return;
		}
		if (step > 1) {
			handleBack();
			return;
		}
		navigate('/login');
	};

	const reviewRegistrationAccessCode = async () => {
		setComplimentaryBusy(true);
		setComplimentaryError('');
		setComplimentaryPreview(null);
		try {
			const verifiedUser = await finalizeCurrentUserEmailVerification();
			dispatch(setCurrentUser(verifiedUser));
			setComplimentaryPreview(
				await previewComplimentaryAccessCode(complimentaryCode),
			);
		} catch (reviewError: any) {
			setComplimentaryError(
				String(reviewError?.message || 'This complimentary access code is not available.'),
			);
		} finally {
			setComplimentaryBusy(false);
		}
	};

	const activateRegistrationAccessCode = async () => {
		if (!complimentaryPreview) return;
		setComplimentaryBusy(true);
		setComplimentaryError('');
		try {
			await redeemComplimentaryAccessCode(complimentaryCode);
			sessionStorage.removeItem('pendingComplimentaryAccessCode');
			navigate('/dashboard', { replace: true });
		} catch (activationError: any) {
			setComplimentaryError(
				String(activationError?.message || 'Maintley could not activate this access code.'),
			);
			setComplimentaryPreview(null);
			setComplimentaryBusy(false);
		}
	};

	const signup = async (planOverride?: string) => {
		setError('');
		if (!planOverride && !skipsPlanSelection && !validateStep3()) {
			return;
		}
		setLoading(true);
		let signupStage = 'account_creation';

		try {
			// Map selected account type to appropriate role
			const effectiveAccountType = inviteMode ? 'tenantInvite' : accountType;
			const userRole = inviteMode
				? inviteRole ||
				(inviteType === 'team'
					? USER_ROLES.MAINTENANCE
					: getRoleFromAccountType(effectiveAccountType))
				: getRoleFromAccountType(effectiveAccountType);
			const agreedAt = new Date().toISOString();
			const signupPlan = inviteMode
				? inviteType === 'tenant'
					? 'tenant'
					: 'team'
				: isTenantSignup ? 'tenant' : planOverride || selectedPlan;
			const effectivePromoCode = inviteMode
				? inviteCodeInput.trim()
				: isTenantSignup ? '' : promoCode.trim();

			// Register with Firebase - use mapped role, trim values
			const { user } = await signUpWithEmail(
				email.trim(),
				password.trim(),
				firstName.trim(),
				lastName.trim(),
				userRole,
				signupPlan,
				effectivePromoCode || undefined,
				{
					agreedToTerms: true,
					agreedVersion: LEGAL_AGREEMENT_VERSION,
					documents: createLegalAgreementDocuments(
						agreedAt,
						LEGAL_AGREEMENT_VERSION,
					),
				},
				inviteMode ? inviteType : undefined,
			);
			signupStage = 'post_signup_access';

			// Store session in localStorage
			localStorage.setItem(
				'loggedUser',
				JSON.stringify({
					token: `firebase-token-${user.id}`,
					user,
				}),
			);
			if (hasRegistrationAccessCode) {
				sessionStorage.setItem(
					'pendingComplimentaryAccessCode',
					complimentaryCode,
				);
			}

			// Update Redux store to mark user as logged in
			dispatch(setCurrentUser(user));

			if (isEmailVerificationRequired()) {
				try {
					await sendCurrentUserEmailVerification();
					void trackAnalyticsEvent('email_verification_sent', {
						verification_source: 'registration',
					});
				} catch (verificationError) {
					console.warn(
						'Account created, but the verification email was not sent.',
						verificationError,
					);
				}
			} else {
				void trackAnalyticsEvent('signup_completed', {
					registration_mode: user.registrationMode || 'standard',
					selected_plan:
						user.subscription?.pendingCheckoutPlan ||
						user.subscription?.plan ||
						'homeowner',
					used_access_code: hasRegistrationAccessCode,
					requires_checkout: Boolean(user.subscription?.pendingCheckoutPlan),
				});
			}

			if (hasRegistrationAccessCode) {
				setStep(4);
				setLoading(false);
				return;
			}

			if (isEmailVerificationRequired()) {
				navigate('/verify-email', { replace: true });
			} else if (user.subscription?.pendingCheckoutPlan) {
				navigate('/checkout/start', { replace: true });
			} else {
				navigate(
					user.role === USER_ROLES.TENANT ? '/tenant-profile' : '/dashboard',
					{ replace: true },
				);
			}
		} catch (error: any) {
			console.error('RegistrationCard: Registration error', error);
			void trackAnalyticsEvent('workflow_error_shown', {
				workflow_name: 'signup',
				workflow_stage: signupStage,
				error_code: getAnalyticsErrorCode(error),
			});
			if (isPaidCheckoutSelection && auth.currentUser) {
				navigate('/paywall?checkout=failed', { replace: true });
				return;
			}
			setError(error.message || 'Registration failed. Please try again.');
			setLoading(false);
		}
	};

	useEffect(() => {
		if (password === passwordConfirm) {
			setConfirmed(true);
		} else {
			setConfirmed(false);
		}
	}, [password, passwordConfirm]);

	return (
		<Wrapper
			$wide={step === 3 || step === 4}
			onSubmit={(e) => e.preventDefault()}>
			<BackButton
				type='button'
				onClick={handleTopBack}
				aria-label={step > 1 ? 'Go back to previous step' : 'Back to login'}>
				<FontAwesomeIcon icon={faArrowCircleLeft} />
			</BackButton>
			<Title>
				{step === 1 && `Create Account - Step ${displayStep} of ${totalSteps}`}
				{step === 2 && `Create Account - Step ${displayStep} of ${totalSteps}`}
				{step === 3 && `Create Account - Step ${displayStep} of ${totalSteps}`}
				{step === 4 && 'Review Complimentary Access'}
			</Title>
			{step === 1 && (
				<TrialNotice>
					{inviteMode
						? 'Complete your invited account setup.'
						: 'Keep your home record, maintenance tasks, and service history organized in one place.'}
				</TrialNotice>
			)}
			{error && <ErrorMessage>{error}</ErrorMessage>}

			{/* Step 1: Basic Information */}
			{step === 1 && (
				<>
					<SectionLabel>Let's start with your name</SectionLabel>
					<Input
						placeholder='First Name *'
						type='text'
						autoComplete='given-name'
						value={firstName}
						onChange={(event) => {
							setFirstName(event.target.value);
							setError('');
						}}
						required
					/>
					<Input
						placeholder='Last Name *'
						type='text'
						autoComplete='family-name'
						value={lastName}
						onChange={(event) => {
							setLastName(event.target.value);
							setError('');
						}}
						required
					/>
					{inviteMode && (
						<SectionLabel>You are joining through an invite.</SectionLabel>
					)}
					{inviteMode ? (
						<InviteModePanel $active>
							<InviteModeTitle>Invite Registration Enabled</InviteModeTitle>
							<InviteModeDescription>
								Use this flow if you were invited to join a property or team.
							</InviteModeDescription>
							<InviteModeActionButton
								type='button'
								$secondary
								onClick={disableInviteMode}>
								Switch to Standard Registration
							</InviteModeActionButton>
						</InviteModePanel>
					) : (
						<InviteModePanel>
							<InviteModeTitle>Have an Invite Code?</InviteModeTitle>
							<InviteModeDescription>
								Use invite registration if you were invited as a tenant or team
								member.
							</InviteModeDescription>
							<InviteModeActionButton type='button' onClick={enableInviteMode}>
								Use Invite Registration
							</InviteModeActionButton>
						</InviteModePanel>
					)}
					<Submit type='button' onClick={handleNext}>
						Next
					</Submit>
				</>
			)}

			{/* Step 2: Account Credentials & Legal Agreement */}
			{step === 2 && (
				<>
					<SectionLabel>Create your login credentials</SectionLabel>
					{inviteMode && (
						<>
							<Input
								placeholder='Invitation Code *'
								type='text'
								value={inviteCodeInput}
								onChange={(event) => {
									setInviteCodeInput(event.target.value.toUpperCase());
									setInviteValidationState('idle');
									setInviteValidationMessage('');
									setError('');
								}}
								onBlur={() => {
									if (inviteCodeInput.trim() && email.trim()) {
										void validateInvite();
									}
								}}
								required
							/>
							{inviteValidationMessage && (
								<EmailStatusText error={inviteValidationState === 'invalid'}>
									{inviteValidationMessage}
								</EmailStatusText>
							)}
						</>
					)}
					<Input
						placeholder='Email Address *'
						type='email'
						autoComplete='email'
						value={email}
						disabled={inviteEmailLocked}
						onChange={(event) => {
							setEmail(event.target.value);
							setError('');
							setEmailExists(false);
							if (inviteMode) {
								setInviteValidationState('idle');
								setInviteValidationMessage('');
							}
						}}
						onBlur={handleEmailBlur}
						required
					/>
					{emailChecking && (
						<EmailStatusText>Checking email availability...</EmailStatusText>
					)}
					{!emailChecking && emailExists && email.trim() && (
						<EmailStatusText error>
							This email is already registered. Please use a different email or
							sign in instead.
						</EmailStatusText>
					)}
					{complimentaryAccessCodesEnabled && !inviteMode && !isTenantSignup && (
						<InviteModePanel $active={showComplimentaryCode}>
							<InviteModeTitle>Have a complimentary access code?</InviteModeTitle>
							<InviteModeDescription>
								This is separate from a Stripe coupon. It provides temporary Maintley access without automatic billing.
							</InviteModeDescription>
							{showComplimentaryCode ? (
								<>
									<Input
										placeholder='Complimentary access code'
										type='text'
										value={complimentaryCode}
										onChange={(event) => {
											setComplimentaryCode(event.target.value.toUpperCase());
											setComplimentaryError('');
										}}
										autoComplete='off'
									/>
									<InviteModeActionButton
										type='button'
										$secondary
										onClick={() => {
											setShowComplimentaryCode(false);
											setComplimentaryCode('');
										}}>
										Remove access code
									</InviteModeActionButton>
								</>
							) : (
								<InviteModeActionButton type='button' onClick={() => setShowComplimentaryCode(true)}>
									Enter Access Code
								</InviteModeActionButton>
							)}
						</InviteModePanel>
					)}
					<PasswordInputWrapper>
						<Input
							placeholder='Password (min 8 characters) *'
							type={showPassword ? 'text' : 'password'}
							autoComplete='new-password'
							value={password}
							onChange={(event) => {
								setPassword(event.target.value);
								setError('');
							}}
							required
						/>
						<PasswordToggleButton
							type='button'
							tabIndex={-1}
							onClick={(e) => {
								e.preventDefault();
								setShowPassword(!showPassword);
							}}
							title={showPassword ? 'Hide password' : 'Show password'}>
							<FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
						</PasswordToggleButton>
					</PasswordInputWrapper>
					<PasswordInputWrapper>
						<Input
							placeholder='Confirm Password *'
							type={showPasswordConfirm ? 'text' : 'password'}
							autoComplete='new-password'
							value={passwordConfirm}
							onChange={(event) => {
								setPasswordConfirm(event.target.value);
								setError('');
							}}
							required
						/>
						<PasswordToggleButton
							type='button'
							tabIndex={-1}
							onClick={(e) => {
								e.preventDefault();
								setShowPasswordConfirm(!showPasswordConfirm);
							}}
							title={showPasswordConfirm ? 'Hide password' : 'Show password'}>
							<FontAwesomeIcon
								icon={showPasswordConfirm ? faEyeSlash : faEye}
							/>
						</PasswordToggleButton>
					</PasswordInputWrapper>
					{password && passwordConfirm && (
						<PasswordMatchText matched={confirmed}>
							{confirmed ? '✓ Passwords match' : '✗ Passwords do not match'}
						</PasswordMatchText>
					)}
					<LegalAgreementSection>
						<LegalAgreementLabel>
							<input
								type='checkbox'
								checked={agreedToTerms}
								onChange={(e) => {
									setAgreedToTerms(e.target.checked);
									setError('');
								}}
								required
							/>
							<span>
								I agree to the{' '}
								<LegalDocumentButton
									type='button'
									onClick={() =>
										handleViewDocument('terms-of-service', 'Terms of Service')
									}>
									Terms of Service
								</LegalDocumentButton>{' '}
								and{' '}
								<LegalDocumentButton
									type='button'
									onClick={() => handleViewDocument('eula', 'EULA')}>
									EULA
								</LegalDocumentButton>
								. I acknowledge the Privacy Policy and important maintenance and
								subscription disclosures. *
							</span>
						</LegalAgreementLabel>
						<details>
							<summary>Review privacy and important disclosures</summary>
							<div>
								<LegalDocumentButton
									type='button'
									onClick={() =>
										handleViewDocument('privacy-policy', 'Privacy Policy')
									}>
									Privacy Policy
								</LegalDocumentButton>
								{' · '}
								<LegalDocumentButton
									type='button'
									onClick={() =>
										handleViewDocument(
											'maintenance-disclaimer',
											'Maintenance Disclaimer',
										)
									}>
									Maintenance Disclaimer
								</LegalDocumentButton>
								{' · '}
								<LegalDocumentButton
									type='button'
									onClick={() =>
										handleViewDocument(
											'subscription-terms',
											'Subscription Terms',
										)
									}>
									Subscription Terms
								</LegalDocumentButton>
							</div>
						</details>
					</LegalAgreementSection>
					<Submit type='button' onClick={handleNext}>
						Next
					</Submit>
				</>
			)}

			{/* Step 3: Plan Selection + Create Account */}
			{step === 3 && !skipsPlanSelection && (
				<>
					<TrialNotice>
						Start with Free. After you create your first home, eligible new
						homeowners receive temporary Homeowner+ access automatically—no
						payment method is required.
					</TrialNotice>
					<PaywallPage
						subscription={{
							status: 'trial',
							plan: '',
							currentPeriodStart: Math.floor(Date.now() / 1000),
							currentPeriodEnd:
								Math.floor(Date.now() / 1000) +
								TRIAL_DURATION_DAYS * 24 * 60 * 60,
							trialEndsAt:
								Math.floor(Date.now() / 1000) +
								TRIAL_DURATION_DAYS * 24 * 60 * 60,
						}}
						currentPlan={selectedPlan}
						variant='embedded'
						selectionOnly={true}
						initialPlanAudience='home'
						onPlanSelect={(planId) => {
							setSelectedPlan(planId);
							setError('');
						}}
						onPromoCodeApplied={(appliedPromoCode) => {
							setPromoCode(appliedPromoCode);
							setError('');
						}}
					/>
					<Submit type='button' onClick={() => void signup()} disabled={loading}>
						{loading && <LoadingSpinner />}
						{loading
							? isPaidCheckoutSelection
								? 'Opening secure checkout...'
								: 'Creating account...'
							: 'Create Account'}
					</Submit>
				</>
			)}

			{step === 4 && (
				<>
					<TrialNotice>
						{isEmailVerificationRequired()
							? 'Verify your email, then review this code before activating temporary access.'
							: 'Review this code before activating temporary access.'}
					</TrialNotice>
					{complimentaryError ? <ErrorMessage>{complimentaryError}</ErrorMessage> : null}
					<Input
						placeholder='Complimentary access code'
						type='text'
						value={complimentaryCode}
						onChange={(event) => {
							setComplimentaryCode(event.target.value.toUpperCase());
							setComplimentaryPreview(null);
							setComplimentaryError('');
						}}
						autoComplete='off'
					/>
					{complimentaryPreview ? (
						<InviteModePanel $active>
							<InviteModeTitle>{complimentaryPreview.label}</InviteModeTitle>
							<InviteModeDescription>
								Includes {complimentaryPreview.durationDays} days of{' '}
								{complimentaryPreview.bundleId.replaceAll('_', ' ')} access. It does not create a charge or automatic renewal. When it ends, your account returns to its existing plan{complimentaryPreview.transitionMode === 'checkout_required' ? ' and paid continuation requires Checkout' : ''}.
							</InviteModeDescription>
							<Submit type='button' disabled={complimentaryBusy} onClick={() => void activateRegistrationAccessCode()}>
								{complimentaryBusy ? 'Activating...' : 'Activate Complimentary Access'}
							</Submit>
						</InviteModePanel>
					) : (
						<Submit type='button' disabled={complimentaryBusy || complimentaryCode.trim().length < 8} onClick={() => void reviewRegistrationAccessCode()}>
							{complimentaryBusy ? 'Reviewing...' : 'Review Access'}
						</Submit>
					)}
					<InviteModeActionButton
						type='button'
						$secondary
						onClick={() => {
							sessionStorage.removeItem('pendingComplimentaryAccessCode');
							navigate(
								!isEmailVerificationRequired() || auth.currentUser?.emailVerified
									? '/dashboard'
									: '/verify-email',
								{ replace: true },
							);
						}}>
						Skip for now
					</InviteModeActionButton>
				</>
			)}

			<RegisterWrapper>
				<p>
					Already have an account? <Link to='/login'>Login here</Link>
				</p>
			</RegisterWrapper>

			<DocumentViewer
				documentName={selectedDocument?.name || ''}
				title={selectedDocument?.title || ''}
				isOpen={!!selectedDocument}
				onClose={handleCloseDocumentViewer}
			/>
		</Wrapper>
	);
};
