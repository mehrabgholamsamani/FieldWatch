import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { showToast } from '../../stores/toastStore';
import { router, useLocalSearchParams } from 'expo-router';
import { getSimilarReports, suggestNote } from '../../services/ai';
import type { SimilarReportItem } from '../../types';
import { IMAGE_PENDING_URL } from '../../utils/constants';
import { LocationTag } from '../../components/LocationTag';
import { StatusBadge } from '../../components/StatusBadge';
import { LoadingBar } from '../../components/LoadingBar';
import { ErrorState } from '../../components/ErrorState';
import { ImageViewer } from '../../components/ImageViewer';
import { useReportStore } from '../../stores/reportStore';
import { useAuthStore } from '../../stores/authStore';
import { fetchManagers } from '../../services/reports';
import { C } from '../../utils/theme';
import { ROLES } from '../../types';
import type { ReportStatus } from '../../types';

const POLL_INTERVAL_MS = 3000;
// Stop polling after 20 attempts (~60 s). Prevents infinite battery drain when
// Celery workers or S3 are down. The user can navigate away and back to retry.
const MAX_POLL_COUNT = 20;

const STATUS_TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  DRAFT: ['SUBMITTED'],
  PENDING: ['SUBMITTED'],
  SUBMITTED: ['IN_REVIEW', 'REJECTED'],
  IN_REVIEW: ['RESOLVED', 'REJECTED'],
  RESOLVED: [],
  REJECTED: [],
};

const STATUS_LABEL: Record<ReportStatus, string> = {
  DRAFT: 'Draft',
  PENDING: 'Pending',
  SUBMITTED: 'Submitted',
  IN_REVIEW: 'In Review',
  RESOLVED: 'Resolved',
  REJECTED: 'Rejected',
};

const PRIORITY_COLOR: Record<string, string> = {
  LOW: C.priorityLow,
  MEDIUM: C.priorityMedium,
  HIGH: C.priorityHigh,
  CRITICAL: C.priorityCritical,
};

