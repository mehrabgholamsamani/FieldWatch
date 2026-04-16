import { StyleSheet, Text, View } from 'react-native';
import type { ReportStatus } from '../types';

interface Props {
  status: ReportStatus;
}

const STATUS_CONFIG: Record<ReportStatus, { bg: string; color: string; dot: string; label: string }> = {
  DRAFT:     { bg: '#F4F4F5', color: '#71717A', dot: '#A1A1AA', label: 'Draft' },
  PENDING:   { bg: '#FFFBEB', color: '#D97706', dot: '#D97706', label: 'Pending' },
  SUBMITTED: { bg: '#EFF6FF', color: '#2563EB', dot: '#2563EB', label: 'Submitted' },
  IN_REVIEW: { bg: '#F5F3FF', color: '#7C3AED', dot: '#7C3AED', label: 'In Review' },
  RESOLVED:  { bg: '#F0FDF4', color: '#16A34A', dot: '#16A34A', label: 'Resolved' },
  REJECTED:  { bg: '#FEF2F2', color: '#DC2626', dot: '#DC2626', label: 'Rejected' },
};

export function StatusBadge({ status }: Props) {
  const { bg, color, dot, label } = STATUS_CONFIG[status];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});
