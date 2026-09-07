import { act, renderHook } from '@testing-library/react';
import { addMaintenanceRequest, convertRequestToTask } from '../../Redux/Slices/maintenanceRequestsSlice';
import type { MaintenanceRequestItem } from '../../types/MaintenanceRequest.types';
import type { TaskData } from '../../types/Task.types';
import { uploadMaintenanceRequestFiles } from '../../utils/maintenanceRequestUpload';
import { createMaintenanceRequestUtil } from './PropertyDetailPage.utils';
import { useMaintenanceRequestHandlers } from './useMaintenanceRequestHandlers';

const mockDispatch = jest.fn();
const mockNotify = jest.fn();

jest.mock('react-redux', () => ({
	useDispatch: () => mockDispatch,
}));

jest.mock('../../utils/maintenanceRequestUpload', () => ({
	uploadMaintenanceRequestFiles: jest.fn(),
}));

jest.mock('./PropertyDetailPage.utils', () => ({
	createMaintenanceRequestUtil: jest.fn(),
}));

jest.mock('../../Components/Library/AppFeedback/AppFeedbackProvider', () => ({
	useAppFeedback: () => ({ notify: mockNotify }),
}));

const mockedUploadMaintenanceRequestFiles =
	uploadMaintenanceRequestFiles as jest.MockedFunction<
		typeof uploadMaintenanceRequestFiles
	>;
const mockedCreateMaintenanceRequest =
	createMaintenanceRequestUtil as jest.MockedFunction<
		typeof createMaintenanceRequestUtil
	>;

const property = {
	id: 'property-1',
	title: 'Maple Street Home',
	maintenanceRequests: [] as MaintenanceRequestItem[],
};

const currentUser = {
	id: 'user-1',
	firstName: 'Alex',
	lastName: 'Homeowner',
	email: 'alex@example.com',
};

const createdRequest: MaintenanceRequestItem = {
	id: 'request-1',
	propertyId: property.id,
	propertyTitle: property.title,
	title: 'No heat downstairs',
	description: 'The downstairs vents are blowing cold air.',
	priority: 'High',
	status: 'Pending',
	category: 'HVAC',
	requestedBy: currentUser.id,
	requestedByEmail: currentUser.email,
	requestedDate: '2026-09-07T14:00:00.000Z',
	submittedBy: currentUser.id,
	submittedByName: 'Alex Homeowner',
};

describe('useMaintenanceRequestHandlers regression coverage', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.useFakeTimers();
		jest.setSystemTime(new Date('2026-09-07T14:00:00.000Z'));
		mockedUploadMaintenanceRequestFiles.mockResolvedValue([]);
		mockedCreateMaintenanceRequest.mockReturnValue(createdRequest);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it('uploads native files, adds the pending request, and emits the existing notification action', async () => {
		const attachment = new File(['photo'], 'vent.jpg', {
			type: 'image/jpeg',
		});
		const uploadedAttachment = {
			url: 'https://example.com/vent.jpg',
			name: 'vent.jpg',
			size: attachment.size,
			type: attachment.type,
		};
		mockedUploadMaintenanceRequestFiles.mockResolvedValue([uploadedAttachment]);

		const { result } = renderHook(() =>
			useMaintenanceRequestHandlers(property, currentUser),
		);

		act(() => result.current.setShowMaintenanceRequestModal(true));

		await act(async () => {
			await result.current.handleMaintenanceRequestSubmit({
				title: createdRequest.title,
				description: createdRequest.description,
				priority: 'High',
				category: 'HVAC',
				files: [attachment],
			});
		});

		expect(mockedUploadMaintenanceRequestFiles).toHaveBeenCalledWith(
			[attachment],
			property.id,
		);
		expect(mockedCreateMaintenanceRequest).toHaveBeenCalledWith(
			{
				title: createdRequest.title,
				description: createdRequest.description,
				priority: 'High',
				category: 'HVAC',
				files: [uploadedAttachment],
			},
			property,
			currentUser,
		);
		expect(mockDispatch).toHaveBeenNthCalledWith(
			1,
			addMaintenanceRequest(createdRequest),
		);
		expect(mockDispatch).toHaveBeenNthCalledWith(2, {
			type: 'maintenance_request_created',
			data: {
				requestId: createdRequest.id,
				requestTitle: createdRequest.title,
				propertyId: property.id,
				propertyTitle: property.title,
				priority: createdRequest.priority,
			},
			status: 'unread',
			actionUrl: `/properties/${property.id}`,
			createdAt: '2026-09-07T14:00:00.000Z',
			updatedAt: '2026-09-07T14:00:00.000Z',
		});
		expect(mockNotify).toHaveBeenCalledWith(
			'Maintenance request submitted successfully!',
		);
		expect(result.current.showMaintenanceRequestModal).toBe(false);
	});

	it('does not add or announce a request when attachment upload fails', async () => {
		const uploadError = new Error('storage unavailable');
		const consoleError = jest
			.spyOn(console, 'error')
			.mockImplementation(() => undefined);
		mockedUploadMaintenanceRequestFiles.mockRejectedValue(uploadError);

		const { result } = renderHook(() =>
			useMaintenanceRequestHandlers(property, currentUser),
		);

		await act(async () => {
			await result.current.handleMaintenanceRequestSubmit({
				title: createdRequest.title,
				description: createdRequest.description,
				priority: 'High',
				category: 'HVAC',
			});
		});

		expect(mockedCreateMaintenanceRequest).not.toHaveBeenCalled();
		expect(mockDispatch).not.toHaveBeenCalled();
		expect(mockNotify).toHaveBeenCalledWith(
			'Failed to upload files. Please try again.',
		);
		expect(consoleError).toHaveBeenCalledWith(
			'Failed to upload maintenance request files:',
			uploadError,
		);

		consoleError.mockRestore();
	});

	it('opens conversion from the property request and preserves the current completed-status action', async () => {
		const propertyWithRequest = {
			...property,
			maintenanceRequests: [createdRequest],
		};
		const { result } = renderHook(() =>
			useMaintenanceRequestHandlers(propertyWithRequest, currentUser),
		);

		act(() => result.current.handleConvertRequestToTask(createdRequest.id));

		expect(result.current.convertingRequest).toBe(createdRequest);
		expect(result.current.showConvertModal).toBe(true);

		await act(async () => {
			await result.current.handleConvertToTask({
				title: 'Inspect downstairs heating',
				status: 'Initiated',
				dueDate: '2026-09-14',
			} as TaskData);
		});

		expect(mockDispatch).toHaveBeenCalledTimes(1);
		expect(mockDispatch).toHaveBeenCalledWith(
			convertRequestToTask(createdRequest.id),
		);
		expect(result.current.showConvertModal).toBe(false);
		expect(result.current.convertingRequest).toBeNull();
		expect(mockNotify).toHaveBeenCalledWith(
			'Maintenance request converted to task successfully!',
		);
	});
});
