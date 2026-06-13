import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockStorage = {};
function setupMockLS() {
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key) => mockStorage[key] ?? null),
    setItem: vi.fn((key, val) => { mockStorage[key] = String(val); }),
    removeItem: vi.fn((key) => { delete mockStorage[key]; }),
    clear: vi.fn(() => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }),
    get length() { return Object.keys(mockStorage).length; },
    key: vi.fn((i) => Object.keys(mockStorage)[i]),
  });
}

function cleanup() {
  Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
}

const { mockSupabase, mockIsSupabaseEnabled } = vi.hoisted(() => {
  const builder = {
    then: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    upsert: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
  };
  return {
    mockSupabase: { from: vi.fn(() => builder), builder },
    mockIsSupabaseEnabled: vi.fn(() => true),
  };
});

vi.mock('./supabaseClient', () => ({
  supabase: mockSupabase,
  isSupabaseEnabled: mockIsSupabaseEnabled,
}));

beforeEach(() => {
  cleanup();
  setupMockLS();
  vi.stubGlobal('navigator', { onLine: true });
  vi.stubGlobal('window', { addEventListener: vi.fn() });
  mockIsSupabaseEnabled.mockReturnValue(true);
  const b = mockSupabase.builder;
  b.insert.mockReset().mockResolvedValue({ data: null, error: null });
  b.upsert.mockReset().mockResolvedValue({ data: null, error: null });
  b.update.mockReset().mockReturnValue(b);
  b.delete.mockReset().mockReturnValue(b);
  b.select.mockReset().mockReturnValue(b);
  b.eq.mockReset().mockReturnValue(b);
  b.order.mockReset().mockReturnValue(b);
  b.then.mockReset().mockImplementation((resolve) => { resolve({ data: [], error: null }); });
});

describe('syncToCloud', () => {
  it('returns disabled when Supabase is disabled', async () => {
    mockIsSupabaseEnabled.mockReturnValue(false);
    const { syncToCloud } = await import('./syncManager');
    const result = await syncToCloud('test', { foo: 'bar' });
    expect(result).toEqual({ success: false, reason: 'disabled' });
  });

  it('queues item offline when sync fails', async () => {
    mockSupabase.builder.insert.mockResolvedValue({ data: null, error: { message: 'fail' } });
    const { syncToCloud } = await import('./syncManager');
    const result = await syncToCloud('test', { foo: 'bar' }, 'insert');
    expect(result.success).toBe(false);
    const queue = JSON.parse(localStorage.getItem('smart_offline_queue') || '[]');
    expect(queue.length).toBe(1);
    expect(queue[0].table).toBe('test');
    expect(queue[0].operation).toBe('insert');
    expect(queue[0]).toHaveProperty('queued_at');
  });
});

describe('flushOfflineQueue', () => {
  it('processes queue and clears it on success', async () => {
    localStorage.setItem('smart_offline_queue', JSON.stringify([
      { table: 't1', data: { x: 1 }, operation: 'insert' },
      { table: 't2', data: { y: 2 }, operation: 'upsert' },
    ]));
    const { flushOfflineQueue } = await import('./syncManager');
    await flushOfflineQueue();
    expect(localStorage.getItem('smart_offline_queue')).toBeNull();
  });
});

describe('fetchFromCloud', () => {
  it('returns null when offline', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const { fetchFromCloud } = await import('./syncManager');
    const result = await fetchFromCloud('test');
    expect(result).toBeNull();
  });
});

describe('initNetworkListener', () => {
  it('adds online event listener', async () => {
    const { initNetworkListener } = await import('./syncManager');
    initNetworkListener();
    expect(window.addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
  });
});
