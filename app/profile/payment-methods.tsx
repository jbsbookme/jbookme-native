import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function PaymentMethods() {
	const router = useRouter();

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
				<Text style={styles.title}>Payment Methods</Text>
				<Text style={styles.subtitle}>Cards are saved securely with Stripe.</Text>

				<View style={styles.optionCard}>
					<Text style={styles.optionTitle}>Card (Stripe)</Text>
					<Text style={styles.optionBody}>Add a card to pay inside the app.</Text>
					<Pressable
						style={styles.optionButton}
						onPress={() => router.push('/payment')}
					>
						<Text style={styles.optionButtonText}>Add Payment Method</Text>
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
