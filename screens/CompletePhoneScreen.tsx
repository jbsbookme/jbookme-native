import { useMemo, useState } from 'react';
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';

export default function CompletePhoneScreen() {
	const router = useRouter();
	const { user, setUserPhone } = useAuth();
	const [phoneInput, setPhoneInput] = useState('');
	const [saving, setSaving] = useState(false);

	const normalizedPhone = useMemo(() => phoneInput.trim(), [phoneInput]);
	const isValid = useMemo(() => /^\+\d{10,15}$/.test(normalizedPhone), [normalizedPhone]);

	const handleSave = async () => {
		if (!user) {
			router.replace('/auth/login');
			return;
		}
		if (!isValid) {
			Alert.alert('Invalid phone', 'Use format like +17815551234 (10-15 digits).');
			return;
		}

		setSaving(true);
		try {
			const userRef = doc(db, 'users', user.uid);
			await updateDoc(userRef, {
				phone: normalizedPhone,
			});
			const refreshed = await getDoc(userRef);
			const refreshedPhone = (refreshed.data() as { phone?: string } | undefined)?.phone;
			setUserPhone(refreshedPhone ?? normalizedPhone);
			router.replace('/(tabs)/home');
		} catch (error) {
			Alert.alert('Save failed', 'Unable to update your phone number.');
		} finally {
			setSaving(false);
		}
	};

	return (
		<SafeAreaView style={styles.screen}>
			<View style={styles.content}>
				<Text style={styles.title}>Complete Your Profile</Text>
				<Text style={styles.subtitle}>Add your phone number to receive SMS updates.</Text>

				<View style={styles.inputCard}>
					<Text style={styles.label}>Phone Number</Text>
					<TextInput
						style={styles.input}
						value={phoneInput}
						onChangeText={setPhoneInput}
						placeholder="+17815551234"
						placeholderTextColor="#6b7280"
						autoCapitalize="none"
						autoCorrect={false}
						keyboardType="phone-pad"
						textContentType="telephoneNumber"
						returnKeyType="done"
					/>
					<Text style={styles.helperText}>
						Must start with + and contain 10 to 15 digits.
					</Text>
				</View>

				<Pressable
					style={[styles.button, (!isValid || saving) && styles.buttonDisabled]}
					onPress={handleSave}
					disabled={!isValid || saving}
				>
					<Text style={styles.buttonText}>{saving ? 'Saving...' : 'Save Phone'}</Text>
				</Pressable>
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
		flex: 1,
		paddingHorizontal: 24,
		paddingTop: 32,
		gap: 18,
	},
	title: {
		color: '#ffffff',
		fontSize: 24,
		fontWeight: '700',
	},
	subtitle: {
		color: '#9aa0a6',
		fontSize: 14,
	},
	inputCard: {
		backgroundColor: '#000',
		borderRadius: 14,
		padding: 16,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		gap: 10,
	},
	label: {
		color: '#ffffff',
		fontSize: 14,
		fontWeight: '600',
	},
	input: {
		color: '#ffffff',
		fontSize: 16,
		borderRadius: 10,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		paddingVertical: 10,
		paddingHorizontal: 12,
	},
	helperText: {
		color: '#9aa0a6',
		fontSize: 12,
	},
	button: {
		backgroundColor: '#00f0ff',
		paddingVertical: 14,
		alignItems: 'center',
		borderRadius: 14,
	},
	buttonDisabled: {
		opacity: 0.5,
	},
	buttonText: {
		color: '#000000',
		fontSize: 14,
		fontWeight: '700',
		letterSpacing: 0.4,
		textTransform: 'uppercase',
	},
});
