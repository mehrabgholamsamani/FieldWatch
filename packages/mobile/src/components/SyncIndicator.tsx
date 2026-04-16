import { StyleSheet, Text, View } from 'react-native';
import { useSyncStore } from '../stores/syncStore';
import { C } from '../utils/theme';

export function SyncIndicator() {
  const { queue, syncStatus } = useSyncStore();
  const pendingCount = queue.filter((r) => r.syncStatus === 'PENDING').length;
  const failedCount = queue.filter((r) => r.syncStatus === 'FAILED').length;

  if (syncStatus === 'syncing') {
    return <Text style={styles.text}>Syncing…</Text>;
  }

  if (failedCount > 0) {
    return (
      <Text style={[styles.text, styles.error]}>
        {failedCount} {failedCount === 1 ? 'report' : 'reports'} failed to sync
      </Text>
    );
  }

  if (pendingCount > 0) {
    return (
      <Text style={styles.text}>
        {pendingCount} {pendingCount === 1 ? 'report' : 'reports'} pending
      </Text>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  text: { fontSize: 12, color: C.secondary },
  error: { color: C.accent },
});
