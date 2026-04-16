export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/v1';

/** Sentinel value the backend stores while an image is being processed by Celery. */
export const IMAGE_PENDING_URL = 'pending';

export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'fieldwatch_access_token',
  REFRESH_TOKEN: 'fieldwatch_refresh_token',
  OFFLINE_QUEUE: 'fieldwatch_offline_queue',
  LAST_SYNC: 'fieldwatch_last_sync',
  // Separate key for Zustand syncStore UI state (sync status, UI-side queue mirror).
  // Must be different from OFFLINE_QUEUE, which syncEngine owns directly via AsyncStorage.
  SYNC_UI_STATE: 'fieldwatch_sync_ui_state',
} as const;

export const SYNC_STATUSES = {
  SYNCED: 'SYNCED',
  PENDING: 'PENDING',
  FAILED: 'FAILED',
} as const;
