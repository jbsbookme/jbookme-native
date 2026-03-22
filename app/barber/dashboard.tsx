import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../config/firebase';
import { getAllAppointments, type Appointment } from '../../src/services/appointmentService';

type TimestampLike = { toDate?: () => Date; seconds?: number };

type BarberAppointment = Appointment & {
	barberId?: string;
	date?: string | Date | TimestampLike | null;
	time?: string | Date | TimestampLike | null;
	appointmentDate?: string | Date | TimestampLike | null;
	startTime?: string | Date | TimestampLike | null;
	barber?: { id?: string };
};

function formatTimeLabel(value: string) {
	const [rawHour, rawMinute] = value.split(':').map(Number);
	if (Number.isNaN(rawHour) || Number.isNaN(rawMinute)) return value;
	const period = rawHour >= 12 ? 'PM' : 'AM';
	const hour = rawHour % 12 === 0 ? 12 : rawHour % 12;
	const minute = rawMinute.toString().padStart(2, '0');
	return `${hour}:${minute} ${period}`;
}

function padTime(value: number) {
	return value.toString().padStart(2, '0');
}

function toDateKey(value?: string | Date | TimestampLike | null) {
	if (!value) return null;
	if (typeof value === 'string') {
		if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
		const parsed = new Date(value);
		return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
	}
	if (value instanceof Date) return value.toISOString().slice(0, 10);
	if (typeof value === 'object') {
		if (typeof value.toDate === 'function') return value.toDate().toISOString().slice(0, 10);
		if (typeof value.seconds === 'number') return new Date(value.seconds * 1000).toISOString().slice(0, 10);
	}
	return null;
}

function toTimeString(value?: string | Date | TimestampLike | null) {
	if (!value) return null;
	if (typeof value === 'string') {
		if (/^\d{2}:\d{2}$/.test(value)) return value;
		const parsed = new Date(value);
		if (!Number.isNaN(parsed.getTime())) {
			return `${padTime(parsed.getHours())}:${padTime(parsed.getMinutes())}`;
		}
		return null;
	}
	if (value instanceof Date) return `${padTime(value.getHours())}:${padTime(value.getMinutes())}`;
	if (typeof value === 'object') {
		if (typeof value.toDate === 'function') {
			const date = value.toDate();
			return `${padTime(date.getHours())}:${padTime(date.getMinutes())}`;
		}
		if (typeof value.seconds === 'number') {
			const date = new Date(value.seconds * 1000);
			return `${padTime(date.getHours())}:${padTime(date.getMinutes())}`;
		}
	}
	return null;
}

