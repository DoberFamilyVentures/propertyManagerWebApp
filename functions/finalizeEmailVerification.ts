import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { isEmailVerificationRequired } from './emailVerificationRequirement';

if (!admin.apps.length) {
	admin.initializeApp();
}

const db = admin.firestore();

export const finalizeEmailVerification = functions.https.onCall(
	async (_data: Record<string, never>, context) => {
		if (!context.auth?.uid) {
			throw new functions.https.HttpsError(
				'unauthenticated',
				'Sign in before confirming your email.',
			);
		}

		const userRecord = await admin.auth().getUser(context.auth.uid);
		const verificationRequired = isEmailVerificationRequired();
		if (verificationRequired && !userRecord.emailVerified) {
			throw new functions.https.HttpsError(
				'failed-precondition',
				'Your email is not verified yet.',
			);
		}

		const userRef = db.collection('users').doc(context.auth.uid);
		const userSnapshot = await userRef.get();
		if (!userSnapshot.exists) {
			throw new functions.https.HttpsError(
				'not-found',
				'Your Maintley profile could not be found.',
			);
		}

		const user = userSnapshot.data() || {};
		const updates: Record<string, unknown> = {
			updatedAt: admin.firestore.FieldValue.serverTimestamp(),
		};
		if (userRecord.emailVerified) {
			updates.emailVerifiedAt = admin.firestore.FieldValue.serverTimestamp();
		}
		if (user.registrationStatus === 'pending_email_verification') {
			updates.registrationStatus = 'active';
		}

		await userRef.set(updates, { merge: true });

		return {
			status: 'active' as const,
			emailVerified: userRecord.emailVerified,
			verificationRequired,
		};
	},
);
