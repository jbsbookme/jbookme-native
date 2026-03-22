import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import { auth, db } from '@/src/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { uploadImageToCloudinary } from '@/services/cloudinary';
import { SafeImage } from '../../components/SafeImage';

export default function EditProfile() {
	const router = useRouter();
	const { user } = useAuth();
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [name, setName] = useState('');
	const [phone, setPhone] = useState('');
	const [photoUrl, setPhotoUrl] = useState('');
	const [uploadingPhoto, setUploadingPhoto] = useState(false);

	const requestMediaPermission = async () => {
		const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
		if (status !== 'granted') {
			Alert.alert('Permission needed', 'Allow access to your photos to choose a profile image.');
			return false;
		}
		return true;
	};

	useEffect(() => {
		const loadProfile = async () => {
			if (!user) return;
			setLoading(true);
			try {
				const snapshot = await getDoc(doc(db, 'users', user.uid));
				const data = snapshot.data() as { name?: string; phone?: string; photoUrl?: string } | undefined;
				setName(data?.name ?? user.displayName ?? '');
				setPhone(data?.phone ?? '');
				setPhotoUrl(data?.photoUrl ?? user.photoURL ?? '');
			} catch (error) {
				console.log('[EditProfile] load error:', error);
			} finally {
				setLoading(false);
			}
		};

		void loadProfile();
	}, [user]);

	const handleSave = async () => {
		if (!user || saving) return;
		setSaving(true);
		const payload = {
			name: name.trim(),
			phone: phone.trim(),
			photoUrl: photoUrl.trim(),
			updatedAt: new Date(),
		};
		console.log('[EditProfile] saving profile', payload);
		try {
			await setDoc(doc(db, 'users', user.uid), payload, { merge: true });
			if (auth.currentUser) {
				await updateProfile(auth.currentUser, {
					displayName: payload.name,
					photoURL: payload.photoUrl,
				});
			}
			console.log('[EditProfile] save success');
			Alert.alert('Saved', 'Your profile has been updated.');
			router.back();
		} catch (error) {
			console.log('[EditProfile] save error:', error);
			Alert.alert('Save failed', 'Unable to update your profile.');
		} finally {
			setSaving(false);
		}
	};

	const handlePickPhoto = async () => {
		if (uploadingPhoto) return;
		setUploadingPhoto(true);
		try {
			const allowed = await requestMediaPermission();
			if (!allowed) return;
			const result = await ImagePicker.launchImageLibraryAsync({
				mediaTypes: ImagePicker.MediaTypeOptions.Images,
				quality: 0.8,
			});
			if (result.canceled || !result.assets?.length) return;

			const uploadUrl = await uploadImageToCloudinary(result.assets[0].uri);
			setPhotoUrl(uploadUrl);
		} catch (error) {
			console.log('[EditProfile] photo upload error:', error);
			Alert.alert('Upload failed', 'Unable to upload profile photo.');
		} finally {
			setUploadingPhoto(false);
		}
	};

	if (loading) {
		return (
			<SafeAreaView style={styles.screen}>
				<View style={styles.loadingContainer}>
					<ActivityIndicator color="#00f0ff" size="large" />
					<Text style={styles.loadingText}>Loading profile...</Text>
				</View>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={styles.screen}>
			<View style={styles.content}>
				<Text style={styles.title}>Edit Profile</Text>
				<Text style={styles.subtitle}>Update your name, photo, and phone.</Text>

				<View style={styles.photoRow}>
					<View style={styles.photoPreview}>
						{photoUrl ? (
							<SafeImage
								uri={photoUrl}
								fallbackSource={require('../../assets/placeholder-barber.png')}
								style={styles.photoImage}
								resizeMode="cover"
							/>
						) : (
							<Text style={styles.photoPlaceholder}>No photo</Text>
						)}
					</View>
					<Pressable
						style={styles.photoButton}
						onPress={handlePickPhoto}
						disabled={uploadingPhoto}
					>
						<Text style={styles.photoButtonText}>
							{uploadingPhoto ? 'Uploading...' : 'Change Photo'}
						</Text>
					</Pressable>
				</View>

				<TextInput
					placeholder="Name"
					placeholderTextColor="#9aa0a6"
					value={name}
					onChangeText={setName}
					style={styles.input}
				/>
				<TextInput
					placeholder="Phone"
					placeholderTextColor="#9aa0a6"
					value={phone}
					onChangeText={setPhone}
					style={styles.input}
					keyboardType="phone-pad"
				/>
				<TextInput
					placeholder="Photo URL"
					placeholderTextColor="#9aa0a6"
					value={photoUrl}
					onChangeText={setPhotoUrl}
					style={styles.input}
					autoCapitalize="none"
				/>

				<Pressable style={styles.saveButton} onPress={handleSave} disabled={saving}>
					<Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
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
		padding: 20,
		gap: 12,
	},
	title: {
		color: '#ffffff',
		fontSize: 22,
		fontWeight: '700',
	},
	subtitle: {
		color: '#9aa0a6',
		fontSize: 13,
		marginBottom: 6,
	},
	photoRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		marginBottom: 6,
	},
	photoPreview: {
		width: 72,
		height: 72,
		borderRadius: 36,
		overflow: 'hidden',
		backgroundColor: '#000',
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
	},
	photoImage: {
		width: 72,
		height: 72,
		borderRadius: 36,
	},
	photoPlaceholder: {
		color: '#9aa0a6',
		fontSize: 12,
	},
	photoButton: {
		paddingVertical: 10,
		paddingHorizontal: 14,
		borderRadius: 10,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
backgroundColor: '#000',
	},
	photoButtonText: {
		color: '#ffffff',
		fontSize: 13,
		fontWeight: '600',
	},
	input: {
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		borderRadius: 10,
		paddingVertical: 10,
		paddingHorizontal: 12,
		color: '#ffffff',
	},
	saveButton: {
		marginTop: 8,
		backgroundColor: '#00f0ff',
		borderRadius: 12,
		paddingVertical: 12,
		alignItems: 'center',
	},
	saveButtonText: {
		color: '#000000',
		fontSize: 14,
		fontWeight: '700',
		textTransform: 'uppercase',
		letterSpacing: 0.6,
	},
	loadingContainer: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		gap: 12,
	},
	loadingText: {
		color: '#9aa0a6',
		fontSize: 13,
	},
});
