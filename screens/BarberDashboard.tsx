import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, SafeAreaView, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import {
	addDoc,
	collection,
	deleteDoc,
	doc,
	getDoc,
	getDocs,
	onSnapshot,
	orderBy,
	query,
	updateDoc,
	where,
} from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/config/firebase';
import { startAppointment, completeAppointment, cancelAppointment } from '@/services/appointmentActions';
import { ALL_TIME_SLOTS } from '@/src/services/availabilityService';
import {
	AccountingCard,
	CalendarSection,
	HeaderSection,
	PaymentsSection,
	RevenueCard,
	ReviewsSection,
	ScheduleSection,
	SocialSection,
	StatsCard,
} from './barber-dashboard/BarberDashboardSections';
import type {
	BlockedSlot,
	ClosedDay,
	PaymentAccounts,
	ReviewItem,
	SocialLinks,
	WorkingHours,
} from './barber-dashboard/BarberDashboardSections';
import { styles } from './barber-dashboard/styles';

type AppointmentItem = {
	id: string;
	userId?: string;
	clientName?: string;
	serviceName?: string;
	date?: string | { seconds: number } | Date | null;
	time?: string | { seconds: number } | Date | null;
	price?: number;
	status?: string;
};

type ManualPayment = {
	id: string;
	amount?: number;
	type?: 'walkin' | 'tip' | 'product';
	date?: unknown;
};

const WEEK_DAYS = [
	'monday',
	'tuesday',
	'wednesday',
	'thursday',
	'friday',
	'saturday',
	'sunday',
] as const;

const STAR_FULL = '\u2605';
const STAR_EMPTY = '\u2606';

function padTime(value: number) {
	return value.toString().padStart(2, '0');
}

function startOfToday() {
	const now = new Date();
	return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function toDateKey(value: Date) {
	const year = value.getFullYear();
	const month = padTime(value.getMonth() + 1);
	const day = padTime(value.getDate());
	return `${year}-${month}-${day}`;
}

function parseDateValue(value: unknown) {
	if (!value) return null;
	if (value instanceof Date) return value;
	if (typeof value === 'string') {
		if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
			const [year, month, day] = value.split('-').map(Number);
			return new Date(year, month - 1, day);
		}
		const parsed = new Date(value);
		return Number.isNaN(parsed.getTime()) ? null : parsed;
	}
	if (typeof value === 'object') {
		if ('toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
			return (value as { toDate: () => Date }).toDate();
		}
		if ('seconds' in value && typeof (value as { seconds: number }).seconds === 'number') {
			return new Date((value as { seconds: number }).seconds * 1000);
		}
	}
	return null;
}

function isSameDay(left: Date, right: Date) {
	return (
		left.getFullYear() === right.getFullYear() &&
		left.getMonth() === right.getMonth() &&
		left.getDate() === right.getDate()
	);
}

function formatMoney(value?: number) {
	if (typeof value !== 'number' || Number.isNaN(value)) return '$0';
	return `$${value.toFixed(2)}`;
}

function formatTimeLabel(value: string) {
	const [rawHour, rawMinute] = value.split(':').map(Number);
	if (Number.isNaN(rawHour) || Number.isNaN(rawMinute)) return value;
	const period = rawHour >= 12 ? 'PM' : 'AM';
	const hour = rawHour % 12 === 0 ? 12 : rawHour % 12;
	const minute = rawMinute.toString().padStart(2, '0');
	return `${hour}:${minute} ${period}`;
}

function to24HourString(value: string) {
	const trimmed = value.trim();
	if (!trimmed) return null;
	const match24 = trimmed.match(/^(\d{1,2}):(\d{2})$/);
	if (match24) {
		const hours = Number(match24[1]);
		const minutes = Number(match24[2]);
		if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
		if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
		return `${padTime(hours)}:${padTime(minutes)}`;
	}
	const match12 = trimmed.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
	if (!match12) return null;
	const hoursRaw = Number(match12[1]);
	const minutes = Number(match12[2]);
	if (Number.isNaN(hoursRaw) || Number.isNaN(minutes)) return null;
	if (hoursRaw < 1 || hoursRaw > 12 || minutes < 0 || minutes > 59) return null;
	const period = match12[3]?.toLowerCase();
	let hours = hoursRaw % 12;
	if (period === 'pm') hours += 12;
	return `${padTime(hours)}:${padTime(minutes)}`;
}

