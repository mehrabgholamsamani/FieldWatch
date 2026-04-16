import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { fetchAllUsers } from '../../services/reports';
import { LoadingBar } from '../../components/LoadingBar';
import { C } from '../../utils/theme';
import { ROLES } from '../../types';

interface UserItem {
  id: string;
  fullName: string;
  email: string;
  role: string;
}

function roleBadgeStyle(role: string): object {
  if (role === ROLES.ADMIN) return { backgroundColor: C.primary };
  if (role === ROLES.MANAGER) return { backgroundColor: '#555' };
  return { backgroundColor: C.border };
}

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  REPORTER: 'Reporter',
};

export default function UsersScreen() {
  const { user } = useAuthStore();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchAllUsers();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (user && user.role !== ROLES.ADMIN) {
    router.replace('/(tabs)/dashboard');
    return null;
  }

  return (
    <View style={styles.container}>
      <LoadingBar visible={isLoading && users.length === 0} />
      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={isLoading && users.length > 0}
            onRefresh={load}
            tintColor={C.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={styles.count}>{users.length} USER{users.length !== 1 ? 'S' : ''}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowName}>{item.fullName}</Text>
              <Text style={styles.rowEmail}>{item.email}</Text>
            </View>
            <View style={[styles.roleBadge, roleBadgeStyle(item.role)]}>
              <Text style={styles.roleBadgeText}>{ROLE_LABEL[item.role] ?? item.role}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              {error ? (
                <Text style={styles.errorText}>{error}</Text>
              ) : (
                <Text style={styles.emptyText}>No users found.</Text>
              )}
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  listHeader: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.white,
  },
  count: { fontSize: 11, fontWeight: '600', color: C.secondary, letterSpacing: 0.5 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  rowLeft: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: '600', color: C.primary, marginBottom: 3 },
  rowEmail: { fontSize: 13, color: C.secondary },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: C.border,
  },
  roleBadgeText: { fontSize: 11, fontWeight: '600', color: C.white, letterSpacing: 0.3 },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, color: C.secondary },
  errorText: { fontSize: 14, color: C.accent, textAlign: 'center' },
});
