import { useEffect, useMemo, useState } from 'react';
import {
	ActivityIndicator,
	Alert,
	FlatList,
	Pressable,
	RefreshControl,
	SafeAreaView,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { uploadImageToCloudinary } from '../../services/cloudinary';
import { addShopGalleryImage } from '../../src/services/shopGalleryService';

const API_BASE_URL = 'https://jbsbookme.com/api';

type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled';

type Appointment = {
	id: string;
	barberId?: string;
	barberName?: string;
	customerName: string;
	serviceId?: string;
	serviceName: string;
	date: string;
	time: string;
	paymentMethod: 'card' | 'zelle' | 'cashapp' | 'shop';
	paymentStatus: 'pending' | 'paid';
	status?: AppointmentStatus;
};

type Barber = {
	id: string;
	user?: { name?: string };
	specialties?: string;
	status?: 'active' | 'disabled';
};

type Service = {
	id: string;
	name: string;
	price: number;
	duration: number;
	gender?: 'men' | 'women' | 'unisex';
};

type AdminStat = {
	label: string;
	value: string;
};

function formatTimeLabel(value: string) {
	const [rawHour, rawMinute] = value.split(':').map(Number);
	if (Number.isNaN(rawHour) || Number.isNaN(rawMinute)) return value;
	const period = rawHour >= 12 ? 'PM' : 'AM';
	const hour = rawHour % 12 === 0 ? 12 : rawHour % 12;
	const minute = rawMinute.toString().padStart(2, '0');
	return `${hour}:${minute} ${period}`;
}

function normalizeDate(value: string) {
	if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return value;
	return parsed.toISOString().slice(0, 10);
}

async function fetchAppointments() {
	const response = await fetch(`${API_BASE_URL}/appointments`);
	if (!response.ok) {
		throw new Error('Unable to load appointments.');
	}
	const data = (await response.json()) as { appointments?: Appointment[] };
	return data.appointments ?? [];
}

async function fetchBarbers() {
	const response = await fetch(`${API_BASE_URL}/barbers`);
	if (!response.ok) {
		throw new Error('Unable to load barbers.');
	}
	const data = (await response.json()) as { barbers?: Barber[] };
	return data.barbers ?? [];
}

async function fetchServices() {
	const response = await fetch(`${API_BASE_URL}/services`);
	if (!response.ok) {
		throw new Error('Unable to load services.');
	}
	const data = (await response.json()) as { services?: Service[] };
	return data.services ?? [];
}

async function updateAppointmentStatus(appointmentId: string, status: AppointmentStatus) {
	const response = await fetch(`${API_BASE_URL}/appointments/${appointmentId}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ status }),
	});
	if (!response.ok) {
		throw new Error('Unable to update appointment.');
	}
}

async function updateBarber(barberId: string, payload: Record<string, unknown>) {
	const response = await fetch(`${API_BASE_URL}/barbers/${barberId}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	});
	if (!response.ok) {
		throw new Error('Unable to update barber.');
	}
}

async function deleteBarber(barberId: string) {
	const response = await fetch(`${API_BASE_URL}/barbers/${barberId}`, {
		method: 'DELETE',
	});
	if (!response.ok) {
		throw new Error('Unable to delete barber.');
	}
}

async function deleteService(serviceId: string) {
	const response = await fetch(`${API_BASE_URL}/services/${serviceId}`, {
		method: 'DELETE',
	});
	if (!response.ok) {
		throw new Error('Unable to delete service.');
	}
}

