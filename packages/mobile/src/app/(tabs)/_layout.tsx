import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../stores/authStore';
import { ROLES } from '../../types';
import { C } from '../../utils/theme';

type IconName = React.ComponentProps<typeof Feather>['name'];

function TabIcon({
  name,
  focused,
}: {
  name: IconName;
  focused: boolean;
}) {
  const scale = useRef(new Animated.Value(focused ? 1 : 0.88)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: focused ? 1 : 0.88,
      useNativeDriver: true,
      tension: 260,
      friction: 16,
    }).start();
  }, [focused]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Feather name={name} size={20} color={focused ? C.primary : C.placeholder} />
    </Animated.View>
  );
}

export default function TabsLayout() {
  const { user, isLoading } = useAuthStore();
  const insets = useSafeAreaInsets();

  // Prevent flash of wrong tabs while auth state is hydrating
  if (isLoading && !user) return null;

  const isReporter = !user || user.role === ROLES.REPORTER;
  const isManager = user?.role === ROLES.MANAGER || user?.role === ROLES.ADMIN;
  const isAdmin = user?.role === ROLES.ADMIN;

  return (
    <Tabs
      screenOptions={{
        tabBarShowLabel: true,
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.placeholder,
        tabBarLabelStyle: styles.tabLabel,
        tabBarStyle: [styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }],
        tabBarItemStyle: styles.tabBarItem,
        tabBarHideOnKeyboard: true,
        headerStyle: styles.header,
        headerShadowVisible: false,
        headerTitleStyle: styles.headerTitle,
        headerTitleAlign: 'center',
        headerTintColor: C.primary,
      }}
    >
      {/* ── Reporter tabs ──────────────────────────────────────── */}
      <Tabs.Screen
        name="create"
        options={{
          title: 'New',
          href: isReporter ? undefined : null,
          tabBarIcon: ({ focused }) => <TabIcon name="plus-circle" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports',
          href: isReporter ? undefined : null,
          tabBarIcon: ({ focused }) => <TabIcon name="file-text" focused={focused} />,
        }}
      />

      {/* ── Manager / Admin tabs ──────────────────────────────── */}
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          href: isManager ? undefined : null,
          tabBarIcon: ({ focused }) => <TabIcon name="grid" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="all-reports"
        options={{
          title: 'All Reports',
          href: isManager ? undefined : null,
          tabBarIcon: ({ focused }) => <TabIcon name="list" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          href: isManager ? undefined : null,
          tabBarIcon: ({ focused }) => <TabIcon name="map" focused={focused} />,
        }}
      />

      {/* ── Admin only ────────────────────────────────────────── */}
      <Tabs.Screen
        name="users"
        options={{
          title: 'Users',
          href: isAdmin ? undefined : null,
          tabBarIcon: ({ focused }) => <TabIcon name="users" focused={focused} />,
        }}
      />

      {/* ── Shared ────────────────────────────────────────────── */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon name="user" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: C.white,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 6,
    elevation: Platform.OS === 'android' ? 4 : 0,
    shadowColor: C.black,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  tabBarItem: {
    paddingTop: 4,
    paddingBottom: 2,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.1,
    marginTop: 2,
  },
  header: {
    backgroundColor: C.white,
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerTitle: {
    fontWeight: '700',
    fontSize: 15,
    color: C.primary,
    letterSpacing: -0.3,
  },
});
