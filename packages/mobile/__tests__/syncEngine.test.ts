import AsyncStorage from '@react-native-async-storage/async-storage';
import { enqueueReport, getQueue, syncPendingReports } from '../src/services/syncEngine';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn().mockResolvedValue({ isConnected: true, isInternetReachable: true }),
  addEventListener: jest.fn().mockReturnValue(() => {}),
}));

jest.mock('../src/services/reports', () => ({
  createReport: jest.fn(),
}));

jest.mock('../src/services/images', () => ({
  uploadImage: jest.fn(),
}));

// Provide crypto.randomUUID in Jest environment
Object.defineProperty(global, 'crypto', {
  value: { randomUUID: () => `${Math.random().toString(36).slice(2)}-${Date.now()}` },
});

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const { createReport: mockCreateReport } = jest.requireMock('../src/services/reports') as {
  createReport: jest.Mock;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupEmptyStorage(): void {
  mockAsyncStorage.getItem.mockResolvedValue(null);
  mockAsyncStorage.setItem.mockResolvedValue(undefined);
}

function setupStorageWithQueue(queue: unknown[]): void {
  mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(queue));
  mockAsyncStorage.setItem.mockResolvedValue(undefined);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

describe('syncEngine — offline behaviour', () => {
  test('enqueueReport saves report to AsyncStorage queue', async () => {
    setupEmptyStorage();

    const queued = await enqueueReport({
      title: 'Offline Report',
      description: 'Created while offline',
      priority: 'MEDIUM',
    });

    expect(queued.syncStatus).toBe('PENDING');
    expect(queued.idempotencyKey).toBeTruthy();
    expect(queued.payload.title).toBe('Offline Report');

    // setItem should have been called to persist the queue
    expect(mockAsyncStorage.setItem).toHaveBeenCalledTimes(1);
    const saved = JSON.parse(
      (mockAsyncStorage.setItem.mock.calls[0] as [string, string])[1]
    ) as unknown[];
    expect(saved).toHaveLength(1);
  });

  test('getQueue returns items in insertion order', async () => {
    const existing = [
      {
        localId: 'a',
        idempotencyKey: 'k1',
        payload: { title: 'First', description: 'd', priority: 'LOW' },
        images: [],
        syncStatus: 'PENDING',
        retryCount: 0,
        enqueuedAt: '2024-01-01T00:00:00Z',
      },
      {
        localId: 'b',
        idempotencyKey: 'k2',
        payload: { title: 'Second', description: 'd', priority: 'HIGH' },
        images: [],
        syncStatus: 'PENDING',
        retryCount: 0,
        enqueuedAt: '2024-01-01T00:01:00Z',
      },
    ];
    setupStorageWithQueue(existing);

    const queue = await getQueue();
    expect(queue).toHaveLength(2);
    expect(queue[0].payload.title).toBe('First');
    expect(queue[1].payload.title).toBe('Second');
  });
});

describe('syncEngine — online sync', () => {
  test('syncPendingReports POSTs queued reports in order', async () => {
    const items = [
      {
        localId: 'local-1',
        idempotencyKey: 'idem-1',
        payload: { title: 'Report A', description: 'd', priority: 'LOW' },
        images: [],
        syncStatus: 'PENDING',
        retryCount: 0,
        enqueuedAt: '2024-01-01T00:00:00Z',
      },
      {
        localId: 'local-2',
        idempotencyKey: 'idem-2',
        payload: { title: 'Report B', description: 'd', priority: 'HIGH' },
        images: [],
        syncStatus: 'PENDING',
        retryCount: 0,
        enqueuedAt: '2024-01-01T00:01:00Z',
      },
    ];

    // Each getItem call returns the current queue (simplification: always return same items)
    mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(items));
    mockAsyncStorage.setItem.mockResolvedValue(undefined);
    mockCreateReport.mockResolvedValue({ id: 'server-id-123' });

    const result = await syncPendingReports();

    expect(result.synced).toBe(2);
    expect(result.failed).toBe(0);
    expect(mockCreateReport).toHaveBeenCalledTimes(2);

    // First call should include idempotency_key
    expect(mockCreateReport.mock.calls[0][0]).toMatchObject({
      title: 'Report A',
      idempotency_key: 'idem-1',
    });
    expect(mockCreateReport.mock.calls[1][0]).toMatchObject({
      title: 'Report B',
      idempotency_key: 'idem-2',
    });
  });

  test('syncPendingReports marks item as FAILED and retries on next sync', async () => {
    const items = [
      {
        localId: 'local-fail',
        idempotencyKey: 'idem-fail',
        payload: { title: 'Failing Report', description: 'd', priority: 'MEDIUM' },
        images: [],
        syncStatus: 'PENDING',
        retryCount: 0,
        enqueuedAt: '2024-01-01T00:00:00Z',
      },
    ];

    let currentQueue = [...items];
    mockAsyncStorage.getItem.mockImplementation(() =>
      Promise.resolve(JSON.stringify(currentQueue))
    );
    mockAsyncStorage.setItem.mockImplementation((_key: string, value: string) => {
      currentQueue = JSON.parse(value) as typeof items;
      return Promise.resolve(undefined);
    });

    // First attempt fails
    mockCreateReport.mockRejectedValueOnce(new Error('500 Server Error'));

    const result = await syncPendingReports();

    expect(result.synced).toBe(0);
    expect(result.failed).toBe(1);
    expect(currentQueue[0].syncStatus).toBe('FAILED');
    expect(currentQueue[0].retryCount).toBe(1);

    // Reset to PENDING and retry — succeeds
    currentQueue = [{ ...currentQueue[0], syncStatus: 'PENDING' }];
    mockCreateReport.mockResolvedValueOnce({ id: 'server-id-retry' });

    const result2 = await syncPendingReports();
    expect(result2.synced).toBe(1);
    expect(result2.failed).toBe(0);
  });
});
