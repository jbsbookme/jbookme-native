import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { View } from 'react-native';
// import { StripeProvider } from '@stripe/stripe-react-native';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { requestNotificationPermissions } from '../lib/notifications';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Evita que el splash se quede bloqueado
SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === 'auth';
    if (!user && !inAuthGroup) {
      router.replace('/auth/login');
      return;
    }
    if (user && inAuthGroup) {
      router.replace('/(tabs)/home');
    }
  }, [loading, router, segments, user]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        gestureResponseDistance: { horizontal: 80 },
      }}
    />
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
    if (!__DEV__) {
      requestNotificationPermissions();
    }
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000' }}>
      <AuthProvider>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <RootLayoutNav />
        </View>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}