export const scheduleBookingNotification = async (date: Date) => {
	const { requireOptionalNativeModule } = await import('expo-modules-core');
	const { Platform } = await import('react-native');
	if (Platform.OS === 'ios' && !requireOptionalNativeModule('ExpoPushTokenManager')) {
		return;
	}
	let Notifications: typeof import('expo-notifications') | null = null;
	try {
		Notifications = await import('expo-notifications');
	} catch (error) {
		return;
	}

	if (!Notifications?.scheduleNotificationAsync) return;

	const trigger = new Date(date);
	trigger.setHours(trigger.getHours() - 1);

	await Notifications.scheduleNotificationAsync({
		content: {
			title: 'Upcoming Appointment 💈',
			body: 'Your haircut appointment is coming soon.',
		},
		trigger,
	});
};
