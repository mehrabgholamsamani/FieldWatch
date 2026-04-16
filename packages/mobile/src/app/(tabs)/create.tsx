import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { suggestPriority, enhanceDescription } from '../../services/ai';
import type { AISuggestPriorityResponse } from '../../types';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCamera, type PickedImage } from '../../hooks/useCamera';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useAutoLocation } from '../../hooks/useLocation';
import { uploadImage } from '../../services/images';
import { enqueueReport } from '../../services/syncEngine';
import { useReportStore } from '../../stores/reportStore';
import { useSyncStore } from '../../stores/syncStore';
import { useAuthStore } from '../../stores/authStore';
import { LoadingBar } from '../../components/LoadingBar';
import { showToast } from '../../stores/toastStore';
import { C } from '../../utils/theme';
import { ROLES } from '../../types';
import type { Priority } from '../../types';

const PRIORITIES: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const PRIORITY_LABEL: Record<Priority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

const PRIORITY_COLOR: Record<Priority, string> = {
  LOW: C.priorityLow,
  MEDIUM: C.priorityMedium,
  HIGH: C.priorityHigh,
  CRITICAL: C.priorityCritical,
};

const PRIORITY_BG: Record<Priority, string> = {
  LOW: C.priorityLowBg,
  MEDIUM: C.priorityMediumBg,
  HIGH: C.priorityHighBg,
  CRITICAL: C.priorityCriticalBg,
};

