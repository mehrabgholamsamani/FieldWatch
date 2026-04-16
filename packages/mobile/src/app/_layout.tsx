import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from '../stores/authStore';
import { useSyncStore } from '../stores/syncStore';
import { startNetworkListener, syncPendingReports } from '../services/syncEngine';
import { getNotificationReportId } from '../services/notifications';
import { setForceLogoutHandler } from '../utils/authEvents';
import { ToastContainer } from '../components/Toast';

export default function RootLayout() {
  const { loadUser, logout } = useAuthStore();
  const { setSyncStatus, setLastSyncAt, removeFromQueue } = useSyncStore();
  const router = useRouter();
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // Register the force-logout handler so the Axios interceptor can clear auth
  // state and navigate to login when the refresh token expires.
  useEffect(() => {
    setForceLogoutHandler(() => {
      logout().catch(() => {});
      router.replace('/(auth)/login');
    });
  }, [logout, router]);

  useEffect(() => {
    // Initial drain on app launch (in case there are pending items from last session)
    syncPendingReports((item) => {
      removeFromQueue(item.localId);
    }).catch(() => {});

    // Listen for reconnect events
    const unsubscribe = startNetworkListener((result) => {
      if (result.synced > 0) {
        setLastSyncAt(new Date().toISOString());
      }
      setSyncStatus(result.failed > 0 ? 'error' : 'idle');
    });

    return unsubscribe;
  }, [setSyncStatus, setLastSyncAt, removeFromQueue]);

  useEffect(() => {
    // Handle notification tap when app is already open (foreground)
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (_notification) => {
        // Notification received while app is foregrounded — no action needed
      },
    );

    // Handle notification tap (app in background or closed)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const reportId = getNotificationReportId(response.notification);
        // Validate UUID format before navigating — reject crafted notification payloads
        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (reportId && UUID_RE.test(reportId)) {
          router.push(`/report/${reportId}`);
        }
      },
    );

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [router]);

  return (
    <View style={{ flex: 1 }}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="report/[id]" options={{ title: 'Report Detail' }} />
      </Stack>
      <ToastContainer />
    </View>
  );
}
