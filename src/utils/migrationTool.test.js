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

const MOCK_JOURNAL_KEY = 'smart_journal_cptable_test';

vi.mock('./journalKey', () => ({
  getJournalKey: () => MOCK_JOURNAL_KEY,
}));

vi.mock('./payrollStore', () => ({
  getAllBulletins: vi.fn(() => []),
}));

const { mockIsSupabaseEnabled } = vi.hoisted(() => ({
  mockIsSupabaseEnabled: vi.fn(() => true),
}));

vi.mock('./supabaseClient', () => {
  const builder = {
    insert: vi.fn().mockResolvedValue({ error: null }),
    upsert: vi.fn().mockResolvedValue({ error: null }),
  };
  return {
    supabase: { from: vi.fn(() => builder) },
    isSupabaseEnabled: mockIsSupabaseEnabled,
  };
});

describe('migrateLocalToSupabase', () => {
  beforeEach(() => {
    cleanup();
    setupMockLS();
    mockIsSupabaseEnabled.mockReturnValue(true);
  });

  it('returns errors when Supabase is disabled', async () => {
    mockIsSupabaseEnabled.mockReturnValue(false);
    const { migrateLocalToSupabase } = await import('./migrationTool');
    const result = await migrateLocalToSupabase('company_1');
    expect(result.errors).toEqual(['Supabase non configuré']);
    expect(result.journal).toBe(0);
    expect(result.employees).toBe(0);
    expect(result.invoices).toBe(0);
    expect(result.bulletins).toBe(0);
  });
});

describe('isMigrated', () => {
  beforeEach(() => {
    cleanup();
    setupMockLS();
  });

  it('returns true when migration flag exists', async () => {
    localStorage.setItem('smart_migrated_company_1', '2025-01-01T00:00:00.000Z');
    const { isMigrated } = await import('./migrationTool');
    expect(isMigrated('company_1')).toBe(true);
  });

  it('returns false when no migration flag', async () => {
    const { isMigrated } = await import('./migrationTool');
    expect(isMigrated('company_1')).toBe(false);
  });
});
