import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/src/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { getNotifications, markAsRead, subscribe } from '@/store/notificationStore';

type NotificationSettings = {
	reminders: boolean;
	bookingConfirmations: boolean;
	cancellations: boolean;
	promotions: boolean;
};

const DEFAULT_SETTINGS: NotificationSettings = {
	reminders: true,
	bookingConfirmations: true,
	cancellations: true,
	promotions: false,
};

export default function ProfileNotifications() {
	const router = useRouter();
	const { user } = useAuth();
	const [loading, setLoading] = useState(true);
	const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
	const notifications = useSyncExternalStore(
		subscribe,
		() => getNotifications(user?.uid ?? ''),
		() => getNotifications(user?.uid ?? '')
	);
	const unreadCount = useMemo(
		() => notifications.filter((item) => !item.read).length,
		[notifications]
	);

	useEffect(() => {
		const loadSettings = async () => {
			if (!user) return;
			setLoading(true);
			try {
				const ref = doc(db, 'users', user.uid, 'notificationSettings', 'settings');
				const snapshot = await getDoc(ref);
				if (snapshot.exists()) {
					const data = snapshot.data() as Partial<NotificationSettings>;
					setSettings({
						reminders: data.reminders ?? DEFAULT_SETTINGS.reminders,
						bookingConfirmations:
							data.bookingConfirmations ?? DEFAULT_SETTINGS.bookingConfirmations,
						cancellations: data.cancellations ?? DEFAULT_SETTINGS.cancellations,
						promotions: data.promotions ?? DEFAULT_SETTINGS.promotions,
					});
				}
			} catch (error) {
				console.log('[Notifications] load error:', error);
			} finally {
				setLoading(false);
			}
		};

		void loadSettings();
	}, [user]);

	const updateSetting = async (key: keyof NotificationSettings, value: boolean) => {
		if (!user) return;
		setSettings((current) => ({ ...current, [key]: value }));
		try {
			await setDoc(
				doc(db, 'users', user.uid, 'notificationSettings', 'settings'),
				{ [key]: value, updatedAt: new Date() },
				{ merge: true }
			);
		} catch (error) {
			console.log('[Notifications] save error:', error);
		}
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
				<Text style={styles.title}>Notifications</Text>
				<Text style={styles.subtitle}>Manage your notification preferences.</Text>

				{loading ? (
					<View style={styles.loadingRow}>
						<ActivityIndicator color="#00f0ff" />
						<Text style={styles.loadingText}>Loading settings...</Text>
					</View>
				) : (
					<View style={styles.settingsCard}>
						<View style={styles.settingRow}>
							<Text style={styles.settingLabel}>Appointment Reminders</Text>
							<Switch
								value={settings.reminders}
								onValueChange={(value) => updateSetting('reminders', value)}
								trackColor={{ false: '#1f1f1f', true: '#00f0ff' }}
								thumbColor="#ffffff"
							/>
						</View>
						<View style={styles.settingRow}>
							<Text style={styles.settingLabel}>Booking Confirmations</Text>
							<Switch
								value={settings.bookingConfirmations}
								onValueChange={(value) => updateSetting('bookingConfirmations', value)}
								trackColor={{ false: '#1f1f1f', true: '#00f0ff' }}
								thumbColor="#ffffff"
							/>
						</View>
						<View style={styles.settingRow}>
							<Text style={styles.settingLabel}>Cancellation Alerts</Text>
							<Switch
								value={settings.cancellations}
								onValueChange={(value) => updateSetting('cancellations', value)}
								trackColor={{ false: '#1f1f1f', true: '#00f0ff' }}
								thumbColor="#ffffff"
							/>
						</View>
						<View style={styles.settingRow}>
							<Text style={styles.settingLabel}>Promotions</Text>
							<Switch
								value={settings.promotions}
								onValueChange={(value) => updateSetting('promotions', value)}
								trackColor={{ false: '#1f1f1f', true: '#00f0ff' }}
								thumbColor="#ffffff"
							/>
						</View>
					</View>
				)}

				<View style={styles.sectionHeader}>
					<Text style={styles.sectionTitle}>Recent</Text>
					{unreadCount > 0 ? (
						<View style={styles.unreadPill}>
							<Text style={styles.unreadText}>{unreadCount} new</Text>
						</View>
					) : null}
				</View>
				{notifications.length === 0 ? (
					<View style={styles.emptyState}>
						<Ionicons name="notifications" size={38} color="#5f6368" />
						<Text style={styles.emptyTitle}>No notifications yet.</Text>
						<Text style={styles.emptyBody}>
							When you receive booking updates, reminders or promotions they will appear here.
						</Text>
					</View>
				) : (
					notifications.map((item) => (
						<Pressable
							key={item.id}
							style={[styles.notificationCard, !item.read && styles.notificationCardUnread]}
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
	settingsCard: {
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		borderRadius: 12,
		padding: 14,
backgroundColor: '#000',
		gap: 12,
	},
	settingRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 12,
	},
	settingLabel: {
		color: '#ffffff',
		fontSize: 14,
		fontWeight: '600',
		flex: 1,
	},
	loadingRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		paddingVertical: 6,
	},
	loadingText: {
		color: '#9aa0a6',
		fontSize: 12,
	},
	sectionHeader: {
		marginTop: 6,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	sectionTitle: {
		color: '#00f0ff',
		fontSize: 14,
		fontWeight: '600',
	},
	unreadPill: {
		paddingHorizontal: 10,
		paddingVertical: 4,
		borderRadius: 999,
backgroundColor: '#000',
		borderWidth: 1,
		borderColor: 'rgba(255,255,255,0.16)',
	},
	unreadText: {
		color: '#ffffff',
		fontSize: 11,
		fontWeight: '600',
	},
	emptyState: {
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		borderRadius: 14,
		padding: 18,
backgroundColor: '#000',
		gap: 8,
		alignItems: 'center',
	},
	emptyTitle: {
		color: '#ffffff',
		fontSize: 14,
		fontWeight: '700',
		textAlign: 'center',
	},
	emptyBody: {
		color: '#9aa0a6',
		fontSize: 12,
		lineHeight: 18,
		textAlign: 'center',
	},
	notificationCard: {
		backgroundColor: '#000',
		borderRadius: 14,
		padding: 14,
		marginTop: 10,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
	},
	notificationCardUnread: {
		borderColor: 'rgba(0,240,255,0.45)',
	},
	notificationRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 12,
	},
	notificationText: {
		color: '#ffffff',
		fontSize: 14,
		fontWeight: '600',
		flex: 1,
	},
	notificationDot: {
		width: 8,
		height: 8,
		borderRadius: 4,
		backgroundColor: '#00f0ff',
	},
});