export default function CreateReportScreen() {
  const { user } = useAuthStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [images, setImages] = useState<PickedImage[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [descError, setDescError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestPriorityResponse | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);

  const { createReport } = useReportStore();
  const { addToQueue } = useSyncStore();
  const { pickImage, takePhoto } = useCamera();
  const { coords, isLocating, requestLocation } = useAutoLocation();
  const { isOnline } = useNetworkStatus();

  if (user && user.role !== ROLES.REPORTER) {
    router.replace('/(tabs)/dashboard');
    return null;
  }

  const handleAddImage = () => {
    Alert.alert('Add Photo', 'Choose source', [
      {
        text: 'Camera',
        onPress: async () => {
          const img = await takePhoto();
          if (img) setImages((prev) => [...prev, img]);
        },
      },
      {
        text: 'Library',
        onPress: async () => {
          const img = await pickImage();
          if (img) setImages((prev) => [...prev, img]);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSubmit = async () => {
    let valid = true;
    if (!title.trim()) {
      setTitleError('Required.');
      valid = false;
    } else {
      setTitleError(null);
    }
    if (!description.trim()) {
      setDescError('Required.');
      valid = false;
    } else {
      setDescError(null);
    }
    if (!valid) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        priority,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        idempotency_key: crypto.randomUUID(),
      };
      const imageList = images.map((img) => ({
        uri: img.uri,
        name: img.name,
        type: img.type,
      }));

      if (isOnline) {
        const report = await createReport(payload);
        let imagesFailed = 0;
        for (const img of imageList) {
          try {
            await uploadImage(report.id, img.uri, img.name, img.type);
          } catch {
            imagesFailed++;
          }
        }
        if (imagesFailed > 0) {
          showToast({
            type: 'error',
            title: `${imagesFailed} photo${imagesFailed > 1 ? 's' : ''} failed to upload`,
            subtitle: 'Open the report to review',
          });
          setTitle('');
          setDescription('');
          setPriority('MEDIUM');
          setImages([]);
          router.replace(`/report/${report.id}`);
          return;
        }
        showToast({
          type: 'success',
          title: 'Report submitted',
          subtitle: imageList.length > 0 ? 'Report and photos sent successfully' : 'Your report has been sent',
        });
      } else {
        const queued = await enqueueReport(payload, imageList);
        addToQueue(queued);
        showToast({
          type: 'info',
          title: 'Saved offline',
          subtitle: 'Will sync automatically when you reconnect',
        });
      }

      setTitle('');
      setDescription('');
      setPriority('MEDIUM');
      setImages([]);
      router.replace('/(tabs)/reports');
    } catch {
      setSubmitError('Failed to submit. Please try again.');
      showToast({
        type: 'error',
        title: 'Submission failed',
        subtitle: 'Check your connection and try again',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LoadingBar visible={isSubmitting} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.label}>TITLE</Text>
        <TextInput
          style={[styles.input, titleError ? styles.inputError : null]}
          placeholder="Brief title for the issue"
          placeholderTextColor={C.secondary}
          value={title}
          onChangeText={(t) => {
            setTitle(t);
            if (t.trim()) setTitleError(null);
          }}
          maxLength={200}
        />
        {titleError ? <Text style={styles.fieldError}>{titleError}</Text> : null}

        <View style={styles.labelRow}>
          <Text style={styles.label}>DESCRIPTION</Text>
          <TouchableOpacity
            style={[styles.aiBtn, (description.trim().length < 30 || isEnhancing) && styles.aiBtnDisabled]}
            onPress={async () => {
              if (description.trim().length < 30 || isEnhancing) return;
              setIsEnhancing(true);
              try {
                const enhanced = await enhanceDescription(title, description);
                Alert.alert(
                  'Enhanced description ready',
                  enhanced,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Replace', onPress: () => setDescription(enhanced) },
                  ]
                );
              } catch {
                Alert.alert('AI unavailable', 'Could not enhance description right now.');
              } finally {
                setIsEnhancing(false);
              }
            }}
            disabled={description.trim().length < 30 || isEnhancing}
          >
            {isEnhancing ? (
              <ActivityIndicator size="small" color={C.primary} />
            ) : (
              <Text style={styles.aiBtnText}>✦ Enhance</Text>
            )}
          </TouchableOpacity>
        </View>
        <TextInput
          style={[styles.input, styles.textArea, descError ? styles.inputError : null]}
          placeholder="Describe the issue in detail"
          placeholderTextColor={C.secondary}
          value={description}
          onChangeText={(t) => {
            setDescription(t);
            if (t.trim()) setDescError(null);
          }}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
          maxLength={2000}
        />
        {descError ? <Text style={styles.fieldError}>{descError}</Text> : null}

        <Text style={styles.label}>LOCATION</Text>
        <View style={styles.locationRow}>
          {isLocating ? (
            <View style={styles.locationDetecting}>
              <ActivityIndicator size="small" color={C.secondary} />
              <Text style={styles.locationMuted}>Detecting GPS…</Text>
            </View>
          ) : coords ? (
            <Text style={styles.locationText}>
              {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
              {coords.accuracy ? `  ±${Math.round(coords.accuracy)}m` : ''}
            </Text>
          ) : (
            <View style={styles.locationUnavailable}>
              <Text style={styles.locationMuted}>GPS unavailable</Text>
              <View style={styles.locationActions}>
                <TouchableOpacity onPress={requestLocation} style={styles.locationRetryBtn}>
                  <Text style={styles.locationRetryText}>Retry</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => Linking.openSettings()} style={styles.locationRetryBtn}>
                  <Text style={styles.locationRetryText}>Open Settings</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <View style={styles.labelRow}>
          <Text style={styles.label}>PRIORITY</Text>
          <TouchableOpacity
            style={[styles.aiBtn, (title.trim().length < 10 || isAiLoading) && styles.aiBtnDisabled]}
            onPress={async () => {
              if (title.trim().length < 10 || isAiLoading) return;
              setIsAiLoading(true);
              setAiSuggestion(null);
              try {
                const result = await suggestPriority(title, description);
                setAiSuggestion(result);
              } catch {
                Alert.alert('AI unavailable', 'Could not suggest priority right now.');
              } finally {
                setIsAiLoading(false);
              }
            }}
            disabled={title.trim().length < 10 || isAiLoading}
          >
            {isAiLoading ? (
              <ActivityIndicator size="small" color={C.primary} />
            ) : (
              <Text style={styles.aiBtnText}>✦ Suggest</Text>
            )}
          </TouchableOpacity>
        </View>
        <View style={styles.priorityRow}>
          {PRIORITIES.map((p) => (
            <TouchableOpacity
              key={p}
              style={[
                styles.priorityBtn,
                priority === p && {
                  backgroundColor: PRIORITY_BG[p],
                  borderBottomColor: PRIORITY_COLOR[p],
                  borderBottomWidth: 2,
                },
              ]}
              onPress={() => {
                setPriority(p);
                setAiSuggestion(null);
              }}
            >
              <Text
                style={[
                  styles.priorityText,
                  { color: priority === p ? PRIORITY_COLOR[p] : C.secondary },
                  priority === p && { fontWeight: '700' },
                ]}
              >
                {PRIORITY_LABEL[p]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {aiSuggestion ? (
          <View style={styles.aiSuggestionBanner}>
            <View style={styles.aiSuggestionLeft}>
              <Text style={styles.aiSuggestionTitle}>
                ✦ AI suggests: <Text style={{ color: PRIORITY_COLOR[aiSuggestion.priority] }}>{PRIORITY_LABEL[aiSuggestion.priority]}</Text>
                {'  '}
                <Text style={styles.aiSuggestionConfidence}>({Math.round(aiSuggestion.confidence * 100)}% confident)</Text>
              </Text>
              <Text style={styles.aiSuggestionReasoning} numberOfLines={2}>{aiSuggestion.reasoning}</Text>
            </View>
            <View style={styles.aiSuggestionActions}>
              <TouchableOpacity
                style={styles.aiApplyBtn}
                onPress={() => {
                  setPriority(aiSuggestion.priority);
                  setAiSuggestion(null);
                }}
              >
                <Text style={styles.aiApplyText}>Apply</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setAiSuggestion(null)}>
                <Text style={styles.aiDismissText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <Text style={styles.label}>PHOTOS</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.photoRow}
          contentContainerStyle={styles.photoContent}
        >
          {images.map((img, idx) => (
            <View key={idx} style={styles.thumbWrap}>
              <Image source={{ uri: img.uri }} style={styles.thumb} />
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
              >
                <Feather name="x" size={11} color={C.white} />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={styles.addPhotoBtn} onPress={handleAddImage}>
            <Feather name="camera" size={18} color={C.secondary} />
            <Text style={styles.addPhotoText}>Add</Text>
          </TouchableOpacity>
        </ScrollView>

        {submitError ? <Text style={styles.fieldError}>{submitError}</Text> : null}

        <TouchableOpacity
          style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          <Text style={styles.submitText}>
            {isSubmitting ? 'Submitting…' : 'Submit Report'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flex: 1, backgroundColor: C.white },
  content: { paddingHorizontal: 20, paddingBottom: 48 },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: C.secondary,
    letterSpacing: 0.8,
    marginTop: 24,
    marginBottom: 8,
    flexShrink: 1,
  },
  input: {
    borderWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingVertical: 10,
    paddingHorizontal: 0,
    fontSize: 16,
    color: C.primary,
    backgroundColor: 'transparent',
  },
  inputError: { borderBottomColor: C.accent },
  textArea: { minHeight: 100 },
  fieldError: { fontSize: 13, color: C.accent, marginTop: 4 },
  locationRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  locationText: { fontSize: 14, color: C.primary },
  locationMuted: { fontSize: 14, color: C.secondary },
  locationDetecting: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  locationUnavailable: { gap: 8 },
  locationActions: { flexDirection: 'row', gap: 10 },
  locationRetryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.bg,
  },
  locationRetryText: { fontSize: 13, color: C.primary, fontWeight: '500' },
  priorityRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingBottom: 10,
    paddingTop: 4,
  },
  priorityBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 4,
    borderRadius: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  priorityText: { fontSize: 14 },
  photoRow: { marginTop: 4 },
  photoContent: { paddingVertical: 10, gap: 10 },
  thumbWrap: { position: 'relative' },
  thumb: { width: 80, height: 80, borderRadius: 4 },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoBtn: {
    width: 80,
    height: 80,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addPhotoText: { fontSize: 11, color: C.secondary },
  submitBtn: {
    marginTop: 36,
    height: 52,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitText: { color: C.white, fontSize: 15, fontWeight: '600', letterSpacing: 0.3 },
  // AI styles
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 8,
  },
  aiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.primary,
    minWidth: 28,
    minHeight: 24,
    justifyContent: 'center',
  },
  aiBtnDisabled: { borderColor: C.border, opacity: 0.5 },
  aiBtnText: { fontSize: 11, fontWeight: '600', color: C.primary, letterSpacing: 0.2 },
  aiSuggestionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bg,
    borderLeftWidth: 3,
    borderLeftColor: C.primary,
    padding: 12,
    marginTop: 8,
    gap: 10,
  },
  aiSuggestionLeft: { flex: 1 },
  aiSuggestionTitle: { fontSize: 13, color: C.primary, fontWeight: '600', marginBottom: 3 },
  aiSuggestionConfidence: { fontSize: 11, color: C.textMuted, fontWeight: '400' },
  aiSuggestionReasoning: { fontSize: 12, color: C.textMuted, lineHeight: 17 },
  aiSuggestionActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  aiApplyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: C.primary,
    borderRadius: 6,
  },
  aiApplyText: { fontSize: 12, color: C.white, fontWeight: '600' },
  aiDismissText: { fontSize: 14, color: C.secondary, paddingHorizontal: 4 },
});
