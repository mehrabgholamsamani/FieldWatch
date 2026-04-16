import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

// Single shared pulse value so all skeletons breathe in sync
let _pulse: Animated.Value | null = null;

function getSharedPulse(): Animated.Value {
  if (!_pulse) {
    _pulse = new Animated.Value(1);
    Animated.loop(
      Animated.sequence([
        Animated.timing(_pulse, {
          toValue: 0.38,
          duration: 850,
          useNativeDriver: true,
        }),
        Animated.timing(_pulse, {
          toValue: 1,
          duration: 950,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }
  return _pulse;
}

function Bone({
  w,
  h,
  radius,
  mt,
  ml,
}: {
  w: number | string;
  h: number;
  radius?: number;
  mt?: number;
  ml?: number;
}) {
  const pulse = getSharedPulse();
  return (
    <View
      style={{
        width: w as number,
        height: h,
        borderRadius: radius ?? h / 2,
        marginTop: mt,
        marginLeft: ml,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={{
          ...StyleSheet.absoluteFillObject,
          backgroundColor: '#E4E4E7',
          opacity: pulse,
        }}
      />
    </View>
  );
}

export function SkeletonCard() {
  return (
    <View style={styles.card}>
      {/* Title + date row */}
      <View style={styles.row}>
        <Bone w="58%" h={14} />
        <Bone w={38} h={11} />
      </View>

      {/* Description lines */}
      <Bone w="82%" h={12} mt={12} />
      <Bone w="60%" h={12} mt={6} />

      {/* Badge row */}
      <View style={[styles.row, { marginTop: 16 }]}>
        <Bone w={72} h={24} radius={12} />
        <Bone w={58} h={24} radius={12} ml={8} />
      </View>
    </View>
  );
}

export function SkeletonStatCard() {
  return (
    <View style={styles.statCard}>
      <Bone w={44} h={28} radius={6} />
      <Bone w={56} h={10} mt={8} />
    </View>
  );
}

export function SkeletonDashboardCard() {
  return (
    <View style={styles.dashCard}>
      {/* Reporter + time */}
      <View style={styles.row}>
        <Bone w={90} h={11} />
        <Bone w={36} h={11} />
      </View>
      {/* Title */}
      <Bone w="70%" h={14} mt={8} />
      {/* Badges */}
      <View style={[styles.row, { marginTop: 10 }]}>
        <Bone w={72} h={22} radius={11} />
        <Bone w={44} h={22} radius={11} ml={8} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  dashCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 14,
    marginVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 18,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
