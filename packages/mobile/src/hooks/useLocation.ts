import { useEffect, useState } from 'react';
import * as Location from 'expo-location';

export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

export function useLocation() {
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestLocation = async (): Promise<Coordinates | null> => {
    setIsLocating(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission denied.');
        return null;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const result: Coordinates = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };
      setCoords(result);
      return result;
    } catch {
      setError('Unable to get location.');
      return null;
    } finally {
      setIsLocating(false);
    }
  };

  return { coords, isLocating, error, requestLocation };
}

export function useAutoLocation() {
  const { coords, isLocating, error, requestLocation } = useLocation();

  useEffect(() => {
    requestLocation();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { coords, isLocating, error, requestLocation };
}
