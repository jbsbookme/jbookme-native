import { useEffect, useMemo, useState } from 'react';
import {
	ActivityIndicator,
	SafeAreaView,
	StyleSheet,
	Text,
	View,
	FlatList,
	Pressable,
} from 'react-native';
import { collection, doc, getDoc, getDocs, orderBy, query, where } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import { useAuth } from '@/contexts/AuthContext';
import { auth, db } from '@/config/firebase';

type AppointmentItem = {
	id: string;
	barberId?: string;
	clientName?: string;
	userId?: string;
	serviceName?: string;
	date?: string | { seconds: number } | Date | null;
	time?: string | { seconds: number } | Date | null;
	price?: number;
	status?: string;
};

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function normalizeDateString(value: string) {
	if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
	if (value.includes('T')) return value.split('T')[0] ?? value;
	return value;
}

function normalizeTimeString(value: string) {
	if (/^\d{2}:\d{2}$/.test(value)) return value;
	if (value.includes('T')) {
		const timePart = value.split('T')[1] ?? '';
		return timePart.slice(0, 5) || value;
	}
	return value;
}

function formatDateKeyFromDateUTC(value: Date) {
	const year = value.getUTCFullYear();
	const month = `${value.getUTCMonth() + 1}`.padStart(2, '0');
	const day = `${value.getUTCDate()}`.padStart(2, '0');
	return `${year}-${month}-${day}`;
}

function formatDateLabelFromKey(dateKey: string) {
	const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!match) return dateKey;
	const monthIndex = Number(match[2]) - 1;
	const day = Number(match[3]);
	const label = MONTH_LABELS[monthIndex] ?? match[2];
	return `${label} ${day}`;
}

function formatDateKeyFromDateLocal(value: Date) {
	const year = value.getFullYear();
	const month = `${value.getMonth() + 1}`.padStart(2, '0');
	const day = `${value.getDate()}`.padStart(2, '0');
	return `${year}-${month}-${day}`;
}

function toDate(value?: AppointmentItem['date'] | AppointmentItem['time']) {
	if (!value) return null;
	if (value instanceof Date) return value;
	if (typeof value === 'string') {
		const normalized = normalizeDateString(value);
		if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
			const [year, month, day] = normalized.split('-').map(Number);
			return new Date(year, month - 1, day);
		}
		const parsed = new Date(value);
		return Number.isNaN(parsed.getTime()) ? null : parsed;
	}
	if (typeof value === 'object' && 'seconds' in value && typeof value.seconds === 'number') {
		return new Date(value.seconds * 1000);
	}
	return null;
}

function formatDate(value?: AppointmentItem['date']) {
	if (!value) return 'Pending date';
	if (typeof value === 'string') {
		return formatDateLabelFromKey(normalizeDateString(value));
	}
	const parsed = toDate(value);
	if (!parsed) return 'Pending date';
	return formatDateLabelFromKey(formatDateKeyFromDateUTC(parsed));
}

function formatTime(value?: AppointmentItem['time'] | AppointmentItem['date']) {
	if (!value) return 'Pending time';
	if (typeof value === 'string') {
		const normalized = normalizeTimeString(value);
		if (/^\d{2}:\d{2}$/.test(normalized)) {
			const [rawHour, rawMinute] = normalized.split(':').map(Number);
			if (Number.isNaN(rawHour) || Number.isNaN(rawMinute)) return normalized;
			const period = rawHour >= 12 ? 'PM' : 'AM';
			const hour = rawHour % 12 === 0 ? 12 : rawHour % 12;
			const minute = rawMinute.toString().padStart(2, '0');
			return `${hour}:${minute} ${period}`;
		}
		return normalized;
	}
	const parsed = toDate(value);
	if (!parsed) return 'Pending time';
	return parsed.toLocaleTimeString(undefined, {
		hour: 'numeric',
		minute: '2-digit',
		hour12: true,
	});
}

