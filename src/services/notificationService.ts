import { doc, getDoc, setDoc } from 'firebase/firestore';
import Constants from 'expo-constants';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';
import { getAuth } from 'firebase/auth';
import { db } from '../config/firebase';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type NotificationPayload = {
	customerName: string;
	serviceName: string;
	timeLabel: string;
};

function getProjectId() {
	const easProjectId = Constants?.expoConfig?.extra?.eas?.projectId;
	return easProjectId ?? Constants?.easConfig?.projectId ?? undefined;
}

async function isPhysicalDevice() {
	if (Platform.OS === 'web') return false;
	return Constants?.isDevice ?? false;
}

async function getNotificationsModule() {
	if (Platform.OS === 'ios' && !requireOptionalNativeModule('ExpoPushTokenManager')) {
		return null;
	}
	try {
		return await import('expo-notifications');
	} catch {
		return null;
	}
}

export async function registerForPushNotifications(userId?: string) {
	if (!(await isPhysicalDevice())) return null;

	const Notifications = await getNotificationsModule();
	if (!Notifications) return null;

	const settings = await Notifications.getPermissionsAsync();
	let finalStatus = settings.granted
		? 'granted'
		: settings.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED
		? 'granted'
		: settings.status;

	if (finalStatus !== 'granted') {
		const requested = await Notifications.requestPermissionsAsync();
		finalStatus = requested.granted
			? 'granted'
			: requested.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED
			? 'granted'
			: requested.status;
	}

	if (finalStatus !== 'granted') return null;

	const tokenData = await Notifications.getExpoPushTokenAsync({ projectId: getProjectId() });
	const token = tokenData.data;

	const authUser = getAuth().currentUser;
	const targetUserId = userId ?? authUser?.uid;
	if (!targetUserId) return null;

	if (Platform.OS === 'android') {
		await Notifications.setNotificationChannelAsync('default', {
			name: 'default',
			importance: Notifications.AndroidImportance.MAX,
		});
	}

	try {
		await setDoc(
			doc(db, 'users', targetUserId),
			{
				pushToken: token,
				pushTokenUpdatedAt: new Date(),
			},
			{ merge: true }
		);
	} catch {
		return null;
	}

	console.log('Push token saved:', token);
	return token;
}

export async function sendNewAppointmentNotification(
	barberId: string,
	payload: NotificationPayload
) {
	const Notifications = await getNotificationsModule();
	if (!Notifications) return;

	let pushToken: string | undefined;
	try {
		const snapshot = await getDoc(doc(db, 'users', barberId));
		const data = snapshot.data() as { pushToken?: string } | undefined;
		pushToken = data?.pushToken;
	} catch {
		return;
	}
	if (!pushToken) return;

	await fetch(EXPO_PUSH_URL, {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Accept-encoding': 'gzip, deflate',
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			to: pushToken,
			sound: 'default',
			title: 'New Appointment',
			body: `${payload.customerName} booked ${payload.serviceName} at ${payload.timeLabel}`,
			data: { type: 'appointment' },
		}),
	});
}

export async function scheduleAppointmentReminder(
	appointmentDate: Date,
	barberName: string
) {
	const Notifications = await getNotificationsModule();
	if (!Notifications) return;

	if (Platform.OS === 'android') {
		await Notifications.setNotificationChannelAsync('default', {
			name: 'default',
			importance: Notifications.AndroidImportance.MAX,
		});
	}

	const triggerDate = new Date(appointmentDate);
	triggerDate.setHours(triggerDate.getHours() - 1);
	if (triggerDate <= new Date()) return;

	await Notifications.scheduleNotificationAsync({
		content: {
			title: 'Reminder',
			body: `Your appointment with ${barberName} is today at ${appointmentDate.toLocaleTimeString('en-US', {
				hour: 'numeric',
				minute: '2-digit',
			})}.`,
		},
		trigger:
			Platform.OS === 'android'
				? { type: 'date', date: triggerDate, channelId: 'default' }
				: { type: 'date', date: triggerDate },
	});
}

export async function registerPushOnLogin() {
	try {
		await registerForPushNotifications();
	} catch (error) {
		console.log('Push registration error:', error);
	}
}
