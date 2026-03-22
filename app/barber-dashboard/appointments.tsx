import { useEffect, useMemo, useState } from 'react';
import {
	ActivityIndicator,
	SafeAreaView,
	StyleSheet,
	Text,
	View,
	FlatList,
} from 'react-native';
import { collection, doc, getDoc, getDocs, orderBy, query, where } from 'firebase/firestore';
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

	const sortedAppointments = useMemo(() => {
		return [...appointments].sort((left, right) => {
			const leftDate = toDate(left.date) ?? new Date(0);
			const rightDate = toDate(right.date) ?? new Date(0);
			return rightDate.getTime() - leftDate.getTime();
		});
	}, [appointments]);

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
				if (barberSnapshot.empty) {
					console.log('BARBER DOC NOT FOUND');
					setAppointments([]);
					setLoading(false);
					return;
				}
				const barberSnapshotDoc = barberSnapshot.docs[0];
				const barberDocId = barberSnapshotDoc.id;
				console.log('BARBER DOC ID:', barberDocId);

				const q = query(
					collection(db, 'appointments'),
					where('barberId', '==', barberDocId)
				);

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
			</View>
			{loading ? (
				<View style={styles.loadingRow}>
					<ActivityIndicator color="#00f0ff" />
					<Text style={styles.loadingText}>Loading appointments...</Text>
				</View>
			) : (
				<FlatList
					data={sortedAppointments}
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
