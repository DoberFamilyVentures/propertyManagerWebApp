import { createMaintenanceRequestUtil } from './PropertyDetailPage.utils';

describe('createMaintenanceRequestUtil regression coverage', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date('2026-09-07T14:00:00.000Z'));
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it('preserves the existing pending request shape and attachment metadata', () => {
		const image = {
			name: 'air-handler.jpg',
			url: 'https://example.com/air-handler.jpg',
			size: 2048,
			type: 'image/jpeg',
		};
		const document = {
			name: 'notes.pdf',
			url: 'https://example.com/notes.pdf',
			size: 4096,
			type: 'application/pdf',
		};

		const result = createMaintenanceRequestUtil(
			{
				title: 'No heat downstairs',
				description: 'The downstairs vents are blowing cold air.',
				priority: 'High',
				category: 'HVAC',
				files: [image, document],
			},
			{ id: 'property-1', title: 'Maple Street Home' },
			{
				id: 'user-1',
				firstName: 'Alex',
				lastName: 'Homeowner',
				email: 'alex@example.com',
			},
		);

		expect(result).toMatchObject({
			title: 'No heat downstairs',
			description: 'The downstairs vents are blowing cold air.',
			priority: 'High',
			category: 'HVAC',
			status: 'Pending',
			propertyId: 'property-1',
			propertyTitle: 'Maple Street Home',
			requestedBy: 'user-1',
			requestedByEmail: 'alex@example.com',
			requestedDate: '2026-09-07T14:00:00.000Z',
			submittedBy: 'user-1',
			submittedByName: 'Alex Homeowner',
			files: [image, document],
			images: [image.url],
		});
		expect(result.id).toMatch(/^req-/);
		expect(result).not.toHaveProperty('accountId');
		expect(result).not.toHaveProperty('serviceWorkRequestId');
	});
});
