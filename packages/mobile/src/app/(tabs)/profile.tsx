import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { C } from '../../utils/theme';

const ROLE_LABEL: Record<string, string> = {
  REPORTER: 'Field Reporter',
  MANAGER: 'Manager',
  ADMIN: 'Administrator',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  const initials = user?.fullName ? getInitials(user.fullName) : '?';

  return (
    <View style={styles.container}>
      {/* Avatar header */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.displayName}>{user?.fullName ?? '—'}</Text>
        <Text style={styles.roleTag}>{user?.role ? ROLE_LABEL[user.role] ?? user.role : '—'}</Text>
      </View>

      <Text style={styles.sectionLabel}>ACCOUNT</Text>
      <View style={styles.infoBlock}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Name</Text>
          <Text style={styles.rowValue}>{user?.fullName ?? '—'}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Email</Text>
          <Text style={styles.rowValue} numberOfLines={1} ellipsizeMode="tail">{user?.email ?? '—'}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Role</Text>
          <Text style={styles.rowValue}>{user?.role ? ROLE_LABEL[user.role] ?? user.role : '—'}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.signOutBtn} onPress={handleLogout}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
    paddingHorizontal: 20,
    paddingTop: 32,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '700',
    color: C.white,
    letterSpacing: 1,
  },
  displayName: {
    fontSize: 18,
    fontWeight: '700',
    color: C.primary,
    marginBottom: 4,
  },
  roleTag: {
    fontSize: 13,
    color: C.secondary,
    fontWeight: '500',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: C.secondary,
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  infoBlock: {
    backgroundColor: C.white,
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: C.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  divider: { height: 1, backgroundColor: C.border, marginLeft: 16 },
  rowLabel: { fontSize: 15, color: C.primary },
  rowValue: {
    fontSize: 15,
    color: C.secondary,
    maxWidth: '60%',
    textAlign: 'right',
    flexShrink: 1,
  },
  signOutBtn: {
    marginTop: 24,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: C.white,
    shadowColor: C.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  signOutText: { fontSize: 15, color: C.accent, fontWeight: '600' },
});