export default function BarberAppointments() {
	const { user } = useAuth();
	const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [showCalendar, setShowCalendar] = useState(false);
	const [selectedDate, setSelectedDate] = useState(
		formatDateKeyFromDateLocal(new Date())
	);
	const [showAll, setShowAll] = useState(true);

	const sortedAppointments = useMemo(() => {
		return [...appointments].sort((left, right) => {
			const leftDate = toDate(left.date) ?? new Date(0);
			const rightDate = toDate(right.date) ?? new Date(0);
			return rightDate.getTime() - leftDate.getTime();
		});
	}, [appointments]);

	const filteredAppointments = useMemo(() => {
		if (showAll || !selectedDate) return sortedAppointments;
		return sortedAppointments.filter((item) => {
			const dateValue = toDate(item.date ?? item.time);
			if (!dateValue) return false;
			return formatDateKeyFromDateLocal(dateValue) === selectedDate;
		});
	}, [selectedDate, showAll, sortedAppointments]);

	const visibleCount = filteredAppointments.length;
	const totalCount = sortedAppointments.length;

	useEffect(() => {
		const loadAppointments = async () => {
			const uid = auth.currentUser?.uid;
			if (!uid) {
				console.log('NO AUTH USER');
				setAppointments([]);
				setLoading(false);
				return;
			}
			console.log('AUTH UID:', uid);
			setLoading(true);
			try {
				const barberQuery = query(
					collection(db, 'barbers'),
					where('userId', '==', uid)
				);
				const barberSnapshot = await getDocs(barberQuery);
				const barberSnapshotDoc = barberSnapshot.docs[0];
				const barberDocId = barberSnapshotDoc?.id ?? null;
				const barberData = barberSnapshotDoc?.data() as
					| { userId?: string; prismaBarberId?: string }
					| undefined;
				const barberIds = [
					barberDocId,
					barberData?.userId,
					barberData?.prismaBarberId,
					uid,
				].filter((value): value is string => Boolean(value));
				const uniqueIds = Array.from(new Set(barberIds));
				if (uniqueIds.length === 0) {
					console.log('BARBER DOC NOT FOUND');
					setAppointments([]);
					setLoading(false);
					return;
				}
				console.log('BARBER IDS:', uniqueIds.join(', '));

				const baseRef = collection(db, 'appointments');
				const q =
					uniqueIds.length === 1
						? query(baseRef, where('barberId', '==', uniqueIds[0]))
						: query(baseRef, where('barberId', 'in', uniqueIds.slice(0, 10)));

				const snapshot = await getDocs(q);
				const data = snapshot.docs.map((docItem) => ({
					id: docItem.id,
					...(docItem.data() as AppointmentItem),
				}));
				const missingUserIds = Array.from(
					new Set(
						data
							.filter((item) => !item.clientName && item.userId)
							.map((item) => item.userId as string)
					)
				);
				if (missingUserIds.length === 0) {
					console.log('BARBER APPOINTMENTS:', data.length);
					setAppointments(data);
					return;
				}
				const resolved = await Promise.all(
					missingUserIds.map(async (userId) => {
						const userSnap = await getDoc(doc(db, 'users', userId));
						const userData = userSnap.exists()
							? (userSnap.data() as { name?: string })
							: undefined;
						return { userId, name: userData?.name?.trim() || 'Client' };
					})
				);
				const nameMap = new Map(resolved.map((item) => [item.userId, item.name]));
				const merged = data.map((item) =>
					item.clientName
						? item
						: { ...item, clientName: nameMap.get(item.userId ?? '') ?? 'Client' }
				);
				console.log('BARBER APPOINTMENTS:', merged.length);
				setAppointments(merged);
			} catch (error) {
				console.log('[BarberAppointments] load error:', error);
			} finally {
				setLoading(false);
			}
		};

		void loadAppointments();
	}, [user?.uid]);

	return (
		<SafeAreaView style={styles.screen}>
			<View style={styles.header}>
				<Text style={styles.title}>Appointment History</Text>
				<Text style={styles.subtitle}>All appointments for your chair.</Text>
				<View style={styles.pickDateRow}>
					<Pressable
						style={styles.pickDateButton}
						onPress={() => setShowCalendar((current) => !current)}
					>
						<Ionicons name="calendar" size={18} color="#00f0ff" />
						<Text style={styles.pickDateText}>Pick Date</Text>
					</Pressable>
					<Pressable
						style={[styles.pickDateButton, showAll && styles.pickDateButtonActive]}
						onPress={() => setShowAll((current) => !current)}
					>
						<Ionicons name="list" size={18} color="#00f0ff" />
						<Text style={styles.pickDateText}>Show All</Text>
					</Pressable>
					<Text style={styles.pickDateLabel}>
						{showAll ? 'All dates' : formatDateLabelFromKey(selectedDate)}
					</Text>
				</View>
				<Text style={styles.countText}>
					Showing {visibleCount} of {totalCount} appointments
				</Text>
				{showCalendar ? (
					<View style={styles.calendarWrap}>
						<Calendar
							minDate={new Date().toISOString().slice(0, 10)}
							onDayPress={(day) => {
								setSelectedDate(day.dateString);
								setShowCalendar(false);
							}}
							markedDates={{
								[selectedDate]: { selected: true, selectedColor: '#00f0ff' },
							}}
							theme={{
								backgroundColor: '#000',
								calendarBackground: '#000',
								textSectionTitleColor: '#9aa0a6',
								dayTextColor: '#ffffff',
								monthTextColor: '#ffffff',
								todayTextColor: '#ffd700',
								arrowColor: '#00f0ff',
								textDisabledColor: 'rgba(255,255,255,0.3)',
							}}
						/>
					</View>
				) : null}
			</View>
			{loading ? (
				<View style={styles.loadingRow}>
					<ActivityIndicator color="#00f0ff" />
					<Text style={styles.loadingText}>Loading appointments...</Text>
				</View>
			) : (
				<FlatList
					data={filteredAppointments}
					keyExtractor={(item) => item.id}
					renderItem={({ item }) => {
						console.log('APPOINTMENT BARBER ID:', item.barberId);
						return (
							<View style={[styles.card, { backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(225, 6, 0, 0.85)' }]}>
								{item.barberId ? (
									<Text style={styles.label}>
										APPOINTMENT BARBER ID: {item.barberId}
									</Text>
								) : null}
								<Text style={styles.label}>Client: {item.clientName ?? 'Client'}</Text>
								<Text style={styles.label}>Service: {item.serviceName ?? 'Service'}</Text>
								<Text style={styles.label}>Date: {formatDate(item.date)}</Text>
								<Text style={styles.label}>
									Time: {formatTime(item.time ?? item.date)}
								</Text>
								<Text style={styles.label}>
									Price:{' '}
									{typeof item.price === 'number' ? `$${item.price}` : 'N/A'}
								</Text>
								<Text style={styles.label}>Status: {item.status ?? 'Pending'}</Text>
							</View>
						);
					}}
					contentContainerStyle={styles.list}
					ListEmptyComponent={
						<Text style={styles.emptyText}>No appointments found.</Text>
					}
					showsVerticalScrollIndicator={false}
				/>
			)}
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	screen: {
		flex: 1,
		backgroundColor: '#000000',
	},
	header: {
		paddingHorizontal: 20,
		paddingTop: 16,
		paddingBottom: 12,
		gap: 6,
	},
	title: {
		color: '#ffffff',
		fontSize: 22,
		fontWeight: '700',
	},
	subtitle: {
		color: '#9aa0a6',
		fontSize: 13,
	},
	pickDateRow: {
		marginTop: 8,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		flexWrap: 'wrap',
	},
	pickDateButton: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		borderRadius: 12,
		paddingVertical: 10,
		paddingHorizontal: 12,
	},
	pickDateButtonActive: {
		backgroundColor: 'rgba(0,240,255,0.12)',
	},
	pickDateText: {
		color: '#ffffff',
		fontSize: 13,
		fontWeight: '600',
	},
	pickDateLabel: {
		color: '#00f0ff',
		fontSize: 13,
		fontWeight: '600',
	},
	countText: {
		color: '#9aa0a6',
		fontSize: 12,
	},
	calendarWrap: {
		marginTop: 12,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		borderRadius: 12,
		overflow: 'hidden',
		backgroundColor: '#000',
	},
	list: {
		paddingHorizontal: 20,
		paddingBottom: 24,
		gap: 12,
	},
	card: {
		backgroundColor: '#000',
		borderRadius: 12,
		padding: 16,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		gap: 6,
	},
	label: {
		color: '#ffffff',
		fontSize: 13,
	},
	emptyText: {
		color: '#9aa0a6',
		fontSize: 13,
		paddingHorizontal: 20,
		paddingTop: 40,
		textAlign: 'center',
	},
	loadingRow: {
		flexDirection: 'row',
		gap: 10,
		alignItems: 'center',
		paddingHorizontal: 20,
		paddingTop: 20,
	},
	loadingText: {
		color: '#9aa0a6',
		fontSize: 13,
	},
});