export default function AdminDashboard() {
	const [appointments, setAppointments] = useState<Appointment[]>([]);
	const [barbers, setBarbers] = useState<Barber[]>([]);
	const [services, setServices] = useState<Service[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [uploadingGallery, setUploadingGallery] = useState(false);

	const requestMediaPermission = async () => {
		const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
		if (status !== 'granted') {
			Alert.alert('Permission needed', 'Allow access to your photos to upload.');
			return false;
		}
		return true;
	};

	const loadData = async () => {
		try {
			const [appointmentsData, barbersData, servicesData] = await Promise.all([
				fetchAppointments(),
				fetchBarbers(),
				fetchServices(),
			]);
			setAppointments(appointmentsData);
			setBarbers(barbersData);
			setServices(servicesData);
		} catch (error) {
			Alert.alert('Load failed', 'Unable to load admin dashboard data.');
		}
	};

	useEffect(() => {
		let active = true;
		const start = async () => {
			setLoading(true);
			await loadData();
			if (active) setLoading(false);
		};
		start();
		return () => {
			active = false;
		};
	}, []);

	const onRefresh = async () => {
		setRefreshing(true);
		await loadData();
		setRefreshing(false);
	};

	const handleUploadGalleryImage = async () => {
		if (uploadingGallery) return;
		setUploadingGallery(true);
		try {
			const allowed = await requestMediaPermission();
			if (!allowed) return;
			const result = await ImagePicker.launchImageLibraryAsync({
				mediaTypes: ImagePicker.MediaTypeOptions.Images,
				quality: 0.8,
			});
			if (result.canceled || !result.assets?.length) return;

			const uploadUrl = await uploadImageToCloudinary(result.assets[0].uri);
			const saved = await addShopGalleryImage(uploadUrl);
			if (!saved) {
				Alert.alert('Upload failed', 'Unable to save the gallery photo.');
				return;
			}
			Alert.alert('Uploaded', 'Photo added to the Shop Gallery.');
		} catch (error) {
			Alert.alert('Upload failed', 'Unable to upload photo.');
		} finally {
			setUploadingGallery(false);
		}
	};

	const servicePriceMap = useMemo(() => {
		const map = new Map<string, number>();
		services.forEach((service) => {
			map.set(service.id, service.price);
			map.set(service.name, service.price);
		});
		return map;
	}, [services]);

	const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);
	const weekStart = useMemo(() => {
		const now = new Date();
		const day = now.getDay();
		const diff = now.getDate() - day;
		const start = new Date(now);
		start.setDate(diff);
		start.setHours(0, 0, 0, 0);
		return start;
	}, []);

	const stats = useMemo<AdminStat[]>(() => {
		const appointmentsToday = appointments.filter(
			(appointment) => normalizeDate(appointment.date) === todayKey
		);
		const completed = appointments.filter((appointment) => appointment.status === 'completed');
		const revenueToday = appointmentsToday
			.filter((appointment) => appointment.status === 'completed')
			.reduce((total, appointment) => {
				const price =
					servicePriceMap.get(appointment.serviceId ?? '') ??
					servicePriceMap.get(appointment.serviceName) ??
					0;
				return total + price;
			}, 0);
		const revenueWeek = completed.reduce((total, appointment) => {
			const date = new Date(appointment.date);
			if (Number.isNaN(date.getTime()) || date < weekStart) return total;
			const price =
				servicePriceMap.get(appointment.serviceId ?? '') ??
				servicePriceMap.get(appointment.serviceName) ??
				0;
			return total + price;
		}, 0);

		const serviceCounts = appointments.reduce((acc, appointment) => {
			const key = appointment.serviceName || 'Service';
			acc.set(key, (acc.get(key) ?? 0) + 1);
			return acc;
		}, new Map<string, number>());
		let mostBooked = 'N/A';
		let highestCount = 0;
		serviceCounts.forEach((count, name) => {
			if (count > highestCount) {
				highestCount = count;
				mostBooked = name;
			}
		});

		return [
			{ label: 'Appointments Today', value: String(appointmentsToday.length) },
			{ label: 'Revenue Today', value: `$${revenueToday}` },
			{ label: 'Total Barbers', value: String(barbers.length) },
			{ label: 'Most Booked Service', value: mostBooked },
			{ label: 'Revenue This Week', value: `$${revenueWeek}` },
		];
	}, [appointments, barbers.length, servicePriceMap, todayKey, weekStart]);

	const todaysAppointments = useMemo(() => {
		return appointments
			.filter((appointment) => normalizeDate(appointment.date) === todayKey)
			.sort((a, b) => a.time.localeCompare(b.time));
	}, [appointments, todayKey]);

	const handleCancel = async (appointmentId: string) => {
		try {
			await updateAppointmentStatus(appointmentId, 'cancelled');
			setAppointments((current) =>
				current.map((item) =>
					item.id === appointmentId ? { ...item, status: 'cancelled' } : item
				)
			);
		} catch (error) {
			Alert.alert('Update failed', 'Unable to cancel appointment.');
		}
	};

	const handleDisableBarber = async (barberId: string) => {
		try {
			await updateBarber(barberId, { status: 'disabled' });
			setBarbers((current) =>
				current.map((item) => (item.id === barberId ? { ...item, status: 'disabled' } : item))
			);
		} catch (error) {
			Alert.alert('Update failed', 'Unable to disable barber.');
		}
	};

	const handleDeleteBarber = async (barberId: string) => {
		Alert.alert('Delete barber', 'Are you sure you want to delete this barber?', [
			{ text: 'Cancel', style: 'cancel' },
			{
				text: 'Delete',
				style: 'destructive',
				onPress: async () => {
					try {
						await deleteBarber(barberId);
						setBarbers((current) => current.filter((item) => item.id !== barberId));
					} catch (error) {
						Alert.alert('Delete failed', 'Unable to delete barber.');
					}
				},
			},
		]);
	};

	const handleDeleteService = async (serviceId: string) => {
		Alert.alert('Delete service', 'Are you sure you want to delete this service?', [
			{ text: 'Cancel', style: 'cancel' },
			{
				text: 'Delete',
				style: 'destructive',
				onPress: async () => {
					try {
						await deleteService(serviceId);
						setServices((current) => current.filter((item) => item.id !== serviceId));
					} catch (error) {
						Alert.alert('Delete failed', 'Unable to delete service.');
					}
				},
			},
		]);
	};

	if (loading) {
		return (
			<SafeAreaView style={styles.screen}>
				<View style={styles.loadingContainer}>
					<ActivityIndicator color="#00f0ff" size="large" />
					<Text style={styles.loadingText}>Loading admin dashboard...</Text>
				</View>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={styles.screen}>
			<FlatList
				data={todaysAppointments}
				keyExtractor={(item) => item.id}
				refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
				ListHeaderComponent={
					<View>
						<View style={styles.header}>
							<Text style={styles.title}>Admin Dashboard</Text>
							<Text style={styles.subtitle}>Shop overview and management</Text>
						</View>
						<View style={styles.statsGrid}>
							{stats.map((stat) => (
								<View key={stat.label} style={styles.statCard}>
									<Text style={styles.statValue}>{stat.value}</Text>
									<Text style={styles.statLabel}>{stat.label}</Text>
								</View>
							))}
						</View>
						<View style={styles.section}>
							<Text style={styles.sectionTitle}>Today's Appointments</Text>
							{todaysAppointments.length === 0 ? (
								<Text style={styles.emptyText}>No appointments today.</Text>
							) : null}
						</View>
					</View>
				}
				renderItem={({ item }) => (
					<View style={styles.appointmentCard}>
						<Text style={styles.appointmentTime}>{formatTimeLabel(item.time)}</Text>
						<Text style={styles.appointmentTitle}>
							{item.barberName ?? 'Barber'} — {item.customerName}
						</Text>
						<Text style={styles.appointmentMeta}>Service: {item.serviceName}</Text>
						<Text style={styles.appointmentMeta}>
							Payment: {item.paymentMethod} ({item.paymentStatus})
						</Text>
						<View style={styles.actions}>
							<Pressable
								style={styles.cancelButton}
								onPress={() => handleCancel(item.id)}
							>
								<Text style={styles.cancelButtonText}>Cancel</Text>
							</Pressable>
						</View>
					</View>
				)}
				ListFooterComponent={
					<View>
						<View style={styles.section}>
							<Text style={styles.sectionTitle}>Shop Gallery</Text>
						</View>
						<View style={styles.manageCard}>
							<Text style={styles.manageMeta}>
								Upload photos that appear in the Shop Gallery on Home.
							</Text>
							<Pressable
								style={styles.primaryButton}
								onPress={handleUploadGalleryImage}
								disabled={uploadingGallery}
							>
								<Text style={styles.primaryButtonText}>
									{uploadingGallery ? 'Uploading...' : 'Add Photo'}
								</Text>
							</Pressable>
						</View>
						<View style={styles.section}>
							<Text style={styles.sectionTitle}>Barbers</Text>
						</View>
						{barbers.map((barber) => (
							<View key={barber.id} style={styles.manageCard}>
								<View>
									<Text style={styles.manageTitle}>{barber.user?.name ?? 'Barber'}</Text>
									<Text style={styles.manageMeta}>{barber.specialties ?? 'Specialist'}</Text>
									<Text style={styles.manageStatus}>
										Status: {barber.status ?? 'active'}
									</Text>
								</View>
								<View style={styles.manageActions}>
									<Pressable
										style={styles.secondaryButton}
										onPress={() => handleDisableBarber(barber.id)}
									>
										<Text style={styles.secondaryButtonText}>Disable</Text>
									</Pressable>
									<Pressable
										style={styles.dangerButton}
										onPress={() => handleDeleteBarber(barber.id)}
									>
										<Text style={styles.dangerButtonText}>Delete</Text>
									</Pressable>
								</View>
							</View>
						))}
						<View style={styles.section}>
							<Text style={styles.sectionTitle}>Services</Text>
						</View>
						{services.map((service) => (
							<View key={service.id} style={styles.manageCard}>
								<View>
									<Text style={styles.manageTitle}>{service.name}</Text>
									<Text style={styles.manageMeta}>
										${service.price} • {service.duration} min
									</Text>
									<Text style={styles.manageStatus}>
										{service.gender ? `Gender: ${service.gender}` : 'Gender: all'}
									</Text>
								</View>
								<View style={styles.manageActions}>
									<Pressable
										style={styles.dangerButton}
										onPress={() => handleDeleteService(service.id)}
									>
										<Text style={styles.dangerButtonText}>Delete</Text>
									</Pressable>
								</View>
							</View>
						))}
					</View>
				}
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
	statsGrid: {
		paddingHorizontal: 20,
		paddingBottom: 12,
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 12,
	},
	statCard: {
		width: '48%',
		backgroundColor: '#000',
		borderRadius: 14,
		padding: 14,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		gap: 6,
	},
	statValue: {
		color: '#00f0ff',
		fontSize: 18,
		fontWeight: '700',
	},
	statLabel: {
		color: '#9aa0a6',
		fontSize: 12,
	},
	section: {
		paddingHorizontal: 20,
		paddingTop: 12,
		paddingBottom: 8,
	},
	sectionTitle: {
		color: '#ffffff',
		fontSize: 16,
		fontWeight: '700',
	},
	listContent: {
		paddingBottom: 40,
	},
	appointmentCard: {
		marginHorizontal: 20,
		marginBottom: 12,
		backgroundColor: '#000',
		borderRadius: 14,
		padding: 16,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		gap: 6,
	},
	appointmentTime: {
		color: '#00f0ff',
		fontSize: 14,
		fontWeight: '700',
	},
	appointmentTitle: {
		color: '#ffffff',
		fontSize: 15,
		fontWeight: '600',
	},
	appointmentMeta: {
		color: '#9aa0a6',
		fontSize: 12,
	},
	actions: {
		flexDirection: 'row',
		gap: 10,
		marginTop: 8,
	},
	cancelButton: {
		flex: 1,
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
	manageCard: {
		marginHorizontal: 20,
		marginBottom: 12,
		backgroundColor: '#000',
		borderRadius: 14,
		padding: 16,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		gap: 8,
	},
	manageTitle: {
		color: '#ffffff',
		fontSize: 15,
		fontWeight: '600',
	},
	manageMeta: {
		color: '#9aa0a6',
		fontSize: 12,
	},
	manageStatus: {
		color: '#ffd700',
		fontSize: 12,
	},
	manageActions: {
		flexDirection: 'row',
		gap: 10,
		marginTop: 8,
	},
	secondaryButton: {
		paddingVertical: 10,
		paddingHorizontal: 14,
		borderRadius: 10,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
	},
	secondaryButtonText: {
		color: '#00f0ff',
		fontSize: 12,
		fontWeight: '700',
		textTransform: 'uppercase',
		letterSpacing: 0.4,
	},
	primaryButton: {
		marginTop: 10,
		paddingVertical: 12,
		borderRadius: 10,
		backgroundColor: '#00f0ff',
		alignItems: 'center',
	},
	primaryButtonText: {
		color: '#000000',
		fontSize: 12,
		fontWeight: '700',
		textTransform: 'uppercase',
		letterSpacing: 0.6,
	},
	dangerButton: {
		paddingVertical: 10,
		paddingHorizontal: 14,
		borderRadius: 10,
		backgroundColor: '#ff4d4f',
	},
	dangerButtonText: {
		color: '#ffffff',
		fontSize: 12,
		fontWeight: '700',
		textTransform: 'uppercase',
		letterSpacing: 0.4,
	},
	emptyText: {
		color: '#9aa0a6',
		fontSize: 13,
		paddingHorizontal: 20,
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
