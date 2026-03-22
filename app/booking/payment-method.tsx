import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
	ActivityIndicator,
	Alert,
	Linking,
	Pressable,
	SafeAreaView,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { fetchBarbers } from '@/src/services/barberService';
import { fetchServices } from '@/src/services/serviceService';
import {
	scheduleAppointmentReminder,
	sendNewAppointmentNotification,
} from '@/src/services/notificationService';

type Service = {
	id: string;
	name: string;
	price?: number;
	duration?: number;
};

type Barber = {
	id: string;
	user?: {
		name?: string;
	};
	zelleEmail?: string;
	zellePhone?: string;
	cashappTag?: string;
};

type PaymentMethod = 'zelle' | 'cashapp' | 'shop';

type Params = {
	barberId?: string;
	serviceId?: string;
	barber?: string;
	service?: string;
	date?: string;
	time?: string;
};

function parseParam<T>(value?: string): T | null {
	if (!value) return null;
	try {
		return JSON.parse(value) as T;
	} catch {
		return null;
	}
}

function padTime(value: number) {
	return value.toString().padStart(2, '0');
}

function formatDateId(date: Date) {
	const year = date.getFullYear();
	const month = padTime(date.getMonth() + 1);
	const day = padTime(date.getDate());
	return `${year}${month}${day}`;
}

function formatTimeIdFromDate(date: Date) {
	return `${padTime(date.getHours())}${padTime(date.getMinutes())}`;
}

