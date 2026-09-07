import { render, screen } from '@testing-library/react';
import { useSelector } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RegistrationPage } from './RegistrationPage';

jest.mock('react-redux', () => ({
	useSelector: jest.fn(),
}));

jest.mock('../../utils/platform', () => ({
	isNativeApp: () => false,
}));

jest.mock('../../Components/LoadingState', () => ({
	LoadingState: ({ title }: { title?: string }) => <div>{title}</div>,
}));

jest.mock('../../Components/RegistrationCard/RegistrationCard', () => ({
	RegistrationCard: () => <div>Registration form</div>,
}));

describe('RegistrationPage checkout gate', () => {
	const originalRequirement = process.env.REACT_APP_REQUIRE_EMAIL_VERIFICATION;
	const originalProjectId = process.env.REACT_APP_FIREBASE_PROJECT_ID;

	beforeEach(() => {
		process.env.REACT_APP_REQUIRE_EMAIL_VERIFICATION = 'true';
		process.env.REACT_APP_FIREBASE_PROJECT_ID = 'maintleybeta';
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

	it('routes a newly created pending account to email verification before checkout', () => {
		(useSelector as unknown as jest.Mock).mockImplementation((selector) =>
			selector({
				user: {
					authLoading: false,
					currentUser: {
						id: 'user-123',
						role: 'admin',
						registrationStatus: 'pending_email_verification',
						subscription: {
							status: 'active',
							plan: 'homeowner',
							pendingCheckoutPlan: 'homeowner_plus',
						},
					},
				},
			}),
		);

		render(
			<MemoryRouter initialEntries={['/registration']}>
				<Routes>
					<Route path='/registration' element={<RegistrationPage />} />
					<Route path='/verify-email' element={<div>Verify email page</div>} />
				</Routes>
			</MemoryRouter>,
		);

		expect(screen.getByText('Verify email page')).toBeInTheDocument();
	});

	it('routes an exempt pending account to checkout instead of email verification', () => {
		process.env.REACT_APP_REQUIRE_EMAIL_VERIFICATION = 'false';
		(useSelector as unknown as jest.Mock).mockImplementation((selector) =>
			selector({
				user: {
					authLoading: false,
					currentUser: {
						id: 'user-123',
						role: 'admin',
						registrationStatus: 'pending_email_verification',
						subscription: {
							status: 'active',
							plan: 'homeowner',
							pendingCheckoutPlan: 'homeowner_plus',
						},
					},
				},
			}),
		);

		render(
			<MemoryRouter initialEntries={['/registration']}>
				<Routes>
					<Route path='/registration' element={<RegistrationPage />} />
					<Route path='/verify-email' element={<div>Verify email page</div>} />
					<Route path='/checkout/start' element={<div>Checkout start page</div>} />
				</Routes>
			</MemoryRouter>,
		);

		expect(screen.getByText('Checkout start page')).toBeInTheDocument();
		expect(screen.queryByText('Verify email page')).not.toBeInTheDocument();
	});

	it('does not enter the app while a paid checkout is pending', () => {
		(useSelector as unknown as jest.Mock).mockImplementation((selector) =>
			selector({
				user: {
					authLoading: false,
					currentUser: {
						id: 'user-123',
						role: 'admin',
						subscription: {
							status: 'active',
							plan: 'homeowner',
							pendingCheckoutPlan: 'homeowner_plus',
						},
					},
				},
			}),
		);

		render(
			<MemoryRouter
				initialEntries={['/registration']}
				future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
			>
				<Routes>
					<Route path="/registration" element={<RegistrationPage />} />
					<Route
						path="/checkout/start"
						element={<div>Checkout start page</div>}
					/>
				</Routes>
			</MemoryRouter>,
		);

		expect(screen.getByText('Checkout start page')).toBeInTheDocument();
		expect(screen.queryByText('Registration form')).not.toBeInTheDocument();
	});
});
