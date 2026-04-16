import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { fetchReports } from '../../services/reports';
import { StatusBadge } from '../../components/StatusBadge';
import { SkeletonCard } from '../../components/SkeletonCard';
import { LoadingBar } from '../../components/LoadingBar';
import { ErrorState } from '../../components/ErrorState';
import { C } from '../../utils/theme';
import { ROLES } from '../../types';
import type { Priority, Report, ReportFilters, ReportStatus } from '../../types';

const VALID_STATUSES = new Set<string>([
  'DRAFT', 'PENDING', 'SUBMITTED', 'IN_REVIEW', 'RESOLVED', 'REJECTED',
]);

function toReportStatus(value: string | undefined): ReportStatus | undefined {
  if (!value || !VALID_STATUSES.has(value)) return undefined;
  return value as ReportStatus;
}

const PRIORITY_COLOR: Record<Priority, string> = {
  LOW: C.priorityLow,
  MEDIUM: C.priorityMedium,
  HIGH: C.priorityHigh,
  CRITICAL: C.priorityCritical,
};

const STATUS_TABS: Array<{ label: string; value: ReportStatus | undefined }> = [
  { label: 'All', value: undefined },
  { label: 'Submitted', value: 'SUBMITTED' },
  { label: 'In Review', value: 'IN_REVIEW' },
  { label: 'Resolved', value: 'RESOLVED' },
  { label: 'Rejected', value: 'REJECTED' },
];

const PRIORITY_OPTIONS: Array<{ label: string; value: Priority | undefined }> = [
  { label: 'All', value: undefined },
  { label: 'Critical', value: 'CRITICAL' },
  { label: 'High', value: 'HIGH' },
  { label: 'Medium', value: 'MEDIUM' },
  { label: 'Low', value: 'LOW' },
];

const SORT_OPTIONS: Array<{ label: string; value: ReportFilters['sortBy'] }> = [
  { label: 'Newest', value: 'newest' },
  { label: 'Oldest', value: 'oldest' },
  { label: 'Priority', value: 'priority' },
];

const PRIORITY_LABEL: Record<Priority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

