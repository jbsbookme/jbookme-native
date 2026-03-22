import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Alert, Modal, Pressable, SafeAreaView, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Linking from 'expo-linking';
import { SafeImage } from '../../components/SafeImage';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useFocusEffect } from '@react-navigation/native';
import { Calendar } from 'react-native-calendars';
import { db } from '../../src/config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { fetchBarbers } from '../../src/services/barberService';
import { fetchServices, type Service } from '../../src/services/serviceService';
import { getUserAppointments } from '../../src/services/appointmentService';
import {
	ALL_TIME_SLOTS,
	getAvailableTimeSlots,
	getBookedTimes,
} from '../../src/services/availabilityService';
import { useRoleStore } from '../../src/store/roleStore';
import { ensureReferralUser, getCredit, getReferralUser, subscribe } from '../../store/referralStore';
import {
	getHaircuts,
	getRewardCredit,
	subscribe as subscribeLoyalty,
} from '../../store/loyaltyStore';
import {
	getNotifications,
	markAsRead,
	subscribe as subscribeNotifications,
} from '../../store/notificationStore';

type AppointmentItem = {
	id: string;
	serviceId?: string;
	barberId?: string;
	date?: { seconds: number } | Date | null;
	time?: { seconds: number } | Date | null;
	status?: string;
};

type Barber = {
	id: string;
	user?: {
		name?: string;
	};
};

const ACCOUNT_ITEMS = ['Edit Profile', 'Payment Methods', 'Notifications', 'Help'];
const POLICY_ITEMS = ['Privacy Policy', 'Terms & Conditions'];

function toBarberId(value: string) {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '');
}

