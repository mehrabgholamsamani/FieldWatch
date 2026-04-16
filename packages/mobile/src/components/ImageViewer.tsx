import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SW, height: SH } = Dimensions.get('window');

interface Props {
  images: string[];
  initialIndex?: number;
  visible: boolean;
  onClose: () => void;
}

export function ImageViewer({ images, initialIndex = 0, visible, onClose }: Props) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const insets = useSafeAreaInsets();
  const isSingle = images.length === 1;

  // Stable refs for stale-closure-safe access inside panResponder
  const activeIndexRef = useRef(activeIndex);
  const imagesRef = useRef(images);
  const navigateRef = useRef<((to: number) => void) | null>(null);
  activeIndexRef.current = activeIndex;
  imagesRef.current = images;

  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentScale = useRef(new Animated.Value(0.9)).current;
  const slideX = useRef(new Animated.Value(0)).current;

  // Keep navigateRef pointing to the latest navigate fn every render
  function navigate(to: number) {
    const imgs = imagesRef.current;
    if (to < 0 || to >= imgs.length) return;
    const dir = to > activeIndexRef.current ? -1 : 1;

    Animated.timing(slideX, {
      toValue: dir * SW,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      slideX.setValue(-dir * SW);
      setActiveIndex(to);
      activeIndexRef.current = to;
      Animated.spring(slideX, {
        toValue: 0,
        useNativeDriver: true,
        damping: 26,
        stiffness: 340,
      }).start();
    });
  }
  navigateRef.current = navigate;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.4,
      onPanResponderRelease: (_, g) => {
        const idx = activeIndexRef.current;
        const len = imagesRef.current.length;
        if (g.dx < -55 && idx < len - 1) navigateRef.current?.(idx + 1);
        else if (g.dx > 55 && idx > 0) navigateRef.current?.(idx - 1);
      },
    }),
  ).current;

  useEffect(() => {
    if (visible) {
      setActiveIndex(initialIndex);
      activeIndexRef.current = initialIndex;
      slideX.setValue(0);

      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 230, useNativeDriver: true }),
        Animated.timing(contentOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(contentScale, {
          toValue: 1,
          useNativeDriver: true,
          damping: 22,
          stiffness: 280,
        }),
      ]).start();
    } else {
      backdropOpacity.setValue(0);
      contentOpacity.setValue(0);
      contentScale.setValue(0.9);
    }
  }, [visible, initialIndex]);

  function handleClose() {
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(contentOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.spring(contentScale, {
        toValue: 0.88,
        useNativeDriver: true,
        damping: 22,
        stiffness: 300,
      }),
    ]).start(() => onClose());
  }

  const isFirst = activeIndex === 0;
  const isLast = activeIndex === images.length - 1;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Animated.View
        style={[StyleSheet.absoluteFillObject, styles.backdrop, { opacity: backdropOpacity }]}
      />

      {/* Content */}
      <Animated.View
        style={[
          styles.container,
          { opacity: contentOpacity, transform: [{ scale: contentScale }] },
        ]}
        {...panResponder.panHandlers}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.counter}>
            {images.length > 1 ? `${activeIndex + 1} of ${images.length}` : ''}
          </Text>
          <TouchableOpacity
            onPress={handleClose}
            hitSlop={{ top: 14, right: 14, bottom: 14, left: 14 }}
          >
            <View style={styles.closeCircle}>
              <Feather name="x" size={16} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Image area */}
        <Animated.View
          style={[styles.imageWrapper, { transform: [{ translateX: slideX }] }]}
        >
          <Image
            source={{ uri: images[activeIndex] }}
            style={styles.image}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Footer: arrows + dots (hidden for single image) */}
        {!isSingle ? (
          <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
            <TouchableOpacity
              style={[styles.navBtn, isFirst && styles.navBtnDim]}
              onPress={() => navigate(activeIndex - 1)}
              disabled={isFirst}
            >
              <Feather name="chevron-left" size={24} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.dots}>
              {images.map((_, i) => (
                <TouchableOpacity key={i} onPress={() => navigate(i)} hitSlop={{ top: 8, right: 4, bottom: 8, left: 4 }}>
                  <View style={[styles.dot, i === activeIndex && styles.dotActive]} />
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.navBtn, isLast && styles.navBtnDim]}
              onPress={() => navigate(activeIndex + 1)}
              disabled={isLast}
            >
              <Feather name="chevron-right" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ paddingBottom: insets.bottom + 16 }} />
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: '#000000',
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  counter: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.2,
  },
  closeCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SW,
    height: SH * 0.62,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  navBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnDim: {
    opacity: 0.2,
  },
  dots: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotActive: {
    width: 20,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
});
