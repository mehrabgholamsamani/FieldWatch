import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Callout, Marker, Region } from 'react-native-maps';
import { router } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { fetchReports } from '../../services/reports';
import { StatusBadge } from '../../components/StatusBadge';
import { C } from '../../utils/theme';
import { ROLES } from '../../types';
import type { Priority, Report } from '../../types';

const PRIORITY_PIN_COLOR: Record<Priority, string> = {
  CRITICAL: C.priorityCritical,
  HIGH: C.priorityHigh,
  MEDIUM: C.priorityMedium,
  LOW: C.priorityLow,
};

// World-level fallback shown briefly before reports load and fitToCoordinates runs.
const FALLBACK_REGION: Region = {
  latitude: 20,
  longitude: 0,
  latitudeDelta: 120,
  longitudeDelta: 120,
};

export default function MapScreen() {
  const { user } = useAuthStore();
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [showActive, setShowActive] = useState(true);
  const mapRef = useRef<MapView>(null);

  const MAP_REPORT_LIMIT = 200;

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(false);
    try {
      const result = await fetchReports(undefined, MAP_REPORT_LIMIT, { sortBy: 'newest' });
      const withCoords = result.items.filter(
        (r) => r.latitude !== null && r.longitude !== null,
      );
      // When "Active only" is on, exclude resolved and rejected reports.
      setReports(
        showActive
          ? withCoords.filter((r) => r.status !== 'RESOLVED' && r.status !== 'REJECTED')
          : withCoords,
      );
    } catch {
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, [showActive]);

  useEffect(() => {
    load();
  }, [load]);

  // After reports load, fit the map viewport to the markers instead of
  // relying on a hardcoded default region.
  useEffect(() => {
    if (reports.length === 0) return;
    const coords = reports
      .filter((r): r is typeof r & { latitude: number; longitude: number } =>
        r.latitude !== null && r.longitude !== null,
      )
      .map((r) => ({ latitude: r.latitude, longitude: r.longitude }));
    if (coords.length === 0) return;
    mapRef.current?.fitToCoordinates(coords, {
      edgePadding: { top: 60, right: 40, bottom: 80, left: 40 },
      animated: false,
    });
  }, [reports]);

  if (user && user.role === ROLES.REPORTER) {
    router.replace('/(tabs)/reports');
    return null;
  }

  const reportsWithCoords = reports.filter(
    (r): r is typeof r & { latitude: number; longitude: number } =>
      r.latitude !== null && r.longitude !== null,
  );

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={FALLBACK_REGION}
        showsUserLocation
        showsMyLocationButton
      >
        {reportsWithCoords.map((report) => (
          <Marker
            key={report.id}
            coordinate={{ latitude: report.latitude, longitude: report.longitude }}
            pinColor={PRIORITY_PIN_COLOR[report.priority]}
          >
            <Callout onPress={() => router.push(`/report/${report.id}`)}>
              <View style={styles.callout}>
                <Text style={styles.calloutTitle} numberOfLines={2}>
                  {report.title}
                </Text>
                <View style={styles.calloutMeta}>
                  <StatusBadge status={report.status} />
                </View>
                <Text style={styles.calloutTap}>Tap to view →</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {/* Legend */}
      <View style={styles.legend}>
        {(Object.entries(PRIORITY_PIN_COLOR) as [Priority, string][]).map(([p, color]) => (
          <View key={p} style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: color }]} />
            <Text style={styles.legendText}>{p[0] + p.slice(1).toLowerCase()}</Text>
          </View>
        ))}
      </View>

      {loadError ? (
        <View style={styles.emptyOverlay}>
          <Text style={[styles.emptyText, styles.errorText]}>Failed to load reports</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryBtnText}>Tap to retry</Text>
          </TouchableOpacity>
        </View>
      ) : reportsWithCoords.length === 0 && !isLoading ? (
        <View style={styles.emptyOverlay}>
          <Text style={styles.emptyText}>No reports to display</Text>
        </View>
      ) : null}

      {/* Active / All toggle */}
      <TouchableOpacity
        style={[styles.filterToggle, showActive && styles.filterToggleActive]}
        onPress={() => setShowActive((v) => !v)}
      >
        <Text style={[styles.filterToggleText, showActive && styles.filterToggleTextActive]}>
          {showActive ? 'Active' : 'All'}
        </Text>
      </TouchableOpacity>

      {/* Reload button */}
      <TouchableOpacity style={styles.reloadBtn} onPress={load}>
        <Text style={styles.reloadText}>↺</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  callout: { width: 200, padding: 8 },
  calloutTitle: { fontSize: 13, fontWeight: '600', color: C.primary, marginBottom: 6 },
  calloutMeta: { marginBottom: 4 },
  calloutTap: { fontSize: 11, color: C.secondary },
  legend: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: C.white,
    padding: 10,
    gap: 6,
    elevation: 4,
    shadowColor: C.black,
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { fontSize: 11, color: C.primary },
  emptyOverlay: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    backgroundColor: C.white,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    color: C.secondary,
    elevation: 2,
  },
  errorText: { color: C.accent },
  retryBtn: {
    backgroundColor: C.white,
    paddingHorizontal: 16,
    paddingVertical: 8,
    elevation: 2,
  },
  retryBtnText: { fontSize: 13, color: C.primary, fontWeight: '600' },
  filterToggle: {
    position: 'absolute',
    bottom: 88,
    right: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: C.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    elevation: 4,
    shadowColor: C.black,
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  filterToggleActive: { backgroundColor: C.primary, borderColor: C.primary },
  filterToggleText: { fontSize: 12, fontWeight: '600', color: C.primary },
  filterToggleTextActive: { color: C.white },
  reloadBtn: {
    position: 'absolute',
    bottom: 32,
    right: 16,
    width: 44,
    height: 44,
    backgroundColor: C.white,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: C.black,
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  reloadText: { fontSize: 20, color: C.primary },
});