export default function Profile() {
	const router = useRouter();
	const { user, logout } = useAuth();
	const [profileName, setProfileName] = useState('');
	const [profileEmail, setProfileEmail] = useState('');
	const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
	const role = useRoleStore((state) => state.role);
	const normalizedRole = role?.toLowerCase() ?? null;
	const isAdmin = normalizedRole === 'admin';
	const isBarber = normalizedRole === 'barber' || normalizedRole === 'stylist';
	const canUpload = isBarber;
	const roleLabel = isAdmin ? 'Admin' : isBarber ? 'Barber' : 'Client';
	const showClientAppointments = !isBarber && !isAdmin;
	const notificationBarberId = toBarberId(profileName) || 'barber';
	const referralUserId = '123';
	useEffect(() => {
		ensureReferralUser(referralUserId, profileName);
	}, [referralUserId, profileName]);

	useFocusEffect(
		useCallback(() => {
			let active = true;
			setShowPolicies(false);
			const loadProfile = async () => {
				if (!user) return;
				try {
					const snapshot = await getDoc(doc(db, 'users', user.uid));
					const data = snapshot.data() as { name?: string; photoUrl?: string } | undefined;
					if (!active) return;
					setProfileName(data?.name ?? user.displayName ?? '');
					setProfileEmail(user.email ?? '');
					setProfilePhotoUrl(data?.photoUrl ?? user.photoURL ?? '');
				} catch (error) {
					console.log('[Profile] load profile error:', error);
					if (!active) return;
					setProfileName(user?.displayName ?? '');
					setProfileEmail(user?.email ?? '');
					setProfilePhotoUrl(user?.photoURL ?? '');
				}
			};

			void loadProfile();
			return () => {
				active = false;
			};
		}, [user])
	);
	const referralUser = useSyncExternalStore(
		subscribe,
		() => getReferralUser(referralUserId),
		() => getReferralUser(referralUserId)
	);
	const referralCode = referralUser?.referralCode ?? '';
	const creditBalance = useSyncExternalStore(
		subscribe,
		() => getCredit(referralUserId),
		() => getCredit(referralUserId)
	);
	const haircutsCount = useSyncExternalStore(
		subscribeLoyalty,
		() => getHaircuts(referralUserId),
		() => getHaircuts(referralUserId)
	);
	const rewardCredit = useSyncExternalStore(
		subscribeLoyalty,
		() => getRewardCredit(referralUserId),
		() => getRewardCredit(referralUserId)
	);
	const notifications = useSyncExternalStore(
		subscribeNotifications,
		() => getNotifications(notificationBarberId),
		() => getNotifications(notificationBarberId)
	);
	const nextReward = useMemo(() => {
		const remainder = haircutsCount % 5;
		return remainder === 0 ? 5 : 5 - remainder;
	}, [haircutsCount]);
	const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
	const [servicesById, setServicesById] = useState<Record<string, Service>>({});
	const [barbersById, setBarbersById] = useState<Record<string, Barber>>({});
	const [showHistory, setShowHistory] = useState(false);
	const [rescheduleOpen, setRescheduleOpen] = useState(false);
	const [rescheduleSelectedDate, setRescheduleSelectedDate] = useState<string | null>(null);
	const [rescheduleSelectedTime, setRescheduleSelectedTime] = useState<string | null>(null);
	const [availableSlots, setAvailableSlots] = useState<string[]>(ALL_TIME_SLOTS);
	const [bookedSlots, setBookedSlots] = useState<Set<string>>(new Set());
	const [loadingSlots, setLoadingSlots] = useState(false);
	const [activeAppointment, setActiveAppointment] = useState<AppointmentItem | null>(null);
	const [showPolicies, setShowPolicies] = useState(false);

	useEffect(() => {
		const loadAppointments = async () => {
			if (!user || !showClientAppointments) {
				setAppointments([]);
				return;
			}
			try {
				const data = await getUserAppointments(user.uid);
				const appointments = data as AppointmentItem[];
				setAppointments(appointments);

				const now = Date.now();
				appointments.forEach((appointment) => {
					const status = appointment.status ?? '';
					if (status === 'cancelled' || status === 'completed' || status === 'no-show') return;
					const appointmentDate = formatAppointmentTime(appointment.time ?? appointment.date);
					if (!appointmentDate) return;
					if (appointmentDate.getTime() <= now) {
						void setDoc(
							doc(db, 'appointments', appointment.id),
							{
								status: 'completed',
								updatedAt: new Date(),
							},
							{ merge: true }
						);
					}
				});
			} catch (error) {
				console.log('Load appointments error:', error);
			}
		};

		loadAppointments();
	}, [showClientAppointments, user]);

	useEffect(() => {
		const loadLookups = async () => {
			try {
				const [services, barbers] = await Promise.all([fetchServices(), fetchBarbers()]);
				setServicesById(
					services.reduce<Record<string, Service>>((acc, service) => {
						acc[service.id] = service;
						return acc;
					}, {})
				);
				setBarbersById(
					barbers.reduce<Record<string, Barber>>((acc, barber) => {
						acc[barber.id] = barber as Barber;
						return acc;
					}, {})
				);
			} catch (error) {
				console.log('[Profile] lookup load error:', error);
			}
		};

		void loadLookups();
	}, []);

	useEffect(() => {
		const loadAvailability = async () => {
			if (!activeAppointment?.barberId || !rescheduleSelectedDate || !rescheduleOpen) return;
			setLoadingSlots(true);
			try {
				const [available, booked] = await Promise.all([
					getAvailableTimeSlots(activeAppointment.barberId, rescheduleSelectedDate),
					getBookedTimes(activeAppointment.barberId, rescheduleSelectedDate),
				]);
				setAvailableSlots(available);
				setBookedSlots(new Set(booked));
				if (rescheduleSelectedTime && booked.includes(rescheduleSelectedTime)) {
					setRescheduleSelectedTime(null);
				}
			} catch (error) {
				console.log('[Profile] availability load error:', error);
				setAvailableSlots(ALL_TIME_SLOTS);
				setBookedSlots(new Set());
			} finally {
				setLoadingSlots(false);
			}
		};

		void loadAvailability();
	}, [activeAppointment?.barberId, rescheduleOpen, rescheduleSelectedDate, rescheduleSelectedTime]);

	const formatAppointmentDate = (value: AppointmentItem['date']) => {
		if (!value) return 'Pending date';
		if (value instanceof Date) return value.toLocaleString();
		if ('seconds' in value) return new Date(value.seconds * 1000).toLocaleString();
		return 'Pending date';
	};

	const formatAppointmentTime = (value: AppointmentItem['time']) => {
		if (!value) return null;
		if (value instanceof Date) return value;
		if ('seconds' in value) return new Date(value.seconds * 1000);
		return null;
	};

	const toDateString = (value: AppointmentItem['date'] | AppointmentItem['time']) => {
		if (!value) return null;
		if (value instanceof Date) return value.toISOString().slice(0, 10);
		if ('seconds' in value) return new Date(value.seconds * 1000).toISOString().slice(0, 10);
		return null;
	};

	const toTimeString = (value: AppointmentItem['date'] | AppointmentItem['time']) => {
		if (!value) return null;
		const date = value instanceof Date ? value : 'seconds' in value ? new Date(value.seconds * 1000) : null;
		if (!date) return null;
		const hours = date.getHours().toString().padStart(2, '0');
		const minutes = date.getMinutes().toString().padStart(2, '0');
		return `${hours}:${minutes}`;
	};

	const formatTimeLabel = (value: string) => {
		const [rawHour, rawMinute] = value.split(':').map(Number);
		if (Number.isNaN(rawHour) || Number.isNaN(rawMinute)) return value;
		const period = rawHour >= 12 ? 'PM' : 'AM';
		const hour = rawHour % 12 === 0 ? 12 : rawHour % 12;
		const minute = rawMinute.toString().padStart(2, '0');
		return `${hour}:${minute} ${period}`;
	};


	const formatServiceLabel = (service?: Service, fallbackId?: string) => {
		if (!service) return fallbackId ?? 'Haircut';
		if (typeof service.price === 'number') return `${service.name} $${service.price}`;
		return service.name;
	};

	const getAppointmentTimestamp = (appointment: AppointmentItem) => {
		const date = formatAppointmentTime(appointment.time ?? appointment.date);
		return date ? date.getTime() : 0;
	};

	const upcomingAppointments = useMemo(() => {
		return appointments
			.filter((appointment) => {
				const status = appointment.status ?? '';
				if (status === 'cancelled' || status === 'completed' || status === 'no-show') {
					return false;
				}
				const date = formatAppointmentTime(appointment.time ?? appointment.date);
				return date ? date.getTime() > Date.now() : false;
			})
			.sort((left, right) => getAppointmentTimestamp(left) - getAppointmentTimestamp(right))
			.slice(0, 2);
	}, [appointments]);

	const handleShare = async () => {
		await Share.share({
			message: `Use my JBookMe code ${referralCode} to get $5 deposit credit!`,
		});
	};

	const handleAccountPress = (item: string) => {
		if (item === 'Edit Profile') {
			router.push('/profile/edit');
			return;
		}
		if (item === 'Payment Methods') {
			router.push('/profile/payment-methods');
			return;
		}
		if (item === 'Notifications') {
			router.push('/profile/notifications');
			return;
		}
		if (item === 'Help') {
			router.push('/profile/help');
			return;
		}
		return;
	};

	const handlePolicyPress = (item: string) => {
		if (item === 'Privacy Policy') {
			setShowPolicies(false);
			router.push('/policy');
			return;
		}
		if (item === 'Terms & Conditions') {
			setShowPolicies(false);
			router.push('/terms');
			return;
		}
	};

	const openMap = () => {
		Linking.openURL('https://maps.google.com/?q=JB+Barbershop+Lynn+MA');
	};
	const makeCall = () => {
		Linking.openURL('tel:+17815551234');
	};
	const openWhatsAppShop = () => {
		Linking.openURL('https://wa.me/17815551234?text=Hi I want to book an appointment');
	};

	const handleLogout = async () => {
		try {
			await logout();
			router.replace('/auth/login');
		} catch (error) {
			console.log('[Profile] logout error:', error);
		}
	};

	const handleReschedule = (appointment: AppointmentItem) => {
		const baseDate = formatAppointmentTime(appointment.time ?? appointment.date) || new Date();
		const dateString = toDateString(appointment.date ?? appointment.time);
		const timeString = toTimeString(appointment.time ?? appointment.date);
		setActiveAppointment(appointment);
		setRescheduleSelectedDate(dateString ?? baseDate.toISOString().slice(0, 10));
		setRescheduleSelectedTime(timeString ?? null);
		setRescheduleOpen(true);
	};

	const handleConfirmReschedule = async () => {
		if (!activeAppointment) return;
		if (!rescheduleSelectedDate || !rescheduleSelectedTime) {
			Alert.alert('Select a time', 'Please choose a new date and time.');
			return;
		}
		const [year, month, day] = rescheduleSelectedDate.split('-').map(Number);
		const [hour, minute] = rescheduleSelectedTime.split(':').map(Number);
		const nextDate = new Date(year, month - 1, day, hour, minute);
		try {
			await setDoc(
				doc(db, 'appointments', activeAppointment.id),
				{
					date: nextDate,
					time: nextDate,
					status: 'rescheduled',
					updatedAt: new Date(),
				},
				{ merge: true }
			);
			setAppointments((prev) =>
				prev.map((item) =>
					item.id === activeAppointment.id
						? { ...item, date: nextDate, time: nextDate, status: 'rescheduled' }
						: item
				)
			);
		} catch (error) {
			console.log('[Profile] reschedule error:', error);
			Alert.alert('Reschedule failed', 'Unable to update this appointment.');
		} finally {
			setRescheduleOpen(false);
			setActiveAppointment(null);
			setRescheduleSelectedDate(null);
			setRescheduleSelectedTime(null);
		}
	};

	const handleCancel = (appointment: AppointmentItem) => {
		Alert.alert('Cancel appointment?', 'This will mark the appointment as cancelled.', [
			{ text: 'Keep', style: 'cancel' },
			{
				text: 'Cancel Appointment',
				style: 'destructive',
				onPress: async () => {
					try {
						await setDoc(
							doc(db, 'appointments', appointment.id),
							{
								status: 'cancelled',
								cancelledAt: new Date(),
								updatedAt: new Date(),
							},
							{ merge: true }
						);
						setAppointments((prev) =>
							prev.map((item) =>
								item.id === appointment.id ? { ...item, status: 'cancelled' } : item
							)
						);
					} catch (error) {
						console.log('[Profile] cancel error:', error);
						Alert.alert('Cancel failed', 'Unable to cancel this appointment.');
					}
				},
			},
		]);
	};

	const handleMessageBarber = (appointmentId: string) => {
		router.push(`/chat/${appointmentId}`);
	};

	return (
		<SafeAreaView style={styles.screen}>
			<ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
				<View style={styles.header}>
					{profilePhotoUrl ? (
						<SafeImage
							uri={profilePhotoUrl}
							fallbackSource={require('../../assets/placeholder-barber.png')}
							style={styles.avatar}
							resizeMode="cover"
						/>
					) : (
						<View style={styles.avatarPlaceholder}>
							<Ionicons name="person" size={36} color="#9aa0a6" />
						</View>
					)}
					<Text style={styles.name}>{profileName || roleLabel}</Text>
					<Text style={styles.email}>{profileEmail}</Text>
				</View>

				{showClientAppointments ? (
					<View style={styles.section}>
						<View style={styles.sectionHeaderRow}>
							<Text style={styles.sectionTitle}>Upcoming Appointments</Text>
							<Pressable
								style={styles.historyToggle}
								onPress={() =>
									router.push({
										pathname: '/client/appointments',
										params: { filter: 'past' },
									})
								}
							>
								<Text style={styles.historyToggleText}>View History</Text>
							</Pressable>
						</View>
						{upcomingAppointments.length === 0 ? (
							<View style={styles.appointmentCard}>
								<Text style={styles.appointmentLabel}>No upcoming appointments.</Text>
							</View>
						) : (
							upcomingAppointments.map((appointment) => {
								const service = appointment.serviceId ? servicesById[appointment.serviceId] : undefined;
								const barber = appointment.barberId ? barbersById[appointment.barberId] : undefined;
								return (
									<View key={`preview-${appointment.id}`} style={styles.appointmentCard}>
										<Text style={styles.appointmentHeadline}>
											{barber?.user?.name ?? 'Barber'}
										</Text>
										<Text style={styles.appointmentLabel}>
											Service:{' '}
											<Text style={styles.appointmentValue}>
												{formatServiceLabel(service, appointment.serviceId)}
											</Text>
										</Text>
										<Text style={styles.appointmentLabel}>
											Time:{' '}
											<Text style={styles.appointmentValue}>
												{formatAppointmentDate(appointment.time ?? appointment.date)}
											</Text>
										</Text>
										<View style={styles.appointmentActions}>
											<Pressable
												style={styles.messageButton}
												onPress={() => handleMessageBarber(appointment.id)}
												disabled={!appointment.barberId}
											>
												<Text style={styles.messageText}>Chat</Text>
											</Pressable>
											<Pressable
												style={styles.rescheduleButton}
												onPress={() => handleReschedule(appointment)}
											>
												<Text style={styles.rescheduleText}>Reschedule</Text>
											</Pressable>
											<Pressable
												style={styles.cancelButton}
												onPress={() => handleCancel(appointment)}
											>
												<Text style={styles.cancelText}>Cancel</Text>
											</Pressable>
										</View>
									</View>
								);
							})
						)}
					</View>
				) : null}

				{isAdmin ? (
					<Pressable
						style={styles.secondaryAction}
						onPress={() => router.push('/admin-dashboard')}
					>
						<Text style={styles.secondaryActionText}>Admin Dashboard</Text>
					</Pressable>
				) : null}
				{isBarber && !isAdmin ? (
					<Pressable
						style={styles.secondaryAction}
						onPress={() => router.push('/barber-dashboard')}
					>
						<Text style={styles.secondaryActionText}>Barber Dashboard</Text>
					</Pressable>
				) : null}

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>🔔 Notifications</Text>
					{notifications.length === 0 ? (
						<View style={styles.notificationCard}>
							<Text style={styles.notificationText}>No notifications yet.</Text>
						</View>
					) : (
						notifications.map((item) => (
							<Pressable
								key={item.id}
								style={styles.notificationCard}
								onPress={() => markAsRead(item.id)}
							>
								<View style={styles.notificationRow}>
									<Text style={styles.notificationText}>{item.message}</Text>
									{item.read ? null : <View style={styles.notificationDot} />}
								</View>
							</Pressable>
						))
					)}
				</View>

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Account</Text>
					{ACCOUNT_ITEMS.map((item) => (
						<Pressable key={item} style={styles.accountRow} onPress={() => handleAccountPress(item)}>
							<Text style={styles.accountText}>{item}</Text>
						</Pressable>
					))}
				</View>

				<View style={styles.section}>
					<Pressable
						style={styles.sectionHeaderRow}
						onPress={() => setShowPolicies((current) => !current)}
					>
						<Text style={styles.sectionTitle}>Legal & Policies</Text>
						<Ionicons
							name={showPolicies ? 'chevron-up' : 'chevron-down'}
							size={18}
							color="#ffffff"
						/>
					</Pressable>
					{showPolicies
						? POLICY_ITEMS.map((item) => (
								<Pressable
									key={item}
									style={styles.accountRow}
									onPress={() => handlePolicyPress(item)}
								>
									<Text style={styles.accountText}>{item}</Text>
								</Pressable>
							))
						: null}
				</View>

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>👥 Invite Friends</Text>
					<View style={styles.inviteCard}>
						<Text style={styles.inviteLabel}>Your referral code:</Text>
						<Text style={styles.inviteCode}>{referralCode}</Text>
						<Pressable style={styles.inviteButton} onPress={handleShare}>
							<Text style={styles.inviteButtonText}>Share Code</Text>
						</Pressable>
						<Text style={styles.creditText}>Deposit Credit: ${creditBalance}</Text>
					</View>
				</View>

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Support & Info</Text>
					<View style={styles.supportGrid}>
						<Pressable style={styles.supportCard} onPress={openMap}>
							<View style={styles.supportIconWrap}>
								<Ionicons name="map" size={18} color="#00f0ff" />
							</View>
							<Text style={styles.supportTitle} numberOfLines={1}>Get Directions</Text>
							<Text style={styles.supportSubtitle} numberOfLines={1}>Open Maps</Text>
						</Pressable>
						<Pressable style={styles.supportCard} onPress={makeCall}>
							<View style={styles.supportIconWrap}>
								<Ionicons name="call" size={18} color="#00f0ff" />
							</View>
							<Text style={styles.supportTitle} numberOfLines={1}>Call Shop</Text>
							<Text style={styles.supportSubtitle} numberOfLines={1}>Tap to call</Text>
						</Pressable>
						<Pressable style={styles.supportCard} onPress={openWhatsAppShop}>
							<View style={styles.supportIconWrap}>
								<Ionicons name="logo-whatsapp" size={18} color="#00f0ff" />
							</View>
							<Text style={styles.supportTitle} numberOfLines={1}>WhatsApp</Text>
							<Text style={styles.supportSubtitle} numberOfLines={1}>Send a message</Text>
						</Pressable>
						<Pressable style={styles.supportCard} onPress={() => router.push('/about')}>
							<View style={styles.supportIconWrap}>
								<Ionicons name="information-circle" size={18} color="#00f0ff" />
							</View>
							<Text style={styles.supportTitle} numberOfLines={1}>About Us</Text>
							<Text style={styles.supportSubtitle} numberOfLines={1}>Learn more</Text>
						</Pressable>
					</View>
				</View>

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>👑 Loyalty Rewards</Text>
					<View style={styles.loyaltyCard}>
						<Text style={styles.loyaltyRow}>Haircuts Completed: {haircutsCount}</Text>
						<Text style={styles.loyaltyRow}>
							Next Reward: {nextReward} more haircut → $10 credit
						</Text>
						<Text style={styles.loyaltyRow}>Reward Balance: ${rewardCredit}</Text>
					</View>
				</View>

				{canUpload ? (
					<>
						<View style={styles.separator} />
						<Pressable style={styles.uploadButton} onPress={() => router.push('/upload-video')}>
							<Text style={styles.uploadText}>🎥 Upload Video</Text>
						</Pressable>
					</>
				) : null}

				<Pressable style={styles.logoutButton} onPress={handleLogout}>
					<Text style={styles.logoutText}>Logout</Text>
				</Pressable>
			</ScrollView>
			<Modal visible={rescheduleOpen} transparent animationType="fade">
				<View style={styles.modalOverlay}>
					<View style={styles.modalCard}>
						<Text style={styles.modalTitle}>Reschedule</Text>
						<View style={styles.calendarCard}>
							<Calendar
								onDayPress={(day) => {
									setRescheduleSelectedDate(day.dateString);
									setRescheduleSelectedTime(null);
								}}
								markedDates={
									rescheduleSelectedDate
										? {
												[rescheduleSelectedDate]: {
													selected: true,
													selectedColor: '#00f0ff',
												},
											}
										: undefined
								}
								theme={{
									backgroundColor: '#000',
									calendarBackground: '#111111',
									textSectionTitleColor: '#9aa0a6',
									dayTextColor: '#ffffff',
									monthTextColor: '#ffffff',
									todayTextColor: '#ffd700',
									arrowColor: '#00f0ff',
									textDisabledColor: 'rgba(255,255,255,0.3)',
								}}
							/>
						</View>
						<Text style={styles.modalSubtitle}>Select Time</Text>
						<View style={styles.timeGrid}>
							{ALL_TIME_SLOTS.map((slot) => {
								const isSelected = slot === rescheduleSelectedTime;
								const isBooked = bookedSlots.has(slot);
								const isAvailable = availableSlots.includes(slot);
								return (
									<Pressable
										key={slot}
										style={[
											styles.timeButton,
											isSelected && styles.timeButtonActive,
											isBooked && styles.timeButtonDisabled,
										]}
										onPress={() => setRescheduleSelectedTime(slot)}
										disabled={!isAvailable || loadingSlots}
									>
										<Text
											style={[
												styles.timeButtonText,
												isSelected && styles.timeButtonTextActive,
												isBooked && styles.timeButtonTextDisabled,
											]}
										>
											{formatTimeLabel(slot)}
										</Text>
									</Pressable>
								);
							})}
						</View>
						{rescheduleSelectedDate && !loadingSlots && availableSlots.length === 0 ? (
							<Text style={styles.emptySlotsText}>
								No available times for this barber on this date.
							</Text>
						) : null}
						<View style={styles.modalActions}>
							<Pressable
								style={styles.modalSecondaryButton}
								onPress={() => {
									setRescheduleOpen(false);
									setActiveAppointment(null);
									setRescheduleSelectedDate(null);
									setRescheduleSelectedTime(null);
								}}
							>
								<Text style={styles.modalSecondaryText}>Close</Text>
							</Pressable>
							<Pressable style={styles.modalPrimaryButton} onPress={handleConfirmReschedule}>
								<Text style={styles.modalPrimaryText}>Confirm</Text>
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
		padding: 20,
		paddingBottom: 40,
		gap: 24,
	},
	topNav: {
		marginBottom: 4,
	},
	backButton: {
		width: 36,
		height: 36,
		borderRadius: 18,
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
backgroundColor: '#000',
	},
	primaryAction: {
		backgroundColor: '#00f0ff',
		borderRadius: 12,
		paddingVertical: 12,
		alignItems: 'center',
	},
	primaryActionText: {
		color: '#000000',
		fontSize: 14,
		fontWeight: '700',
		textTransform: 'uppercase',
		letterSpacing: 0.6,
	},
	secondaryAction: {
		borderRadius: 12,
		paddingVertical: 12,
		alignItems: 'center',
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
	},
	secondaryActionText: {
		color: '#00f0ff',
		fontSize: 13,
		fontWeight: '700',
		textTransform: 'uppercase',
		letterSpacing: 0.6,
	},
	header: {
		alignItems: 'center',
		gap: 8,
	},
	avatar: {
		width: 110,
		height: 110,
		borderRadius: 55,
		borderWidth: 2,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		marginBottom: 12,
	},
	avatarPlaceholder: {
		width: 90,
		height: 90,
		borderRadius: 45,
		marginBottom: 12,
		backgroundColor: '#000',
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
	},
	name: {
		color: '#ffffff',
		fontSize: 22,
		fontWeight: '700',
	},
	email: {
		color: '#9aa0a6',
		fontSize: 14,
	},
	section: {
		gap: 12,
	},
	sectionTitle: {
		color: '#00f0ff',
		fontSize: 16,
		fontWeight: '600',
	},
	sectionHeaderRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	appointmentsHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	historyToggle: {
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 999,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
backgroundColor: '#000',
	},
	historyToggleActive: {
		borderColor: 'rgba(225, 6, 0, 0.85)',
	},
	historyToggleText: {
		color: '#ffffff',
		fontSize: 12,
		fontWeight: '600',
	},
	notificationCard: {
		backgroundColor: '#000',
		borderRadius: 14,
		padding: 14,
		marginBottom: 10,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
	},
	notificationRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	notificationText: {
		color: '#ffffff',
		fontSize: 14,
		fontWeight: '600',
	},
	notificationDot: {
		width: 8,
		height: 8,
		borderRadius: 4,
		backgroundColor: '#00f0ff',
	},
	appointmentCard: {
backgroundColor: '#000',
		borderRadius: 16,
		padding: 14,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		gap: 6,
	},
	appointmentHeadline: {
		color: '#ffffff',
		fontSize: 15,
		fontWeight: '700',
	},
	appointmentLabel: {
		color: '#9aa0a6',
		fontSize: 13,
	},
	appointmentValue: {
		color: '#ffffff',
		fontWeight: '600',
	},
	appointmentActions: {
		flexDirection: 'row',
		gap: 10,
		marginTop: 6,
	},
	messageButton: {
		flex: 1,
		borderRadius: 10,
		borderWidth: 1,
		borderColor: 'rgba(0,240,255,0.4)',
		paddingVertical: 10,
		alignItems: 'center',
		backgroundColor: '#03181b',
	},
	messageText: {
		color: '#00f0ff',
		fontSize: 13,
		fontWeight: '700',
	},
	rescheduleButton: {
		flex: 1,
		borderRadius: 10,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		paddingVertical: 10,
		alignItems: 'center',
	},
	rescheduleText: {
		color: '#ffffff',
		fontSize: 13,
		fontWeight: '600',
	},
	cancelButton: {
		flex: 1,
		borderRadius: 10,
		backgroundColor: '#2a0f0f',
		borderWidth: 1,
		borderColor: 'rgba(255,90,90,0.4)',
		paddingVertical: 10,
		alignItems: 'center',
	},
	cancelText: {
		color: '#ff7b7b',
		fontSize: 13,
		fontWeight: '700',
	},
	accountRow: {
backgroundColor: '#000',
		borderRadius: 14,
		paddingVertical: 12,
		paddingHorizontal: 14,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
	},
	accountText: {
		color: '#ffffff',
		fontSize: 14,
	},
	inviteCard: {
		backgroundColor: '#000',
		borderRadius: 14,
		padding: 16,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		gap: 10,
	},
	inviteLabel: {
		color: '#9aa0a6',
		fontSize: 13,
	},
	inviteCode: {
		color: '#ffffff',
		fontSize: 20,
		fontWeight: '700',
		letterSpacing: 1.2,
	},
	inviteButton: {
		backgroundColor: '#00f0ff',
		borderRadius: 10,
		paddingVertical: 10,
		alignItems: 'center',
	},
	inviteButtonText: {
		color: '#000000',
		fontSize: 13,
		fontWeight: '700',
		letterSpacing: 0.4,
		textTransform: 'uppercase',
	},
	creditText: {
		color: '#ffffff',
		fontSize: 13,
		fontWeight: '600',
	},
	loyaltyCard: {
		backgroundColor: '#000',
		borderRadius: 14,
		padding: 16,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		gap: 8,
	},
	loyaltyRow: {
		color: '#ffffff',
		fontSize: 13,
		fontWeight: '600',
	},
	supportGrid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 12,
		alignItems: 'stretch',
	},
	supportCard: {
		flexBasis: '48%',
		backgroundColor: '#000',
		borderRadius: 14,
		padding: 14,
		height: 120,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		gap: 6,
		justifyContent: 'center',
		alignItems: 'center',
	},
	supportIconWrap: {
		width: 34,
		height: 34,
		borderRadius: 17,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		alignItems: 'center',
		justifyContent: 'center',
	},
	supportTitle: {
		color: '#ffffff',
		fontSize: 13,
		fontWeight: '700',
		textAlign: 'center',
		width: '100%',
	},
	supportSubtitle: {
		color: '#9aa0a6',
		fontSize: 11,
		textAlign: 'center',
		width: '100%',
	},
	logoutButton: {
		marginTop: 4,
		backgroundColor: '#00f0ff',
		paddingVertical: 14,
		borderRadius: 14,
		alignItems: 'center',
	},
	uploadButton: {
		backgroundColor: '#00f0ff',
		borderRadius: 12,
		paddingVertical: 12,
		marginTop: 20,
		alignItems: 'center',
	},
	separator: {
		height: 1,
		backgroundColor: 'rgba(255,255,255,0.08)',
		marginVertical: 20,
	},
	uploadText: {
		color: '#000000',
		fontSize: 14,
		fontWeight: '700',
		letterSpacing: 0.4,
	},
	logoutText: {
		color: '#000000',
		fontSize: 15,
		fontWeight: '700',
		letterSpacing: 0.6,
		textTransform: 'uppercase',
	},
	modalOverlay: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.6)',
		alignItems: 'center',
		justifyContent: 'center',
		padding: 24,
	},
	modalCard: {
		width: '100%',
		borderRadius: 16,
backgroundColor: '#000',
		padding: 16,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		gap: 16,
	},
	modalTitle: {
		color: '#ffffff',
		fontSize: 16,
		fontWeight: '700',
	},
	modalSubtitle: {
		color: '#9aa0a6',
		fontSize: 13,
		fontWeight: '600',
	},
	calendarCard: {
		backgroundColor: '#000',
		borderRadius: 14,
		padding: 10,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
	},
	timeGrid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 10,
	},
	timeButton: {
		paddingVertical: 10,
		paddingHorizontal: 12,
		borderRadius: 10,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
backgroundColor: '#000',
	},
	timeButtonActive: {
		backgroundColor: '#00f0ff',
		borderColor: 'rgba(225, 6, 0, 0.85)',
	},
	timeButtonDisabled: {
		opacity: 0.4,
	},
	timeButtonText: {
		color: '#ffffff',
		fontSize: 12,
		fontWeight: '600',
	},
	timeButtonTextActive: {
		color: '#000000',
	},
	timeButtonTextDisabled: {
		color: '#9aa0a6',
	},
	emptySlotsText: {
		color: '#9aa0a6',
		fontSize: 12,
	},
	modalActions: {
		flexDirection: 'row',
		gap: 10,
	},
	modalSecondaryButton: {
		flex: 1,
		paddingVertical: 10,
		borderRadius: 10,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		alignItems: 'center',
	},
	modalSecondaryText: {
		color: '#ffffff',
		fontSize: 13,
		fontWeight: '600',
	},
	modalPrimaryButton: {
		flex: 1,
		paddingVertical: 10,
		borderRadius: 10,
		backgroundColor: '#00f0ff',
		alignItems: 'center',
	},
	modalPrimaryText: {
		color: '#000000',
		fontSize: 13,
		fontWeight: '700',
	},
});