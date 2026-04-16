import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../utils/constants';
import type { QueuedReport } from '../services/syncEngine';

export type SyncStatus = 'idle' | 'syncing' | 'error';

interface SyncState {
  queue: QueuedReport[];
  lastSyncAt: string | null;
  syncStatus: SyncStatus;

  addToQueue: (item: QueuedReport) => void;
  removeFromQueue: (localId: string) => void;
  updateQueueItem: (localId: string, updates: Partial<QueuedReport>) => void;
  clearQueue: () => void;
  setSyncStatus: (status: SyncStatus) => void;
  setLastSyncAt: (ts: string) => void;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set) => ({
      queue: [],
      lastSyncAt: null,
      syncStatus: 'idle',

      addToQueue: (item) =>
        set((state) => ({ queue: [...state.queue, item] })),

      removeFromQueue: (localId) =>
        set((state) => ({ queue: state.queue.filter((r) => r.localId !== localId) })),

      updateQueueItem: (localId, updates) =>
        set((state) => ({
          queue: state.queue.map((r) => (r.localId === localId ? { ...r, ...updates } : r)),
        })),

      clearQueue: () => set({ queue: [] }),

      setSyncStatus: (syncStatus) => set({ syncStatus }),

      setLastSyncAt: (lastSyncAt) => set({ lastSyncAt }),
    }),
    {
      name: STORAGE_KEYS.SYNC_UI_STATE,
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
