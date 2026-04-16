import { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';
import { C } from '../utils/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;

export function LoadingBar({ visible }: { visible: boolean }) {
  const translateX = useRef(new Animated.Value(-SCREEN_WIDTH)).current;
  const anim = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (visible) {
      translateX.setValue(-SCREEN_WIDTH);
      anim.current = Animated.loop(
        Animated.timing(translateX, {
          toValue: SCREEN_WIDTH,
          duration: 900,
          useNativeDriver: true,
        })
      );
      anim.current.start();
    } else {
      anim.current?.stop();
      translateX.setValue(-SCREEN_WIDTH);
    }
    return () => {
      anim.current?.stop();
    };
  }, [visible, translateX]);

  if (!visible) return null;

  return (
    <View style={styles.track}>
      <Animated.View style={[styles.bar, { transform: [{ translateX }] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 3,
    backgroundColor: C.border,
    overflow: 'hidden',
    width: '100%',
  },
  bar: {
    height: 3,
    width: '40%',
    backgroundColor: C.primary,
  },
});
