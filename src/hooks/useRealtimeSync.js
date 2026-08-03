import { useEffect, useRef } from 'react';
import { isSupabaseEnabled } from '../utils/supabaseClient';
import { fetchData, fetchDataSince, hasSession } from '../utils/supabaseService';
import { getJournalKey } from '../utils/journalKey';
import { initNetworkListener, flushOfflineQueue } from '../utils/syncManager';

// Polling period (ms) — remplace le temps réel Supabase par une relecture
const POLL_MS = 30000;

export default function useRealtimeSync({ currentCompanyId, currentUser, invoices, expenses, transactions, setInvoices, setExpenses, setTransactions }) {
  const invRef = useRef(invoices);
  const expRef = useRef(expenses);
  const txRef = useRef(transactions);
  const lastPollRef = useRef(0);
  useEffect(() => { invRef.current = invoices; }, [invoices]);
  useEffect(() => { expRef.current = expenses; }, [expenses]);
  useEffect(() => { txRef.current = transactions; }, [transactions]);

  useEffect(() => {
    initNetworkListener();
    if (isSupabaseEnabled()) {
      hasSession().then(ok => { if (ok) flushOfflineQueue().catch(() => {}); }).catch(e => console.warn('[sync] flushOfflineQueue failed:', e?.message));
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseEnabled() || !currentCompanyId || !currentUser) return;
    let cancelled = false;
    const syncJournal = async () => {
      try {
        const entries = await fetchData('journal_entries', currentCompanyId, 'date', true);
        if (cancelled) return;
        if (entries.length > 0) {
          const key = getJournalKey();
          localStorage.setItem(key, JSON.stringify(entries));
          window.dispatchEvent(new CustomEvent('journal:updated'));
        }
      } catch { /* silencieux */ }
    };
    const syncData = async () => {
      try {
        const since = lastPollRef.current > 0 ? new Date(lastPollRef.current).toISOString() : null;
        const [inv, exp, tx] = await Promise.all([
          since ? fetchDataSince('invoices', currentCompanyId, since) : fetchData('invoices', currentCompanyId),
          since ? fetchDataSince('expenses', currentCompanyId, since) : fetchData('expenses', currentCompanyId),
          since ? fetchDataSince('transactions', currentCompanyId, since) : fetchData('transactions', currentCompanyId),
        ]);
        if (cancelled) return;
        lastPollRef.current = Date.now();
        if (since && (inv.length || exp.length || tx.length)) {
          // Appliquer les changements incrémentaux sur les refs locales
          const apply = (list, changed) => {
            const map = new Map((list || []).map(r => [r.id, r]));
            for (const r of changed) map.set(r.id, r);
            return Array.from(map.values());
          };
          if (inv.length) setInvoices(apply(invRef.current, inv));
          if (exp.length) setExpenses(apply(expRef.current, exp));
          if (tx.length) setTransactions(apply(txRef.current, tx));
        } else if (!since) {
          if (JSON.stringify(inv) !== JSON.stringify(invRef.current)) setInvoices(inv);
          if (JSON.stringify(exp) !== JSON.stringify(expRef.current)) setExpenses(exp);
          if (JSON.stringify(tx) !== JSON.stringify(txRef.current)) setTransactions(tx);
        }
      } catch { /* silencieux */ }
    };

    syncJournal();
    syncData();
    const poll = setInterval(() => {
      syncJournal();
      syncData();
    }, POLL_MS);
    return () => { cancelled = true; clearInterval(poll); };
  }, [currentCompanyId]);
}
