import { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelopeCircleCheck } from '@fortawesome/free-solid-svg-icons';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Wrapper } from '../RegistrationPage/RegistrationPage.styles';
import type { AppDispatch, RootState } from '../../Redux/store/store';
import { setCurrentUser, type User } from '../../Redux/Slices/userSlice';
import { USER_ROLES } from '../../constants/roles';
import { signOutUser } from '../../services/authService';
import {
	finalizeCurrentUserEmailVerification,
	sendCurrentUserEmailVerification,
} from '../../services/emailVerificationService';
import { trackAnalyticsEvent } from '../../analytics/analytics';
import { isEmailVerificationRequired } from '../../config/emailVerificationPolicy';
import {
	PrimaryAction,
	SecondaryAction,
	TextAction,
	VerificationActions,
	VerificationCard,
	VerificationMark,
	VerificationMessage,
	VerificationText,
	VerificationTitle,
} from './EmailVerificationPage.styles';

const RESEND_COOLDOWN_SECONDS = 60;

const getPostVerificationDestination = (user: User): string => {
	if (sessionStorage.getItem('pendingComplimentaryAccessCode')) {
		return '/registration?continue=complimentary-access';
	}
	if (user.subscription?.pendingCheckoutPlan) return '/checkout/start';
	return user.role === USER_ROLES.TENANT ? '/tenant-profile' : '/dashboard';
};

export const EmailVerificationPage = () => {
	const navigate = useNavigate();
	const dispatch = useDispatch<AppDispatch>();
	const currentUser = useSelector((state: RootState) => state.user.currentUser);
	const [isChecking, setIsChecking] = useState(false);
	const [isSending, setIsSending] = useState(false);
	const [message, setMessage] = useState('');
	const [error, setError] = useState('');
	const [cooldown, setCooldown] = useState(0);

	useEffect(() => {
		if (currentUser && !isEmailVerificationRequired()) {
			navigate(getPostVerificationDestination(currentUser), { replace: true });
			return;
		}
		if (
			currentUser &&
			currentUser.registrationStatus !== 'pending_email_verification'
		) {
			navigate(getPostVerificationDestination(currentUser), { replace: true });
		}
	}, [currentUser, navigate]);

	useEffect(() => {
		if (cooldown <= 0) return;
		const timer = window.setInterval(() => {
			setCooldown((remaining) => Math.max(0, remaining - 1));
		}, 1000);
		return () => window.clearInterval(timer);
	}, [cooldown]);

	const continueAfterVerification = async () => {
		setIsChecking(true);
		setError('');
		setMessage('');
		try {
			const user = await finalizeCurrentUserEmailVerification();
			dispatch(setCurrentUser(user));
			localStorage.setItem(
				'loggedUser',
				JSON.stringify({ token: `firebase-token-${user.id}`, user }),
			);
			void trackAnalyticsEvent('email_verification_completed', {
				registration_mode: user.registrationMode || 'standard',
			});
			void trackAnalyticsEvent('signup_completed', {
				registration_mode: user.registrationMode || 'standard',
				selected_plan:
					user.subscription?.pendingCheckoutPlan || user.subscription?.plan || 'homeowner',
				used_access_code: Boolean(
					sessionStorage.getItem('pendingComplimentaryAccessCode'),
				),
				requires_checkout: Boolean(user.subscription?.pendingCheckoutPlan),
			});

			navigate(getPostVerificationDestination(user), { replace: true });
		} catch (verificationError: any) {
			setError(
				String(
					verificationError?.message ||
						'Maintley could not confirm your email yet. Please try again.',
				),
			);
		} finally {
			setIsChecking(false);
		}
	};

	const resendVerification = async () => {
		setIsSending(true);
		setError('');
		setMessage('');
		try {
			await sendCurrentUserEmailVerification();
			setCooldown(RESEND_COOLDOWN_SECONDS);
			setMessage('A new verification email has been sent.');
			void trackAnalyticsEvent('email_verification_sent', {
				verification_source: 'verification_page',
			});
		} catch (sendError: any) {
			setError(
				String(
					sendError?.message ||
						'Maintley could not send another verification email. Please try again shortly.',
				),
			);
		} finally {
			setIsSending(false);
		}
	};

	const signOutAndReturn = async () => {
		setError('');
		try {
			await signOutUser();
			dispatch(setCurrentUser(null));
			navigate('/login', { replace: true });
		} catch (signOutError: any) {
			setError(
				String(signOutError?.message || 'Maintley could not sign you out. Please try again.'),
			);
		}
	};

	return (
		<Wrapper>
			<VerificationCard>
				<VerificationMark aria-hidden='true'>
					<FontAwesomeIcon icon={faEnvelopeCircleCheck} />
				</VerificationMark>
				<VerificationTitle>Verify your email</VerificationTitle>
				<VerificationText>
					We sent a verification link to <strong>{currentUser?.email}</strong>.
					 Open it to confirm this address before continuing into Maintley.
				</VerificationText>
				<VerificationText>
					After you use the link, return here and let Maintley confirm it. You
					can also finish later by signing in again with this account.
				</VerificationText>
				{message ? <VerificationMessage>{message}</VerificationMessage> : null}
				{error ? <VerificationMessage $error>{error}</VerificationMessage> : null}
				<VerificationActions>
					<PrimaryAction
						type='button'
						disabled={isChecking}
						onClick={() => void continueAfterVerification()}>
						{isChecking ? 'Checking...' : "I've verified my email"}
					</PrimaryAction>
					<SecondaryAction
						type='button'
						disabled={isSending || cooldown > 0}
						onClick={() => void resendVerification()}>
						{isSending
							? 'Sending...'
							: cooldown > 0
								? `Send again in ${cooldown}s`
								: 'Send another verification email'}
					</SecondaryAction>
					<TextAction type='button' onClick={() => void signOutAndReturn()}>
						Sign out
					</TextAction>
				</VerificationActions>
			</VerificationCard>
		</Wrapper>
	);
};
