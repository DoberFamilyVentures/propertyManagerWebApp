import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
	beginAuthTransition,
	setCurrentUser,
	updateEntitlementProjection,
	updateSubscriptionFromStripe,
	setAuthLoading,
} from './Redux/Slices/userSlice';
import { isAccountDeletionSessionActive } from './services/accountDeletionSession';
import type { AppDispatch, RootState } from './Redux/store/store';
import { RouterComponent } from './router';
import { DataFetchProvider } from './Hooks/DataFetchContext';
import { onAuthStateChange } from './services/authSession';
import styled from 'styled-components';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { initializePushNotifications } from './services/pushNotifications';
import { setIsMobile } from './Redux/Slices/appSlice';
import { AppFeedbackProvider } from './Components/Library/AppFeedback/AppFeedbackProvider';
import { canUseNotifications } from './utils/subscriptionUtils';
import { COLORS } from './constants/colors';
import { SplashScreen } from './Components/Library/SplashScreen';
import { clearAccountScopedClientState } from './Redux/utils/clearAccountScopedClientState';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './config/firebase';
import type { User } from './Redux/Slices/userSlice';
import { syncSubscriptionFromStripe } from './services/stripeService';
import { recordCurrentUserActivity } from './services/userActivityService';
import { isEmailVerificationRequired } from './config/emailVerificationPolicy';

const USER_ACTIVITY_HEARTBEAT_INTERVAL_MS = 15 * 60 * 1000;

type SystemBarType = 'StatusBar' | 'NavigationBar';

interface SystemBarsPlugin {
	hide(options?: { type?: SystemBarType }): Promise<void>;
}

let systemBarsPlugin: SystemBarsPlugin | null = null;

const getSystemBars = (): SystemBarsPlugin => {
	if (systemBarsPlugin) {
		return systemBarsPlugin;
	}

	const existingSystemBars = (Capacitor as any).Plugins?.SystemBars as
		| SystemBarsPlugin
		| undefined;

	systemBarsPlugin =
		existingSystemBars || registerPlugin<SystemBarsPlugin>('SystemBars');

	return systemBarsPlugin;
};

const RefreshSpinner = styled.div<{ $isVisible: boolean }>`
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	z-index: 9999;
	display: ${(props) => (props.$isVisible ? 'flex' : 'none')};
	justify-content: center;
	align-items: center;
	padding: 20px;
	background: ${COLORS.gradientPrimary};
	color: ${COLORS.white};
	font-size: 16px;
	font-weight: 600;
	box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);

	.spinner {
		width: 24px;
		height: 24px;
		border: 3px solid rgba(255, 255, 255, 0.3);
		border-top: 3px solid white;
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin-right: 12px;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
`;

