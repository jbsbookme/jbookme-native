import 'expo-router/entry';
import { configureNotifications, requestNotificationPermissions } from './lib/notifications';

void configureNotifications();
void requestNotificationPermissions();
