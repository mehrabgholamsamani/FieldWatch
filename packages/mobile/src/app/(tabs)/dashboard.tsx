import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/authStore';
import { fetchReports, fetchStats } from '../../services/reports';
import { StatusBadge } from '../../components/StatusBadge';
import { SkeletonStatCard, SkeletonDashboardCard } from '../../components/SkeletonCard';
import { ErrorState } from '../../components/ErrorState';
import { C } from '../../utils/theme';
import { ROLES } from '../../types';
import type { Priority, Report, ReportStats } from '../../types';

function timeAgo(isoString: string): string {
  const diff = (Date.now() - new Date(isoString).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const PRIORITY_LABEL: Record<Priority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

const PRIORITY_COLOR: Record<Priority, string> = {
  LOW: C.priorityLow,
  MEDIUM: C.priorityMedium,
  HIGH: C.priorityHigh,
  CRITICAL: C.priorityCritical,
};

export default function DashboardScreen() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [recent, setRecent] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [statsData, reportsData] = await Promise.all([
        fetchStats(),
        fetchReports(undefined, 10, { sortBy: 'newest' }),
      ]);
      setStats(statsData);
      setRecent(reportsData.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (user && user.role === ROLES.REPORTER) {
    router.replace('/(tabs)/reports');
    return null;
  }

  const showSkeletons = isLoading && !stats;

  if (error && !stats && !isLoading) {
    return <ErrorState title="Failed to load dashboard" subtitle={error} onRetry={load} />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={showSkeletons ? [] : recent}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isLoading && !!stats} onRefresh={load} tintColor={C.primary} />
        }
        ListHeaderComponent={
          <>
            {/* Stats row */}
            <View style={styles.statsRow}>
              {showSkeletons ? (
                <>
                  <SkeletonStatCard />
                  <SkeletonStatCard />
                  <SkeletonStatCard />
                </>
              ) : (
                <>
                  <StatCard
                    label="Total"
                    value={stats?.total ?? '—'}
                    accentColor={C.statusSubmitted}
                    onPress={() => router.push('/(tabs)/all-reports')}
                  />
                  <StatCard
                    label="Pending Review"
                    value={stats?.pendingReview ?? '—'}
                    accentColor={C.statusPending}
                    onPress={() =>
                      router.push({
                        pathname: '/(tabs)/all-reports',
                        params: { initialStatus: 'SUBMITTED' },
                      })
                    }
                  />
                  <StatCard
                    label="Resolved Today"
                    value={stats?.resolvedToday ?? '—'}
                    accentColor={C.statusResolved}
                    onPress={() =>
                      router.push({
                        pathname: '/(tabs)/all-reports',
                        params: { initialStatus: 'RESOLVED' },
                      })
                    }
                  />
                </>
              )}
            </View>


            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>RECENT REPORTS</Text>
            </View>

            {showSkeletons ? (
              <>
                {[...Array(5)].map((_, i) => <SkeletonDashboardCard key={i} />)}
              </>
            ) : null}
          </>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/report/${item.id}`)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.priorityBar,
                { backgroundColor: PRIORITY_COLOR[item.priority] },
              ]}
            />
            <View style={styles.cardContent}>
              <View style={styles.rowTop}>
                <Text style={styles.rowReporter} numberOfLines={1}>
                  {item.reporterName ?? 'Unknown'}
                </Text>
                <Text style={styles.rowTime}>{timeAgo(item.createdAt)}</Text>
              </View>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <View style={styles.rowMeta}>
                <StatusBadge status={item.status} />
                <Text style={[styles.priorityText, { color: PRIORITY_COLOR[item.priority] }]}>
                  {PRIORITY_LABEL[item.priority]}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No reports yet.</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

function StatCard({
  label,
  value,
  accentColor,
  onPress,
}: {
  label: string;
  value: number | string;
  accentColor: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.statCard, { borderTopColor: accentColor }]}
      onPress={onPress}
      activeOpacity={0.72}
      disabled={!onPress}
    >
      <Text style={[styles.statValue, { color: accentColor }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Feather name="chevron-right" size={11} color={accentColor} style={styles.statChevron} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  listContent: { paddingBottom: 80 },
  statsRow: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 14,
    gap: 10,
    backgroundColor: C.bg,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: C.white,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderTopWidth: 3,
    shadowColor: C.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  statValue: { fontSize: 26, fontWeight: '700', marginBottom: 4 },
  statLabel: { fontSize: 11, color: C.secondary, textAlign: 'center', lineHeight: 14 },
  statChevron: { marginTop: 6, opacity: 0.7 },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: C.secondary,
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: C.white,
    marginHorizontal: 14,
    marginVertical: 5,
    borderRadius: 10,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: C.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  priorityBar: { width: 4 },
  cardContent: { flex: 1, paddingHorizontal: 14, paddingVertical: 12 },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  rowReporter: { fontSize: 12, color: C.secondary, fontWeight: '500' },
  rowTime: { fontSize: 12, color: C.secondary },
  rowTitle: { fontSize: 15, fontWeight: '600', color: C.primary, marginBottom: 7 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  priorityText: { fontSize: 12, fontWeight: '600' },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 15, color: C.secondary },
});