export default function BarberDashboard() {
	const router = useRouter();
	const { user } = useAuth();
	const [appointments, setAppointments] = useState<BarberAppointment[]>([]);

	useEffect(() => {
		let active = true;
		const load = async () => {
			if (!user?.uid) {
				if (active) setAppointments([]);
				return;
			}
			const barberQuery = query(
				collection(db, 'barbers'),
				where('userId', '==', user.uid)
			);
			const barberSnapshot = await getDocs(barberQuery);
			const barberDoc = barberSnapshot.docs[0];
			const barberData = barberDoc?.data() as
				| { userId?: string; prismaBarberId?: string }
				| undefined;
			const barberIds = [
				barberDoc?.id,
				barberData?.userId,
				barberData?.prismaBarberId,
				user.uid,
			].filter((value): value is string => Boolean(value));
			const uniqueIds = Array.from(new Set(barberIds));
			if (uniqueIds.length === 0) {
				if (active) setAppointments([]);
				return;
			}

			const data = await getAllAppointments();
			const scoped = data.filter((item) => {
				const barberId = (item as BarberAppointment).barberId ?? (item as BarberAppointment).barber?.id;
				return barberId ? uniqueIds.includes(barberId) : false;
			});
			if (active) setAppointments(scoped as BarberAppointment[]);
		};
		load();
		return () => {
			active = false;
		};
	}, [user?.uid]);

	const todayKey = new Date().toISOString().slice(0, 10);
	const todayAppointments = useMemo(() => {
		return appointments.filter((item) => {
			const dateKey = toDateKey(item.date ?? item.appointmentDate ?? item.startTime ?? item.time);
			return dateKey === todayKey;
		});
	}, [appointments, todayKey]);

	const totalRevenue = useMemo(
		() => todayAppointments.reduce((sum, item) => sum + (item.price || 0), 0),
		[todayAppointments]
	);

	const openMap = () => {
		Linking.openURL('https://maps.google.com/?q=JB+Barbershop+Lynn+MA');
	};
	const makeCall = () => {
		Linking.openURL('tel:+17815551234');
	};
	const openWhatsAppShop = () => {
		Linking.openURL('https://wa.me/17815551234?text=Hi I want to book an appointment');
	};

	return (
		<SafeAreaView style={styles.screen}>
			<ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
				<View style={styles.header}>
					<Text style={styles.title}>Barber Dashboard</Text>
				</View>

				<View style={styles.sectionHeader}>
					<Text style={styles.sectionTitle}>Today Appointments</Text>
					<Text style={styles.sectionAccent}>Stay on top of your day</Text>
				</View>
				<View style={[styles.card, { backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(225, 6, 0, 0.85)' }]}>
					{todayAppointments.length === 0 ? (
						<Text style={styles.emptyText}>No appointments today.</Text>
					) : (
						todayAppointments.map((item) => (
							<View key={item.id} style={styles.appointmentRow}>
								<View>
									<Text style={styles.appointmentName}>{item.barberName}</Text>
									<Text style={styles.appointmentMeta}>{item.serviceName}</Text>
								</View>
								<Text style={styles.appointmentTime}>
									{formatTimeLabel(
										toTimeString(item.time ?? item.startTime ?? item.date ?? item.appointmentDate) ??
										'00:00'
									)}
								</Text>
							</View>
						))
					)}
				</View>

				<View style={styles.sectionHeader}>
					<Text style={styles.sectionTitle}>Today Revenue</Text>
					<Text style={styles.sectionAccent}>Total earnings</Text>
				</View>
				<View style={[styles.card, { backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(225, 6, 0, 0.85)' }]}>
					<Text style={styles.revenueValue}>${totalRevenue.toFixed(2)}</Text>
				</View>

				<View style={styles.sectionHeader}>
					<Text style={styles.sectionTitle}>Stats</Text>
					<Text style={styles.sectionAccent}>Daily performance</Text>
				</View>
				<View style={styles.statsRow}>
					<View style={styles.statCard}>
						<Text style={styles.statLabel}>Total Citas</Text>
						<Text style={styles.statValue}>{todayAppointments.length}</Text>
					</View>
					<View style={styles.statCard}>
						<Text style={styles.statLabel}>Total Revenue</Text>
						<Text style={styles.statValue}>${totalRevenue.toFixed(2)}</Text>
					</View>
				</View>

				<View style={styles.sectionHeader}>
					<Text style={styles.sectionTitle}>Payments</Text>
					<Text style={styles.sectionAccent}>Quick access</Text>
				</View>
				<View style={[styles.card, { backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(225, 6, 0, 0.85)' }]}>
					<View style={styles.paymentRow}>
						<Pressable style={styles.paymentButton}>
							<Text style={styles.paymentButtonText}>Zelle</Text>
						</Pressable>
						<Pressable style={styles.paymentButton}>
							<Text style={styles.paymentButtonText}>CashApp</Text>
						</Pressable>
						<Pressable style={styles.paymentButton}>
							<Text style={styles.paymentButtonText}>QR</Text>
						</Pressable>
					</View>
				</View>

				<View style={styles.sectionHeader}>
					<Text style={styles.sectionTitle}>Support & Info</Text>
					<Text style={styles.sectionAccent}>Stay connected</Text>
				</View>
				<View style={styles.supportGrid}>
					<Pressable style={styles.supportCard} onPress={openMap}>
						<View style={styles.supportIconWrap}>
							<Ionicons name="map" size={20} color="#00f0ff" />
						</View>
						<Text style={styles.supportTitle} numberOfLines={1}>Get Directions</Text>
						<Text style={styles.supportSubtitle} numberOfLines={1}>Open Maps</Text>
					</Pressable>
					<Pressable style={styles.supportCard} onPress={makeCall}>
						<View style={styles.supportIconWrap}>
							<Ionicons name="call" size={20} color="#00f0ff" />
						</View>
						<Text style={styles.supportTitle} numberOfLines={1}>Call Shop</Text>
						<Text style={styles.supportSubtitle} numberOfLines={1}>Tap to call</Text>
					</Pressable>
					<Pressable style={styles.supportCard} onPress={openWhatsAppShop}>
						<View style={styles.supportIconWrap}>
							<Ionicons name="logo-whatsapp" size={20} color="#00f0ff" />
						</View>
						<Text style={styles.supportTitle} numberOfLines={1}>WhatsApp</Text>
						<Text style={styles.supportSubtitle} numberOfLines={1}>Send a message</Text>
					</Pressable>
					<Pressable style={styles.supportCard} onPress={() => router.push('/about')}>
						<View style={styles.supportIconWrap}>
							<Ionicons name="information-circle" size={20} color="#00f0ff" />
						</View>
						<Text style={styles.supportTitle} numberOfLines={1}>About Us</Text>
						<Text style={styles.supportSubtitle} numberOfLines={1}>Learn more</Text>
					</Pressable>
				</View>
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
		padding: 24,
		paddingBottom: 36,
		gap: 20,
	},
	header: {
		paddingTop: 4,
	},
	title: {
		color: '#ffffff',
		fontSize: 24,
		fontWeight: '700',
	},
	sectionHeader: {
		gap: 4,
	},
	sectionTitle: {
		color: '#ffffff',
		fontSize: 18,
		fontWeight: '700',
	},
	sectionAccent: {
		color: '#00f0ff',
		fontSize: 13,
	},
	card: {
		backgroundColor: '#000',
		borderRadius: 16,
		padding: 18,
		borderWidth: 1,
		borderColor: '#111',
		gap: 14,
	},
	appointmentRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingVertical: 8,
		borderBottomWidth: 1,
		borderBottomColor: 'rgba(255,255,255,0.08)',
	},
	appointmentName: {
		color: '#ffffff',
		fontSize: 15,
		fontWeight: '600',
	},
	appointmentMeta: {
		color: '#9aa0a6',
		fontSize: 13,
		marginTop: 2,
	},
	appointmentTime: {
		color: '#00f0ff',
		fontSize: 13,
		fontWeight: '700',
	},
	emptyText: {
		color: '#9aa0a6',
		fontSize: 13,
	},
	revenueValue: {
		color: '#ffffff',
		fontSize: 24,
		fontWeight: '700',
	},
	statsRow: {
		flexDirection: 'row',
		gap: 12,
	},
	statCard: {
		flex: 1,
		backgroundColor: '#000',
		borderRadius: 16,
		padding: 18,
		borderWidth: 1,
		borderColor: '#111',
		gap: 10,
	},
	statLabel: {
		color: '#9aa0a6',
		fontSize: 13,
	},
	statValue: {
		color: '#ffffff',
		fontSize: 20,
		fontWeight: '700',
	},
	paymentRow: {
		flexDirection: 'row',
		gap: 10,
	},
	paymentButton: {
		flex: 1,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		paddingVertical: 14,
		alignItems: 'center',
	},
	paymentButtonText: {
		color: '#00f0ff',
		fontSize: 13,
		fontWeight: '700',
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
		padding: 16,
		height: 132,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		gap: 8,
		justifyContent: 'center',
		alignItems: 'center',
	},
	supportIconWrap: {
		width: 38,
		height: 38,
		borderRadius: 19,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		alignItems: 'center',
		justifyContent: 'center',
	},
	supportTitle: {
		color: '#ffffff',
		fontSize: 14,
		fontWeight: '700',
		textAlign: 'center',
		width: '100%',
	},
	supportSubtitle: {
		color: '#9aa0a6',
		fontSize: 12,
		textAlign: 'center',
		width: '100%',
	},
});
