import { useEffect, useMemo, useState } from 'react';
import {
	ActivityIndicator,
	Alert,
	FlatList,
	Pressable,
	RefreshControl,
	SafeAreaView,
	StyleSheet,
	Text,
	View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useRoleStore } from '@/src/store/roleStore';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://jbsbookme.com/api';

type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled';

type Appointment = {
	id: string;
	barberName: string;
	serviceName: string;
	date: string;
	time: string;
	paymentMethod: 'card' | 'zelle' | 'cashapp' | 'shop';
	paymentStatus: 'pending' | 'paid';
	status?: AppointmentStatus;
};

type SectionItem = {
	key: 'upcoming' | 'past' | 'cancelled';
	title: string;
	appointments: Appointment[];
	emptyText: string;
};

function formatTimeLabel(value: string) {
	const [rawHour, rawMinute] = value.split(':').map(Number);
	if (Number.isNaN(rawHour) || Number.isNaN(rawMinute)) return value;
	const period = rawHour >= 12 ? 'PM' : 'AM';
	const hour = rawHour % 12 === 0 ? 12 : rawHour % 12;
	const minute = rawMinute.toString().padStart(2, '0');
	return `${hour}:${minute} ${period}`;
}

function formatDateLabel(value: string) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return date.toLocaleDateString('en-US', {
		month: 'long',
		day: 'numeric',
	});
}

function normalizeDate(value: string) {
	if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return date.toISOString().slice(0, 10);
}

function paymentLabel(method: Appointment['paymentMethod'], status: Appointment['paymentStatus']) {
	const methodLabel =
		method === 'card'
			? 'Card'
			: method === 'zelle'
				? 'Zelle'
				: method === 'cashapp'
					? 'Cash App'
					: 'Pay at Shop';
	const statusLabel = status === 'paid' ? 'Paid' : 'Pending';
	return `${methodLabel} (${statusLabel})`;
}

async function fetchAppointments(userId: string) {
	const url = `${API_BASE_URL}/appointments?userId=${encodeURIComponent(userId)}`;
	console.log('[MyAppointments] fetch start:', url);
	const response = await fetch(url);
	console.log('[MyAppointments] fetch status:', response.status);
	if (!response.ok) {
		throw new Error(`Unable to load appointments (${response.status}).`);
	}
	const data = (await response.json()) as { appointments?: Appointment[] };
	console.log('[MyAppointments] fetch data:', data);
	return data.appointments ?? [];
}

