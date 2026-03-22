import * as SecureStore from 'expo-secure-store';

export async function silentLogout() {
  await SecureStore.deleteItemAsync('access_token');
  await SecureStore.deleteItemAsync('refresh_token');
  // navega a login si aplica
}
