import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from './Redux/store/store';
import { logout } from './Redux/Slices/userSlice';
import { LoadingState } from './Components/LoadingState';
import { USER_ROLES } from './constants/roles';
import type { UserRole } from './constants/roles';
import { isSubscriptionActive } from './utils/subscriptionUtils';
import { isEmailVerificationRequired } from './config/emailVerificationPolicy';

interface ProtectedRoutesProps {
	children: React.ReactNode;
	requiredRoles?: readonly UserRole[];
	requireSubscription?: boolean;
	subscriptionFeature?: string; // For future feature-specific checks
	allowExpiredUsers?: boolean; // Allow users with expired trials to access this route
}

export const ProtectedRoutes = ({
	children,
	requiredRoles = [],
	requireSubscription = false,
	subscriptionFeature: _subscriptionFeature,
	allowExpiredUsers = false,
}: ProtectedRoutesProps) => {
	const dispatch = useDispatch();
	const currentUser = useSelector((state: RootState) => state.user.currentUser);
	const isLoading = useSelector((state: RootState) => state.user.authLoading);
	const location = useLocation();

	// Auto-logout if currentUser becomes undefined after initial load
	useEffect(() => {
		if (!isLoading && !currentUser) {
			// Clear any stored session data
			localStorage.removeItem('loggedUser');
			// Dispatch logout to ensure state is clean
			dispatch(logout());
		}
	}, [currentUser, isLoading, dispatch]);

	useEffect(() => {
		const handleActiveRoute = () => {
			// This can be expanded to include analytics or other side effects on route change
			dispatch({ type: 'navigation/setActiveRoute', payload: location.pathname });
		}
		handleActiveRoute();
	}, [location, dispatch]);

	// Show loading state while auth is being initialized
	if (isLoading) {
		return <LoadingState />;
	}

	const isLoginRoute =
		location.pathname === '/login' ||
		location.pathname === '/login/' ||
		location.pathname === '/forgot-password' ||
		location.pathname === '/forgot-password/';
	const isCheckoutRecoveryRoute =
		location.pathname === '/checkout/start' ||
		location.pathname === '/checkout/complete' ||
		location.pathname === '/paywall';
	const isEmailVerificationRoute =
		location.pathname === '/verify-email' ||
		location.pathname === '/verify-email/';

	if (
		isEmailVerificationRequired() &&
		currentUser?.registrationStatus === 'pending_email_verification' &&
		!isEmailVerificationRoute
	) {
		return <Navigate to='/verify-email' replace />;
	}

	if (
		currentUser?.subscription?.pendingCheckoutPlan &&
		!isCheckoutRecoveryRoute &&
		!isEmailVerificationRoute
	) {
		return <Navigate to='/checkout/start' replace />;
	}

	// If authenticated and on login page, redirect to dashboard
	if (currentUser && isLoginRoute) {
		return (
			<Navigate
				to={currentUser.role === USER_ROLES.TENANT ? '/tenant-profile' : '/dashboard'}
				replace
			/>
		);
	}

	// If not authenticated and not on login page, redirect to login
	if (!currentUser && !isLoginRoute) {
		return <Navigate to='/login' replace />;
	}

	// Check role authorization if required roles specified
	if (
		requiredRoles.length > 0 &&
		currentUser &&
		!requiredRoles.includes(currentUser.role as UserRole)
	) {
		return <Navigate to='/unauthorized' replace />;
	}

	// Check subscription requirements
	if (requireSubscription && currentUser) {
		if (currentUser.isTeamMemberAccount === true) {
			return <>{children}</>;
		}

		if (!currentUser.subscription) {
			return <Navigate to='/paywall' replace />;
		}

		const isActive = isSubscriptionActive(currentUser.subscription);
		const isExpired = currentUser.subscription.status === 'expired';

		// Allow access if subscription is active OR if expired users are allowed for this route
		if (!isActive && !(allowExpiredUsers && isExpired)) {
			return <Navigate to='/paywall' replace />;
		}
	}

	// Authenticated and authorized: render children
	return <>{children}</>;
};
