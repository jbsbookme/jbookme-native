import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { fetchAppointments, type Appointment } from '../../src/services/appointmentService';

function formatTimeLabel(value: string) {
	const [rawHour, rawMinute] = value.split(':').map(Number);
	if (Number.isNaN(rawHour) || Number.isNaN(rawMinute)) return value;
	const period = rawHour >= 12 ? 'PM' : 'AM';
	const hour = rawHour % 12 === 0 ? 12 : rawHour % 12;
	const minute = rawMinute.toString().padStart(2, '0');
	return `${hour}:${minute} ${period}`;
}

export default function BarberDashboard() {
	const router = useRouter();
	const [appointments, setAppointments] = useState<Appointment[]>([]);

	useEffect(() => {
		let active = true;
		const load = async () => {
			const data = await fetchAppointments();
			if (active) setAppointments(data);
		};
		load();
		return () => {
			active = false;
		};
	}, []);

	const todayKey = new Date().toISOString().slice(0, 10);
	const todayAppointments = useMemo(
		() => appointments.filter((item) => item.date === todayKey),
		[appointments, todayKey]
	);

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
								<Text style={styles.appointmentTime}>{formatTimeLabel(item.time)}</Text>
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
				<View style={[styles.card, { backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(225, 6, 0, 0.85)' }]}>
					<Pressable onPress={openMap}>
						<Text style={styles.supportLink}>Get Directions</Text>
					</Pressable>
					<Pressable onPress={makeCall}>
						<Text style={styles.supportLink}>Call Shop</Text>
					</Pressable>
					<Pressable onPress={openWhatsAppShop}>
						<Text style={styles.supportLink}>WhatsApp</Text>
					</Pressable>
					<Pressable onPress={() => router.push('/about')}>
						<Text style={styles.supportLink}>About Us</Text>
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
		padding: 20,
		paddingBottom: 32,
		gap: 18,
	},
	header: {
		paddingTop: 4,
	},
	title: {
		color: '#ffffff',
		fontSize: 22,
		fontWeight: '700',
	},
	sectionHeader: {
		gap: 4,
	},
	sectionTitle: {
		color: '#ffffff',
		fontSize: 16,
		fontWeight: '700',
	},
	sectionAccent: {
		color: '#00f0ff',
		fontSize: 12,
	},
	card: {
		backgroundColor: '#000',
		borderRadius: 16,
		padding: 16,
		borderWidth: 1,
		borderColor: '#111',
		gap: 12,
	},
	appointmentRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingVertical: 6,
		borderBottomWidth: 1,
		borderBottomColor: 'rgba(255,255,255,0.08)',
	},
	appointmentName: {
		color: '#ffffff',
		fontSize: 14,
		fontWeight: '600',
	},
	appointmentMeta: {
		color: '#9aa0a6',
		fontSize: 12,
		marginTop: 2,
	},
	appointmentTime: {
		color: '#00f0ff',
		fontSize: 12,
		fontWeight: '700',
	},
	emptyText: {
		color: '#9aa0a6',
		fontSize: 12,
	},
	revenueValue: {
		color: '#ffffff',
		fontSize: 22,
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
		padding: 16,
		borderWidth: 1,
		borderColor: '#111',
		gap: 8,
	},
	statLabel: {
		color: '#9aa0a6',
		fontSize: 12,
	},
	statValue: {
		color: '#ffffff',
		fontSize: 18,
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
		paddingVertical: 12,
		alignItems: 'center',
	},
	paymentButtonText: {
		color: '#00f0ff',
		fontSize: 12,
		fontWeight: '700',
	},
	supportLink: {
		color: '#ffffff',
		fontSize: 13,
		paddingVertical: 4,
	},
});
