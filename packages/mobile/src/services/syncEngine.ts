import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { STORAGE_KEYS } from '../utils/constants';
import { createReport, type CreateReportPayload } from './reports';
import { uploadImage } from './images';

export interface QueuedReport {
  localId: string;
  idempotencyKey: string;
  payload: CreateReportPayload;
  images: Array<{ uri: string; name: string; type: string }>;
  syncStatus: 'PENDING' | 'FAILED';
  retryCount: number;
  enqueuedAt: string;
}

export interface SyncResult {
  synced: number;
  failed: number;
}

// ---------------------------------------------------------------------------
// Queue persistence helpers
// ---------------------------------------------------------------------------

async function loadQueue(): Promise<QueuedReport[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
    return raw ? (JSON.parse(raw) as QueuedReport[]) : [];
  } catch {
    return [];
  }
}

async function saveQueue(queue: QueuedReport[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function enqueueReport(
  payload: CreateReportPayload,
  images: Array<{ uri: string; name: string; type: string }> = []
): Promise<QueuedReport> {
  const item: QueuedReport = {
    localId: crypto.randomUUID(),
    idempotencyKey: crypto.randomUUID(),
    payload,
    images,
    syncStatus: 'PENDING',
    retryCount: 0,
    enqueuedAt: new Date().toISOString(),
  };
  const queue = await loadQueue();
  queue.push(item);
  await saveQueue(queue);
  return item;
}

export async function getQueue(): Promise<QueuedReport[]> {
  return loadQueue();
}

const MAX_RETRIES = 3;

// Prevent concurrent sync runs (e.g. rapid network toggling firing multiple listeners)
let _isSyncing = false;

/** Remove permanently failed items (exceeded retry limit) from the queue. */
export async function clearSyncedItems(): Promise<void> {
  const queue = await loadQueue();
  const remaining = queue.filter(
    (r) => !(r.syncStatus === 'FAILED' && r.retryCount >= MAX_RETRIES)
  );
  await saveQueue(remaining);
}

export async function syncPendingReports(
  onItemSynced?: (item: QueuedReport) => void
): Promise<SyncResult> {
  if (_isSyncing) return { synced: 0, failed: 0 };
  _isSyncing = true;
  try {
    return await _doSync(onItemSynced);
  } finally {
    _isSyncing = false;
  }
}

async function _doSync(onItemSynced?: (item: QueuedReport) => void): Promise<SyncResult> {
  const queue = await loadQueue();
  const pending = queue.filter((r) => r.syncStatus === 'PENDING');
  let synced = 0;
  let failed = 0;

  for (const item of pending) {
    try {
      const report = await createReport({
        ...item.payload,
        idempotency_key: item.idempotencyKey,
      });

      // Upload queued images now that report exists on server
      for (const img of item.images) {
        try {
          await uploadImage(report.id, img.uri, img.name, img.type);
        } catch {
          // Image upload failure is non-fatal
        }
      }

      // Remove successfully synced item
      const updated = await loadQueue();
      await saveQueue(updated.filter((r) => r.localId !== item.localId));
      synced++;
      onItemSynced?.(item);
    } catch {
      // Mark as failed and increment retry counter
      const updated = await loadQueue();
      await saveQueue(
        updated.map((r) =>
          r.localId === item.localId
            ? { ...r, syncStatus: 'FAILED' as const, retryCount: r.retryCount + 1 }
            : r
        )
      );
      failed++;
    }
  }

  if (synced > 0) {
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
  }

  return { synced, failed };
}

export async function retryFailedReports(): Promise<void> {
  const queue = await loadQueue();
  await saveQueue(
    queue.map((r) =>
      r.syncStatus === 'FAILED' ? { ...r, syncStatus: 'PENDING' as const } : r
    )
  );
}

// ---------------------------------------------------------------------------
// Network listener — call this once at app startup
// ---------------------------------------------------------------------------

export function startNetworkListener(
  onSync: (result: SyncResult) => void
): () => void {
  let wasOffline = false;

  const unsubscribe = NetInfo.addEventListener((state) => {
    const isOnline = state.isConnected === true && state.isInternetReachable !== false;

    if (isOnline && wasOffline) {
      // Just came back online — drain queue
      syncPendingReports().then(onSync).catch(() => {});
    }
    wasOffline = !isOnline;
  });

  return unsubscribe;
}
