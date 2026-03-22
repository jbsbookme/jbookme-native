import { SafeAreaView } from 'react-native-safe-area-context';
import { Linking, StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const SHOP_NAME = "JB's Barbershop";
const SHOP_ADDRESS = '98 Union St, Lynn MA';
const SHOP_PHONE = '+1 781-355-2007';
const SUPPORT_EMAIL = 'info@jbbarbershop.com';

export default function ProfileHelp() {
	const router = useRouter();

	const handleCallShop = () => {
		Linking.openURL('tel:+17813552007');
	};

	const handleEmailSupport = () => {
		Linking.openURL(
			"mailto:info@jbbarbershop.com?subject=JBookMe%20Support%20Request&body=Hello%20JB%27s%20Barbershop,%0A%0AI%20need%20help%20with:%0A%0AName:%0AAppointment%20Date:%0ABarber:%0AMessage:%0A"
		);
	};

	return (
		<SafeAreaView style={styles.screen}>
			<View style={styles.content}>
				<Pressable
					style={styles.backButton}
					onPress={() => {
						router.push('/profile');
					}}
				>
					<Ionicons name="chevron-back" size={22} color="#ffffff" />
				</Pressable>
				<Text style={styles.title}>Help & Support</Text>
				<Text style={styles.subtitle}>Find quick answers and contact the shop.</Text>

				<View style={styles.sectionCard}>
					<Text style={styles.sectionTitle}>How to book an appointment</Text>
					<Text style={styles.sectionBody}>
						Go to the Book tab, select a service, choose your barber, then pick a date
						and time to confirm your booking.
					</Text>
				</View>
				<View style={styles.sectionCard}>
					<Text style={styles.sectionTitle}>How to reschedule an appointment</Text>
					<Text style={styles.sectionBody}>
						Open Profile → My Appointments and tap Reschedule to choose a new date
						and time.
					</Text>
				</View>
				<View style={styles.sectionCard}>
					<Text style={styles.sectionTitle}>Payment options</Text>
					<Text style={styles.sectionBody}>
						Payments can be made with Apple Pay, Google Pay, or Pay at Shop.
					</Text>
				</View>
				<View style={styles.sectionCard}>
					<Text style={styles.sectionTitle}>Contact the barbershop</Text>
					<Text style={styles.sectionBody}>{SHOP_NAME}</Text>
					<Text style={styles.sectionBody}>{SHOP_ADDRESS}</Text>
					<Text style={styles.sectionBody}>Phone: {SHOP_PHONE}</Text>
					<Pressable style={styles.callButton} onPress={handleCallShop}>
						<Text style={styles.callButtonText}>Call Shop</Text>
					</Pressable>
					<Text style={styles.sectionBody}>Email: {SUPPORT_EMAIL}</Text>
					<Pressable style={styles.callButton} onPress={handleEmailSupport}>
						<Text style={styles.callButtonText}>Email Support</Text>
					</Pressable>
				</View>
			</View>
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
		gap: 12,
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
	title: {
		color: '#ffffff',
		fontSize: 22,
		fontWeight: '700',
	},
	subtitle: {
		color: '#9aa0a6',
		fontSize: 13,
	},
	sectionCard: {
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		borderRadius: 12,
		padding: 14,
backgroundColor: '#000',
		gap: 8,
	},
	sectionTitle: {
		color: '#ffffff',
		fontSize: 15,
		fontWeight: '700',
	},
	sectionBody: {
		color: '#9aa0a6',
		fontSize: 13,
		lineHeight: 18,
	},
	callButton: {
		marginTop: 6,
		alignSelf: 'flex-start',
		paddingVertical: 10,
		paddingHorizontal: 14,
		borderRadius: 10,
		backgroundColor: '#00f0ff',
	},
	callButtonText: {
		color: '#000000',
		fontSize: 13,
		fontWeight: '700',
	},
});