function normalizeTimeInput(value: string) {
	const trimmed = value.trim();
	if (!trimmed) return '';
	const match12 = trimmed.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
	if (match12) {
		const hours = Number(match12[1]);
		const minutes = Number(match12[2]);
		if (Number.isNaN(hours) || Number.isNaN(minutes)) return trimmed;
		const safeHours = Math.max(1, Math.min(12, hours));
		const period = match12[3]?.toUpperCase() ?? 'AM';
		return `${safeHours}:${padTime(minutes)} ${period}`;
	}
	const match24 = trimmed.match(/^(\d{1,2}):(\d{2})$/);
	if (!match24) return trimmed;
	const hours24 = Number(match24[1]);
	const minutes = Number(match24[2]);
	if (Number.isNaN(hours24) || Number.isNaN(minutes)) return trimmed;
	const period = hours24 >= 12 ? 'PM' : 'AM';
	const hour = hours24 % 12 === 0 ? 12 : hours24 % 12;
	return `${hour}:${padTime(minutes)} ${period}`;
}

function appointmentDateKey(value: AppointmentItem['date']) {
	if (!value) return '';
	if (typeof value === 'string') {
		if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
		if (value.includes('T')) return value.split('T')[0] ?? value;
	}
	const parsed = parseDateValue(value);
	return parsed ? toDateKey(parsed) : '';
}

function appointmentTimeValue(value?: AppointmentItem['time'] | AppointmentItem['date']) {
	if (!value) return null;
	if (typeof value === 'string') {
		if (/^\d{2}:\d{2}$/.test(value)) return value;
		const match12 = value.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
		if (match12) return to24HourString(value);
		if (value.includes('T')) {
			const timePart = value.split('T')[1] ?? '';
			return timePart.slice(0, 5) || null;
		}
	}
	const parsed = parseDateValue(value);
	if (!parsed) return null;
	return `${padTime(parsed.getHours())}:${padTime(parsed.getMinutes())}`;
}

function appointmentTimeMinutes(value?: AppointmentItem['time']) {
	const timeValue = appointmentTimeValue(value);
	if (!timeValue) return 0;
	const [hours, minutes] = timeValue.split(':').map(Number);
	if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;
	return hours * 60 + minutes;
}

function reviewDate(value?: ReviewItem['createdAt']) {
	const parsed = parseDateValue(value);
	if (!parsed) return '';
	return parsed.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	});
}

function reviewStars(value?: number) {
	const rating = typeof value === 'number' ? Math.round(value) : 0;
	const safeRating = Math.max(0, Math.min(5, rating));
	return `${STAR_FULL.repeat(safeRating)}${STAR_EMPTY.repeat(5 - safeRating)}`;
}