export default function ReportDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentReport, isLoading, error, fetchReport, updateReport } = useReportStore();
  const { user } = useAuthStore();
  const [pollCount, setPollCount] = useState(0);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const isManager = user?.role === ROLES.MANAGER || user?.role === ROLES.ADMIN;

  // Manager action state
  const [noteText, setNoteText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  const [managers, setManagers] = useState<{ id: string; fullName: string }[]>([]);
  const [managersLoaded, setManagersLoaded] = useState(false);
  const [managersError, setManagersError] = useState(false);
  const [similarReports, setSimilarReports] = useState<SimilarReportItem[]>([]);
  const [isSuggestingNote, setIsSuggestingNote] = useState(false);

  useEffect(() => {
    if (id) fetchReport(id);
  }, [id, fetchReport]);

  // Load similar reports once we have the main report
  useEffect(() => {
    if (!id || !currentReport) return;
    getSimilarReports(id).then(setSimilarReports).catch(() => {});
  }, [id, currentReport?.id]);

  // Sync note text when report loads
  useEffect(() => {
    if (currentReport?.managerNote && noteText === '') {
      setNoteText(currentReport.managerNote);
    }
  }, [currentReport?.managerNote]);

  // Load managers list once for assignment picker
  useEffect(() => {
    if (isManager && !managersLoaded) {
      fetchManagers()
        .then((m) => {
          setManagers(m);
          setManagersLoaded(true);
          setManagersError(false);
        })
        .catch(() => {
          setManagersLoaded(true);
          setManagersError(true);
        });
    }
  }, [isManager, managersLoaded]);

  // Poll while images are processing or address geocoding is pending
  useEffect(() => {
    if (!currentReport) return;
    const hasPendingImages = currentReport.images.some(
      (img) => img.originalUrl === IMAGE_PENDING_URL || img.originalUrl === null
    );
    const hasPendingAddress =
      currentReport.address === null &&
      currentReport.latitude !== null &&
      currentReport.longitude !== null;

    if (!hasPendingImages && !hasPendingAddress) return;
    if (pollCount >= MAX_POLL_COUNT) return;

    const timer = setTimeout(() => {
      if (id) fetchReport(id);
      setPollCount((n) => n + 1);
    }, POLL_INTERVAL_MS);

    return () => clearTimeout(timer);
  }, [currentReport, id, fetchReport, pollCount]);

  const handleStatusChange = useCallback(
    async (newStatus: ReportStatus) => {
      if (!id) return;
      setShowStatusPicker(false);
      setIsSaving(true);
      try {
        await updateReport(id, { status: newStatus });
        showToast({
          type: 'success',
          title: 'Status updated',
          subtitle: `Changed to ${STATUS_LABEL[newStatus]}`,
        });
      } catch {
        showToast({ type: 'error', title: 'Failed to update status', subtitle: 'Please try again' });
      } finally {
        setIsSaving(false);
      }
    },
    [id, updateReport]
  );

  const handleAssign = useCallback(
    async (managerId: string) => {
      if (!id) return;
      setShowAssigneePicker(false);
      setIsSaving(true);
      try {
        await updateReport(id, { assignedToId: managerId });
        const name = managers.find((m) => m.id === managerId)?.fullName;
        showToast({
          type: 'success',
          title: 'Report assigned',
          subtitle: name ? `Assigned to ${name}` : undefined,
        });
      } catch {
        showToast({ type: 'error', title: 'Failed to assign report', subtitle: 'Please try again' });
      } finally {
        setIsSaving(false);
      }
    },
    [id, updateReport, managers]
  );

  const handleSaveNote = useCallback(async () => {
    if (!id) return;
    setIsSaving(true);
    try {
      await updateReport(id, { managerNote: noteText });
      showToast({ type: 'success', title: 'Note saved' });
    } catch {
      showToast({ type: 'error', title: 'Failed to save note', subtitle: 'Please try again' });
    } finally {
      setIsSaving(false);
    }
  }, [id, noteText, updateReport]);

  if (!currentReport && !isLoading) {
    return (
      <ErrorState
        title={error ? 'Failed to load report' : 'Report not found'}
        subtitle={error ?? undefined}
        onRetry={error && id ? () => fetchReport(id) : undefined}
      />
    );
  }

  if (!currentReport) {
    return (
      <View style={styles.flex}>
        <LoadingBar visible={true} />
      </View>
    );
  }

  const createdDate = new Date(currentReport.createdAt).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const nextStatuses = STATUS_TRANSITIONS[currentReport.status] ?? [];

  return (
    <>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <LoadingBar visible={(isLoading && !!currentReport) || isSaving} />

        <View
          style={[
            styles.priorityStrip,
            { backgroundColor: PRIORITY_COLOR[currentReport.priority] ?? C.secondary },
          ]}
        />

        <Text style={styles.title}>{currentReport.title}</Text>

        <View style={styles.metaRow}>
          <StatusBadge status={currentReport.status} />
          <Text
            style={[
              styles.priorityLabel,
              { color: PRIORITY_COLOR[currentReport.priority] ?? C.secondary },
            ]}
          >
            {currentReport.priority}
          </Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.metaText}>{createdDate}</Text>
        </View>

        <View style={styles.divider} />

        {/* Reporter & Assignment info */}
        <View style={styles.infoBlock}>
          <InfoRow label="Reporter" value={currentReport.reporterName ?? currentReport.reporterId} />
          {currentReport.assigneeName ? (
            <InfoRow label="Assigned to" value={currentReport.assigneeName} />
          ) : null}
        </View>

        <LocationTag
          address={currentReport.address}
          latitude={currentReport.latitude ?? undefined}
          longitude={currentReport.longitude ?? undefined}
        />

        <Text style={styles.sectionLabel}>DESCRIPTION</Text>
        <Text style={styles.description}>{currentReport.description}</Text>

        {similarReports.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>SIMILAR OPEN REPORTS ({similarReports.length})</Text>
            <View style={styles.similarList}>
              {similarReports.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={styles.similarRow}
                  onPress={() => router.push(`/report/${s.id}`)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.similarTitle} numberOfLines={1}>{s.title}</Text>
                  <Text style={styles.similarMeta}>
                    {s.priority} · {s.status.replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : null}

        {currentReport.managerNote ? (
          <>
            <Text style={styles.sectionLabel}>MANAGER NOTE</Text>
            <Text style={styles.managerNote}>{currentReport.managerNote}</Text>
          </>
        ) : null}

        {currentReport.images.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>PHOTOS ({currentReport.images.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
              {currentReport.images.map((img, idx) => {
                const isPending =
                  img.originalUrl === IMAGE_PENDING_URL || img.originalUrl === null;
                return (
                  <View key={img.id} style={styles.imageContainer}>
                    {isPending ? (
                      <View style={[styles.image, styles.imagePlaceholder]}>
                        {pollCount >= MAX_POLL_COUNT ? (
                          <Text style={styles.processingFailedText}>Upload failed</Text>
                        ) : (
                          <Text style={styles.processingText}>Processing…</Text>
                        )}
                      </View>
                    ) : (
                      <TouchableOpacity
                        activeOpacity={0.88}
                        onPress={() => {
                          setViewerIndex(idx);
                          setViewerVisible(true);
                        }}
                      >
                        <Image
                          source={{ uri: img.thumbnailUrl ?? img.originalUrl ?? '' }}
                          style={styles.image}
                        />
                        <View style={styles.imageTapHint}>
                          <Text style={styles.imageTapHintText}>Tap to expand</Text>
                        </View>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </>
        ) : null}

        {/* Manager actions */}
        {isManager ? (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionLabel}>MANAGER ACTIONS</Text>

            {/* Status change */}
            {nextStatuses.length > 0 ? (
              <View style={styles.actionBlock}>
                <Text style={styles.actionLabel}>Change Status</Text>
                <View style={styles.statusButtons}>
                  {nextStatuses.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={styles.statusBtn}
                      onPress={() => handleStatusChange(s)}
                      disabled={isSaving}
                    >
                      <Text style={styles.statusBtnText}>{STATUS_LABEL[s]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Assign to */}
            <View style={styles.actionBlock}>
              <Text style={styles.actionLabel}>
                Assign To
                {currentReport.assigneeName ? ` (current: ${currentReport.assigneeName})` : ''}
              </Text>
              <TouchableOpacity
                style={[styles.pickerButton, managersError && styles.pickerButtonError]}
                onPress={() => {
                  if (managersError) {
                    setManagersLoaded(false);
                    setManagersError(false);
                  } else if (managers.length > 0) {
                    setShowAssigneePicker(true);
                  }
                }}
                disabled={isSaving || (!managersLoaded && !managersError)}
              >
                <Text style={[styles.pickerButtonText, managersError && styles.pickerButtonErrorText]}>
                  {managersError
                    ? 'Failed to load — tap to retry'
                    : !managersLoaded
                    ? 'Loading managers…'
                    : 'Select a manager ▾'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Manager note */}
            <View style={styles.actionBlock}>
              <View style={styles.actionLabelRow}>
                <Text style={styles.actionLabel}>Manager Note</Text>
                <TouchableOpacity
                  style={[styles.aiBtn, isSuggestingNote && styles.aiBtnDisabled]}
                  onPress={async () => {
                    if (isSuggestingNote || !id) return;
                    setIsSuggestingNote(true);
                    try {
                      const suggestion = await suggestNote(id);
                      if (suggestion) setNoteText(suggestion);
                    } catch {
                      showToast({ type: 'error', title: 'AI unavailable', subtitle: 'Could not generate suggestion' });
                    } finally {
                      setIsSuggestingNote(false);
                    }
                  }}
                  disabled={isSuggestingNote}
                >
                  {isSuggestingNote ? (
                    <ActivityIndicator size="small" color={C.primary} />
                  ) : (
                    <Text style={styles.aiBtnText}>✦ Suggest</Text>
                  )}
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.noteInput}
                multiline
                numberOfLines={4}
                placeholder="Add a note for the reporter or team…"
                placeholderTextColor={C.secondary}
                value={noteText}
                onChangeText={setNoteText}
              />
              <TouchableOpacity
                style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
                onPress={handleSaveNote}
                disabled={isSaving}
              >
                <Text style={styles.saveBtnText}>{isSaving ? 'Saving…' : 'Save Note'}</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : null}
      </ScrollView>

      {/* Fullscreen image viewer */}
      <ImageViewer
        images={currentReport.images
          .filter((img) => img.originalUrl !== IMAGE_PENDING_URL && img.originalUrl !== null)
          .map((img) => img.originalUrl ?? '')}
        initialIndex={viewerIndex}
        visible={viewerVisible}
        onClose={() => setViewerVisible(false)}
      />

      {/* Assignee picker modal */}
      <Modal
        visible={showAssigneePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAssigneePicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setShowAssigneePicker(false)}
          activeOpacity={1}
        >
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Assign To</Text>
            {managers.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={styles.modalOption}
                onPress={() => handleAssign(m.id)}
              >
                <Text style={styles.modalOptionText}>{m.fullName}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.modalOption, styles.modalCancel]}
              onPress={() => setShowAssigneePicker(false)}
            >
              <Text style={[styles.modalOptionText, { color: C.accent }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: C.white },
  scroll: { flex: 1, backgroundColor: C.white },
  content: { paddingHorizontal: 20, paddingBottom: 60 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: C.accent, fontSize: 14 },
  priorityStrip: {
    height: 4,
    borderRadius: 2,
    marginTop: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: C.primary,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  priorityLabel: { fontSize: 12, fontWeight: '700' },
  dot: { fontSize: 13, color: C.secondary },
  metaText: { fontSize: 13, color: C.secondary },
  divider: { height: 1, backgroundColor: C.border, marginBottom: 20, marginTop: 4 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: C.secondary,
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 20,
  },
  description: { fontSize: 15, color: C.primary, lineHeight: 24 },
  managerNote: {
    fontSize: 14,
    color: C.primary,
    lineHeight: 22,
    backgroundColor: C.bg,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: C.secondary,
  },
  infoBlock: { marginBottom: 16 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  infoLabel: { fontSize: 13, color: C.secondary },
  infoValue: { fontSize: 13, color: C.primary, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
  imageScroll: { marginHorizontal: -20 },
  imageContainer: { marginRight: 8, paddingLeft: 20 },
  image: { width: 200, height: 200, borderRadius: 4 },
  imagePlaceholder: {
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingText: { fontSize: 12, color: C.secondary },
  processingFailedText: { fontSize: 12, color: C.accent },
  imageTapHint: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.32)',
    paddingVertical: 5,
    alignItems: 'center',
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  imageTapHintText: { fontSize: 11, color: 'rgba(255,255,255,0.9)', fontWeight: '500' },
  // Similar reports
  similarList: { gap: 2, marginBottom: 4 },
  similarRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: C.bg,
    borderLeftWidth: 3,
    borderLeftColor: C.border,
    marginBottom: 6,
  },
  similarTitle: { fontSize: 14, color: C.primary, fontWeight: '500', marginBottom: 2 },
  similarMeta: { fontSize: 12, color: C.textMuted },
  // AI note suggest
  actionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  // Manager action styles
  actionBlock: { marginBottom: 20 },
  actionLabel: { fontSize: 13, color: C.secondary, fontWeight: '500' },
  statusButtons: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  statusBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: C.primary,
    backgroundColor: C.white,
    borderRadius: 8,
  },
  statusBtnText: { fontSize: 13, color: C.primary, fontWeight: '600' },
  pickerButton: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.bg,
    borderRadius: 8,
  },
  pickerButtonError: { borderColor: C.accent, backgroundColor: C.bg },
  pickerButtonText: { fontSize: 14, color: C.primary },
  pickerButtonErrorText: { color: C.accent },
  noteInput: {
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    fontSize: 14,
    color: C.primary,
    minHeight: 100,
    textAlignVertical: 'top',
    backgroundColor: C.bg,
    marginBottom: 10,
  },
  saveBtn: {
    height: 44,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnText: { color: C.white, fontSize: 14, fontWeight: '600' },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: C.white,
    paddingBottom: 32,
  },
  modalTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: C.secondary,
    letterSpacing: 0.8,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  modalOption: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  modalCancel: { marginTop: 8 },
  modalOptionText: { fontSize: 16, color: C.primary },
});
