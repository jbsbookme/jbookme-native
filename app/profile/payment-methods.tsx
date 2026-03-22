import { useEffect, useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert, Linking, StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/src/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { fetchBarbers } from '@/src/services/barberService';

type AppointmentLite = {
	barberId?: string;
};

type Barber = {
	id: string;
	zelleEmail?: string;
	zellePhone?: string;
	cash?: string;
	cashappTag?: string;
};

export default function PaymentMethods() {
	const router = useRouter();
	const { user } = useAuth();
	const [barber, setBarber] = useState<Barber | null>(null);

	useEffect(() => {
		const loadLastBarber = async () => {
			if (!user) return;
			try {
				const q = query(
					collection(db, 'appointments'),
					where('userId', '==', user.uid),
					orderBy('date', 'desc'),
					limit(1)
				);
				const snapshot = await getDocs(q);
				const appointment = snapshot.docs[0]?.data() as AppointmentLite | undefined;
				if (!appointment?.barberId) return;
				const barberList = await fetchBarbers();
				const found = barberList.find((item: Barber) => item.id === appointment.barberId) ?? null;
				setBarber(found);
			} catch (error) {
				console.log('[PaymentMethods] load barber error:', error);
			}
		};

		void loadLastBarber();
	}, [user]);

	const zelleValue = useMemo(() => {
		return barber?.zelleEmail || barber?.zellePhone || '';
	}, [barber]);
	const cashTag = useMemo(() => {
		return barber?.cashappTag || barber?.cash || '';
	}, [barber]);

	const handleCopyZelle = async () => {
		if (!zelleValue) {
			Alert.alert('Zelle not available', 'No Zelle email or phone is available for this barber.');
			return;
		}
		try {
			const Clipboard = await import('expo-clipboard');
			await Clipboard.setStringAsync(zelleValue);
			Alert.alert('Copied', 'Zelle info copied to clipboard.');
		} catch {
			Alert.alert('Clipboard unavailable', 'Clipboard is not available on this build.');
		}
	};

	const handleCashApp = async () => {
		const tag = cashTag.replace(/^\$/, '');
		if (!tag) {
			Alert.alert('Cash App not available', 'No Cash App tag is available for this barber.');
			return;
		}
		await Linking.openURL(`https://cash.app/$${tag}`);
	};

	const handlePayAtShop = () => {
		Alert.alert('Pay at Shop', 'Payment will be made in person at the barbershop.');
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
				<Text style={styles.title}>Payment Options</Text>
				<Text style={styles.subtitle}>Payments are handled outside the app.</Text>

				<View style={styles.optionCard}>
					<Text style={styles.optionTitle}>Zelle</Text>
					<Text style={styles.optionBody}>Pay directly using the barber's Zelle account.</Text>
					<Text style={styles.optionValue}>{zelleValue || 'Not available yet.'}</Text>
					<Pressable style={styles.optionButton} onPress={handleCopyZelle}>
						<Text style={styles.optionButtonText}>Copy</Text>
					</Pressable>
				</View>
				<View style={styles.optionCard}>
					<Text style={styles.optionTitle}>Cash App</Text>
					<Text style={styles.optionBody}>Send payment to the barber's Cash App tag.</Text>
					<Text style={styles.optionValue}>{cashTag || 'Not available yet.'}</Text>
					<Pressable style={styles.optionButton} onPress={handleCashApp}>
						<Text style={styles.optionButtonText}>Open Cash App</Text>
					</Pressable>
				</View>
				<View style={styles.optionCard}>
					<Text style={styles.optionTitle}>Pay at Shop</Text>
					<Text style={styles.optionBody}>Pay in person after the appointment.</Text>
					<Pressable style={styles.optionButton} onPress={handlePayAtShop}>
						<Text style={styles.optionButtonText}>How it works</Text>
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
	optionCard: {
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		borderRadius: 12,
		padding: 14,
backgroundColor: '#000',
	},
	optionTitle: {
		color: '#ffffff',
		fontSize: 16,
		fontWeight: '700',
		marginBottom: 4,
	},
	optionBody: {
		color: '#9aa0a6',
		fontSize: 13,
		lineHeight: 18,
	},
	optionValue: {
		color: '#ffffff',
		fontSize: 13,
		fontWeight: '600',
		marginTop: 8,
	},
	optionButton: {
		marginTop: 10,
		alignSelf: 'flex-start',
		paddingVertical: 8,
		paddingHorizontal: 12,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
backgroundColor: '#000',
	},
	optionButtonText: {
		color: '#ffffff',
		fontSize: 12,
		fontWeight: '600',
	},
});
