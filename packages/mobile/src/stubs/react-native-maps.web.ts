// Web stub for react-native-maps — the real module is native-only.
// map.web.tsx is rendered on web instead; this stub just satisfies Metro's
// module graph traversal of map.tsx.
import { View } from 'react-native';

const MapView = View;
const Marker = View;
const Callout = View;

export interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export default MapView;
export { Marker, Callout };
