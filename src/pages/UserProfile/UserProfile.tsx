import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { RootState, AppDispatch } from 'Redux/store';
import { setCurrentUser } from 'Redux/Slices/userSlice';
import {
	useGetAllMaintenanceHistoryForUserQuery,
	useUpdateUserMutation,
} from 'Redux/API/userSlice';
import { useGetPropertiesQuery } from 'Redux/API/propertySlice';
import { useGetAllDevicesQuery } from 'Redux/API/deviceSlice';
import { useGetTasksQuery } from 'Redux/API/taskSlice';
import { useGetTeamMembersQuery } from 'Redux/API/teamSlice';
import { mergeMaintenanceHistoryWithDeviceSources } from '../../maintenanceHistory/maintenanceHistoryAdapter';
import { getEmbeddedPropertyDocuments } from '../../propertyKnowledge/propertyMemoryRecordService';
import { FileUploader } from 'Components/Library/FileUploader';
import { uploadUserProfileImage } from 'utils/userProfileImageUpload';
import {
	PageHeaderSection,
	PageTitle as StandardPageTitle,
} from '../../Components/Library/PageHeaders';
import {
	FormGroup,
	FormLabel,
	FormInput,
	ButtonGroup,
	Section,
	GenericModal,
} from '../../Components/Library';
import {
	Wrapper,
	FormContentWrapper,
	FormSection,
	ImageUploadSection,
	ImagePreview,
	CancelButton,
	SaveButton,
	ErrorMessage,
	SuccessMessage,
	LoadingOverlay,
	UserProfileHeader,
	PageHeader,
	ImageView,
	ProfileAvatarColumn,
	ProfileDetailsPanel,
	EditProfileButton,
	ProfileInitialsAvatar,
	StatusPill,
	AccountSummaryCard,
	AccountSummaryMetric,
	AccountSummaryIcon,
	AccountSummaryValue,
	AccountSummaryLabel,
	ProfileSectionHeader,
	ProfileSectionTitle,
	ProfileSectionLink,
	ProfileListCard,
	ActivityRow,
	ActivityIcon,
	ActivityTitle,
	ActivityDetail,
	ActivityTime,
	TeamGrid,
	TeamMemberRow,
	TeamMemberAvatar,
	EmptyProfileSection,
	AccountActionsPanel,
	AccountActionButtons,
	ProfileActionButton,
	DangerProfileActionButton,
	ActionHelperText,
	DeleteLoadingCard,
	DeleteLoadingOverlay,
	DeleteLoadingTitle,
	DeleteLoadingText,
	PasswordInputWrapper,
	PasswordVisibilityButton,
} from './UserProfile.styles';
import { HouseLogoLoader } from 'Components/Library/HouseLogoLoader';
import { Button } from 'pages/PropertyDetailPage/TabSystem/index.styles';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
	faArrowLeft,
	faCircleCheck,
	faClipboardList,
	faGear,
	faHouse,
	faPencil,
	faScrewdriverWrench,
	faTriangleExclamation,
	faUserCheck,
} from '@fortawesome/free-solid-svg-icons';
import { faEye, faEyeSlash } from '@fortawesome/free-regular-svg-icons';
import { formatDate } from 'utils/detailPageUtils';
import COLORS from 'constants/colors';
import { PortfolioPlanSub, PortfolioTop, PortfolioUsage, PortfolioUsageBadge, ProgressFill, ProgressTrack } from 'Components/Library/Navbar/SideNav/SideNav.styles';
import {
	getActiveGrantedPlanAccess,
	getActiveHomeownerPlusTrial,
	getEffectiveAccessPlanId,
	getEffectiveSubscriptionPlanId,
	getSubscriptionPlanDetails,
} from 'utils/subscriptionUtils';
import { getStripeBillingPresentation } from 'utils/billingDisclosure';
import { filterPropertyGroupsByRole } from 'utils/dataFilters';
import { TeamMember } from 'Redux/Slices/teamSlice';
import { useStorageUsage } from 'Hooks/useStorageUsage';
import {
	selectIsTeamMemberAccount,
	selectIsTenant,
	selectCanAccessTeam,
} from 'Redux/selectors/permissionSelectors';
import { formatStorageBytes } from 'utils/storageQuota';
import { isContinuityEvent } from 'utils/maintenanceEventUtils';
import {
	updatePassword,
	reauthenticateWithCredential,
	EmailAuthProvider,
} from 'firebase/auth';
import { auth } from 'config/firebase';
import { callFirebaseFunction } from 'config/firebaseFunctions';
import { getCustomerBillingPortalUrl } from 'utils/authLinks';
import { useAppFeedback } from '../../Components/Library/AppFeedback/AppFeedbackProvider';
import {
	beginAccountDeletionSession,
	endAccountDeletionSession,
	finalizeDeletedAccountSession,
} from '../../services/accountDeletionSession';
import {
	refreshCurrentUserEmailVerification,
	sendCurrentUserEmailVerification,
} from '../../services/emailVerificationService';
import { trackAnalyticsEvent } from '../../analytics/analytics';
import { isEmailVerificationRequired } from '../../config/emailVerificationPolicy';

