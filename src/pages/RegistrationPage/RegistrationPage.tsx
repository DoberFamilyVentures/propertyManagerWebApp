import { useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RegistrationCard } from '../../Components/RegistrationCard/RegistrationCard';
import { Wrapper } from './RegistrationPage.styles';
import { isNativeApp } from '../../utils/platform';
import { openRegistrationInBrowser } from '../../utils/authLinks';
import { LoadingState } from '../../Components/LoadingState';
import { RootState } from '../../Redux/store/store';
import { USER_ROLES } from '../../constants/roles';
import { isEmailVerificationRequired } from '../../config/emailVerificationPolicy';

export const RegistrationPage = () => {
	const navigate = useNavigate();
	const location = useLocation();
	const currentUser = useSelector((state: RootState) => state.user.currentUser);
	const authLoading = useSelector((state: RootState) => state.user.authLoading);
	const pendingCheckoutPlan = currentUser?.subscription?.pendingCheckoutPlan;
	const isContinuingComplimentaryAccess =
		new URLSearchParams(location.search).get('continue') ===
		'complimentary-access';

	useEffect(() => {
		if (!isNativeApp()) return;

		void openRegistrationInBrowser().finally(() => {
			navigate('/login', { replace: true });
		});
	}, [navigate]);

	if (isNativeApp()) {
		return (
			<LoadingState
				loadingKey="registration"
				title="Opening signup"
				message="Opening secure signup in your browser."
				steps={[
					'Opening secure signup...',
					'Preparing your account setup...',
					'Almost ready...',
				]}
			/>
		);
	}

	if (authLoading) {
		return <LoadingState />;
	}

	if (
		isEmailVerificationRequired() &&
		currentUser?.registrationStatus === 'pending_email_verification'
	) {
		return <Navigate to="/verify-email" replace />;
	}

	if (pendingCheckoutPlan && !isContinuingComplimentaryAccess) {
		return <Navigate to="/checkout/start" replace />;
	}

	if (currentUser && !isContinuingComplimentaryAccess) {
		return (
			<Navigate
				to={
					currentUser.role === USER_ROLES.TENANT
						? '/tenant-profile'
						: '/dashboard'
				}
				replace
			/>
		);
	}

	return (
		<Wrapper>
			<RegistrationCard />
		</Wrapper>
	);
};
