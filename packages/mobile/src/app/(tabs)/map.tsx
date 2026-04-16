import { StyleSheet, Text, View } from 'react-native';
import { C } from '../../utils/theme';

export default function MapScreenWeb() {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🗺</Text>
      <Text style={styles.title}>Map view</Text>
      <Text style={styles.subtitle}>
        The interactive map is available in the mobile app.{'\n'}
        Open this app in Expo Go on your phone to see report pins on the map.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.bg,
    padding: 32,
  },
  icon: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700', color: C.primary, marginBottom: 8 },
  subtitle: {
    fontSize: 14,
    color: C.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
