import {
	reload,
	sendEmailVerification,
	type ActionCodeSettings,
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { callFirebaseFunction } from '../config/firebaseFunctions';
import type { User } from '../Redux/Slices/userSlice';
import { getUserProfile } from './userProfileService';
import { isEmailVerificationRequired } from '../config/emailVerificationPolicy';

const getEmailVerificationReturnUrl = (): string => {
	const origin = window.location.origin;
	const hostname = window.location.hostname.toLowerCase();
	const isFirebasePreview = hostname.endsWith('.web.app') && hostname.includes('--');
	const authDomain = String(process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || '').trim();
	if (isFirebasePreview && authDomain) {
		return `https://${authDomain.replace(/^https?:\/\//i, '').replace(/\/+$/, '')}/verify-email`;
	}
	return `${origin}/verify-email`;
};

const getEmailVerificationSettings = (): ActionCodeSettings => ({
	url: getEmailVerificationReturnUrl(),
	handleCodeInApp: false,
});

export const sendCurrentUserEmailVerification = async (): Promise<void> => {
	if (!isEmailVerificationRequired()) return;
	const firebaseUser = auth.currentUser;
	if (!firebaseUser) {
		throw new Error('Sign in before requesting a verification email.');
	}
	if (firebaseUser.emailVerified) return;

	await sendEmailVerification(firebaseUser, getEmailVerificationSettings());
};

export const refreshCurrentUserEmailVerification = async (): Promise<boolean> => {
	const firebaseUser = auth.currentUser;
	if (!firebaseUser) return false;

	await reload(firebaseUser);
	if (firebaseUser.emailVerified) {
		await firebaseUser.getIdToken(true);
	}
	return firebaseUser.emailVerified;
};

export const finalizeCurrentUserEmailVerification = async (): Promise<User> => {
	const verificationRequired = isEmailVerificationRequired();
	const verified = verificationRequired
		? await refreshCurrentUserEmailVerification()
		: Boolean(auth.currentUser?.emailVerified);
	if ((verificationRequired && !verified) || !auth.currentUser) {
		throw new Error(
			'Your email is not verified yet. Open the link in your email, then try again.',
		);
	}

	await callFirebaseFunction<Record<string, never>, { status: 'active' }>(
		'finalizeEmailVerification',
		{},
	);
	return getUserProfile(auth.currentUser.uid);
};

export const reconcileCurrentUserEmailVerification = async (
	user: User,
): Promise<User> => {
	if (user.registrationStatus !== 'pending_email_verification') return user;

	try {
		const verificationRequired = isEmailVerificationRequired();
		const verified = verificationRequired
			? await refreshCurrentUserEmailVerification()
			: Boolean(auth.currentUser?.emailVerified);
		if ((verificationRequired && !verified) || !auth.currentUser) return user;

		await callFirebaseFunction<Record<string, never>, { status: 'active' }>(
			'finalizeEmailVerification',
			{},
		);
		return getUserProfile(auth.currentUser.uid);
	} catch (error) {
		console.warn(
			'Email verification could not be reconciled during sign in.',
			error,
		);
		return user;
	}
};