export const App = () => {
	const dispatch = useDispatch<AppDispatch>();
	const authLoading = useSelector((state: RootState) => state.user.authLoading);
	const currentUser = useSelector((state: RootState) => state.user.currentUser);
	const appLoading = useSelector((state: RootState) => state.app.loading);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const currentUserIdRef = useRef<string | null>(null);
	const resolvedAuthUserIdRef = useRef<string | null | undefined>(undefined);
	const pushNotificationsInitializedRef = useRef(false);
	const stripeSyncKeyRef = useRef('');
	const isPendingEmailVerification =
		isEmailVerificationRequired() &&
		currentUser?.registrationStatus === 'pending_email_verification';

	useEffect(() => {
		if ('scrollRestoration' in window.history) {
			window.history.scrollRestoration = 'manual';
		}
	}, []);

	useEffect(() => {
		currentUserIdRef.current = currentUser?.id || null;
	}, [currentUser?.id]);

	useEffect(() => {
		if (!currentUser?.id || isPendingEmailVerification) return undefined;

		const recordActivity = () => {
			if (document.visibilityState !== 'visible') return;
			recordCurrentUserActivity().catch((error) => {
				console.warn('User activity heartbeat could not be recorded:', error);
			});
		};
		const handleVisibilityChange = () => recordActivity();

		recordActivity();
		const intervalId = window.setInterval(
			recordActivity,
			USER_ACTIVITY_HEARTBEAT_INTERVAL_MS,
		);
		document.addEventListener('visibilitychange', handleVisibilityChange);

		return () => {
			window.clearInterval(intervalId);
			document.removeEventListener('visibilitychange', handleVisibilityChange);
		};
	}, [currentUser?.id, isPendingEmailVerification]);

	useEffect(() => {
		if (
			!currentUser?.id ||
			isPendingEmailVerification ||
			!currentUser.subscription?.stripeCustomerId
		) {
			stripeSyncKeyRef.current = '';
			return;
		}
		if (currentUser.isTeamMemberAccount || currentUser.isAccountOwner === false) {
			return;
		}

		const syncKey = `${currentUser.id}:${
			currentUser.subscription.stripeSubscriptionId ||
			currentUser.subscription.stripeCustomerId
		}`;
		if (stripeSyncKeyRef.current === syncKey) return;
		stripeSyncKeyRef.current = syncKey;

		syncSubscriptionFromStripe()
			.then((result) => {
				if (result.subscription) {
					dispatch(
						updateSubscriptionFromStripe({
							userId: currentUser.id,
							subscription: result.subscription,
						}),
					);
				}
				if (result.conflict) {
					console.warn(
						'Stripe subscription sync requires review:',
						result.reason,
					);
				}
			})
			.catch((error) => {
				console.warn('Background Stripe subscription sync skipped:', error);
			});
	}, [
		currentUser?.id,
		currentUser?.isAccountOwner,
		currentUser?.isTeamMemberAccount,
		currentUser?.subscription?.stripeCustomerId,
		currentUser?.subscription?.stripeSubscriptionId,
		isPendingEmailVerification,
		dispatch,
	]);

	useEffect(() => {
		if (!currentUser?.id || isPendingEmailVerification) return undefined;
		const accountId =
			String(currentUser.accountId || '').trim() || currentUser.id;

		return onSnapshot(
			doc(db, 'familyAccounts', accountId),
			(snapshot) => {
				const rawProjection = snapshot.data()?.effectiveEntitlementProjection;
				// A missing projection means this account snapshot has not supplied an
				// authoritative entitlement result. It must not erase a grant that was
				// already resolved during authentication. Grant revocation and expiration
				// write an explicit projection with an empty activeGrants array.
				if (
					!rawProjection ||
					typeof rawProjection !== 'object' ||
					Array.isArray(rawProjection)
				) {
					return;
				}
				const projection = {
					...rawProjection,
					calculatedAt:
						typeof rawProjection.calculatedAt?.toDate === 'function'
							? rawProjection.calculatedAt.toDate().toISOString()
							: rawProjection.calculatedAt,
				} as User['effectiveEntitlementProjection'];
				dispatch(updateEntitlementProjection({ accountId, projection }));
			},
			(error) => {
				if (isAccountDeletionSessionActive()) return;
				console.warn('Account access updates could not be loaded:', error);
			},
		);
	}, [currentUser?.accountId, currentUser?.id, dispatch, isPendingEmailVerification]);

	// Register push notifications on native app startup
	useEffect(() => {
		if (!Capacitor.isNativePlatform()) return;
		if (
			!currentUser?.id ||
			isPendingEmailVerification ||
			pushNotificationsInitializedRef.current
		) return;
		if (
			!currentUser?.subscription ||
			!canUseNotifications(currentUser.subscription)
		) {
			return;
		}

		pushNotificationsInitializedRef.current = true;
		initializePushNotifications(
			undefined,
			undefined,
			() => currentUserIdRef.current,
		);
	}, [currentUser?.id, currentUser?.subscription, isPendingEmailVerification]);

	useEffect(() => {
		// Listen to Firebase auth state changes to persist authentication
		const clearForAuthUserChange = (nextUserId: string | null) => {
			const previousUserId =
				currentUserIdRef.current || resolvedAuthUserIdRef.current || null;
			const hasResolvedAuth = resolvedAuthUserIdRef.current !== undefined;

			if (hasResolvedAuth && previousUserId !== nextUserId) {
				dispatch(beginAuthTransition());
				clearAccountScopedClientState(dispatch, {
					userId: previousUserId,
					clearLocalStorage: true,
				});
				pushNotificationsInitializedRef.current = false;
			}
		};

		const unsubscribe = onAuthStateChange(async (user) => {
			const nextUserId = user?.id || null;
			const previousUserId = resolvedAuthUserIdRef.current;

			if (previousUserId !== undefined && previousUserId !== nextUserId) {
				clearAccountScopedClientState(dispatch, {
					userId: previousUserId,
					clearLocalStorage: true,
				});
				pushNotificationsInitializedRef.current = false;
			}
			resolvedAuthUserIdRef.current = nextUserId;

			if (user) {
				dispatch(setCurrentUser(user));
			} else {
				dispatch(setCurrentUser(null));
			}
			// Auth check is complete - stop showing loading state
			dispatch(setAuthLoading(false));
		}, {
			onAuthUserResolving: clearForAuthUserChange,
		});

		// Cleanup subscription on unmount
		return () => {
			unsubscribe();
		};
	}, [dispatch]);

	useEffect(() => {
		const checkMobile = () => {
			dispatch(setIsMobile(window.innerWidth < 768));
		};

		checkMobile();
		window.addEventListener('resize', checkMobile);
		return () => window.removeEventListener('resize', checkMobile);
	}, [dispatch]);

	useEffect(() => {
		if (!Capacitor.isNativePlatform()) {
			return;
		}

		const hideStatusBar = async () => {
			try {
				await getSystemBars().hide({ type: 'StatusBar' });
			} catch (error) {
				console.warn('Unable to hide native status bar:', error);
			}
		};

		hideStatusBar();

		const onVisibilityChange = () => {
			if (document.visibilityState === 'visible') {
				hideStatusBar();
			}
		};

		document.addEventListener('visibilitychange', onVisibilityChange);

		let startY = 0;
		let isPulling = false;
		let triggered = false;
		let holdStartTime = 0;
		const threshold = 150; // Increased from 80 to 150 pixels
		const holdDuration = 500; // Require 500ms hold at threshold

		const getScrollTop = () =>
			window.scrollY || document.documentElement.scrollTop || 0;

		const onTouchStart = (event: TouchEvent) => {
			if (getScrollTop() !== 0) {
				return;
			}
			startY = event.touches[0].clientY;
			isPulling = true;
			triggered = false;
			holdStartTime = 0;
		};

		const onTouchMove = (event: TouchEvent) => {
			if (!isPulling || triggered) {
				return;
			}

			const currentY = event.touches[0].clientY;
			const delta = currentY - startY;

			if (delta > threshold) {
				// Start hold timer if not already started
				if (holdStartTime === 0) {
					holdStartTime = Date.now();
					setIsRefreshing(true); // Show spinner when threshold is reached
				} else {
					// Check if held long enough
					const holdTime = Date.now() - holdStartTime;
					if (holdTime >= holdDuration) {
						triggered = true;
						window.location.reload();
					}
				}
			} else {
				// Reset hold timer if user pulls back below threshold
				holdStartTime = 0;
				setIsRefreshing(false); // Hide spinner if pulled back
			}
		};

		const onTouchEnd = () => {
			isPulling = false;
			holdStartTime = 0;
			setIsRefreshing(false); // Hide spinner when touch ends
		};

		window.addEventListener('touchstart', onTouchStart, { passive: true });
		window.addEventListener('touchmove', onTouchMove, { passive: true });
		window.addEventListener('touchend', onTouchEnd);

		return () => {
			document.removeEventListener('visibilitychange', onVisibilityChange);
			window.removeEventListener('touchstart', onTouchStart);
			window.removeEventListener('touchmove', onTouchMove);
			window.removeEventListener('touchend', onTouchEnd);
		};
	}, []);

	if (authLoading) {
		return (
			<SplashScreen
				title='Getting Maintley ready'
				message='Loading your properties, tasks, and maintenance history.'
				steps={[
					'Preparing your dashboard...',
					'Loading your properties...',
					'Organizing your documents...',
					'Checking upcoming maintenance...',
					'Connecting maintenance history...',
					'Almost ready...',
				]}
			/>
		);
	}

	return (
		<DataFetchProvider>
			<AppFeedbackProvider>
				<RefreshSpinner $isVisible={isRefreshing}>
					<div className='spinner'></div>
					Refreshing...
				</RefreshSpinner>
				{appLoading.isLoading && (
					<SplashScreen
						title={appLoading.title}
						message={appLoading.message}
						steps={appLoading.steps}
						variant='overlay'
					/>
				)}
				<RouterComponent />
			</AppFeedbackProvider>
		</DataFetchProvider>
	);
};

export default App;
