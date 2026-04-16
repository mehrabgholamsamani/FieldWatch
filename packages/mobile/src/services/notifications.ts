/**
 * Push notification setup and device token registration.
 *
 * Requests permission, retrieves the FCM/APNs push token via
 * expo-notifications, and registers it with the backend.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './api';

// Configure how notifications are presented while the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  const tokenData = await Notifications.getExpoPushTokenAsync();
  const token = tokenData.data;

  const platform: 'ios' | 'android' = Platform.OS === 'ios' ? 'ios' : 'android';

  try {
    await api.post('/devices/register', { token, platform });
  } catch {
    // Best-effort — don't block login if registration fails
  }

  return token;
}

export type NotificationPayload = {
  type: 'new_report' | 'status_change';
  reportId: string;
  status?: string;
};

export function getNotificationReportId(
  notification: Notifications.Notification,
): string | null {
  const data = notification.request.content.data as Record<string, unknown>;
  return typeof data?.reportId === 'string' ? data.reportId : null;
}
