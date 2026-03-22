import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';

export default function RegisterScreen() {
	const router = useRouter();
	const { register } = useAuth();
	const [firstName, setFirstName] = useState('');
	const [lastName, setLastName] = useState('');
	const [email, setEmail] = useState('');
	const [phone, setPhone] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState('');
	const [submitting, setSubmitting] = useState(false);

	const handleRegister = async () => {
		setError('');
		if (!firstName || !lastName || !email || !phone || !password) {
			Alert.alert('Please complete all fields');
			return;
		}
		setSubmitting(true);
		try {
			await register(
				firstName.trim(),
				lastName.trim(),
				email.trim(),
				phone.trim(),
				password
			);
			router.replace('/(tabs)/home');
		} catch (err) {
			console.log(err);
			const message = err instanceof Error ? err.message : 'Unable to create account.';
			setError(message);
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<SafeAreaView style={styles.screen}>
			<View style={[styles.card, { backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(225, 6, 0, 0.85)' }]}>
				<Text style={styles.title}>Create account</Text>
				<Text style={styles.subtitle}>Join JBookMe today</Text>

				<TextInput
					style={styles.input}
					placeholder="First name"
					placeholderTextColor="#9aa0a6"
					value={firstName}
					onChangeText={setFirstName}
				/>
				<TextInput
					style={styles.input}
					placeholder="Last name"
					placeholderTextColor="#9aa0a6"
					value={lastName}
					onChangeText={setLastName}
				/>
				<TextInput
					style={styles.input}
					placeholder="Email"
					placeholderTextColor="#9aa0a6"
					autoCapitalize="none"
					autoCorrect={false}
					keyboardType="email-address"
					value={email}
					onChangeText={setEmail}
				/>
				<TextInput
					style={styles.input}
					placeholder="Phone"
					placeholderTextColor="#9aa0a6"
					keyboardType="phone-pad"
					value={phone}
					onChangeText={setPhone}
				/>
				<TextInput
					style={styles.input}
					placeholder="Password"
					placeholderTextColor="#9aa0a6"
					secureTextEntry
					value={password}
					onChangeText={setPassword}
				/>

				{error ? <Text style={styles.error}>{error}</Text> : null}

				<Pressable style={styles.primaryButton} onPress={handleRegister} disabled={submitting}>
					<Text style={styles.primaryButtonText}>
						{submitting ? 'Creating...' : 'Create Account'}
					</Text>
				</Pressable>

				<Pressable style={styles.linkButton} onPress={() => router.replace('/auth/login')}>
					<Text style={styles.linkText}>Back to login</Text>
				</Pressable>
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	screen: {
		flex: 1,
		backgroundColor: '#000000',
		justifyContent: 'center',
		paddingHorizontal: 24,
	},
	card: {
		backgroundColor: '#000',
		borderRadius: 16,
		padding: 20,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		gap: 12,
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
	input: {
backgroundColor: '#000',
		borderRadius: 12,
		paddingVertical: 12,
		paddingHorizontal: 14,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		color: '#ffffff',
	},
	primaryButton: {
		backgroundColor: '#00f0ff',
		borderRadius: 12,
		paddingVertical: 12,
		alignItems: 'center',
		marginTop: 4,
	},
	primaryButtonText: {
		color: '#000000',
		fontSize: 14,
		fontWeight: '700',
		textTransform: 'uppercase',
	},
	error: {
		color: '#ff4d4f',
		fontSize: 12,
		fontWeight: '600',
	},
	linkButton: {
		alignSelf: 'center',
		paddingVertical: 6,
	},
	linkText: {
		color: '#00f0ff',
		fontSize: 13,
		fontWeight: '600',
	},
});
