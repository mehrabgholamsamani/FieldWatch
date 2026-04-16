import { useCallback, useEffect } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { ReportCard } from '../../components/ReportCard';
import { SkeletonCard } from '../../components/SkeletonCard';
import { SyncIndicator } from '../../components/SyncIndicator';
import { ErrorState } from '../../components/ErrorState';
import { LoadingBar } from '../../components/LoadingBar';
import { useReportStore } from '../../stores/reportStore';
import { useAuthStore } from '../../stores/authStore';
import { C } from '../../utils/theme';
import { ROLES } from '../../types';
import type { Report } from '../../types';

export default function ReportsScreen() {
  const { user } = useAuthStore();
  if (user && user.role !== ROLES.REPORTER) {
    router.replace('/(tabs)/dashboard');
    return null;
  }

  const { reports, total, isLoading, isLoadingMore, loadMoreError, error, fetchReports, fetchMoreReports } =
    useReportStore();

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const onRefresh = useCallback(() => {
    fetchReports();
  }, [fetchReports]);

  const onEndReached = useCallback(() => {
    fetchMoreReports();
  }, [fetchMoreReports]);

  if (error && reports.length === 0) {
    return (
      <ErrorState
        title="Failed to load reports"
        subtitle={error}
        onRetry={fetchReports}
      />
    );
  }

  // Show skeletons on first load
  if (isLoading && reports.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.listHeader}>
          <View>
            <View style={styles.skeletonGreeting} />
            <View style={styles.skeletonCount} />
          </View>
        </View>
        {[...Array(5)].map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={reports}
        keyExtractor={(item: Report) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => <ReportCard report={item} />}
        refreshControl={
          <RefreshControl
            refreshing={isLoading && reports.length > 0}
            onRefresh={onRefresh}
            tintColor={C.primary}
          />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <View>
              <Text style={styles.greeting}>
                {user?.fullName ? `Hi, ${user.fullName.split(' ')[0]}` : 'My Reports'}
              </Text>
              <Text style={styles.count}>
                {total} {total === 1 ? 'report' : 'reports'} submitted
              </Text>
            </View>
            <SyncIndicator />
          </View>
        }
        ListFooterComponent={
          loadMoreError ? (
            <TouchableOpacity
              style={styles.loadMoreError}
              onPress={fetchMoreReports}
            >
              <Text style={styles.loadMoreErrorText}>Failed to load more — tap to retry</Text>
            </TouchableOpacity>
          ) : isLoadingMore ? (
            <LoadingBar visible={true} />
          ) : null
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Feather name="file-text" size={24} color={C.placeholder} />
              </View>
              <Text style={styles.emptyTitle}>No reports yet</Text>
              <Text style={styles.emptySubtitle}>
                Tap the New tab to submit your first field report.
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  listContent: {
    paddingBottom: 80,
  },

  // Header
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
    color: C.primary,
    letterSpacing: -0.4,
    marginBottom: 2,
  },
  count: {
    fontSize: 13,
    color: C.textMuted,
    fontWeight: '400',
  },

  skeletonGreeting: {
    width: 140,
    height: 22,
    borderRadius: 6,
    backgroundColor: C.border,
    marginBottom: 6,
  },
  skeletonCount: {
    width: 110,
    height: 13,
    borderRadius: 6,
    backgroundColor: C.border,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: C.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: C.primary,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: C.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  loadMoreError: { padding: 16, alignItems: 'center' },
  loadMoreErrorText: { fontSize: 13, color: C.accent, fontWeight: '500' },
});
