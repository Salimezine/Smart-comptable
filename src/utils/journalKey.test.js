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

describe('getJournalKey', () => {
  beforeEach(() => {
    setupMockLS();
  });

  it('should return smart_journal when no company is selected', async () => {
    const { getJournalKey } = await import('./journalKey');
    expect(getJournalKey()).toBe('smart_journal');
  });

  it('should return scoped key when company ID exists', async () => {
    localStorage.setItem('smart_comptable_current_id', '42');
    const { getJournalKey } = await import('./journalKey');
    expect(getJournalKey()).toBe('smart_journal_42');
  });

  it('should migrate old data to scoped key on first access', async () => {
    const oldData = JSON.stringify([{ compte: 'Old data', debit: 100, credit: 0 }]);
    localStorage.setItem('smart_journal', oldData);
    localStorage.setItem('smart_comptable_current_id', '99');

    const { getJournalKey } = await import('./journalKey');
    const key = getJournalKey();
    expect(key).toBe('smart_journal_99');

    const migrated = localStorage.getItem('smart_journal_99');
    expect(migrated).toBe(oldData);
  });

  it('should NOT overwrite existing scoped data during migration', async () => {
    const oldData = JSON.stringify([{ compte: 'Old global', debit: 100, credit: 0 }]);
    const existingData = JSON.stringify([{ compte: 'Existing scoped', debit: 200, credit: 0 }]);

    localStorage.setItem('smart_journal', oldData);
    localStorage.setItem('smart_comptable_current_id', '7');
    localStorage.setItem('smart_journal_7', existingData);

    const { getJournalKey } = await import('./journalKey');
    const key = getJournalKey();
    expect(key).toBe('smart_journal_7');

    // Existing data should remain untouched
    expect(localStorage.getItem('smart_journal_7')).toBe(existingData);
  });

  it('should preserve old data after migration', async () => {
    localStorage.setItem('smart_journal', JSON.stringify([{ test: true }]));
    localStorage.setItem('smart_comptable_current_id', '5');

    const { getJournalKey } = await import('./journalKey');
    getJournalKey();

    // Old key should still exist
    const old = localStorage.getItem('smart_journal');
    expect(old).toBeDefined();
    expect(JSON.parse(old)[0].test).toBe(true);
  });

  it('should fallback to smart_journal when localStorage is unavailable', async () => {
    vi.stubGlobal('localStorage', undefined);

    const { getJournalKey } = await import('./journalKey');
    expect(getJournalKey()).toBe('smart_journal');
  });
});