export default function PaymentMethod() {
	const router = useRouter();
	const { user } = useAuth();
	const params = useLocalSearchParams<Params>();
	const [service, setService] = useState<Service | null>(() =>
		parseParam<Service>(params.service)
	);
	const [barber, setBarber] = useState<Barber | null>(() =>
		parseParam<Barber>(params.barber)
	);
	const [isSubmitting, setIsSubmitting] = useState(false);

	useEffect(() => {
		const loadDetails = async () => {
			const [barberData, serviceData] = await Promise.all([
				fetchBarbers(),
				fetchServices(),
			]);
			const foundBarber = barberData.find((item: Barber) => item.id === params.barberId) ?? null;
			const foundService = serviceData.find((item: Service) => item.id === params.serviceId) ?? null;
			setBarber(foundBarber);
			setService(foundService);
		};

		if ((!barber || !service) && params.barberId && params.serviceId) {
			loadDetails();
		}
	}, [barber, service, params.barberId, params.serviceId]);

	const appointmentDate = useMemo(() => {
		return params.date ? new Date(params.date) : new Date();
	}, [params.date]);
	const appointmentTime = useMemo(() => {
		return params.time ? new Date(params.time) : appointmentDate;
	}, [params.time, appointmentDate]);
	const appointmentId = useMemo(() => {
		const userId = user?.uid ?? 'U123';
		const barberId = barber?.id ?? params.barberId ?? 'barber';
		const dateId = formatDateId(appointmentDate);
		const timeId = formatTimeIdFromDate(appointmentTime);
		return `${userId}-${barberId}-${dateId}-${timeId}`;
	}, [appointmentDate, appointmentTime, barber?.id, params.barberId, user?.uid]);

	const handleCreateAppointment = async (
		paymentMethod: PaymentMethod,
		paymentStatus: 'paid' | 'pending'
	) => {
		if (!user?.uid) {
			Alert.alert('Sign in required', 'Please sign in to complete the booking.');
			return;
		}
		const userId = user.uid;
		const barberId = barber?.id ?? params.barberId ?? 'barber';
		const serviceId = service?.id ?? params.serviceId ?? 'service';
		if (!barberId || !serviceId) {
			Alert.alert('Missing details', 'Please select a barber and service.');
			return;
		}
		const docRef = doc(db, 'appointments', appointmentId);

		await setDoc(docRef, {
			barberId,
			serviceId,
			date: appointmentDate,
			time: appointmentTime,
			paymentMethod,
			paymentStatus,
			userId,
		});

		const timeLabel = appointmentTime.toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit',
		});
		await sendNewAppointmentNotification(barberId, {
			customerName: user?.displayName ?? 'Client',
			serviceName: service?.name ?? 'Service',
			timeLabel,
		});
		await scheduleAppointmentReminder(
			appointmentDate,
			barber?.user?.name ?? 'your barber'
		);

		router.replace({
			pathname: '/booking/confirmation',
			params: {
				appointmentId,
				barberId,
				barberName: barber?.user?.name ?? 'Barber',
				serviceName: service?.name ?? 'Service',
				date: appointmentDate.toISOString(),
				time: appointmentTime.toISOString(),
				userId,
				userName: user?.displayName ?? 'Customer',
			},
		});
	};

	const handlePaymentSelect = async (method: PaymentMethod) => {
		if (isSubmitting) return;
		setIsSubmitting(true);
		try {
			if (method === 'zelle') {
				Alert.alert(
					'Zelle Payment',
					`Send payment to:\n${barber?.zelleEmail || barber?.zellePhone || 'Not available'}`
				);
			}
			if (method === 'cashapp') {
				const tag = barber?.cashappTag?.replace(/^\$/, '') ?? '';
				if (tag) {
					await Linking.openURL(`https://cash.app/$${tag}`);
				} else {
					Alert.alert('Cash App', 'Cash App tag not available.');
				}
			}
			if (method === 'shop') {
				Alert.alert('Payment', 'You will pay at the shop when you arrive.');
			}

			await handleCreateAppointment(method, 'pending');
		} catch (error) {
			console.error('[Payment] create appointment error:', error);
			const message = error instanceof Error ? error.message : 'Unable to create the appointment.';
			Alert.alert('Booking failed', message);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<SafeAreaView style={styles.screen}>
			<ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
				<Text style={styles.title}>Payment Options</Text>

				<View style={[styles.card, { backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(225, 6, 0, 0.85)' }]}>
					<Text style={styles.label}>Service</Text>
					<Text style={styles.value}>{service?.name ?? 'Service'}</Text>
					<Text style={styles.metaText}>
						${service?.price ?? 0} • {service?.duration ?? 0} min
					</Text>
					<Text style={styles.label}>Barber</Text>
					<Text style={styles.value}>{barber?.user?.name ?? 'Barber'}</Text>
				</View>

				<View style={styles.optionList}>
					<Pressable
						style={styles.optionCard}
						onPress={() => handlePaymentSelect('zelle')}
						disabled={isSubmitting}
					>
						<Text style={styles.optionTitle}>Zelle</Text>
						<Text style={styles.optionSubtitle}>
							Send payment to: {barber?.zelleEmail || barber?.zellePhone || 'Not available'}
						</Text>
					</Pressable>
					<Pressable
						style={styles.optionCard}
						onPress={() => handlePaymentSelect('cashapp')}
						disabled={isSubmitting}
					>
						<Text style={styles.optionTitle}>Cash App</Text>
						<Text style={styles.optionSubtitle}>
							Open link: https://cash.app/{barber?.cashappTag || '$tag'}
						</Text>
					</Pressable>
					<Pressable
						style={styles.optionCard}
						onPress={() => handlePaymentSelect('shop')}
						disabled={isSubmitting}
					>
						<Text style={styles.optionTitle}>Pay at Shop</Text>
						<Text style={styles.optionSubtitle}>Pay when you arrive</Text>
					</Pressable>
				</View>

				{isSubmitting ? (
					<View style={styles.loadingRow}>
						<ActivityIndicator color="#00f0ff" />
						<Text style={styles.loadingText}>Saving appointment...</Text>
					</View>
				) : null}
			</ScrollView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	screen: {
		flex: 1,
		backgroundColor: '#000000',
	},
	content: {
		paddingHorizontal: 20,
		paddingTop: 16,
		paddingBottom: 120,
		gap: 16,
	},
	title: {
		color: '#ffffff',
		fontSize: 20,
		fontWeight: '700',
	},
	card: {
		backgroundColor: '#000',
		borderRadius: 14,
		padding: 16,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		gap: 8,
	},
	label: {
		color: '#9aa0a6',
		fontSize: 12,
		textTransform: 'uppercase',
		letterSpacing: 0.6,
	},
	value: {
		color: '#ffffff',
		fontSize: 16,
		fontWeight: '600',
	},
	metaText: {
		color: '#9aa0a6',
		fontSize: 13,
	},
	optionList: {
		gap: 12,
	},
	optionCard: {
		backgroundColor: '#000',
		borderRadius: 14,
		padding: 16,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		gap: 6,
	},
	optionTitle: {
		color: '#ffffff',
		fontSize: 16,
		fontWeight: '700',
	},
	optionSubtitle: {
		color: '#9aa0a6',
		fontSize: 13,
	},
	loadingRow: {
		marginTop: 8,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
	},
	loadingText: {
		color: '#9aa0a6',
		fontSize: 13,
	},
});
