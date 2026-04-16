import { useEffect, useRef } from 'react';
import { Animated, LayoutAnimation, Platform, StyleSheet, Text, TouchableOpacity, UIManager, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useToastStore, type ToastItem, type ToastType } from '../stores/toastStore';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const TYPE_CONFIG: Record<
  ToastType,
  { icon: React.ComponentProps<typeof Feather>['name']; color: string; bg: string }
> = {
  success: { icon: 'check-circle', color: '#16A34A', bg: '#F0FDF4' },
  error:   { icon: 'alert-circle', color: '#DC2626', bg: '#FEF2F2' },
  info:    { icon: 'info',         color: '#2563EB', bg: '#EFF6FF' },
  warning: { icon: 'alert-triangle', color: '#D97706', bg: '#FFFBEB' },
};

function ToastItemView({ toast }: { toast: ToastItem }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const translateY = useRef(new Animated.Value(-72)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  const cfg = TYPE_CONFIG[toast.type];

  useEffect(() => {
    // Animate in
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 220,
        friction: 22,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 220,
        friction: 22,
      }),
    ]).start();

    const timer = setTimeout(handleDismiss, toast.duration);
    return () => clearTimeout(timer);
  }, []);

  function handleDismiss() {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -72,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.92,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      LayoutAnimation.configureNext({
        duration: 220,
        update: { type: 'spring', springDamping: 0.8 },
        delete: { type: 'easeOut', property: 'opacity', duration: 150 },
      });
      dismiss(toast.id);
    });
  }

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
    >
      {/* Icon */}
      <View style={[styles.iconWrap, { backgroundColor: cfg.bg }]}>
        <Feather name={cfg.icon} size={16} color={cfg.color} />
      </View>

      {/* Text */}
      <View style={styles.textWrap}>
        <Text style={styles.toastTitle} numberOfLines={1}>
          {toast.title}
        </Text>
        {toast.subtitle ? (
          <Text style={styles.toastSubtitle} numberOfLines={2}>
            {toast.subtitle}
          </Text>
        ) : null}
      </View>

      {/* Dismiss */}
      <TouchableOpacity
        onPress={handleDismiss}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={styles.dismissBtn}
      >
        <Feather name="x" size={14} color="#A1A1AA" />
      </TouchableOpacity>
    </Animated.View>
  );
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <View style={styles.container} pointerEvents="box-none">
      {toasts.map((toast) => (
        <ToastItemView key={toast.id} toast={toast} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 64,
    left: 12,
    right: 12,
    zIndex: 9999,
    gap: 8,
    alignItems: 'center',
    pointerEvents: 'box-none',
  } as any,

  toast: {
    width: '100%',
    maxWidth: 440,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  },

  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  textWrap: {
    flex: 1,
  },

  toastTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0A0A0A',
    letterSpacing: -0.1,
  },

  toastSubtitle: {
    fontSize: 12,
    color: '#71717A',
    marginTop: 2,
    lineHeight: 17,
  },

  dismissBtn: {
    padding: 2,
  },
});