async function cancelAppointment(appointmentId: string) {
	const response = await fetch(`${API_BASE_URL}/appointments/${appointmentId}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ status: 'cancelled' }),
	});
	if (!response.ok) {
		throw new Error('Unable to cancel appointment.');
	}
}

export default function ClientAppointments() {
	const { user } = useAuth();
	const router = useRouter();
	const params = useLocalSearchParams<{ filter?: string }>();
	const role = useRoleStore((state) => state.role);
	const normalizedRole = role?.toLowerCase() ?? null;
	const isAdmin = normalizedRole === 'admin';
	const isBarber = normalizedRole === 'barber' || normalizedRole === 'stylist';
	const showClientAppointments = !isAdmin && !isBarber;
	const [appointments, setAppointments] = useState<Appointment[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [filter, setFilter] = useState<'upcoming' | 'past'>(
		params.filter === 'past' ? 'past' : 'upcoming'
	);
	const isHistory = filter === 'past';

	useEffect(() => {
		if (!showClientAppointments) {
			router.replace('/barber-dashboard');
		}
	}, [router, showClientAppointments]);

	const loadAppointments = async () => {
		if (!user?.uid || !showClientAppointments) return;
		try {
			const data = await fetchAppointments(user.uid);
			setAppointments(data);
		} catch (error) {
			console.log('[MyAppointments] load error:', error);
			Alert.alert('Load failed', 'Unable to load appointments.');
		}
	};

	useEffect(() => {
		let active = true;
		const start = async () => {
			setLoading(true);
			await loadAppointments();
			if (active) setLoading(false);
		};

		start();
		return () => {
			active = false;
		};
	}, [showClientAppointments, user?.uid]);

	const onRefresh = async () => {
		setRefreshing(true);
		await loadAppointments();
		setRefreshing(false);
	};

	const sections = useMemo<SectionItem[]>(() => {
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		const upcoming: Appointment[] = [];
		const past: Appointment[] = [];
		const cancelled: Appointment[] = [];

		appointments.forEach((appointment) => {
			const status = appointment.status ?? 'scheduled';
			if (status === 'cancelled') {
				cancelled.push(appointment);
				return;
			}

			const dateKey = normalizeDate(appointment.date);
			const date = new Date(`${dateKey}T00:00:00`);
			if (date >= today) {
				upcoming.push(appointment);
			} else {
				past.push(appointment);
			}
		});

		const buildSection = (
			key: SectionItem['key'],
			title: string,
			list: Appointment[],
			emptyText: string
		) => ({
			key,
			title,
			appointments: list.sort((a, b) => a.time.localeCompare(b.time)),
			emptyText,
		});

		const allSections = [
			buildSection('upcoming', 'Upcoming', upcoming, 'No upcoming appointments.'),
			buildSection('past', 'Past', past, 'No past appointments.'),
			buildSection('cancelled', 'Cancelled', cancelled, 'No cancelled appointments.'),
		];

		return isHistory
			? allSections.filter(
					(section) => section.key === 'past' || section.key === 'cancelled'
				)
			: allSections.filter((section) => section.key === 'upcoming');
	}, [appointments, isHistory]);

	const handleCancel = async (appointmentId: string) => {
		try {
			await cancelAppointment(appointmentId);
			setAppointments((current) =>
				current.map((item) =>
					item.id === appointmentId ? { ...item, status: 'cancelled' } : item
				)
			);
		} catch (error) {
			Alert.alert('Cancel failed', 'Unable to cancel the appointment.');
		}
	};

	if (loading) {
		return (
			<SafeAreaView style={styles.screen}>
				<View style={styles.loadingContainer}>
					<ActivityIndicator color="#00f0ff" size="large" />
					<Text style={styles.loadingText}>Loading appointments...</Text>
				</View>
			</SafeAreaView>
		);
	}

	if (!showClientAppointments) {
		return (
			<SafeAreaView style={styles.screen}>
				<View style={styles.loadingContainer}>
					<ActivityIndicator color="#00f0ff" size="large" />
				</View>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={styles.screen}>
			<FlatList
				data={sections}
				keyExtractor={(item) => item.key}
				renderItem={({ item }) => (
					<View style={styles.section}>
						<Text style={styles.sectionTitle}>{item.title}</Text>
						{item.appointments.length === 0 ? (
							<Text style={styles.emptyText}>{item.emptyText}</Text>
						) : (
							item.appointments.map((appointment) => (
								<View
									key={appointment.id}
									style={[
										styles.card,
										{ backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(225, 6, 0, 0.85)' },
									]}
								>
									<Text style={styles.barberName}>{appointment.barberName}</Text>
									<Text style={styles.serviceName}>{appointment.serviceName}</Text>
									<View style={styles.timeRow}>
										<Text style={styles.dateText}>{formatDateLabel(appointment.date)}</Text>
										<Text style={styles.timeText}>{formatTimeLabel(appointment.time)}</Text>
									</View>
									<Text style={styles.paymentText}>
										Payment: {paymentLabel(appointment.paymentMethod, appointment.paymentStatus)}
									</Text>
									{item.key === 'upcoming' && appointment.status !== 'cancelled' ? (
										<Pressable
											style={styles.cancelButton}
											onPress={() => handleCancel(appointment.id)}
										>
											<Text style={styles.cancelButtonText}>Cancel Appointment</Text>
										</Pressable>
									) : null}
								</View>
							))
						)}
					</View>
				)}
				ListHeaderComponent={
					<View style={styles.header}>
						<Text style={styles.title}>My Appointments</Text>
					</View>
				}
				refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
				contentContainerStyle={styles.listContent}
				showsVerticalScrollIndicator={false}
			/>
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
		paddingBottom: 8,
		gap: 12,
	},
	headerRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 12,
	},
	title: {
		color: '#ffffff',
		fontSize: 22,
		fontWeight: '700',
	},
	historyToggle: {
		paddingVertical: 8,
		paddingHorizontal: 12,
		borderRadius: 999,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		backgroundColor: '#000',
	},
	historyToggleActive: {
		borderColor: 'rgba(225, 6, 0, 0.85)',
		backgroundColor: 'rgba(0,240,255,0.15)',
	},
	historyToggleText: {
		color: '#9aa0a6',
		fontSize: 12,
		fontWeight: '600',
	},
	listContent: {
		paddingBottom: 32,
	},
	section: {
		paddingHorizontal: 20,
		paddingTop: 16,
		gap: 12,
	},
	sectionTitle: {
		color: '#ffd700',
		fontSize: 14,
		fontWeight: '700',
		letterSpacing: 0.4,
	},
	emptyText: {
		color: '#9aa0a6',
		fontSize: 13,
	},
	card: {
		backgroundColor: '#000',
		borderRadius: 14,
		padding: 16,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		gap: 8,
	},
	barberName: {
		color: '#ffffff',
		fontSize: 16,
		fontWeight: '700',
	},
	serviceName: {
		color: '#9aa0a6',
		fontSize: 13,
	},
	timeRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
	},
	dateText: {
		color: '#ffffff',
		fontSize: 13,
		fontWeight: '600',
	},
	timeText: {
		color: '#00f0ff',
		fontSize: 13,
		fontWeight: '600',
	},
	paymentText: {
		color: '#9aa0a6',
		fontSize: 13,
	},
	cancelButton: {
		marginTop: 4,
		paddingVertical: 10,
		borderRadius: 10,
		borderWidth: 1,
		borderColor: '#ff6b6b',
		alignItems: 'center',
	},
	cancelButtonText: {
		color: '#ff6b6b',
		fontSize: 12,
		fontWeight: '700',
		textTransform: 'uppercase',
		letterSpacing: 0.4,
	},
	loadingContainer: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		gap: 12,
	},
	loadingText: {
		color: '#9aa0a6',
		fontSize: 13,
	},
});