function timeAgo(isoString: string): string {
  const diff = (Date.now() - new Date(isoString).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function AllReportsScreen() {
  const { user } = useAuthStore();
  const { initialStatus } = useLocalSearchParams<{ initialStatus?: string }>();

  const [reports, setReports] = useState<Report[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeStatus, setActiveStatus] = useState<ReportStatus | undefined>(
    toReportStatus(initialStatus),
  );

  // Sync filter when navigated here from dashboard stat cards
  useEffect(() => {
    setActiveStatus(toReportStatus(initialStatus));
  }, [initialStatus]);
  const [activePriorityIndex, setActivePriorityIndex] = useState(0);
  const [activeSortIndex, setActiveSortIndex] = useState(0);

  const activePriority = PRIORITY_OPTIONS[activePriorityIndex].value;
  const activeSort = SORT_OPTIONS[activeSortIndex].value;

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setLoadMoreError(false);
    try {
      const result = await fetchReports(undefined, 20, {
        status: activeStatus,
        priority: activePriority,
        sortBy: activeSort,
      });
      setReports(result.items);
      setTotal(result.total);
      setNextCursor(result.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setIsLoading(false);
    }
  }, [activeStatus, activePriority, activeSort]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const result = await fetchReports(nextCursor, 20, {
        status: activeStatus,
        priority: activePriority,
        sortBy: activeSort,
      });
      setReports((prev) => [...prev, ...result.items]);
      setNextCursor(result.nextCursor);
    } catch {
      setLoadMoreError(true);
    } finally {
      setIsLoadingMore(false);
    }
  }, [nextCursor, isLoadingMore, activeStatus, activePriority, activeSort]);

  if (user && user.role === ROLES.REPORTER) {
    router.replace('/(tabs)/reports');
    return null;
  }

  const cyclePriority = () => setActivePriorityIndex((i) => (i + 1) % PRIORITY_OPTIONS.length);
  const cycleSort = () => setActiveSortIndex((i) => (i + 1) % SORT_OPTIONS.length);

  const showSkeletons = isLoading && reports.length === 0;

  return (
    <View style={styles.container}>
      {/* Status filter tabs — always visible */}
      <View style={styles.statusTabsWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusTabs}>
          {STATUS_TABS.map((tab) => (
            <TouchableOpacity
              key={tab.label}
              style={[styles.statusTab, activeStatus === tab.value && styles.statusTabActive]}
              onPress={() => setActiveStatus(tab.value)}
            >
              <Text style={[styles.statusTabText, activeStatus === tab.value && styles.statusTabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Priority + Sort controls */}
      <View style={styles.filterRow}>
        <TouchableOpacity style={styles.filterPill} onPress={cyclePriority}>
          <Text style={styles.filterPillText}>
            Priority: {PRIORITY_OPTIONS[activePriorityIndex].label} ▾
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterPill} onPress={cycleSort}>
          <Text style={styles.filterPillText}>
            Sort: {SORT_OPTIONS[activeSortIndex].label} ▾
          </Text>
        </TouchableOpacity>
        <Text style={styles.totalText}>{total} report{total !== 1 ? 's' : ''}</Text>
      </View>

      {error && reports.length === 0 && !isLoading ? (
        <ErrorState
          title="Failed to load reports"
          subtitle={error}
          onRetry={load}
        />
      ) : null}

      {showSkeletons ? (
        <View style={styles.skeletonList}>
          {[...Array(6)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </View>
      ) : null}

      <FlatList
        style={showSkeletons ? styles.hidden : undefined}
        data={reports}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isLoading && reports.length > 0} onRefresh={load} tintColor={C.primary} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/report/${item.id}`)}
            activeOpacity={0.7}
          >
            <View style={[styles.priorityBar, { backgroundColor: PRIORITY_COLOR[item.priority] }]} />
            <View style={styles.cardContent}>
              <View style={styles.rowTop}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.rowTime}>{timeAgo(item.createdAt)}</Text>
              </View>
              <Text style={styles.rowReporter} numberOfLines={1}>
                {item.reporterName ?? 'Unknown reporter'}
              </Text>
              <View style={styles.rowMeta}>
                <StatusBadge status={item.status} />
                <Text style={[styles.priorityText, { color: PRIORITY_COLOR[item.priority] }]}>
                  {PRIORITY_LABEL[item.priority]}
                </Text>
                {item.assigneeName ? (
                  <Text style={styles.assigneeText}>→ {item.assigneeName}</Text>
                ) : null}
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListFooterComponent={
          loadMoreError ? (
            <TouchableOpacity
              style={styles.loadMoreError}
              onPress={() => { setLoadMoreError(false); loadMore(); }}
            >
              <Text style={styles.loadMoreErrorText}>Failed to load more — tap to retry</Text>
            </TouchableOpacity>
          ) : isLoadingMore ? (
            <LoadingBar visible={true} />
          ) : null
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No reports match the current filters.</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  statusTabsWrapper: {
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  statusTabs: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  statusTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 20,
  },
  statusTabActive: { borderColor: C.primary, backgroundColor: C.primary },
  statusTabText: { fontSize: 13, color: C.secondary, fontWeight: '500' },
  statusTabTextActive: { color: C.white },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 20,
  },
  filterPillText: { fontSize: 12, color: C.primary, fontWeight: '500' },
  totalText: { marginLeft: 'auto', fontSize: 12, color: C.secondary },
  listContent: { paddingTop: 8, paddingBottom: 80 },
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
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  rowTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: C.primary, marginRight: 8 },
  rowTime: { fontSize: 12, color: C.secondary },
  rowReporter: { fontSize: 12, color: C.secondary, marginBottom: 7 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  priorityText: { fontSize: 12, fontWeight: '600' },
  assigneeText: { fontSize: 12, color: C.secondary },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, color: C.secondary, textAlign: 'center' },
  loadMoreError: { padding: 16, alignItems: 'center' },
  loadMoreErrorText: { fontSize: 13, color: C.accent, fontWeight: '500' },
  skeletonList: { paddingTop: 8 },
  hidden: { display: 'none' },
});
