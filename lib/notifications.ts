type NotificationsModule = typeof import('expo-notifications');
import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

async function getNotificationsModule(): Promise<NotificationsModule | null> {
  if (Platform.OS === 'ios' && !requireOptionalNativeModule('ExpoPushTokenManager')) {
    return null;
  }
  try {
    return await import('expo-notifications');
  } catch (error) {
    console.warn('Notifications unavailable:', error);
    return null;
  }
}

export async function configureNotifications() {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function requestNotificationPermissions() {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return null;

  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED) {
    return settings;
  }

  return Notifications.requestPermissionsAsync();
}

export async function registerForPushNotifications() {
  if (__DEV__) return null;
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

  let token: string | null = null;
  try {
    token = (await Notifications.getExpoPushTokenAsync()).data;
  } catch (error) {
    console.log('Get push token error:', error);
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  return token;
}

export async function scheduleAppointmentReminder(date: Date, barberName: string) {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;

  const settings = await Notifications.getPermissionsAsync();
  if (!settings.granted && settings.ios?.status !== Notifications.IosAuthorizationStatus.AUTHORIZED) {
    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Appointment Reminder',
      body: `Your haircut with ${barberName} is in 1 hour.\nLocation: JB's Barbershop\n98 Union St, Lynn`,
      sound: true,
    },
    trigger: { date },
  });
}
