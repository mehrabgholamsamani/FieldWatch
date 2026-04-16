import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { C } from '../utils/theme';

const GEOCODE_TIMEOUT_MS = 45_000;

interface Props {
  address: string | null;
  latitude?: number;
  longitude?: number;
}

export function LocationTag({ address, latitude, longitude }: Props) {
  const hasCoords = latitude !== undefined && longitude !== undefined;
  const [timedOut, setTimedOut] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!hasCoords || address) {
      setTimedOut(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }
    timerRef.current = setTimeout(() => setTimedOut(true), GEOCODE_TIMEOUT_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [hasCoords, address]);

  if (!hasCoords) return null;

  const coordString =
    latitude !== undefined && longitude !== undefined
      ? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
      : '';

  return (
    <View style={styles.row}>
      <Feather name="map-pin" size={13} color={C.secondary} style={styles.icon} />
      {address ? (
        <Text style={styles.address} numberOfLines={2}>
          {address}
        </Text>
      ) : timedOut ? (
        <Text style={styles.address}>{coordString}</Text>
      ) : (
        <Text style={styles.pending}>Resolving address…</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    marginBottom: 20,
  },
  icon: { marginTop: 1 },
  address: { flex: 1, fontSize: 13, color: C.secondary },
  pending: { fontSize: 13, color: C.secondary, fontStyle: 'italic' },
});