export const UserProfile: React.FC = () => {
	const dispatch = useDispatch<AppDispatch>();
	const navigate = useNavigate();
	const feedback = useAppFeedback();
	const deleteConfirmationInputId = 'delete-account-confirmation-input';
	const currentUser = useSelector((state: RootState) => state.user.currentUser);
	const [updateUser] = useUpdateUserMutation();
	const isTeamMemberAccount = useSelector(selectIsTeamMemberAccount);
	const canAccessTeam = useSelector(selectCanAccessTeam);
	const [isEditing, setIsEditing] = useState(false);

	const [formData, setFormData] = useState({
		firstName: '',
		lastName: '',
		title: '',
		phone: '',
		address: '',
		image: '',
	});

	const [isUploadingImage, setIsUploadingImage] = useState(false);
	const [imageError, setImageError] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [showPasswordModal, setShowPasswordModal] = useState(false);
	const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
	const [passwordError, setPasswordError] = useState('');
	const [passwordSuccess, setPasswordSuccess] = useState('');
	const [deleteAccountError, setDeleteAccountError] = useState('');
	const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');
	const [isChangingPassword, setIsChangingPassword] = useState(false);
	const [isDeletingAccount, setIsDeletingAccount] = useState(false);
	const [isEmailVerified, setIsEmailVerified] = useState(
		Boolean(auth.currentUser?.emailVerified),
	);
	const [isEmailVerificationBusy, setIsEmailVerificationBusy] = useState(false);
	const [emailVerificationMessage, setEmailVerificationMessage] = useState('');
	const [emailVerificationError, setEmailVerificationError] = useState('');
	const [showCurrentPassword, setShowCurrentPassword] = useState(false);
	const [showNewPassword, setShowNewPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);
	const [passwordForm, setPasswordForm] = useState({
		currentPassword: '',
		newPassword: '',
		confirmPassword: '',
	});
	const isUserTenant = useSelector(selectIsTenant);
	const {
		data: summaryProperties = [],
		isLoading: arePropertiesLoading,
	} = useGetPropertiesQuery();
	const {
		data: summarySystems = [],
		isLoading: areSystemsLoading,
	} = useGetAllDevicesQuery();
	const {
		data: summaryTasks = [],
		isLoading: areTasksLoading,
	} = useGetTasksQuery();
	const {
		data: sourceMaintenanceHistory = [],
		isLoading: isMaintenanceHistoryLoading,
	} = useGetAllMaintenanceHistoryForUserQuery();
	const maintenanceHistory = React.useMemo(
		() =>
			mergeMaintenanceHistoryWithDeviceSources(
				sourceMaintenanceHistory,
				summarySystems,
			),
		[sourceMaintenanceHistory, summarySystems],
	);
	const showTeamSection = isTeamMemberAccount || canAccessTeam;
	const { data: profileTeamMembers = [], isLoading: areTeamMembersLoading } =
		useGetTeamMembersQuery(undefined, {
			skip: !showTeamSection,
		});

	const openTaskCount = React.useMemo(
		() =>
			summaryTasks.filter(
				(task) => task.status !== 'Completed' && task.status !== 'Rejected',
			).length,
		[summaryTasks],
	);

	const completedWorkCount = React.useMemo(() => {
		const visiblePropertyIds = new Set(
			summaryProperties.map((property) => String(property.id || '').trim()),
		);
		const visiblePropertyTitles = new Set(
			summaryProperties
				.map((property) => String(property.title || '').trim())
				.filter(Boolean),
		);
		const completedTaskKeys = new Set<string>();

		maintenanceHistory.forEach((record: any) => {
			const eventType = String(record.eventType || '')
				.trim()
				.toLowerCase();
			const eventSource = String(record.eventSource || '')
				.trim()
				.toLowerCase();
			const status = String(record.status || '')
				.trim()
				.toLowerCase();
			const isTaskCompletion =
				eventType === 'task_completed' ||
				eventType === 'task_approved' ||
				eventSource === 'task_completion' ||
				eventSource === 'task_approval' ||
				status === 'completed' ||
				status === 'approved';

			if (!isContinuityEvent(record)) {
				return;
			}

			const propertyId = String(record.propertyId || '').trim();
			const propertyTitle = String(
				record.propertyTitle || record.property || '',
			).trim();
			const isVisibleRecord =
				(propertyId && visiblePropertyIds.has(propertyId)) ||
				(propertyTitle && visiblePropertyTitles.has(propertyTitle));

			if (!isVisibleRecord) {
				return;
			}

			const linkedTaskId = [
				record.taskId,
				record.originalTaskId,
				record.data?.taskId,
				record.data?.originalTaskId,
				...(Array.isArray(record.linkedTaskIds)
					? record.linkedTaskIds
					: []),
			]
				.map((value) => String(value || '').trim())
				.find(Boolean);

			const recordId = String(record.id || '').trim();
			if (isTaskCompletion && linkedTaskId) {
				completedTaskKeys.add(`task:${linkedTaskId}`);
			} else if (recordId) {
				completedTaskKeys.add(`event:${recordId}`);
			}
		});

		summaryTasks.forEach((task) => {
			if (task.status === 'Completed') {
				completedTaskKeys.add(`task:${task.id}`);
			}
		});

		return completedTaskKeys.size;
	}, [maintenanceHistory, summaryProperties, summaryTasks]);

	const profileInitials = React.useMemo(() => {
		const initials = `${formData.firstName?.[0] || ''}${formData.lastName?.[0] || ''}`.toUpperCase();
		if (initials) {
			return initials;
		}
		return String(currentUser?.email || 'U')
			.trim()
			[0]
			?.toUpperCase() || 'U';
	}, [currentUser?.email, formData.firstName, formData.lastName]);

	const accountSummaryMetrics = [
		{
			label: 'Properties',
			value: arePropertiesLoading ? '—' : summaryProperties.length,
			icon: faHouse,
		},
		{
			label: 'Equipment',
			value: areSystemsLoading ? '—' : summarySystems.length,
			icon: faGear,
		},
		{
			label: 'Open Tasks',
			value: areTasksLoading ? '—' : openTaskCount,
			icon: faClipboardList,
		},
		{
			label: 'Completed Work',
			value:
				isMaintenanceHistoryLoading || areTasksLoading
					? '—'
					: completedWorkCount,
			icon: faCircleCheck,
		},
	];

	const recentActivity = React.useMemo(() => {
		const activities: Array<{
			id: string;
			title: string;
			detail: string;
			date: string;
			icon: typeof faHouse;
		}> = [];

		summaryProperties.forEach((property) => {
			if (!property.createdAt) return;
			activities.push({
				id: `property-${property.id}`,
				title: 'Property added',
				detail: property.title || 'Property',
				date: property.createdAt,
				icon: faHouse,
			});
		});

		summarySystems.forEach((system) => {
			if (!system.createdAt) return;
			activities.push({
				id: `system-${system.id}`,
				title: 'System added',
				detail:
					[system.brand, system.type].filter(Boolean).join(' ') || 'System',
				date: system.createdAt,
				icon: faGear,
			});
		});

		summaryTasks.forEach((task) => {
			if (task.createdAt) {
				activities.push({
					id: `task-created-${task.id}`,
					title: 'Task added',
					detail: task.title,
					date: task.createdAt,
					icon: faClipboardList,
				});
			}

			if (task.assignee || task.assignedTo) {
				const assigneeId =
					String(task.assignedTo?.id || task.assignee || '').trim();
				const teamMember = profileTeamMembers.find(
					(member) => member.id === assigneeId,
				);
				const assigneeName =
					[
						task.assignedTo?.name,
						teamMember
							? `${teamMember.firstName || ''} ${teamMember.lastName || ''}`.trim()
							: '',
					].find(Boolean) || 'a team member';
				const assignmentDate = task.updatedAt || task.createdAt;

				if (assignmentDate) {
					activities.push({
						id: `task-assigned-${task.id}`,
						title: 'Task assigned',
						detail: `${task.title} to ${assigneeName}`,
						date: assignmentDate,
						icon: faUserCheck,
					});
				}
			}
		});

		maintenanceHistory.forEach((record: any) => {
			const date =
				record.completionDate ||
				record.approvedAt ||
				record.date ||
				record.createdAt;
			if (!date || !record.id) return;

			const eventType = String(record.eventType || '').toLowerCase();
			const activityTitle =
				eventType === 'task_completed'
					? 'Task completed'
					: eventType === 'task_approved'
						? 'Task approved'
						: eventType === 'service_note_added'
							? 'Service note added'
							: eventType === 'repair_logged'
								? 'Repair logged'
								: eventType === 'inspection_completed'
									? 'Inspection completed'
									: 'Maintenance recorded';

			activities.push({
				id: `maintenance-${record.id}`,
				title: activityTitle,
				detail:
					record.title ||
					record.taskTitle ||
					record.description ||
					'Maintenance activity',
				date,
				icon:
					eventType === 'task_completed' || eventType === 'task_approved'
						? faCircleCheck
						: faScrewdriverWrench,
			});
		});

		return activities
			.filter((activity) => !Number.isNaN(new Date(activity.date).getTime()))
			.sort(
				(a, b) =>
					new Date(b.date).getTime() - new Date(a.date).getTime(),
			)
			.slice(0, 3);
	}, [
		summaryProperties,
		summarySystems,
		summaryTasks,
		maintenanceHistory,
		profileTeamMembers,
	]);

	const formatActivityTime = (value: string): string => {
		const date = new Date(value);
		const diffMs = Date.now() - date.getTime();
		const diffDays = Math.floor(Math.abs(diffMs) / 86400000);

		if (diffDays === 0) return 'Today';
		if (diffDays === 1) return diffMs >= 0 ? 'Yesterday' : 'Tomorrow';
		if (diffDays < 7) return `${diffDays} days ago`;
		return date.toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
		});
	};

	const { usage: storageUsage, isLoading: isStorageUsageLoading } =
		useStorageUsage(currentUser, !isUserTenant && !isTeamMemberAccount);

	const propertyGroups = useSelector(
		(state: RootState) => state.propertyData.groups,
	);
	const teamGroups = useSelector((state: RootState) => state.team.groups);
	const teamMembers = React.useMemo(
		() => teamGroups.flatMap((group) => group.members || []),
		[teamGroups],
	);

	const filteredPropertyGroups = React.useMemo(
		() =>
			filterPropertyGroupsByRole(
				propertyGroups.map((group) => ({
					...group,
					properties: group.properties || [],
				})) as any[],
				currentUser,
				teamMembers.filter((member): member is TeamMember => member !== undefined),
			),
		[propertyGroups, currentUser, teamMembers],
	);

	const totalProperties = React.useMemo(
		() =>
			Array.from(
				new Set(
					filteredPropertyGroups
						.flatMap((group) => group.properties || [])
						.map((property) => property.id),
				),
			).length,
		[filteredPropertyGroups],
	);
	const effectivePlanId = getEffectiveAccessPlanId(currentUser?.subscription);
	const planDetails = getSubscriptionPlanDetails(effectivePlanId);
	const grantedAccess = getActiveGrantedPlanAccess(currentUser?.subscription);
	const activeHomeownerPlusTrial = getActiveHomeownerPlusTrial(
		currentUser?.subscription,
	);

	const maxProperties = planDetails?.maxProperties ?? 1;
	const remainingSlots = Math.max(0, maxProperties - totalProperties);
	const planRecordNoun = maxProperties <= 1 ? 'home' : 'property';
	const usagePercent = maxProperties > 0 ? (totalProperties / maxProperties) * 100 : 0;
	const hasPropertyCapacity = maxProperties > 0;
	const planSlotLabel = !hasPropertyCapacity
		? 'Property creation is not included'
		: remainingSlots === 0 && totalProperties > maxProperties
			? `${totalProperties - maxProperties} over plan limit`
			: `${remainingSlots} ${planRecordNoun} slot${remainingSlots === 1 ? '' : 's'} available`;
	const planSubtitle = `${grantedAccess ? 'Effective access' : 'Plan'}: ${planDetails?.name || 'Home'}`;
	const grantedAccessEndsLabel = grantedAccess?.endsAtMs
		? new Date(grantedAccess.endsAtMs).toLocaleDateString(undefined, {
			month: 'long',
			day: 'numeric',
			year: 'numeric',
		})
		: null;
	const accessTransition = grantedAccess?.transition;
	const automaticTransition = accessTransition?.mode === 'automatic';
	const firstChargeAt = accessTransition?.firstChargeAt;
	const firstChargeMs =
		typeof firstChargeAt === 'number'
			? firstChargeAt
			: typeof (firstChargeAt as any)?.toMillis === 'function'
				? (firstChargeAt as any).toMillis()
				: Number.NaN;
	const firstChargeLabel = Number.isFinite(firstChargeMs)
		? new Date(firstChargeMs).toLocaleDateString(undefined, {
				year: 'numeric', month: 'long', day: 'numeric',
			})
		: null;
	const recurringPriceLabel = Number.isFinite(Number(accessTransition?.recurringAmountMinor))
		? new Intl.NumberFormat(undefined, {
				style: 'currency',
				currency: String(accessTransition?.currency || 'USD'),
			}).format(Number(accessTransition?.recurringAmountMinor) / 100)
		: null;
	const hasStripeBillingRelationship = Boolean(
		currentUser?.subscription?.stripeCustomerId || accessTransition?.stripeCustomerId,
	);
	const stripeBillingPresentation = getStripeBillingPresentation(
		currentUser?.subscription?.billingDisclosure,
	);
	const storageUsagePercent = Math.min(100, storageUsage?.usagePercent || 0);
	const storageUsageLabel = isStorageUsageLoading
		? 'Loading storage...'
		: storageUsage && storageUsage.maxBytes > 0
			? `${formatStorageBytes(storageUsage.usedBytes)} of ${formatStorageBytes(
				storageUsage.maxBytes,
			)}`
			: 'Storage not included';
	const storageFileLabel = storageUsage
		? `${storageUsage.fileCount} files stored`
		: '';

	// Initialize form with current user data
	useEffect(() => {
		if (currentUser) {
			setFormData({
				firstName: currentUser.firstName || '',
				lastName: currentUser.lastName || '',
				title: currentUser.title || '',
				phone: currentUser.phone || '',
				address: currentUser.address || '',
				image: currentUser.image || '',
			});
		} else {
			navigate('/login');
		}
	}, [currentUser, navigate]);

	useEffect(() => {
		if (!isEmailVerificationRequired() || !auth.currentUser) return;
		void refreshCurrentUserEmailVerification()
			.then(setIsEmailVerified)
			.catch(() => undefined);
	}, [currentUser?.id]);

	const handleSendEmailVerification = async () => {
		setIsEmailVerificationBusy(true);
		setEmailVerificationError('');
		setEmailVerificationMessage('');
		try {
			await sendCurrentUserEmailVerification();
			setEmailVerificationMessage(
				'A verification email has been sent. Open the link, then return here to confirm it.',
			);
			void trackAnalyticsEvent('email_verification_sent', {
				verification_source: 'profile',
			});
		} catch (verificationError: any) {
			setEmailVerificationError(
				String(
					verificationError?.message ||
						'Maintley could not send a verification email. Please try again shortly.',
				),
			);
		} finally {
			setIsEmailVerificationBusy(false);
		}
	};

	const handleInputChange = (
		e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
	) => {
		if (isTeamMemberAccount) return;
		const { name, value } = e.target;
		setFormData((prev) => ({
			...prev,
			[name]: value,
		}));
		setError(null);
	};

	const handlePhotoUpload = async (file: File | null) => {
		if (!file || !currentUser) return;
		if (isTeamMemberAccount) {
			setImageError('Your profile is managed by the account owner.');
			return;
		}

		setImageError(null);
		setIsUploadingImage(true);
		try {
			const imageUrl = await uploadUserProfileImage(file, currentUser.id);
			const updatedUser = await updateUser({
				id: currentUser.id,
				updates: {
					image: imageUrl,
				},
			}).unwrap();
			setFormData((prev) => ({
				...prev,
				image: imageUrl,
			}));
			dispatch(
				setCurrentUser({
					...currentUser,
					...updatedUser,
					image: imageUrl,
				}),
			);
		} catch (err) {
			setImageError('Failed to upload image. Please try again.');
			console.error('Image upload error:', err);
		} finally {
			setIsUploadingImage(false);
		}
	};

	const handleSave = async () => {
		if (isTeamMemberAccount) {
			setError('Your profile is managed by the account owner.');
			return;
		}
		// currentUser guaranteed to exist

		// Validation
		if (!formData.firstName.trim() || !formData.lastName.trim()) {
			setError('First name and last name are required.');
			return;
		}

		setIsLoading(true);
		setError(null);
		setSuccess(null);

		try {
			// Update user in Firebase
			const updatedUser = await updateUser({
				id: currentUser!.id,
				updates: {
					firstName: formData.firstName,
					lastName: formData.lastName,
					title: formData.title,
					phone: formData.phone,
					address: formData.address,
					image: formData.image,
				},
			}).unwrap();

			// Update local Redux state
			dispatch(
				setCurrentUser({
					...currentUser,
					...updatedUser,
				}),
			);

			setSuccess('Profile updated successfully!');
			setTimeout(() => setSuccess(null), 3000);
		} catch (err: any) {
			const errorMessage =
				err?.message || 'Failed to update profile. Please try again.';
			setError(errorMessage);
			console.error('Profile update error:', err);
		} finally {
			setIsLoading(false);
		}
	};

	const handleCancel = () => {
		navigate(-1);
	};

	const hasBlockingSubscription =
		(['homeowner_plus', 'property', 'portfolio'].includes(
			String(currentUser?.subscription?.plan || '').trim().toLowerCase(),
		) &&
			(currentUser?.subscription?.status === 'active' ||
				currentUser?.subscription?.status === 'past_due')) ||
		false;

	const paidPlanIds = [
		'homeowner_plus',
		'property',
		'portfolio',
	];
	const currentPlanId = getEffectiveSubscriptionPlanId(
		currentUser?.subscription,
		'homeowner',
	);
	const isPaidPlan = paidPlanIds.includes(currentPlanId);
	const hasPendingCancellation =
		isPaidPlan &&
		currentUser?.subscription?.status === 'active' &&
		!!currentUser?.subscription?.hasScheduledSubscription;
	const currentPlanDetails = getSubscriptionPlanDetails(currentPlanId || 'homeowner');
	const memberSinceLabel = currentUser?.createdAt
		? formatDate(currentUser.createdAt)
		: 'Not available yet';
	const ownedPropertiesCount = React.useMemo(
		() =>
			summaryProperties.filter(
				(property: any) => String(property.userId || '').trim() === currentUser?.id,
			).length,
		[summaryProperties, currentUser?.id],
	);
	const activeTeamMembersCount = React.useMemo(
		() =>
			profileTeamMembers.filter(
				(member: any) =>
					String(member.status || '').trim().toLowerCase() !== 'inactive',
			).length,
		[profileTeamMembers],
	);
	const hasTeamOwnerBlock =
		!isTeamMemberAccount && ownedPropertiesCount > 0 && activeTeamMembersCount > 0;
	const maintenanceRecordCount = maintenanceHistory.length;
	const documentsCount = summaryProperties.reduce((total: number, property: any) => {
		const propertyDocuments = getEmbeddedPropertyDocuments(property).length;
		return total + propertyDocuments;
	}, 0);
	const deleteImpactItems = [
		{ label: 'properties', value: summaryProperties.length },
		{ label: 'equipment records', value: summarySystems.length },
		{ label: 'maintenance records', value: maintenanceRecordCount },
		{ label: 'uploaded documents', value: documentsCount },
	].filter((item) => item.value > 0);
	const hasDeleteImpactData = deleteImpactItems.length > 0;

	type DeleteModalState =
		| 'active_subscription'
		| 'pending_cancellation'
		| 'team_owner'
		| 'ready';

	const deleteModalState: DeleteModalState = hasPendingCancellation
		? 'pending_cancellation'
		: hasBlockingSubscription
			? 'active_subscription'
			: hasTeamOwnerBlock
				? 'team_owner'
				: 'ready';

	const subscriptionEndDateLabel = React.useMemo(() => {
		const rawPeriodEnd = (currentUser?.subscription as any)?.currentPeriodEnd;
		const numericPeriodEnd = Number(rawPeriodEnd || 0);
		if (!Number.isFinite(numericPeriodEnd) || numericPeriodEnd <= 0) {
			return 'the end of your billing period';
		}
		return new Date(numericPeriodEnd * 1000).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
		});
	}, [currentUser?.subscription]);

	const openChangePasswordModal = () => {
		setPasswordError('');
		setPasswordSuccess('');
		setShowCurrentPassword(false);
		setShowNewPassword(false);
		setShowConfirmPassword(false);
		setPasswordForm({
			currentPassword: '',
			newPassword: '',
			confirmPassword: '',
		});
		setShowPasswordModal(true);
	};

	const openDeleteAccountModal = () => {
		setDeleteAccountError('');
		setDeleteConfirmationInput('');
		setShowDeleteAccountModal(true);
	};

	const handlePasswordChange = async (e: React.FormEvent) => {
		e.preventDefault();
		setPasswordError('');
		setPasswordSuccess('');

		if (!passwordForm.currentPassword) {
			setPasswordError('Current password is required');
			return;
		}
		if (!passwordForm.newPassword) {
			setPasswordError('New password is required');
			return;
		}
		if (passwordForm.newPassword.length < 6) {
			setPasswordError('New password must be at least 6 characters');
			return;
		}
		if (passwordForm.newPassword !== passwordForm.confirmPassword) {
			setPasswordError('New passwords do not match');
			return;
		}

		setIsChangingPassword(true);

		try {
			const user = auth.currentUser;
			if (!user || !user.email) {
				setPasswordError('User not authenticated');
				return;
			}

			const credential = EmailAuthProvider.credential(
				user.email,
				passwordForm.currentPassword,
			);
			await reauthenticateWithCredential(user, credential);
			await updatePassword(user, passwordForm.newPassword);

			setPasswordSuccess('Password updated successfully!');
			setPasswordForm({
				currentPassword: '',
				newPassword: '',
				confirmPassword: '',
			});
			setShowCurrentPassword(false);
			setShowNewPassword(false);
			setShowConfirmPassword(false);
			setTimeout(() => {
				setShowPasswordModal(false);
				setPasswordSuccess('');
			}, 2000);
		} catch (changeError: any) {
			console.error('Password change error:', changeError);
			if (changeError.code === 'auth/wrong-password') {
				setPasswordError('Current password is incorrect');
			} else if (changeError.code === 'auth/weak-password') {
				setPasswordError('New password is too weak');
			} else if (changeError.code === 'auth/requires-recent-login') {
				setPasswordError(
					'Please log out and log back in before changing your password',
				);
			} else {
				setPasswordError('Failed to update password. Please try again.');
			}
		} finally {
			setIsChangingPassword(false);
		}
	};

	const handleDeleteAccount = async () => {
		if (!currentUser) return;

		setDeleteAccountError('');
		setIsDeletingAccount(true);
		beginAccountDeletionSession();

		try {
			await callFirebaseFunction<{ userId: string }, unknown>(
				'deleteUserAccount',
				{ userId: currentUser.id },
			);
			await finalizeDeletedAccountSession({
				userId: currentUser.id,
				dispatch,
				navigate,
				notify: feedback.notify,
			});
		} catch (deleteError: any) {
			endAccountDeletionSession();
			console.error('Delete account error:', deleteError);
			if (deleteError.code === 'functions/permission-denied') {
				setDeleteAccountError('You can only delete your own account.');
			} else if (deleteError.code === 'functions/failed-precondition') {
				setDeleteAccountError(
					String(
						deleteError.message ||
						'You cannot delete your account while you have an active subscription. Please cancel your subscription first.',
					),
				);
			} else if (deleteError.code === 'functions/internal') {
				setDeleteAccountError('Failed to delete account. Please contact support.');
			} else {
				setDeleteAccountError('An error occurred while deleting your account.');
			}
		} finally {
			setIsDeletingAccount(false);
		}
	};
	// currentUser guaranteed to exist in protected routes

	return (
		<Wrapper>
			{isLoading && <LoadingOverlay />}
			{!isEditing && currentUser ? (
				<>
					<PageHeaderSection>
						<StandardPageTitle>
							My Profile
						</StandardPageTitle>
					</PageHeaderSection>
					<UserProfileHeader style={{ flexWrap: 'wrap', gap: '24px', border: '1px solid #E0E0E0', borderRadius: '8px', padding: '16px' }}>
						<ProfileAvatarColumn>
							{formData.image ? (
								<ImageView src={formData.image} alt='Profile' />
							) : (
								<ProfileInitialsAvatar aria-label='Profile'>
									{profileInitials}
								</ProfileInitialsAvatar>
							)}
							<EditProfileButton
								type='button'
								$disabled={isTeamMemberAccount}
								onClick={() => !isTeamMemberAccount && setIsEditing(true)}>
								<FontAwesomeIcon icon={faPencil} /> Edit Profile
							</EditProfileButton>
						</ProfileAvatarColumn>
						<ProfileDetailsPanel>
							<FormLabel style={{ fontSize: '16px', fontWeight: '600', marginBottom: '5px' }}>{formData.firstName} {formData.lastName}</FormLabel>
							<p>{currentUser?.title}</p>
							<p>{currentUser?.email}</p>
							<p>{`Member since: ${memberSinceLabel}`}</p>
						</ProfileDetailsPanel>
					</UserProfileHeader>

					<AccountActionsPanel>
						<ProfileSectionTitle>Account Actions</ProfileSectionTitle>
						{isEmailVerificationRequired() && !isEmailVerified ? (
							<>
								<ActionHelperText>
									Verify {currentUser.email} so Maintley can confirm that account messages are reaching you. Maintley will recognize verification the next time you sign in.
								</ActionHelperText>
								<AccountActionButtons>
									<ProfileActionButton
										type='button'
										disabled={isEmailVerificationBusy}
										onClick={() => void handleSendEmailVerification()}>
										Send Verification Email
									</ProfileActionButton>
								</AccountActionButtons>
								{emailVerificationMessage ? (
									<SuccessMessage>{emailVerificationMessage}</SuccessMessage>
								) : null}
								{emailVerificationError ? (
									<ErrorMessage>{emailVerificationError}</ErrorMessage>
								) : null}
							</>
						) : null}
						<AccountActionButtons>
							<ProfileActionButton type='button' onClick={openChangePasswordModal}>
								Change Password
							</ProfileActionButton>
							<DangerProfileActionButton type='button' onClick={openDeleteAccountModal}>
								Delete Account
							</DangerProfileActionButton>
						</AccountActionButtons>
						<ActionHelperText>
							Delete account is permanent and cannot be undone.
						</ActionHelperText>
					</AccountActionsPanel>

					<div style={{ marginTop: '24px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
						<FormLabel style={{ fontSize: '16px', fontWeight: '600', marginBottom: '5px' }}>Account Summary</FormLabel>
						<Link to='/properties' style={{ color: COLORS.primary, fontSize: '14px', marginRight: '16px', textDecoration: 'none' }}>View all</Link>
					</div>

					<AccountSummaryCard>
						{accountSummaryMetrics.map((metric) => (
							<AccountSummaryMetric key={metric.label}>
								<AccountSummaryIcon aria-hidden='true'>
									<FontAwesomeIcon icon={metric.icon} />
								</AccountSummaryIcon>
								<div>
									<AccountSummaryValue>{metric.value}</AccountSummaryValue>
									<AccountSummaryLabel>{metric.label}</AccountSummaryLabel>
								</div>
							</AccountSummaryMetric>
						))}
					</AccountSummaryCard>
					<Section style={{ padding: '16px', border: '1px solid #E0E0E0', borderRadius: '8px', display: 'flex', flexDirection: 'column', flexWrap: 'wrap', gap: '12px' }}>
						<PortfolioTop>
							<FormLabel style={{ fontSize: '14px', color: '#666' }}>Plan & Usage</FormLabel>
							<StatusPill style={{ backgroundColor: grantedAccess || currentUser?.subscription?.status === 'active' ? COLORS.primary : COLORS.gray300, color: COLORS.bgWhite }}>
								{grantedAccess ? 'Granted' : planDetails?.name || 'Home Plan'}
							</StatusPill>

						</PortfolioTop>
						<PortfolioPlanSub>
							{planSubtitle}
						</PortfolioPlanSub>
						{grantedAccess ? (
							<div
								style={{
									padding: '12px',
									borderRadius: '8px',
									background: '#ECFDF5',
									border: '1px solid #A7F3D0',
									color: '#065F46',
								}}
							>
								<strong>{planDetails?.name || 'Plan'} access granted</strong>
								<div style={{ marginTop: '4px', fontSize: '14px' }}>
									{activeHomeownerPlusTrial
										? `${activeHomeownerPlusTrial.daysRemaining} days remaining. Your complimentary access ends ${grantedAccessEndsLabel}. Your account returns to the Free plan afterward.`
										: grantedAccess.kind === 'permanent'
											? 'Maintley has granted this account permanent access.'
											: `Maintley has granted this account access through ${grantedAccessEndsLabel || 'the scheduled end date'}.`}
								</div>
							</div>
						) : null}
						<div style={{ display: 'grid', gap: '6px', fontSize: '14px' }}>
							<div><strong>Payment method:</strong> {hasStripeBillingRelationship ? 'Managed securely in Stripe' : 'Not connected'}</div>
							{hasStripeBillingRelationship && stripeBillingPresentation.renewalLabel ? <div><strong>Subscription renewal:</strong> {stripeBillingPresentation.renewalLabel}</div> : null}
							{hasStripeBillingRelationship && stripeBillingPresentation.discountLabel ? <div><strong>Stripe discount:</strong> {stripeBillingPresentation.discountLabel}</div> : null}
							{hasStripeBillingRelationship && stripeBillingPresentation.nextInvoiceLabel ? <div><strong>Next invoice:</strong> {stripeBillingPresentation.nextInvoiceLabel}</div> : null}
							{grantedAccess ? <div><strong>After complimentary access:</strong> {automaticTransition ? 'Continues as a paid subscription unless cancelled' : accessTransition?.mode === 'checkout_required' ? 'Paid continuation requires Checkout' : 'No automatic billing'}</div> : null}
							{automaticTransition && firstChargeLabel ? <div><strong>First charge:</strong> {firstChargeLabel}{recurringPriceLabel ? ` at ${recurringPriceLabel} per ${accessTransition?.billingCycle || 'billing period'}` : ''}</div> : null}
						</div>
						<div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
							{hasStripeBillingRelationship ? (
								<ProfileActionButton
									type='button'
									onClick={() => window.open(getCustomerBillingPortalUrl(), '_blank', 'noopener,noreferrer')}
								>
									Manage payment, renewal, or cancellation
								</ProfileActionButton>
							) : (
								<ProfileActionButton type='button' onClick={() => navigate('/paywall')}>
									Review plan options
								</ProfileActionButton>
							)}
						</div>
						<ProgressTrack>
							<ProgressFill $percent={Math.min(100, usagePercent)} />
						</ProgressTrack>
						<PortfolioUsage>
							{planSlotLabel}
						</PortfolioUsage>
						<PortfolioTop>
							<PortfolioPlanSub>
								Storage
							</PortfolioPlanSub>
							<PortfolioUsageBadge>
								{storageFileLabel || 'Files'}
							</PortfolioUsageBadge>
						</PortfolioTop>
						<ProgressTrack>
							<ProgressFill $percent={storageUsagePercent} />
						</ProgressTrack>
						<PortfolioUsage>
							{storageUsageLabel}
						</PortfolioUsage>
						{/* <ManagePlanButton
							type='button'
							onClick={() => navigate('/paywall')}>
							Manage Plan
						</ManagePlanButton> */}
					</Section>

					<ProfileSectionHeader>
						<ProfileSectionTitle>Recent Activity</ProfileSectionTitle>
					</ProfileSectionHeader>
					<ProfileListCard>
						{recentActivity.length > 0 ? (
							recentActivity.map((activity) => (
								<ActivityRow key={activity.id}>
									<ActivityIcon aria-hidden='true'>
										<FontAwesomeIcon icon={activity.icon} />
									</ActivityIcon>
									<div>
										<ActivityTitle>{activity.title}</ActivityTitle>
										<ActivityDetail>{activity.detail}</ActivityDetail>
									</div>
									<ActivityTime>
										{formatActivityTime(activity.date)}
									</ActivityTime>
								</ActivityRow>
							))
						) : (
							<EmptyProfileSection>
								Your latest property and maintenance activity will appear here.
							</EmptyProfileSection>
						)}
					</ProfileListCard>

					{showTeamSection && (
						<>
							<ProfileSectionHeader>
								<ProfileSectionTitle>Team</ProfileSectionTitle>
								<ProfileSectionLink as={Link} to='/team'>
									View team
								</ProfileSectionLink>
							</ProfileSectionHeader>
							<ProfileListCard>
								{areTeamMembersLoading ? (
									<EmptyProfileSection>Loading team...</EmptyProfileSection>
								) : profileTeamMembers.length > 0 ? (
									<TeamGrid>
										{profileTeamMembers.map((member) => {
											const name =
												`${member.firstName || ''} ${member.lastName || ''}`.trim() ||
												member.email;
											const initials =
												`${member.firstName?.[0] || ''}${member.lastName?.[0] || ''}`.toUpperCase() ||
												'?';
											return (
												<TeamMemberRow key={member.id}>
													<TeamMemberAvatar>
														{member.image ? (
															<img src={member.image} alt='' />
														) : (
															initials
														)}
													</TeamMemberAvatar>
													<div>
														<ActivityTitle>{name}</ActivityTitle>
														<ActivityDetail>
															{member.title || member.role || 'Team member'}
														</ActivityDetail>
													</div>
												</TeamMemberRow>
											);
										})}
									</TeamGrid>
								) : (
									<EmptyProfileSection>
										No team members have been added yet.
									</EmptyProfileSection>
								)}
							</ProfileListCard>
						</>
					)}

				</>
			) : (
				<>
					<PageHeader>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>

							<div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px' }} onClick={() => setIsEditing(false)}>
								<FontAwesomeIcon icon={faArrowLeft} />
								<FormLabel style={{ alignSelf: 'center', marginBottom: '5px', padding: 0, fontSize: '18px' }}>
									Edit Profile
								</FormLabel>
							</div>
						</div>
						<div>

							<Button onClick={() => handleSave()} disabled={isLoading || isTeamMemberAccount}>
								Save Changes
							</Button>
						</div>
					</PageHeader>
					<FormContentWrapper>
						{error && <ErrorMessage>{error}</ErrorMessage>}
						{success && <SuccessMessage>{success}</SuccessMessage>}
						{isTeamMemberAccount && (
							<SuccessMessage>
								This profile is managed by the account owner or administrator.
								Ask them to update your name, role, or access details.
							</SuccessMessage>
						)}

						<FormSection>
							{/* Profile Image */}
							<ImageUploadSection>
								<FormLabel>Profile Picture</FormLabel>
								{formData.image && (
									<ImagePreview src={formData.image} alt='Profile' />
								)}
								{!isTeamMemberAccount && (
									<FileUploader
										label='Choose Photo'
										helperText='JPG, PNG, GIF, WEBP (max 8MB)'
										accept='image/*'
										allowedTypes={['image/*']}
										maxSizeBytes={8 * 1024 * 1024}
										setFile={handlePhotoUpload}
										disabled={isUploadingImage || isLoading}
										showSelectedFiles={false}
									/>
								)}
								{imageError && <ErrorMessage>{imageError}</ErrorMessage>}
							</ImageUploadSection>

							{/* First Name */}
							<FormGroup>
								<FormLabel htmlFor='firstName'>First Name *</FormLabel>
								<FormInput
									id='firstName'
									name='firstName'
									type='text'
									value={formData.firstName}
									onChange={handleInputChange}
									placeholder='Enter first name'
									disabled={isLoading || isTeamMemberAccount}
								/>
							</FormGroup>

							{/* Last Name */}
							<FormGroup>
								<FormLabel htmlFor='lastName'>Last Name *</FormLabel>
								<FormInput
									id='lastName'
									name='lastName'
									type='text'
									value={formData.lastName}
									onChange={handleInputChange}
									placeholder='Enter last name'
									disabled={isLoading || isTeamMemberAccount}
								/>
							</FormGroup>

							{/* Title */}
							<FormGroup>
								<FormLabel htmlFor='title'>Job Title</FormLabel>
								<FormInput
									id='title'
									name='title'
									type='text'
									value={formData.title}
									onChange={handleInputChange}
									placeholder='e.g., Property Manager, Administrator'
									disabled={isLoading || isTeamMemberAccount}
								/>
							</FormGroup>

							{/* Phone */}
							<FormGroup>
								<FormLabel htmlFor='phone'>Phone Number</FormLabel>
								<FormInput
									id='phone'
									name='phone'
									type='tel'
									value={formData.phone}
									onChange={handleInputChange}
									placeholder='Enter phone number'
									disabled={isLoading || isTeamMemberAccount}
								/>
							</FormGroup>

							{/* Address */}
							<FormGroup>
								<FormLabel htmlFor='address'>Mailing Address</FormLabel>
								<FormInput
									id='address'
									name='address'
									type='text'
									value={formData.address}
									onChange={handleInputChange}
									placeholder='Enter mailing address'
									disabled={isLoading || isTeamMemberAccount}
								/>
							</FormGroup>

							{/* Email (Read-only) */}
							<FormGroup>
								<FormLabel htmlFor='email'>Email</FormLabel>
								<FormInput
									id='email'
									type='email'
									value={currentUser!.email}
									disabled
									placeholder='Your email address'
								/>
								<small style={{ color: '#666', marginTop: '0.25rem' }}>
									Email cannot be changed
								</small>
							</FormGroup>

							{/* Role (Read-only) */}
							<FormGroup>
								<FormLabel htmlFor='role'>Role</FormLabel>
								<FormInput
									id='role'
									type='text'
									value={currentUser!.role}
									disabled
									placeholder='Your role'
								/>
								<small style={{ color: '#666', marginTop: '0.25rem' }}>
									Role cannot be changed
								</small>
							</FormGroup>
						</FormSection>
					</FormContentWrapper>
					<FormSection
						style={{
							borderBottom: '1px solid #E0E0E0',
							marginBottom: '24px',
						}}
					>
						{isEditing && (
							<ButtonGroup>
								<CancelButton onClick={handleCancel} disabled={isLoading}>
									{isTeamMemberAccount ? 'Back' : 'Cancel'}
								</CancelButton>
								{!isTeamMemberAccount && (
									<SaveButton onClick={handleSave} disabled={isLoading}>
										{isLoading ? 'Saving...' : 'Save Changes'}
									</SaveButton>
								)}
							</ButtonGroup>
						)}
					</FormSection>
				</>
			)
			}

			<GenericModal
				isOpen={showPasswordModal}
				title='Change Password'
				onClose={() => {
					setShowPasswordModal(false);
					setPasswordError('');
					setPasswordSuccess('');
					setShowCurrentPassword(false);
					setShowNewPassword(false);
					setShowConfirmPassword(false);
					setPasswordForm({
						currentPassword: '',
						newPassword: '',
						confirmPassword: '',
					});
				}}
				primaryButtonLabel='Update Password'
				secondaryButtonLabel='Cancel'
				isLoading={isChangingPassword}
				showActions
				onSubmit={handlePasswordChange}>
				{passwordError && <ErrorMessage>{passwordError}</ErrorMessage>}
				{passwordSuccess && <SuccessMessage>{passwordSuccess}</SuccessMessage>}

				<FormGroup>
					<FormLabel>Current Password</FormLabel>
					<PasswordInputWrapper>
						<FormInput
							type={showCurrentPassword ? 'text' : 'password'}
							value={passwordForm.currentPassword}
							onChange={(e) =>
								setPasswordForm({
									...passwordForm,
									currentPassword: e.target.value,
								})
							}
							placeholder='Enter your current password'
							required
						/>
						<PasswordVisibilityButton
							type='button'
							aria-label={
								showCurrentPassword
									? 'Hide current password'
									: 'Show current password'
							}
							title={
								showCurrentPassword
									? 'Hide current password'
									: 'Show current password'
							}
							onClick={() => setShowCurrentPassword((value) => !value)}>
							<FontAwesomeIcon
								icon={showCurrentPassword ? faEyeSlash : faEye}
							/>
						</PasswordVisibilityButton>
					</PasswordInputWrapper>
				</FormGroup>

				<FormGroup>
					<FormLabel>New Password</FormLabel>
					<PasswordInputWrapper>
						<FormInput
							type={showNewPassword ? 'text' : 'password'}
							value={passwordForm.newPassword}
							onChange={(e) =>
								setPasswordForm({
									...passwordForm,
									newPassword: e.target.value,
								})
							}
							placeholder='Enter your new password'
							required
						/>
						<PasswordVisibilityButton
							type='button'
							aria-label={
								showNewPassword ? 'Hide new password' : 'Show new password'
							}
							title={
								showNewPassword ? 'Hide new password' : 'Show new password'
							}
							onClick={() => setShowNewPassword((value) => !value)}>
							<FontAwesomeIcon icon={showNewPassword ? faEyeSlash : faEye} />
						</PasswordVisibilityButton>
					</PasswordInputWrapper>
				</FormGroup>

				<FormGroup>
					<FormLabel>Confirm New Password</FormLabel>
					<PasswordInputWrapper>
						<FormInput
							type={showConfirmPassword ? 'text' : 'password'}
							value={passwordForm.confirmPassword}
							onChange={(e) =>
								setPasswordForm({
									...passwordForm,
									confirmPassword: e.target.value,
								})
							}
							placeholder='Confirm your new password'
							required
						/>
						<PasswordVisibilityButton
							type='button'
							aria-label={
								showConfirmPassword
									? 'Hide confirmed password'
									: 'Show confirmed password'
							}
							title={
								showConfirmPassword
									? 'Hide confirmed password'
									: 'Show confirmed password'
							}
							onClick={() => setShowConfirmPassword((value) => !value)}>
							<FontAwesomeIcon
								icon={showConfirmPassword ? faEyeSlash : faEye}
							/>
						</PasswordVisibilityButton>
					</PasswordInputWrapper>
				</FormGroup>

				<ActionHelperText>
					Password must be at least 6 characters long.
				</ActionHelperText>
			</GenericModal>

			<GenericModal
				isOpen={showDeleteAccountModal}
				title='Delete Account'
				onClose={() => {
					setShowDeleteAccountModal(false);
					setDeleteAccountError('');
					setDeleteConfirmationInput('');
				}}
				primaryButtonLabel={
					deleteModalState === 'active_subscription' ||
						deleteModalState === 'pending_cancellation'
						? 'Manage Subscription'
						: deleteModalState === 'team_owner'
							? 'Open Team'
							: 'Delete Account'
				}
				secondaryButtonLabel='Cancel'
				isLoading={isDeletingAccount}
				showActions={!isDeletingAccount}
				primaryButtonDisabled={
					deleteModalState === 'ready' && deleteConfirmationInput !== 'DELETE'
				}
				onSubmit={
					deleteModalState === 'active_subscription' ||
						deleteModalState === 'pending_cancellation'
						? () => {
							setShowDeleteAccountModal(false);
							navigate('/settings?category=account');
						}
						: deleteModalState === 'team_owner'
							? () => {
								setShowDeleteAccountModal(false);
								navigate('/team');
							}
							: handleDeleteAccount
				}>
				<div style={{ marginBottom: '12px', height: '100%', justifyContent: 'space-between', alignItems: 'center', display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', position: 'relative' }}>
					{deleteAccountError && (
						<ErrorMessage>{deleteAccountError}</ErrorMessage>
					)}

					{isDeletingAccount && deleteModalState === 'ready' && (
						<DeleteLoadingOverlay>
							<DeleteLoadingCard>
								<DeleteLoadingTitle>Sorry to see you go</DeleteLoadingTitle>
								<HouseLogoLoader variant='deconstruct' size={76} />
								<DeleteLoadingText>
									Removing your account data now. This usually takes just a moment.
								</DeleteLoadingText>
							</DeleteLoadingCard>
						</DeleteLoadingOverlay>
					)}

					{!isDeletingAccount && deleteModalState === 'active_subscription' && (
						<div
							style={{
								background: '#fff5f5',
								border: '1px solid #fecaca',
								borderRadius: '10px',
								padding: '12px 14px',
								color: '#7f1d1d',
							}}>
							<p style={{ margin: 0, fontWeight: 700, display: 'flex', gap: '8px', alignItems: 'center' }}>
								<FontAwesomeIcon icon={faTriangleExclamation} />
								Active Subscription Required
							</p>
							<p style={{ margin: '8px 0 0', color: '#7f1d1d' }}>
								You currently have an active {currentPlanDetails?.name || 'paid'} subscription.
								Account deletion is unavailable while a subscription is active.
							</p>
							<p style={{ margin: '10px 0 0', color: '#7f1d1d' }}>To delete your account:</p>
							<ol style={{ margin: '4px 0 0 18px', padding: 0, color: '#7f1d1d' }}>
								<li>Cancel your subscription</li>
								<li>Wait for the subscription to end or downgrade</li>
								<li>Return here to delete your account</li>
							</ol>
						</div>
					)}

					{!isDeletingAccount && deleteModalState === 'pending_cancellation' && (
						<div
							style={{
								background: '#fff5f5',
								border: '1px solid #fecaca',
								borderRadius: '10px',
								padding: '12px 14px',
								color: '#7f1d1d',
							}}>
							<p style={{ margin: 0, fontWeight: 700, display: 'flex', gap: '8px', alignItems: 'center' }}>
								<FontAwesomeIcon icon={faTriangleExclamation} />
								Subscription Ending Soon
							</p>
							<p style={{ margin: '8px 0 0', color: '#7f1d1d' }}>
								Your subscription is scheduled to end on {subscriptionEndDateLabel}.
								Account deletion will become available once it expires.
							</p>
						</div>
					)}

					{!isDeletingAccount && deleteModalState === 'team_owner' && (
						<div
							style={{
								background: '#fff5f5',
								border: '1px solid #fecaca',
								borderRadius: '10px',
								padding: '12px 14px',
								color: '#7f1d1d',
							}}>
							<p style={{ margin: 0, fontWeight: 700, display: 'flex', gap: '8px', alignItems: 'center' }}>
								<FontAwesomeIcon icon={faTriangleExclamation} />
								Team Ownership Review Required
							</p>
							<p style={{ margin: '8px 0 0', color: '#7f1d1d' }}>
								You currently own properties with active team members.
								Remove team access or transfer ownership before deleting this account.
							</p>
						</div>
					)}

					{!isDeletingAccount && deleteModalState === 'ready' && (
						<div>
							<div
								style={{
									background: '#fff5f5',
									border: '1px solid #fecaca',
									borderRadius: '10px',
									padding: '12px 14px',
									color: '#7f1d1d',
								}}>
								<p style={{ margin: 0, fontWeight: 700, display: 'flex', gap: '8px', alignItems: 'center' }}>
									<FontAwesomeIcon icon={faTriangleExclamation} />
									Delete account is permanent
								</p>
								<p style={{ margin: '8px 0 0', color: '#7f1d1d' }}>
									This action cannot be undone.
								</p>
							</div>
							<div style={{ marginTop: '12px', color: '#4b5563' }}>
								{hasDeleteImpactData ? (
									<>
										<p style={{ margin: '0 0 6px', fontWeight: 600 }}>
											Deleting your account will permanently remove:
										</p>
										<ul style={{ margin: 0, paddingLeft: '18px' }}>
											{deleteImpactItems.map((item) => (
												<li key={item.label}>{item.value} {item.label}</li>
											))}
										</ul>
									</>
								) : (
									<p style={{ marginTop: '15px', fontWeight: 600 }}>
										No saved properties, systems, maintenance records, or uploaded documents were found in this account.
									</p>
								)}
							</div>
						</div>
					)}

					{!isDeletingAccount && deleteModalState === 'ready' && (
						<div style={{ marginTop: '14px' }}>
							<FormLabel htmlFor={deleteConfirmationInputId}>Type DELETE to confirm</FormLabel>
							<FormInput
								id={deleteConfirmationInputId}
								type='text'
								value={deleteConfirmationInput}
								onChange={(e) => setDeleteConfirmationInput(e.target.value)}
								placeholder='DELETE'
								autoComplete='off'
							/>
						</div>
					)}
				</div>
			</GenericModal>
		</Wrapper >
	);
};
