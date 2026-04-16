import * as ImagePicker from 'expo-image-picker';

export interface PickedImage {
  uri: string;
  type: string;
  name: string;
}

export function useCamera() {
  const pickImage = async (): Promise<PickedImage | null> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return null;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.9,
    });

    if (result.canceled || !result.assets[0]) return null;

    const asset = result.assets[0];
    const name = asset.fileName ?? `photo_${Date.now()}.jpg`;
    const type = asset.mimeType ?? 'image/jpeg';
    return { uri: asset.uri, type, name };
  };

  const takePhoto = async (): Promise<PickedImage | null> => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return null;

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.9,
    });

    if (result.canceled || !result.assets[0]) return null;

    const asset = result.assets[0];
    const name = asset.fileName ?? `photo_${Date.now()}.jpg`;
    const type = asset.mimeType ?? 'image/jpeg';
    return { uri: asset.uri, type, name };
  };

  return { pickImage, takePhoto };
}
