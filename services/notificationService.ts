import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

async function isPhysicalDevice() {
  if (Platform.OS === 'web') return false;
  return true;
}

async function getNotificationsModule() {
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

export async function registerForPush(tokenAuth: string) {
  if (!(await isPhysicalDevice())) return null;

  const Notifications = await getNotificationsModule();
  if (!Notifications) return null;

  const { status: existingStatus } =
    await Notifications.getPermissionsAsync();

  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  let pushToken: string | null = null;
  try {
    pushToken = (await Notifications.getExpoPushTokenAsync()).data;
  } catch (error) {
    console.warn('Get push token error:', error);
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  await fetch(`${process.env.EXPO_PUBLIC_API_URL}/notifications/register`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenAuth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      pushToken,
      platform: Platform.OS,
    }),
  });

  return pushToken;
}
