import { useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { C } from '../utils/theme';

interface Props {
  title?: string;
  subtitle?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Something went wrong',
  subtitle,
  onRetry,
}: Props) {
  const spin = useRef(new Animated.Value(0)).current;

  function handleRetry() {
    spin.setValue(0);
    Animated.timing(spin, {
      toValue: 1,
      duration: 550,
      useNativeDriver: true,
    }).start(() => onRetry?.());
  }

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      <View style={styles.iconBox}>
        <Feather name="alert-circle" size={22} color={C.statusRejected} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {onRetry ? (
        <TouchableOpacity style={styles.retryBtn} onPress={handleRetry} activeOpacity={0.8}>
          <Animated.View style={{ transform: [{ rotate }] }}>
            <Feather name="refresh-cw" size={13} color={C.primary} />
          </Animated.View>
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
    backgroundColor: C.bg,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.errorBg,
    borderWidth: 1,
    borderColor: C.errorBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: C.primary,
    marginBottom: 6,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 14,
    color: C.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 10,
    paddingHorizontal: 18,
    shadowColor: C.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.primary,
    letterSpacing: -0.1,
  },
});
