import React, { useState } from 'react';
import { Alert, Image, View, TextInput, StyleSheet, Pressable, Text } from 'react-native';
import { sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../src/config/firebase';

export default function LoginScreen() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [cooldownUntil, setCooldownUntil] = useState(0);

	const handleLogin = async () => {
		const now = Date.now();
		if (now < cooldownUntil) {
			const seconds = Math.ceil((cooldownUntil - now) / 1000);
			Alert.alert('Too many attempts', `Please wait ${seconds}s and try again.`);
			return;
		}
		if (!email || !password) {
			Alert.alert('Enter email and password');
			return;
		}
		if (isSubmitting) return;
		setIsSubmitting(true);
		try {
			await signInWithEmailAndPassword(auth, email, password);
			console.log("Login success");
		} catch (error) {
			console.log("LOGIN ERROR:", error);
			const code = (error as { code?: string }).code;
			if (code === 'auth/too-many-requests') {
				setCooldownUntil(Date.now() + 15000);
				Alert.alert('Too many attempts', 'Wait 15 seconds and try again.');
				return;
			}
			Alert.alert('Login failed', 'Please check your credentials and try again.');
		} finally {
			setIsSubmitting(false);
		}
	};

	const resetPassword = async (value: string) => {
		if (!value) {
			Alert.alert('Enter your email');
			return;
		}
		await sendPasswordResetEmail(auth, value);
		Alert.alert('Password reset email sent');
	};

	return (
		<View style={styles.container}>
			<View style={styles.logoWrap}>
				<Image source={require("../../assets/images/logo.png")} style={styles.logo} resizeMode="contain" />
			</View>
			<TextInput
				placeholder="Email"
				placeholderTextColor="#666"
				value={email}
				onChangeText={setEmail}
				style={styles.input}
			/>

			<TextInput
				placeholder="Password"
				placeholderTextColor="#666"
				value={password}
				secureTextEntry
				onChangeText={setPassword}
				style={styles.input}
			/>

			<Pressable style={styles.primaryButton} onPress={handleLogin} disabled={isSubmitting}>
				<Text style={styles.primaryButtonText}>
					{isSubmitting ? 'Logging in...' : 'Login'}
				</Text>
			</Pressable>
			<Pressable onPress={() => resetPassword(email)}>
				<Text style={styles.forgotText}>Forgot Password?</Text>
			</Pressable>
			<Pressable onPress={() => router.push('/auth/register')}>
				<Text style={styles.forgotText}>Create Account</Text>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#000000",
		justifyContent: "center",
		padding: 20
	},
	logoWrap: {
		alignSelf: "center",
		width: 164,
		height: 164,
		borderRadius: 82,
		borderWidth: 2,
		borderColor: "rgba(0,255,255,0.75)",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "#000",
		overflow: "hidden",
		shadowColor: "#00FFFF",
		shadowOpacity: 0.7,
		shadowRadius: 16,
		shadowOffset: { width: 0, height: 6 },
		elevation: 8,
		marginTop: -28,
		marginBottom: 26
	},
	logo: {
		width: 120,
		height: 120,
		borderRadius: 60
	},
	input: {
		borderWidth: 1,
		borderColor: "rgba(0,255,255,0.35)",
		backgroundColor: "#000",
		color: "#ffffff",
		marginBottom: 10,
		padding: 12,
		borderRadius: 10
	},
	primaryButton: {
		marginTop: 8,
		paddingVertical: 12,
		borderRadius: 12,
		alignItems: "center",
		backgroundColor: "#00FFFF",
		shadowColor: "#00FFFF",
		shadowOpacity: 0.5,
		shadowRadius: 10,
		shadowOffset: { width: 0, height: 4 },
		elevation: 6
	},
	primaryButtonText: {
		color: "#000000",
		fontSize: 16,
		fontWeight: "700",
		letterSpacing: 0.5
	},
	forgotText: {
		color: '#9aa0a6',
		marginTop: 10,
		textAlign: 'center',
	}
});
