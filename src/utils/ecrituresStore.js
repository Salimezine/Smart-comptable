import { getJournalKey } from './journalKey';

const STORAGE_KEY = 'smart_comptable_ecritures';
const IMPORTED_KEY = 'smart_comptable_ecritures_imported';

let ecrituresCache = null;

function load() {
  if (ecrituresCache) return ecrituresCache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    ecrituresCache = raw ? JSON.parse(raw) : [];
  } catch { ecrituresCache = []; }
  return ecrituresCache;
}

function save(list) {
  ecrituresCache = list;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function getEcritures() {
  return load();
}

export function clearEcritures() {
  save([]);
}

export function addEcritures(entries) {
  const existing = load();
  const seen = new Set(existing.map(e => `${e.piece}|${e.compte}|${e.date}`));
  const added = [];
  let doublons = 0;
  for (const e of entries) {
    const key = `${e.piece}|${e.compte}|${e.date}`;
    if (!seen.has(key)) {
      existing.push({ ...e, id: crypto.randomUUID(), lettre: null, dateLettrage: null });
      seen.add(key);
      added.push(e);
    } else {
      doublons++;
    }
  }
  save(existing);
  return { ajoutés: added.length, doublons };
}

export function saveLettrage(ids, lettre) {
  const list = load();
  const today = new Date().toISOString().slice(0, 10);
  for (const id of ids) {
    const e = list.find(x => x.id === id);
    if (e) { e.lettre = lettre; e.dateLettrage = today; }
  }
  save(list);
}

export function deletrage(lettre) {
  const list = load();
  for (const e of list) {
    if (e.lettre === lettre) { e.lettre = null; e.dateLettrage = null; }
  }
  save(list);
}

export function getNextLettre(compte) {
  const list = load().filter(e => e.compte === compte && e.lettre);
  const used = new Set(list.map(e => e.lettre));
  for (let len = 1; len <= 3; len++) {
    for (let n = 0; n < 26 ** len; n++) {
      let s = '';
      let v = n;
      for (let i = 0; i < len; i++) { s = String.fromCharCode(65 + (v % 26)) + s; v = Math.floor(v / 26); }
      if (!used.has(s)) return s;
    }
  }
  return 'ZZZ';
}

export function getComptesTiers() {
  const list = load();
  const map = {};
  for (const e of list) {
    const c = e.compte.trim();
    if (!map[c]) map[c] = { nbNonLettre: 0, nbTotal: 0, solde: 0 };
    map[c].nbTotal++;
    if (!e.lettre) {
      map[c].nbNonLettre++;
      map[c].solde += (e.debit || 0) - (e.credit || 0);
    }
  }
  return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).map(([compte, d]) => ({ compte, ...d }));
}

export function getEcrituresByCompte(compte) {
  return load().filter(e => e.compte === compte).sort((a, b) => a.date.localeCompare(b.date) || a.piece.localeCompare(b.piece));
}

export function getNonLettreCount() {
  return load().filter(e => !e.lettre).length;
}

// ── Import depuis les données existantes de l'app ──
const COMPTES_TIERS_RE = /^(401|411|421|431|441|445)/;

function toMontant(v) { return typeof v === 'number' ? v : (parseFloat(v) || 0); }

