import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
	ActivityIndicator,
	Alert,
	Modal,
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
	cash?: string;
	paymentMethods?: string[];
};

type PaymentMethod = 'card';

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
	const [showPolicyModal, setShowPolicyModal] = useState(false);
	const [policyAccepted, setPolicyAccepted] = useState(false);

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

	const barberPaymentMethods = useMemo(() => {
		const methods = new Set<string>();
		const rawMethods = barber?.paymentMethods ?? [];
		rawMethods.forEach((method) => methods.add(method.toLowerCase()));
		if (barber?.cashappTag) methods.add('cashapp');
		if (barber?.zelleEmail || barber?.zellePhone) methods.add('zelle');
		if (barber?.cash) methods.add('cash');
		const labelFor = (value: string) => {
			switch (value) {
				case 'cashapp':
					return 'CashApp';
				case 'zelle':
					return 'Zelle';
				case 'cash':
					return 'Cash';
				default:
					return value.charAt(0).toUpperCase() + value.slice(1);
			}
		};
		return Array.from(methods).map(labelFor);
	}, [barber]);

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
						onPress={() => router.push('/payment')}
						disabled={isSubmitting}
					>
						<Text style={styles.optionTitle}>Card (Stripe)</Text>
						<Text style={styles.optionSubtitle}>Add or use a card to pay in-app.</Text>
					</Pressable>
					<Pressable
						style={styles.optionCard}
						onPress={() => {
							setPolicyAccepted(false);
							setShowPolicyModal(true);
						}}
						disabled={isSubmitting}
					>
						<Text style={styles.optionTitle}>Confirm booking</Text>
						<Text style={styles.optionSubtitle}>Use your saved card for this appointment.</Text>
					</Pressable>
				</View>

				{isSubmitting ? (
					<View style={styles.loadingRow}>
						<ActivityIndicator color="#00f0ff" />
						<Text style={styles.loadingText}>Saving appointment...</Text>
					</View>
				) : null}
			</ScrollView>

			<Modal
				visible={showPolicyModal}
				transparent
				animationType="fade"
				onRequestClose={() => setShowPolicyModal(false)}
			>
				<View style={styles.policyModalBackdrop}>
					<View style={styles.policyModalCard}>
						<Text style={styles.policyModalTitle}>Booking Policy</Text>
						<View style={styles.policyModalBody}>
							<Text style={styles.policyModalBullet}>• Please arrive on time.</Text>
							<Text style={styles.policyModalBullet}>• 10-minute late limit before cancellation.</Text>
							<Text style={styles.policyModalBullet}>
								• Deposits are non-refundable (if applicable).
							</Text>
							<Text style={styles.policyModalBullet}>
								• No-shows may be restricted from future bookings.
							</Text>
						</View>

						{barberPaymentMethods.length > 0 ? (
							<View style={styles.policyModalBody}>
								<Text style={styles.policyModalSectionTitle}>Barber accepts:</Text>
								{barberPaymentMethods.map((method) => (
									<Text key={method} style={styles.policyModalBullet}>
										• {method}
									</Text>
								))}
							</View>
						) : null}

						<Pressable
							style={styles.policyCheckRow}
							onPress={() => setPolicyAccepted((prev) => !prev)}
						>
							<View
								style={[
									styles.checkbox,
									policyAccepted && styles.checkboxChecked,
								]}
							>
								{policyAccepted ? <Text style={styles.checkboxMark}>✓</Text> : null}
							</View>
							<Text style={styles.policyCheckText}>I agree to the booking policy</Text>
						</Pressable>

						<View style={styles.policyModalActions}>
							<Pressable
								style={styles.policyCancelButton}
								onPress={() => setShowPolicyModal(false)}
							>
								<Text style={styles.policyCancelText}>Cancel</Text>
							</Pressable>
							<Pressable
								style={[
									styles.policyConfirmButton,
									!policyAccepted && styles.policyConfirmDisabled,
								]}
								onPress={async () => {
									if (!policyAccepted) return;
									setShowPolicyModal(false);
									await handlePaymentSelect('card');
								}}
								disabled={!policyAccepted}
							>
								<Text style={styles.policyConfirmText}>Accept & Confirm</Text>
							</Pressable>
						</View>
					</View>
				</View>
			</Modal>
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
	policyModalBackdrop: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.6)',
		justifyContent: 'center',
		padding: 20,
	},
	policyModalCard: {
		backgroundColor: '#000',
		borderRadius: 16,
		padding: 18,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		gap: 14,
	},
	policyModalTitle: {
		color: '#ffffff',
		fontSize: 18,
		fontWeight: '700',
	},
	policyModalBody: {
		gap: 6,
	},
	policyModalSectionTitle: {
		color: '#ffffff',
		fontSize: 14,
		fontWeight: '700',
		marginTop: 2,
	},
	policyModalBullet: {
		color: '#9aa0a6',
		fontSize: 13,
	},
	policyModalActions: {
		flexDirection: 'row',
		gap: 10,
	},
	policyCancelButton: {
		flex: 1,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		borderRadius: 12,
		paddingVertical: 12,
		alignItems: 'center',
	},
	policyCancelText: {
		color: '#ffffff',
		fontSize: 13,
		fontWeight: '700',
	},
	policyConfirmButton: {
		flex: 1,
		backgroundColor: '#e10600',
		borderRadius: 12,
		paddingVertical: 12,
		alignItems: 'center',
	},
	policyConfirmDisabled: {
		opacity: 0.5,
	},
	policyConfirmText: {
		color: '#ffffff',
		fontSize: 13,
		fontWeight: '700',
	},
	policyCheckRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
	},
	checkbox: {
		width: 22,
		height: 22,
		borderRadius: 6,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: 'rgba(0,0,0,0.35)',
	},
	checkboxChecked: {
		backgroundColor: '#00f0ff',
	},
	checkboxMark: {
		color: '#000000',
		fontSize: 14,
		fontWeight: '700',
	},
	policyCheckText: {
		color: '#ffffff',
		fontSize: 13,
		fontWeight: '600',
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
