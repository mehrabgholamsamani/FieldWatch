import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../stores/authStore';
import { ROLES } from '../types';
import { C } from '../utils/theme';

export default function IndexScreen() {
  const { isAuthenticated, isLoading, user } = useAuthStore();

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  if (isAuthenticated && user) {
    if (user.role === ROLES.REPORTER) {
      return <Redirect href="/(tabs)/reports" />;
    }
    return <Redirect href="/(tabs)/dashboard" />;
  }

  return <Redirect href="/(auth)/login" />;
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white },
});
