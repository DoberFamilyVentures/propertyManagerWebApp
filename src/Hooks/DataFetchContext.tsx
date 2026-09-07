import React, {
	createContext,
	useContext,
	useEffect,
	useState,
	ReactNode,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../Redux/store/store';
import { useGetPropertiesQuery } from '../Redux/API/propertySlice';
import { useGetPropertyGroupsQuery } from '../Redux/API/propertySlice';
import { setPropertyGroups, setTasks } from '../Redux/Slices/propertyDataSlice';
import { setTeamGroups } from '../Redux/Slices/teamSlice';
import { hideAppLoading, showAppLoading } from '../Redux/Slices/appSlice';
import { useGetTasksQuery } from '../Redux/API/taskSlice';
import {
	useGetTeamGroupsQuery,
	useGetTeamMembersQuery,
} from '../Redux/API/teamSlice';
import type { Property, PropertyGroup } from '../types/Property.types';
import { isEmailVerificationRequired } from '../config/emailVerificationPolicy';

interface DataFetchContextType {
	isInitialLoadComplete: boolean;
	isLoading: boolean;
	error: string | null;
}

const DataFetchContext = createContext<DataFetchContextType>({
	isInitialLoadComplete: false,
	isLoading: true,
	error: null,
});

export const useDataFetch = () => {
	const context = useContext(DataFetchContext);
	if (!context) {
		throw new Error('useDataFetch must be used within DataFetchProvider');
	}
	return context;
};

interface DataFetchProviderProps {
	children: ReactNode;
}

const INITIAL_DATA_LOADING_STEPS = [
	'Preparing your dashboard...',
	'Loading your properties...',
	'Building your property timeline...',
	'Checking upcoming maintenance...',
	'Reviewing Maintley Intelligence recommendations...',
	'Organizing your documents...',
	'Indexing warranties...',
	'Reading equipment information...',
	'Reviewing your property...',
	'Connecting maintenance history...',
	'Looking for missing documentation...',
	'Building maintenance insights...',
	'Organizing your home information...',
	'Almost ready...',
];

export const DataFetchProvider: React.FC<DataFetchProviderProps> = ({
	children,
}) => {
	const dispatch = useDispatch<AppDispatch>();
	const currentUser = useSelector((state: RootState) => state.user.currentUser);
	const canLoadAppData =
		Boolean(currentUser) &&
		(!isEmailVerificationRequired() ||
			currentUser?.registrationStatus !== 'pending_email_verification');
	const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Fetch all data
	const {
		data: propertyGroups = [],
		isLoading: groupsLoading,
		error: groupsError,
	} =
		useGetPropertyGroupsQuery(undefined, { skip: !canLoadAppData });
	const {
		data: properties = [],
		isLoading: propertiesLoading,
		error: propertiesError,
	} = useGetPropertiesQuery(undefined, {
		skip: !canLoadAppData,
	});
	const { data: tasks = [], isLoading: tasksLoading, error: tasksError } = useGetTasksQuery(
		undefined,
		{ skip: !canLoadAppData },
	);
	const { data: teamGroups = [], isLoading: teamGroupsLoading, error: teamGroupsError } =
		useGetTeamGroupsQuery(undefined, { skip: !canLoadAppData });
	const { isLoading: teamMembersLoading, error: teamMembersError } = useGetTeamMembersQuery(undefined, {
		skip: !canLoadAppData,
	});

	const isLoading =
		groupsLoading ||
		propertiesLoading ||
		tasksLoading ||
		teamGroupsLoading ||
		teamMembersLoading;

	useEffect(() => {
		if (!canLoadAppData || !isLoading) {
			dispatch(hideAppLoading('initial-data'));
			return;
		}

		dispatch(
			showAppLoading({
				key: 'initial-data',
				title: 'Loading Maintley',
				message: 'Preparing your dashboard...',
				steps: INITIAL_DATA_LOADING_STEPS,
			}),
		);

		return () => {
			dispatch(hideAppLoading('initial-data'));
		};
	}, [canLoadAppData, dispatch, isLoading]);

	// Track initial load
	useEffect(() => {
		if (!canLoadAppData || !currentUser) {
			setIsInitialLoadComplete(false);
			return;
		}

		if (isLoading) {
			return;
		}

		const queryErrors = [
			{ key: 'propertyGroups', error: groupsError },
			{ key: 'properties', error: propertiesError },
			{ key: 'tasks', error: tasksError },
			{ key: 'teamGroups', error: teamGroupsError },
			{ key: 'teamMembers', error: teamMembersError },
		].filter((entry) => Boolean(entry.error));

		if (queryErrors.length > 0) {
			const firstError = queryErrors[0] as any;
			const firstErrorValue = firstError.error;
			const message =
				typeof firstErrorValue === 'string'
					? firstErrorValue
					: firstErrorValue?.data ||
					  firstErrorValue?.error ||
					  'Failed to fetch initial data';
			setError(String(message));
			console.warn(
				'DataFetchContext query errors detected:',
				queryErrors.map((entry: any) => ({
					key: entry.key,
					error:
						typeof entry.error === 'string'
							? entry.error
							: entry.error?.data || entry.error?.error || entry.error,
				})),
			);
		}

		// Keep Redux cache in sync with the latest query data.
		const normalizedGroups: PropertyGroup[] = propertyGroups.map((g) => ({
			...g,
			properties: (g.properties || []) as Property[],
		}));

		const allGroupPropertiesEmpty =
			normalizedGroups.length > 0 &&
			normalizedGroups.every((group) => (group.properties || []).length === 0);

		const hydratedGroups: PropertyGroup[] =
			allGroupPropertiesEmpty && properties.length > 0
				? (() => {
						const groupsClone: PropertyGroup[] = normalizedGroups.map((group) => ({
							...group,
							properties: [] as Property[],
						}));

						const hasAssignableGroupIds = properties.some(
							(property: any) => !!property.groupId,
						);

						if (hasAssignableGroupIds) {
							const groupById = new Map<string, PropertyGroup>(
								groupsClone.map((group) => [group.id, group]),
							);
							for (const property of properties as Property[]) {
								if (property.groupId && groupById.has(property.groupId)) {
									const matchedGroup = groupById.get(property.groupId);
									if (matchedGroup) {
										matchedGroup.properties = [
											...(matchedGroup.properties || []),
											property,
										];
									}
								}
							}
							return groupsClone;
						}

						const preferredGroup =
							groupsClone.find(
								(group) => group.name?.toLowerCase() === 'my properties',
							) ||
							groupsClone[0];

						if (preferredGroup) {
							preferredGroup.properties = [...(properties as Property[])];
						}

						return groupsClone;
				  })()
				: normalizedGroups;

		const groupedPropertyIds = new Set<string>(
			hydratedGroups
				.flatMap((group) => (group.properties || []).map((property) => property.id))
				.filter(Boolean),
		);
		const ungroupedProperties = (properties as Property[]).filter(
			(property) => !groupedPropertyIds.has(property.id),
		);

		let hydratedWithUngrouped = [...hydratedGroups];
		if (ungroupedProperties.length > 0) {
			const existingUngroupedGroup = hydratedWithUngrouped.find(
				(group) => group.name?.toLowerCase() === 'ungrouped properties',
			);

			if (existingUngroupedGroup) {
				existingUngroupedGroup.properties = [
					...(existingUngroupedGroup.properties || []),
					...ungroupedProperties,
				];
			} else {
				hydratedWithUngrouped = [
					...hydratedWithUngrouped,
					{
						id: `virtual-${currentUser.id}-ungrouped-properties`,
						name: 'Ungrouped Properties',
						userId: currentUser.id,
						accountId: currentUser.accountId || currentUser.id,
						properties: ungroupedProperties,
						createdAt: new Date().toISOString(),
						updatedAt: new Date().toISOString(),
					},
				];
			}
		}

		const groupsToDispatch =
			hydratedWithUngrouped.length === 0 && properties.length > 0
				? [
						{
							id: `virtual-${currentUser.id}-all-properties`,
							name: 'Ungrouped Properties',
							userId: currentUser.id,
							accountId: currentUser.accountId || currentUser.id,
							properties,
							createdAt: new Date().toISOString(),
							updatedAt: new Date().toISOString(),
						},
				  ]
				: hydratedWithUngrouped;

		dispatch(setPropertyGroups(groupsToDispatch));
		dispatch(setTasks(tasks)); // Make sure setTasks expects assignedTo as an object, not a string
		dispatch(
			setTeamGroups(
				teamGroups.map((g) => ({
					...g,
					members: g.members || [],
				})),
			),
		);

		if (!isInitialLoadComplete) {
			setIsInitialLoadComplete(true);
		}
		setError(null);
	}, [
		canLoadAppData,
		currentUser,
		groupsLoading,
		propertiesLoading,
		tasksLoading,
		teamGroupsLoading,
		teamMembersLoading,
		propertyGroups,
		properties,
		tasks,
		teamGroups,
		groupsError,
		propertiesError,
		tasksError,
		teamGroupsError,
		teamMembersError,
		dispatch,
		isInitialLoadComplete,
		isLoading,
	]);

	return (
		<DataFetchContext.Provider
			value={{
				isInitialLoadComplete,
				isLoading,
				error,
			}}>
			{children}
		</DataFetchContext.Provider>
	);
};
