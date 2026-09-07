import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoutes } from './ProtectedRoutes';

const mockDispatch = jest.fn();
let mockState: any;

jest.mock('react-redux', () => ({
	useDispatch: () => mockDispatch,
	useSelector: (selector: any) => selector(mockState),
}));

jest.mock('./Redux/Slices/userSlice', () => ({
	logout: () => ({ type: 'user/logout' }),
}));

jest.mock('./utils/subscriptionUtils', () => ({
	isSubscriptionActive: (subscription: any) =>
		subscription?.status === 'active' || subscription?.status === 'trial',
}));

const renderProtectedRoute = (
	path: string,
	options: { requireSubscription?: boolean; allowExpiredUsers?: boolean } = {},
) => {
	const { requireSubscription = false, allowExpiredUsers = false } = options;

	return render(
		<MemoryRouter
			initialEntries={[path]}
			future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
			<Routes>
				<Route path='/login' element={<div>Login Page</div>} />
				<Route path='/verify-email' element={<div>Verify Email Page</div>} />
				<Route path='/paywall' element={<div>Paywall Page</div>} />
				<Route path='/checkout/start' element={<div>Checkout Start Page</div>} />
				<Route
					path='/report'
					element={
						<ProtectedRoutes
							requireSubscription={requireSubscription}
							allowExpiredUsers={allowExpiredUsers}>
							<div>Report Page</div>
						</ProtectedRoutes>
					}
				/>
			</Routes>
		</MemoryRouter>,
	);
};

describe('ProtectedRoutes', () => {
	const originalRequirement = process.env.REACT_APP_REQUIRE_EMAIL_VERIFICATION;
	const originalProjectId = process.env.REACT_APP_FIREBASE_PROJECT_ID;

	beforeEach(() => {
		mockDispatch.mockClear();
		process.env.REACT_APP_REQUIRE_EMAIL_VERIFICATION = 'true';
		process.env.REACT_APP_FIREBASE_PROJECT_ID = 'maintleybeta';
		mockState = {
			user: {
				currentUser: null,
				authLoading: false,
			},
		};
	});

	it('redirects unauthenticated users to login', () => {
		renderProtectedRoute('/report');

		expect(screen.getByText('Login Page')).toBeInTheDocument();
	});

	it('keeps protected routes on a loading state while auth is unresolved', () => {
		mockState.user.authLoading = true;

		renderProtectedRoute('/report');

		expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
		expect(screen.queryByText('Report Page')).not.toBeInTheDocument();
	});

	it('redirects authenticated users without subscription to paywall when required', () => {
		mockState.user.currentUser = {
			id: 'u1',
			email: 'user@test.com',
			role: 'homeowner',
		};

		renderProtectedRoute('/report', { requireSubscription: true });

		expect(screen.getByText('Paywall Page')).toBeInTheDocument();
	});

	afterAll(() => {
		if (originalRequirement === undefined) {
			delete process.env.REACT_APP_REQUIRE_EMAIL_VERIFICATION;
		} else {
			process.env.REACT_APP_REQUIRE_EMAIL_VERIFICATION = originalRequirement;
		}
		if (originalProjectId === undefined) {
			delete process.env.REACT_APP_FIREBASE_PROJECT_ID;
		} else {
			process.env.REACT_APP_FIREBASE_PROJECT_ID = originalProjectId;
		}
	});

	it('keeps newly registered users out of the app until email verification', () => {
		mockState.user.currentUser = {
			id: 'u1',
			email: 'pending@test.com',
			role: 'admin',
			registrationStatus: 'pending_email_verification',
			subscription: {
				status: 'active',
				plan: 'homeowner',
				currentPeriodStart: 1,
				currentPeriodEnd: 2,
			},
		};

		renderProtectedRoute('/report');

		expect(screen.getByText('Verify Email Page')).toBeInTheDocument();
		expect(screen.queryByText('Report Page')).not.toBeInTheDocument();
	});

	it('allows a pending profile through in an explicitly exempt environment', () => {
		process.env.REACT_APP_REQUIRE_EMAIL_VERIFICATION = 'false';
		mockState.user.currentUser = {
			id: 'u1',
			email: 'pending@test.com',
			role: 'admin',
			registrationStatus: 'pending_email_verification',
			subscription: {
				status: 'active',
				plan: 'homeowner',
				currentPeriodStart: 1,
				currentPeriodEnd: 2,
			},
		};

		renderProtectedRoute('/report');

		expect(screen.getByText('Report Page')).toBeInTheDocument();
		expect(screen.queryByText('Verify Email Page')).not.toBeInTheDocument();
	});

	it('grandfathers existing users without a registration status', () => {
		mockState.user.currentUser = {
			id: 'legacy-user',
			email: 'legacy@test.com',
			role: 'admin',
		};

		renderProtectedRoute('/report');

		expect(screen.getByText('Report Page')).toBeInTheDocument();
	});

	it('recovers an authenticated pending checkout before entering the app', () => {
		mockState.user.currentUser = {
			id: 'u1',
			email: 'user@test.com',
			role: 'homeowner',
			subscription: {
				status: 'active',
				plan: 'homeowner',
				currentPeriodStart: 1,
				currentPeriodEnd: 1,
				pendingCheckoutPlan: 'homeowner_plus',
			},
		};

		renderProtectedRoute('/report');

		expect(screen.getByText('Checkout Start Page')).toBeInTheDocument();
		expect(screen.queryByText('Report Page')).not.toBeInTheDocument();
	});

	it('redirects users with expired subscription when expired access is not allowed', () => {
		mockState.user.currentUser = {
			id: 'u1',
			email: 'user@test.com',
			role: 'homeowner',
			subscription: {
				status: 'expired',
				plan: 'homeowner',
				currentPeriodStart: 1,
				currentPeriodEnd: 1,
			},
		};

		renderProtectedRoute('/report', { requireSubscription: true });

		expect(screen.getByText('Paywall Page')).toBeInTheDocument();
	});

	it('allows users with active subscription when subscription is required', () => {
		mockState.user.currentUser = {
			id: 'u1',
			email: 'user@test.com',
			role: 'homeowner',
			subscription: {
				status: 'active',
				plan: 'homeowner',
				currentPeriodStart: 1,
				currentPeriodEnd: 1,
			},
		};

		renderProtectedRoute('/report', { requireSubscription: true });

		expect(screen.getByText('Report Page')).toBeInTheDocument();
	});

	it('allows expired users when allowExpiredUsers is true', () => {
		mockState.user.currentUser = {
			id: 'u1',
			email: 'user@test.com',
			role: 'homeowner',
			subscription: {
				status: 'expired',
				plan: 'homeowner',
				currentPeriodStart: 1,
				currentPeriodEnd: 1,
			},
		};

		renderProtectedRoute('/report', {
			requireSubscription: true,
			allowExpiredUsers: true,
		});

		expect(screen.getByText('Report Page')).toBeInTheDocument();
	});
});