export function importFromExistingSources(companyId) {
  const imported = JSON.parse(localStorage.getItem(IMPORTED_KEY) || '{}');
  const version = imported[companyId] || 0;
  if (version >= 1) return 0; // déjà importé

  const entries = [];

  // 1. Journal entries (smart_journal_<companyId>)
  try {
    const journalKey = companyId ? `smart_journal_${companyId}` : 'smart_journal';
    const journal = JSON.parse(localStorage.getItem(journalKey) || '[]');
    for (const e of journal) {
      const compte = (e.compte || e.account || '').toString().trim();
      if (!compte || !COMPTES_TIERS_RE.test(compte)) continue;
      entries.push({
        journal: e.journal || 'G',
        date: (e.date || '').slice(0, 10),
        piece: e.piece || e.ref || e.numero || '',
        compte,
        libelle: e.libelle || e.libele || e.label || e.description || '',
        debit: toMontant(e.debit || e.montant_debit),
        credit: toMontant(e.credit || e.montant_credit),
      });
    }
  } catch {}

  // 2. Invoices from companies
  try {
    const companies = JSON.parse(localStorage.getItem('smart_comptable_companies') || '{}');
    const data = companies[companyId];
    if (data?.invoices) {
      for (const inv of data.invoices) {
        const clientCompte = inv.clientCompte || inv.compte || '411001';
        if (!COMPTES_TIERS_RE.test(clientCompte)) continue;
        entries.push({
          journal: 'VTE',
          date: (inv.date || inv.createdAt || inv.invoiceDate || '').slice(0, 10),
          piece: inv.invoiceNumber || inv.numero || inv.ref || '',
          compte: clientCompte,
          libelle: inv.clientName || inv.client || inv.description || 'Vente client',
          debit: toMontant(inv.total || inv.montant || inv.amount || 0),
          credit: 0,
        });
        // Si encaissement partiel
        if (inv.paidAmount > 0) {
          entries.push({
            journal: 'BQ',
            date: (inv.paidAt || inv.date || '').slice(0, 10),
            piece: 'RG-' + (inv.invoiceNumber || inv.numero || ''),
            compte: clientCompte,
            libelle: 'Règlement ' + (inv.clientName || 'client'),
            debit: 0,
            credit: toMontant(inv.paidAmount),
          });
        }
      }
    }
  } catch {}

  // 3. Expenses
  try {
    const companies = JSON.parse(localStorage.getItem('smart_comptable_companies') || '{}');
    const data = companies[companyId];
    if (data?.expenses) {
      for (const exp of data.expenses) {
        const fournCompte = exp.fournisseurCompte || exp.compte || '401001';
        if (!COMPTES_TIERS_RE.test(fournCompte)) continue;
        entries.push({
          journal: 'ACH',
          date: (exp.date || exp.createdAt || exp.expenseDate || '').slice(0, 10),
          piece: exp.invoiceNumber || exp.numero || exp.ref || exp.description || '',
          compte: fournCompte,
          libelle: exp.supplier || exp.fournisseur || exp.description || 'Achat fournisseur',
          debit: 0,
          credit: toMontant(exp.total || exp.montant || exp.amount || 0),
        });
        if (exp.paidAmount > 0) {
          entries.push({
            journal: 'BQ',
            date: (exp.paidAt || exp.date || '').slice(0, 10),
            piece: 'PAY-' + (exp.invoiceNumber || exp.numero || ''),
            compte: fournCompte,
            libelle: 'Paiement ' + (exp.supplier || 'fournisseur'),
            debit: toMontant(exp.paidAmount),
            credit: 0,
          });
        }
      }
    }
  } catch {}

  // 4. Transactions bancaires
  try {
    const companies = JSON.parse(localStorage.getItem('smart_comptable_companies') || '{}');
    const data = companies[companyId];
    if (data?.transactions) {
      for (const tx of data.transactions) {
        if (!tx.tiersCompte && !tx.compteTiers) continue;
        const compte = tx.tiersCompte || tx.compteTiers || '';
        if (!COMPTES_TIERS_RE.test(compte)) continue;
        entries.push({
          journal: tx.journal || tx.type || 'BQ',
          date: (tx.date || tx.createdAt || '').slice(0, 10),
          piece: tx.reference || tx.ref || tx.numero || '',
          compte,
          libelle: tx.description || tx.libelle || tx.label || 'Opération bancaire',
          debit: tx.type === 'depense' || tx.type === 'debit' ? toMontant(tx.montant || tx.amount || 0) : 0,
          credit: tx.type === 'revenu' || tx.type === 'credit' ? toMontant(tx.montant || tx.amount || 0) : 0,
        });
      }
    }
  } catch {}

  // 5. Pièces comptables
  try {
    const pcKey = companyId ? `piecesComptables_${companyId}` : 'piecesComptables';
    const pieces = JSON.parse(localStorage.getItem(pcKey) || '[]');
    for (const p of pieces) {
      const lignes = p.entries || p.lignes || (Array.isArray(p) ? p : [p]);
      for (const l of lignes) {
        const compte = (l.compte || l.account || '').toString().trim();
        if (!compte || !COMPTES_TIERS_RE.test(compte)) continue;
        entries.push({
          journal: l.journal || p.journal || 'PC',
          date: (l.date || p.date || '').slice(0, 10),
          piece: l.piece || p.piece || p.id || '',
          compte,
          libelle: l.libelle || l.label || p.description || '',
          debit: toMontant(l.debit || l.montant_debit || 0),
          credit: toMontant(l.credit || l.montant_credit || 0),
        });
      }
    }
  } catch {}

  if (entries.length === 0) return 0;

  const r = addEcritures(entries);
  imported[companyId] = version + 1;
  localStorage.setItem(IMPORTED_KEY, JSON.stringify(imported));
  return r.ajoutés;
}