const AppointmentCard = memo(function AppointmentCard({
	item,
	onStart,
	onComplete,
	onCancel,
	disabled,
}: {
	item: AppointmentItem;
	onStart: (id: string) => void;
	onComplete: (id: string) => void;
	onCancel: (id: string) => void;
	disabled: boolean;
}) {
	const status = item.status ?? 'pending';
	const isStarted = status === 'started';
	const isCompleted = status === 'completed';
	const isCancelled = status === 'cancelled';
	const canAct = !isCompleted && !isCancelled;
	const primaryLabel = isStarted ? 'Complete' : 'Start';
	const dateLabel = appointmentDateKey(item.date) || 'TBD';
	const timeValue = appointmentTimeValue(item.time ?? item.date);
	const timeLabel = timeValue ? formatTimeLabel(timeValue) : 'TBD';
	const statusLabel = isCancelled
		? 'Cancelled'
		: isCompleted
		? 'Completed'
		: isStarted
		? 'In progress'
		: 'Upcoming';

	return (
		<View style={[styles.card, { backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(225, 6, 0, 0.85)' }]}>
			<Text style={styles.dateText}>Date: {dateLabel}</Text>
			<Text style={styles.statusText}>Status: {statusLabel}</Text>
			<View style={styles.timelineRow}>
				<Text style={styles.timelineTime}>{timeLabel}</Text>
				<View style={styles.timelineDetails}>
					<Text style={styles.serviceText}>{item.serviceName ?? 'Service'}</Text>
					<Text style={styles.clientText}>{item.clientName ?? 'Client'}</Text>
					<Text style={styles.priceText}>{formatMoney(item.price)}</Text>
				</View>
			</View>
			<View style={styles.actionsRow}>
				<Pressable
					style={[styles.actionButton, styles.primaryButton]}
					onPress={() => (isStarted ? onComplete(item.id) : onStart(item.id))}
					disabled={!canAct || disabled}
				>
					<Text style={styles.primaryButtonText}>{primaryLabel}</Text>
				</Pressable>
				<Pressable
					style={[styles.actionButton, styles.secondaryButton]}
					onPress={() => onCancel(item.id)}
					disabled={!canAct || disabled}
				>
					<Text style={styles.secondaryButtonText}>Cancel</Text>
				</Pressable>
			</View>
		</View>
	);
});

export default function BarberDashboard() {
	const { user } = useAuth();
	const router = useRouter();
	const [barberId, setBarberId] = useState<string | null>(null);
	const [barberDocId, setBarberDocId] = useState<string | null>(null);
	const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
	const [loadingAppointments, setLoadingAppointments] = useState(true);
	const [manualPayments, setManualPayments] = useState<ManualPayment[]>([]);
	const [reviews, setReviews] = useState<ReviewItem[]>([]);
	const [loadingReviews, setLoadingReviews] = useState(true);
	const [loadingRevenue, setLoadingRevenue] = useState(true);
	const [todayRevenue, setTodayRevenue] = useState(0);
	const [todayCount, setTodayCount] = useState(0);
	const [totalClients, setTotalClients] = useState(0);
	const [totalServices, setTotalServices] = useState(0);
	const [weeklyRevenue, setWeeklyRevenue] = useState(0);
	const [actionId, setActionId] = useState<string | null>(null);
	const [socialLinks, setSocialLinks] = useState<SocialLinks>({
		instagram: '',
		facebook: '',
		tiktok: '',
		website: '',
	});
	const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccounts>({
		zelle: '',
		cashapp: '',
	});
	const [showZelleQR, setShowZelleQR] = useState(false);
	const [showCashAppQR, setShowCashAppQR] = useState(false);
	const [isEditingPayments, setIsEditingPayments] = useState(false);
	const [savingPayments, setSavingPayments] = useState(false);
	const [workingHours, setWorkingHours] = useState<Record<string, WorkingHours>>(() =>
		WEEK_DAYS.reduce<Record<string, WorkingHours>>((acc, day) => {
			acc[day] = { start: '9:00 AM', end: '6:00 PM' };
			return acc;
		}, {})
	);
	const [closedDays, setClosedDays] = useState<ClosedDay[]>([]);
	const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
	const [newClosedDate, setNewClosedDate] = useState('');
	const [blockDateKey, setBlockDateKey] = useState(() => toDateKey(new Date()));
	const [blockTime, setBlockTime] = useState<string | null>(null);
	const [savingSchedule, setSavingSchedule] = useState(false);
	const [showWorkingHours, setShowWorkingHours] = useState(false);
	const [showClosedDays, setShowClosedDays] = useState(false);
	const [showBlockedSlots, setShowBlockedSlots] = useState(false);
	const [isEditingSocials, setIsEditingSocials] = useState(false);
	const [savingSocials, setSavingSocials] = useState(false);
	const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(new Date()));
	const [showCalendar, setShowCalendar] = useState(false);
	const todayStart = useMemo(() => startOfToday(), []);
	const todayKey = useMemo(() => toDateKey(new Date()), []);
	const weekStartKey = useMemo(() => {
		const start = new Date(todayStart);
		start.setDate(start.getDate() - 7);
		return toDateKey(start);
	}, [todayStart]);
	const reviewsSummary = useMemo(() => {
		if (reviews.length === 0) return { average: 0, count: 0 };
		const total = reviews.reduce((sum, review) => sum + (review.rating ?? 0), 0);
		return { average: total / reviews.length, count: reviews.length };
	}, [reviews]);

	const accountingSummary = useMemo(() => {
		const today = new Date();
		let walkins = 0;
		let tips = 0;
		let products = 0;
		manualPayments.forEach((item) => {
			const date = parseDateValue(item.date);
			if (!date || !isSameDay(date, today)) return;
			const amount = typeof item.amount === 'number' ? item.amount : 0;
			if (item.type === 'tip') tips += amount;
			else if (item.type === 'product') products += amount;
			else walkins += amount;
		});
		const total = todayRevenue + walkins + tips + products;
		return {
			appointmentsRevenue: todayRevenue,
			appointmentsCompleted: todayCount,
			walkins,
			tips,
			products,
			total,
		};
	}, [manualPayments, todayRevenue, todayCount]);

	useEffect(() => {
		const loadBarberId = async () => {
			const uid = user?.uid;
			if (!uid) {
				setBarberId(null);
				setBarberDocId(null);
				setLoadingAppointments(false);
				setLoadingRevenue(false);
				return;
			}
			const barberQuery = query(collection(db, 'barbers'), where('userId', '==', uid));
			const barberSnapshot = await getDocs(barberQuery);
			if (barberSnapshot.empty) {
				setBarberId(null);
				setBarberDocId(null);
				setLoadingAppointments(false);
				setLoadingRevenue(false);
				return;
			}
			const barberSnapshotDoc = barberSnapshot.docs[0];
			const barberDoc = barberSnapshotDoc.data() as {
				prismaBarberId?: string;
				instagram?: string;
				facebook?: string;
				tiktok?: string;
				website?: string;
				zelle?: string;
				cashapp?: string;
				workingHours?: Record<string, WorkingHours>;
			};
			setBarberDocId(barberSnapshotDoc.id);
			setBarberId(barberSnapshotDoc.id);
			setSocialLinks({
				instagram: barberDoc.instagram ?? '',
				facebook: barberDoc.facebook ?? '',
				tiktok: barberDoc.tiktok ?? '',
				website: barberDoc.website ?? '',
			});
			setPaymentAccounts({
				zelle: barberDoc.zelle ?? '',
				cashapp: barberDoc.cashapp ?? '',
			});
			if (barberDoc.workingHours) {
				setWorkingHours((current) => {
					const next: Record<string, WorkingHours> = { ...current };
					WEEK_DAYS.forEach((day) => {
						const dayHours = barberDoc.workingHours?.[day];
						next[day] = {
							start:
								normalizeTimeInput(dayHours?.start ?? next[day]?.start ?? '9:00 AM') ||
								'9:00 AM',
							end:
								normalizeTimeInput(dayHours?.end ?? next[day]?.end ?? '6:00 PM') ||
								'6:00 PM',
						};
					});
					return next;
				});
			}
		};

		void loadBarberId();
	}, [user?.uid]);

	const zelleQrValue = useMemo(() => {
		const email = paymentAccounts.zelle.trim();
		return email ? `mailto:${email}` : '';
	}, [paymentAccounts.zelle]);

	const cashAppQrValue = useMemo(() => {
		const rawTag = paymentAccounts.cashapp.trim();
		if (!rawTag) return '';
		const normalizedTag = rawTag.replace(/^\$/, '');
		return normalizedTag ? `https://cash.app/${normalizedTag}` : '';
	}, [paymentAccounts.cashapp]);

	const qrImageUrl = useCallback((value: string) => {
		const encoded = encodeURIComponent(value);
		return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encoded}`;
	}, []);

	useEffect(() => {
		if (!barberId) {
			setClosedDays([]);
			setBlockedSlots([]);
			return;
		}
		const loadSchedule = async () => {
			const closedSnap = await getDocs(
				query(collection(db, 'barberClosedDays'), where('barberId', '==', barberId))
			);
			setClosedDays(
				closedSnap.docs.map((docSnap) => {
					const data = docSnap.data() as { date?: string };
					return { id: docSnap.id, date: data.date ?? '' };
				})
			);
			const blockedSnap = await getDocs(
				query(collection(db, 'blockedSlots'), where('barberId', '==', barberId))
			);
			setBlockedSlots(
				blockedSnap.docs.map((docSnap) => {
					const data = docSnap.data() as { date?: string; time?: string };
					return { id: docSnap.id, date: data.date ?? '', time: data.time ?? '' };
				})
			);
		};

		void loadSchedule();
	}, [barberId]);

	useEffect(() => {
		if (!barberId) {
			setAppointments([]);
			setLoadingAppointments(false);
			return;
		}
		setLoadingAppointments(true);
		const appointmentsQuery = query(
			collection(db, 'appointments'),
			where('barberId', '==', barberId)
		);
		const unsubscribe = onSnapshot(
			appointmentsQuery,
			(snapshot) => {
				const data = snapshot.docs
					.map((docItem) => {
						const docData = docItem.data() as AppointmentItem;
						return { ...docData, id: docItem.id };
					})
					.filter((item) => appointmentDateKey(item.date) === selectedDateKey)
					.sort(
						(left, right) =>
							appointmentTimeMinutes(left.time) - appointmentTimeMinutes(right.time)
					);
				const missingUserIds = Array.from(
					new Set(
						data
							.filter((item) => !item.clientName && item.userId)
							.map((item) => item.userId as string)
					)
				);
				if (missingUserIds.length === 0) {
					setAppointments(data);
					setLoadingAppointments(false);
					return;
				}
				Promise.all(
					missingUserIds.map(async (userId) => {
						const userSnap = await getDoc(doc(db, 'users', userId));
						const userData = userSnap.exists()
							? (userSnap.data() as { name?: string })
							: undefined;
						return { userId, name: userData?.name?.trim() || 'Client' };
					})
				)
					.then((resolved) => {
						const nameMap = new Map(resolved.map((item) => [item.userId, item.name]));
						const merged = data.map((item) =>
							item.clientName
								? item
								: { ...item, clientName: nameMap.get(item.userId ?? '') ?? 'Client' }
						);
						setAppointments(merged);
						setLoadingAppointments(false);
					})
					.catch((error) => {
						console.log('[BarberDashboard] client name lookup error:', error);
						setAppointments(data);
						setLoadingAppointments(false);
					});
			},
			(error) => {
				console.log('[BarberDashboard] appointments error:', error);
				setAppointments([]);
				setLoadingAppointments(false);
			}
		);
		return () => unsubscribe();
	}, [barberId, selectedDateKey]);

	useEffect(() => {
		if (!barberId) {
			setReviews([]);
			setLoadingReviews(false);
			return;
		}
		setLoadingReviews(true);
		const reviewsQuery = query(
			collection(db, 'reviews'),
			where('barberId', '==', barberId),
			orderBy('createdAt', 'desc')
		);
		const unsubscribe = onSnapshot(
			reviewsQuery,
			(snapshot) => {
				const data = snapshot.docs.map((docItem) => {
					const docData = docItem.data() as ReviewItem;
					return { ...docData, id: docItem.id };
				});
				setReviews(data);
				setLoadingReviews(false);
			},
			(error) => {
				console.log('[BarberDashboard] reviews error:', error);
				setReviews([]);
				setLoadingReviews(false);
			}
		);
		return () => unsubscribe();
	}, [barberId]);

	useEffect(() => {
		if (!barberId) {
			setManualPayments([]);
			return;
		}
		const paymentsQuery = query(
			collection(db, 'manualPayments'),
			where('barberId', '==', barberId)
		);
		const unsubscribe = onSnapshot(
			paymentsQuery,
			(snapshot) => {
				const data = snapshot.docs.map((docItem) => {
					const docData = docItem.data() as Omit<ManualPayment, 'id'>;
					return { ...docData, id: docItem.id } as ManualPayment;
				});
				setManualPayments(data);
			},
			(error) => {
				console.log('[BarberDashboard] manual payments error:', error);
				setManualPayments([]);
			}
		);
		return () => unsubscribe();
	}, [barberId]);

	useEffect(() => {
		if (!barberId) {
			setTodayRevenue(0);
			setLoadingRevenue(false);
			return;
		}
		setLoadingRevenue(true);
		const revenueQuery = query(
			collection(db, 'appointments'),
			where('barberId', '==', barberId),
			where('status', '==', 'completed'),
			where('date', '==', todayKey)
		);
		const unsubscribe = onSnapshot(
			revenueQuery,
			(snapshot) => {
				const total = snapshot.docs.reduce((sum, docItem) => {
					const price = docItem.data().price;
					return sum + (typeof price === 'number' ? price : 0);
				}, 0);
				setTodayRevenue(total);
				setTodayCount(snapshot.size);
				setLoadingRevenue(false);
			},
			(error) => {
				console.log('[BarberDashboard] revenue error:', error);
				setTodayRevenue(0);
				setTodayCount(0);
				setLoadingRevenue(false);
			}
		);
		return () => unsubscribe();
	}, [barberId, todayKey]);

	useEffect(() => {
		if (!barberId) {
			setTotalClients(0);
			setTotalServices(0);
			setWeeklyRevenue(0);
			return;
		}
		const completedQuery = query(
			collection(db, 'appointments'),
			where('barberId', '==', barberId),
			where('status', '==', 'completed')
		);
		const weeklyQuery = query(
			collection(db, 'appointments'),
			where('barberId', '==', barberId),
			where('status', '==', 'completed'),
			where('date', '>=', weekStartKey),
			where('date', '<=', todayKey)
		);

		const unsubscribeCompleted = onSnapshot(
			completedQuery,
			(snapshot) => {
				const uniqueClients = new Set<string>();
				snapshot.docs.forEach((docItem) => {
					const data = docItem.data() as { userId?: string };
					if (data.userId) uniqueClients.add(data.userId);
				});
				setTotalClients(uniqueClients.size);
				setTotalServices(snapshot.size);
			},
			(error) => {
				console.log('[BarberDashboard] stats completed error:', error);
				setTotalClients(0);
				setTotalServices(0);
			}
		);

		const unsubscribeWeekly = onSnapshot(
			weeklyQuery,
			(snapshot) => {
				const total = snapshot.docs.reduce((sum, docItem) => {
					const price = docItem.data().price;
					return sum + (typeof price === 'number' ? price : 0);
				}, 0);
				setWeeklyRevenue(total);
			},
			(error) => {
				console.log('[BarberDashboard] stats weekly error:', error);
				setWeeklyRevenue(0);
			}
		);

		return () => {
			unsubscribeCompleted();
			unsubscribeWeekly();
		};
	}, [barberId, todayKey, weekStartKey]);

	const handleStart = useCallback(async (id: string) => {
		setActionId(id);
		try {
			await startAppointment(id);
		} catch (error) {
			console.log('[BarberDashboard] start error:', error);
			Alert.alert('Unable to start appointment');
		} finally {
			setActionId(null);
		}
	}, []);

	const handleComplete = useCallback(async (id: string) => {
		setActionId(id);
		try {
			await completeAppointment(id);
		} catch (error) {
			console.log('[BarberDashboard] complete error:', error);
			Alert.alert('Unable to complete appointment');
		} finally {
			setActionId(null);
		}
	}, []);

	const handleCancel = useCallback(async (id: string) => {
		setActionId(id);
		try {
			await cancelAppointment(id);
		} catch (error) {
			console.log('[BarberDashboard] cancel error:', error);
			Alert.alert('Unable to cancel appointment');
		} finally {
			setActionId(null);
		}
	}, []);

	const handleSaveSocials = useCallback(async () => {
		if (!barberDocId || savingSocials) return;
		setSavingSocials(true);
		try {
			await updateDoc(doc(db, 'barbers', barberDocId), {
				instagram: socialLinks.instagram.trim(),
				facebook: socialLinks.facebook.trim(),
				tiktok: socialLinks.tiktok.trim(),
				website: socialLinks.website.trim(),
			});
			setIsEditingSocials(false);
		} finally {
			setSavingSocials(false);
		}
	}, [barberDocId, savingSocials, socialLinks]);

	const handleSavePayments = useCallback(async () => {
		if (!barberDocId || savingPayments) return;
		setSavingPayments(true);
		try {
			await updateDoc(doc(db, 'barbers', barberDocId), {
				zelle: paymentAccounts.zelle.trim(),
				cashapp: paymentAccounts.cashapp.trim(),
			});
			setIsEditingPayments(false);
		} finally {
			setSavingPayments(false);
		}
	}, [barberDocId, paymentAccounts, savingPayments]);

	const handleSaveWorkingHours = useCallback(async () => {
		if (!barberDocId || savingSchedule) return;
		setSavingSchedule(true);
		try {
			const normalizedHours = WEEK_DAYS.reduce<Record<string, WorkingHours>>(
				(acc, day) => {
					const start = to24HourString(workingHours[day]?.start ?? '') ?? '09:00';
					const end = to24HourString(workingHours[day]?.end ?? '') ?? '18:00';
					acc[day] = { start, end };
					return acc;
				},
				{}
			);
			await updateDoc(doc(db, 'barbers', barberDocId), {
				workingHours: normalizedHours,
			});
		} finally {
			setSavingSchedule(false);
		}
	}, [barberDocId, savingSchedule, workingHours]);

	const handleAddClosedDay = useCallback(async () => {
		if (!barberId || !newClosedDate.trim()) return;
		const date = newClosedDate.trim();
		const docRef = await addDoc(collection(db, 'barberClosedDays'), {
			barberId,
			date,
		});
		setClosedDays((current) => [...current, { id: docRef.id, date }]);
		setNewClosedDate('');
	}, [barberId, newClosedDate]);

	const handleRemoveClosedDay = useCallback(async (id: string) => {
		await deleteDoc(doc(db, 'barberClosedDays', id));
		setClosedDays((current) => current.filter((item) => item.id !== id));
	}, []);

	const handleAddBlockedSlot = useCallback(async () => {
		if (!barberId || !blockDateKey || !blockTime) return;
		const date = blockDateKey;
		const time = blockTime;
		const docRef = await addDoc(collection(db, 'blockedSlots'), {
			barberId,
			date,
			time,
		});
		setBlockedSlots((current) => [...current, { id: docRef.id, date, time }]);
		setBlockTime(null);
	}, [barberId, blockDateKey, blockTime]);

	const handleRemoveBlockedSlot = useCallback(async (id: string) => {
		await deleteDoc(doc(db, 'blockedSlots', id));
		setBlockedSlots((current) => current.filter((item) => item.id !== id));
	}, []);

	const handleChangeWorkingHours = useCallback(
		(day: string, field: 'start' | 'end', value: string) => {
			setWorkingHours((current) => ({
				...current,
				[day]: { ...current[day], [field]: normalizeTimeInput(value) },
			}));
		},
		[]
	);

	const handleChangePaymentAccount = useCallback(
		(field: keyof PaymentAccounts, value: string) => {
			setPaymentAccounts((current) => ({
				...current,
				[field]: value,
			}));
		},
		[]
	);

	const handleChangeSocialLink = useCallback((field: keyof SocialLinks, value: string) => {
		setSocialLinks((current) => ({
			...current,
			[field]: value,
		}));
	}, []);

	const openMap = useCallback(() => {
		Linking.openURL('https://maps.google.com/?q=JB+Barbershop+Lynn+MA');
	}, []);

	const makeCall = useCallback(() => {
		Linking.openURL('tel:+17815551234');
	}, []);

	const openWhatsAppShop = useCallback(() => {
		Linking.openURL('https://wa.me/17815551234?text=Hi I want to book an appointment');
	}, []);

	const renderItem = useCallback(
		({ item }: { item: AppointmentItem }) => (
			<AppointmentCard
				item={item}
				onStart={handleStart}
				onComplete={handleComplete}
				onCancel={handleCancel}
				disabled={actionId === item.id}
			/>
		),
		[actionId, handleCancel, handleComplete, handleStart]
	);

	return (
		<SafeAreaView style={styles.screen}>
			<FlatList
				data={appointments}
				keyExtractor={(item) => item.id}
				renderItem={renderItem}
				contentContainerStyle={styles.list}
				ListHeaderComponent={
					<View>
						<HeaderSection
							selectedDateKey={selectedDateKey}
							showCalendar={showCalendar}
							onBack={() => {
								if (router.canGoBack()) {
									router.back();
									return;
								}
								router.replace('/(tabs)/profile');
							}}
							onToggleCalendar={() => setShowCalendar((current) => !current)}
							onGoHistory={() => router.push('/barber-dashboard/appointments')}
							onGoAccounting={() => router.push('/barber-dashboard/accounting')}
						/>
						{showCalendar ? (
							<CalendarSection
								selectedDateKey={selectedDateKey}
								onDayPress={(dateString) => {
									setSelectedDateKey(dateString);
									setShowCalendar(false);
								}}
							/>
						) : null}
						<RevenueCard
							loading={loadingRevenue}
							revenue={todayRevenue}
							count={todayCount}
							formatMoney={formatMoney}
						/>
						<AccountingCard summary={accountingSummary} formatMoney={formatMoney} />
						<StatsCard
							reviewsSummary={reviewsSummary}
							totalClients={totalClients}
							totalServices={totalServices}
							weeklyRevenue={weeklyRevenue}
							formatMoney={formatMoney}
						/>
						<View style={styles.sectionHeader}>
							<Text style={styles.sectionTitle}>Appointments</Text>
						</View>
					</View>
				}
				ListEmptyComponent={
					loadingAppointments ? (
						<View style={styles.list}>
							<View style={styles.skeletonCard}>
								<View style={styles.skeletonLineWide} />
								<View style={styles.skeletonLine} />
								<View style={styles.skeletonActions} />
							</View>
							<View style={styles.skeletonCard}>
								<View style={styles.skeletonLineWide} />
								<View style={styles.skeletonLine} />
								<View style={styles.skeletonActions} />
							</View>
						</View>
					) : (
						<Text style={styles.emptyText}>No appointments for this date.</Text>
					)
				}
				ListFooterComponent={
					<View>
						<ScheduleSection
							showWorkingHours={showWorkingHours}
							showClosedDays={showClosedDays}
							showBlockedSlots={showBlockedSlots}
							workingHours={workingHours}
							newClosedDate={newClosedDate}
							blockDateKey={blockDateKey}
							blockTime={blockTime}
							closedDays={closedDays}
							blockedSlots={blockedSlots}
							weekDays={WEEK_DAYS}
							allTimeSlots={ALL_TIME_SLOTS}
							savingSchedule={savingSchedule}
							onToggleWorkingHours={() => setShowWorkingHours((current) => !current)}
							onToggleClosedDays={() => setShowClosedDays((current) => !current)}
							onToggleBlockedSlots={() => setShowBlockedSlots((current) => !current)}
							onChangeWorkingHours={handleChangeWorkingHours}
							onChangeClosedDate={setNewClosedDate}
							onChangeBlockDateKey={setBlockDateKey}
							onSelectBlockTime={setBlockTime}
							onSaveWorkingHours={handleSaveWorkingHours}
							onAddClosedDay={handleAddClosedDay}
							onRemoveClosedDay={handleRemoveClosedDay}
							onAddBlockedSlot={handleAddBlockedSlot}
							onRemoveBlockedSlot={handleRemoveBlockedSlot}
							formatTimeLabel={formatTimeLabel}
						/>
						<PaymentsSection
							barberDocId={barberDocId}
							isEditing={isEditingPayments}
							onToggleEdit={() => setIsEditingPayments((current) => !current)}
							paymentAccounts={paymentAccounts}
							onChangePaymentAccount={handleChangePaymentAccount}
							onSavePayments={handleSavePayments}
							savingPayments={savingPayments}
							zelleQrValue={zelleQrValue}
							cashAppQrValue={cashAppQrValue}
							showZelleQR={showZelleQR}
							onToggleZelleQR={() => setShowZelleQR((current) => !current)}
							showCashAppQR={showCashAppQR}
							onToggleCashAppQR={() => setShowCashAppQR((current) => !current)}
							qrImageUrl={qrImageUrl}
						/>
						<ReviewsSection
							loading={loadingReviews}
							reviews={reviews}
							reviewsSummary={reviewsSummary}
							reviewDate={reviewDate}
							reviewStars={reviewStars}
						/>
						<View style={styles.socialCard}>
							<Text style={styles.socialTitle}>Support & Info</Text>
							<Pressable onPress={openMap}>
								<Text style={styles.supportLinkText}>Get Directions</Text>
							</Pressable>
							<Pressable onPress={makeCall}>
								<Text style={styles.supportLinkText}>Call Shop</Text>
							</Pressable>
							<Pressable onPress={openWhatsAppShop}>
								<Text style={styles.supportLinkText}>WhatsApp</Text>
							</Pressable>
							<Pressable onPress={() => router.push('/about')}>
								<Text style={styles.supportLinkText}>About Us</Text>
							</Pressable>
						</View>
						<SocialSection
							barberDocId={barberDocId}
							isEditing={isEditingSocials}
							onToggleEdit={() => setIsEditingSocials((current) => !current)}
							socialLinks={socialLinks}
							onChangeSocialLink={handleChangeSocialLink}
							onSaveSocials={handleSaveSocials}
							savingSocials={savingSocials}
						/>
						<View style={styles.socialSpacer} />
					</View>
				}
			/>
		</SafeAreaView>
	);
}