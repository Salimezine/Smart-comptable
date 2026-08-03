import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, isSupabaseEnabled } from '../utils/supabaseClient';
import { fetchData as fetchSupabaseData, upsertData as upsertSupabaseData, fetchCompanySettings, saveCompanySettings } from '../utils/supabaseService';
import { getJournalKey } from '../utils/journalKey';
import { employeeToDB, bulletinToDB } from '../utils/payrollStore';
import { syncLearningToSupabase, loadLearningFromSupabase } from '../utils/ocrLearning';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isUUID(v) { return UUID_RE.test(v); }

export default function useCompanyData({ currentUser, currentCompanyId, setCurrentCompanyId, companies, setCompanies }) {
  const [invoices, setInvoices] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [companyDetails, setCompanyDetails] = useState({});
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [piecesComptables, setPiecesComptables] = useState(() => {
    try {
      const id = localStorage.getItem('smart_comptable_current_id');
      const key = id ? `piecesComptables_${id}` : 'piecesComptables';
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch { return []; }
  });

  const [syncVersion, setSyncVersion] = useState(0);
  const activeCompanyRef = useRef(currentCompanyId);
  const saveTimerRef = useRef(null);
  const savingRef = useRef(false);

  useEffect(() => {
    window.__bumpSyncVersion = () => setSyncVersion(v => v + 1);
    return () => { delete window.__bumpSyncVersion; };
  }, []);

  useEffect(() => {
    const listener = () => setSyncVersion(v => v + 1);
    window.addEventListener('journal:updated', listener);
    return () => window.removeEventListener('journal:updated', listener);
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    if (currentCompanyId) return;
    if (currentUser.societeId && isUUID(currentUser.societeId)) {
      setCurrentCompanyId(currentUser.societeId);
      localStorage.setItem('smart_comptable_current_id', currentUser.societeId);
    }
  }, [currentUser, currentCompanyId]);

  useEffect(() => {
    if (!currentUser) return;
    const loadData = async () => {
      if (!currentCompanyId) return;
      if (isSupabaseEnabled() && isUUID(currentCompanyId)) {
        const [invoicesData, transactionsData, expensesData, companySettings] = await Promise.all([
          fetchSupabaseData('invoices', currentCompanyId),
          fetchSupabaseData('transactions', currentCompanyId),
          fetchSupabaseData('expenses', currentCompanyId),
          fetchCompanySettings(currentCompanyId),
        ]);
        Promise.all([
          fetchSupabaseData('employees', currentCompanyId),
          fetchSupabaseData('payroll_slips', currentCompanyId),
          fetchSupabaseData('stock', currentCompanyId),
          fetchSupabaseData('stock_mouvements', currentCompanyId),
          fetchSupabaseData('pieces_comptables', currentCompanyId),
        ]).then(([empData, payData, stockData, movData, piecesData]) => {
          if (empData.length) {
            const mapped = empData.map(e => ({ id: e.id, nom: e.nom, prenom: e.prenom, cin: e.cin, matricule: e.matricule, poste: e.poste, salaireBase: e.salaire_base ?? 0, regimeHoraire: e.regime === '48h' ? 48 : 40, chefFamille: e.situation_famille === 'chef_famille', conjointCharge: e.situation_famille === 'marie', nbEnfants: e.nb_enfants ?? 0 }));
            localStorage.setItem(`smart_employes_${currentCompanyId}`, JSON.stringify(mapped));
          }
          if (payData.length) {
            const seen = new Set();
            const deduped = [];
            for (const b of payData) { const key = `${b.employee_id}_${b.annee}_${String(b.mois).padStart(2, '0')}`; if (!seen.has(key)) { seen.add(key); deduped.push(b); } }
            const mapped = deduped.map(b => ({ id: b.id, employeId: b.employee_id, nom: b.nom, prenom: b.prenom, mois: b.mois, annee: b.annee, salaireBase: b.salaire_base, brut: b.brut, cnssSal: b.cnss_sal, cnssPat: b.cnss_pat, irppAnnuel: b.irpp, netAPayer: b.net_a_payer, coutEmployeur: b.cout_employeur }));
            localStorage.setItem(`smart_bulletins_${currentCompanyId}`, JSON.stringify(mapped));
          }
          if (stockData.length) localStorage.setItem(`smart_stock_${currentCompanyId}`, JSON.stringify(stockData));
          if (movData.length) localStorage.setItem(`STOCK_LOG_KEY_${currentCompanyId}`, JSON.stringify(movData));
          if (piecesData.length) localStorage.setItem(`piecesComptables_${currentCompanyId}`, JSON.stringify(piecesData));
          loadLearningFromSupabase().catch(() => console.warn('[sync] loadLearningFromSupabase failed'));
        }).catch((e) => console.warn('[sync] loadSupabaseData failed:', e?.message));
        if (invoicesData.length || transactionsData.length || expensesData.length) {
          setInvoices(invoicesData);
          setTransactions(transactionsData);
          setExpenses(expensesData);
          const localDetails = companies[currentCompanyId]?.companyDetails || {};
          const mergedSettings = { ...localDetails, ...(companySettings || {}) };
          setCompanyDetails(prev => ({ ...prev, ...mergedSettings }));
          setCompanies(prev => {
            if (prev[currentCompanyId]) return prev;
            const updated = { ...prev, [currentCompanyId]: { id: currentCompanyId, invoices: invoicesData, expenses: expensesData, transactions: transactionsData, companyDetails: mergedSettings } };
            localStorage.setItem('smart_comptable_companies', JSON.stringify(updated));
            return updated;
          });
          activeCompanyRef.current = currentCompanyId;
          return;
        }
      }
      const stored = companies[currentCompanyId];
      if (stored) {
        setInvoices(stored.invoices || []);
        setTransactions(stored.transactions || []);
        setExpenses(stored.expenses || []);
        const details = { ...(stored.companyDetails || {}) };
        setCompanyDetails(details);
        activeCompanyRef.current = currentCompanyId;
        if (!details.onboardingDone && (!details.name || details.name.trim() === '')) {
          const hasData = (stored.invoices?.length > 0) || (stored.expenses?.length > 0);
          if (!hasData) setShowOnboarding(true);
        }
      }
    };
    loadData();
  }, [currentCompanyId, currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    if (!currentCompanyId) return;
    if (currentCompanyId !== activeCompanyRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      if (savingRef.current) return;
      savingRef.current = true;
      try {
        const safeDetails = { ...companyDetails };
        if (isSupabaseEnabled() && navigator.onLine && isUUID(currentCompanyId)) {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              await upsertSupabaseData('invoices', currentCompanyId, invoices);
              await upsertSupabaseData('transactions', currentCompanyId, transactions);
              await upsertSupabaseData('expenses', currentCompanyId, expenses);
              await upsertSupabaseData('pieces_comptables', currentCompanyId, piecesComptables);
              await saveCompanySettings(currentCompanyId, safeDetails);
              try {
                const localEmp = JSON.parse(localStorage.getItem(`smart_employes_${currentCompanyId}`) || '[]');
                if (localEmp.length) await supabase.from('employees').upsert(localEmp.map(e => employeeToDB(e, currentCompanyId)), { onConflict: 'id' });
                const localPay = JSON.parse(localStorage.getItem(`smart_bulletins_${currentCompanyId}`) || '[]');
                if (localPay.length) await supabase.from('payroll_slips').upsert(localPay.map(b => bulletinToDB(b, currentCompanyId)), { onConflict: 'id' });
              } catch (ee) { console.warn('[Save] Employee sync:', ee); }
              try { await syncLearningToSupabase(); } catch (ee) { console.warn('[Save] OCR learning sync:', ee); }
              try {
                const journalKey = getJournalKey();
                const localJournal = JSON.parse(localStorage.getItem(journalKey) || '[]');
                if (localJournal.length) await upsertSupabaseData('journal_entries', currentCompanyId, localJournal);
              } catch (ee) { console.warn('[Save] Journal sync:', ee); }
              try {
                const stockKey = `smart_stock_${currentCompanyId}`;
                const localStock = JSON.parse(localStorage.getItem(stockKey) || '[]');
                if (localStock.length) await supabase.from('stock').upsert(localStock.map(a => ({ ...a, company_id: currentCompanyId })), { onConflict: 'id' });
                const movKey = `smart_stock_mouvements_${currentCompanyId}`;
                const localMov = JSON.parse(localStorage.getItem(movKey) || '[]');
                if (localMov.length) await supabase.from('stock_mouvements').upsert(localMov.map(m => { const { prixUnitaire, ...rest } = m; return { ...rest, company_id: currentCompanyId }; }), { onConflict: 'id' });
              } catch (ee) { console.warn('[Save] Stock sync:', ee); }
            }
          } catch (e) { console.warn('[Save] Supabase sync error:', e?.message || e); }
        }
        setCompanies(prev => {
          const currentData = prev[currentCompanyId] || {};
          const updated = { ...prev, [currentCompanyId]: { ...currentData, invoices, transactions, expenses, companyDetails: safeDetails } };
          localStorage.setItem('smart_comptable_companies', JSON.stringify(updated));
          return updated;
        });
      } finally { savingRef.current = false; }
    }, 2000);
  }, [invoices, transactions, expenses, piecesComptables, companyDetails, currentCompanyId, currentUser, syncVersion]);

  return {
    invoices, setInvoices,
    transactions, setTransactions,
    expenses, setExpenses,
    companyDetails, setCompanyDetails,
    showOnboarding, setShowOnboarding,
    piecesComptables, setPiecesComptables,
    syncVersion,
    activeCompanyRef,
  };
}
