import { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

export function useNotifications() {
  const navigation = useNavigation<any>();

  useEffect(() => {
    let subForeground: { remove: () => void } | null = null;
    let subResponse: { remove: () => void } | null = null;

    const setupNotifications = async () => {
      if (Platform.OS === 'ios' && !requireOptionalNativeModule('ExpoPushTokenManager')) {
        return;
      }
      let Notifications: typeof import('expo-notifications') | null = null;
      try {
        Notifications = await import('expo-notifications');
      } catch {
        return;
      }

      subForeground = Notifications.addNotificationReceivedListener(() => {
        // aquí puedes mostrar banner in-app si quieres
      });

      subResponse = Notifications.addNotificationResponseReceivedListener(
        (response) => {
          const data = response.notification.request.content.data as any;
          const type = data?.type;

          if (data?.postId) {
            navigation.navigate('Feed', {
              postId: data.postId,
              type,
              userId: data?.userId,
            });
            return;
          }

          if (type === 'SYSTEM') {
            navigation.navigate('Feed');
          }
        }
      );
    };

    void setupNotifications();

    return () => {
      subForeground?.remove();
      subResponse?.remove();
    };
  }, [navigation]);
}
