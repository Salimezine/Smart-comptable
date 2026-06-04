const OLD_KEY = 'smart_journal';

export function getJournalKey() {
  try {
    const id = localStorage.getItem('smart_comptable_current_id');
    if (id) {
      const key = `smart_journal_${id}`;
      // Migrate old global data to this company's key on first access
      try {
        const old = localStorage.getItem(OLD_KEY);
        if (old) {
          const existing = localStorage.getItem(key);
          if (!existing) {
            localStorage.setItem(key, old);
          }
        }
      } catch { /* ignore */ }
      return key;
    }
  } catch { /* fallback */ }
  return OLD_KEY;
}
