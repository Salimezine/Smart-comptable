import { logAction, AUDIT_ACTIONS } from './security/auditLog';

const OLD_KEY = 'smart_journal';

export function getJournalKey() {
  try {
    const id = localStorage.getItem('smart_comptable_current_id');
    if (id) {
      const key = `smart_journal_${id}`;
      // Migrate old global data ONCE, then remove the global key
      try {
        const old = localStorage.getItem(OLD_KEY);
        if (old) {
          const existing = localStorage.getItem(key);
          if (!existing) {
            localStorage.setItem(key, old);
            logAction(AUDIT_ACTIONS.JOURNAL_SAVE, { details: 'Migration des données du journal global vers clé société', oldKey: OLD_KEY, newKey: key });
          }
          // Remove global key so it isn't re-copied into every new company
          localStorage.removeItem(OLD_KEY);
        }
      } catch { /* ignore */ }
      return key;
    }
  } catch { /* fallback */ }
  return OLD_KEY;
}
