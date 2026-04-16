import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { StatusBadge } from './StatusBadge';
import { C } from '../utils/theme';
import type { Report } from '../types';

interface Props {
  report: Report;
}

const PRIORITY_CONFIG: Record<Report['priority'], { label: string; color: string; bg: string }> = {
  LOW:      { label: 'Low',      color: C.priorityLow,      bg: C.priorityLowBg },
  MEDIUM:   { label: 'Medium',   color: C.priorityMedium,   bg: C.priorityMediumBg },
  HIGH:     { label: 'High',     color: C.priorityHigh,     bg: C.priorityHighBg },
  CRITICAL: { label: 'Critical', color: C.priorityCritical, bg: C.priorityCriticalBg },
};

export function ReportCard({ report }: Props) {
  const priority = PRIORITY_CONFIG[report.priority];

  const date = new Date(report.createdAt).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  });

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/report/${report.id}`)}
      activeOpacity={0.7}
    >
      {/* Top row: title + date */}
      <View style={styles.topRow}>
        <Text style={styles.title} numberOfLines={1}>
          {report.title}
        </Text>
        <Text style={styles.date}>{date}</Text>
      </View>

      {/* Description preview */}
      {report.description ? (
        <Text style={styles.description} numberOfLines={2}>
          {report.description}
        </Text>
      ) : null}

      {/* Meta row: status + priority */}
      <View style={[styles.metaRow, !report.address && styles.metaRowBottom]}>
        <StatusBadge status={report.status} />
        <View style={[styles.priorityBadge, { backgroundColor: priority.bg }]}>
          <View style={[styles.priorityDot, { backgroundColor: priority.color }]} />
          <Text style={[styles.priorityLabel, { color: priority.color }]}>
            {priority.label}
          </Text>
        </View>
      </View>

      {/* Address */}
      {report.address ? (
        <View style={styles.addressRow}>
          <Feather name="map-pin" size={11} color={C.placeholder} style={styles.pinIcon} />
          <Text style={styles.address} numberOfLines={1}>
            {report.address}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.white,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    shadowColor: C.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },

  // Top row
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: C.primary,
    letterSpacing: -0.2,
    marginRight: 12,
  },
  date: {
    fontSize: 12,
    color: C.placeholder,
    fontWeight: '400',
    marginTop: 1,
  },

  // Description
  description: {
    fontSize: 13,
    color: C.textMuted,
    lineHeight: 18,
    marginBottom: 12,
  },

  // Meta
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaRowBottom: {
    marginBottom: 4,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  priorityDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  priorityLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.1,
  },

  // Address
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: C.bg,
  },
  pinIcon: {
    marginRight: 5,
  },
  address: {
    flex: 1,
    fontSize: 12,
    color: C.placeholder,
  },
});
