import * as XLSX from 'xlsx';

// ── Seed data ──
export const SEED_ECRITURES = [
  { id: "seed-1", journal: "VT", date: "2026-01-05", piece: "FAC001", compte: "411001", libelle: "Facture client ABC", debit: 1000, credit: 0, lettre: null, dateLettrage: null },
  { id: "seed-2", journal: "BQ", date: "2026-01-20", piece: "REG001", compte: "411001", libelle: "Règlement client ABC", debit: 0, credit: 1000, lettre: null, dateLettrage: null },
  { id: "seed-3", journal: "VT", date: "2026-02-10", piece: "FAC002", compte: "411001", libelle: "Facture client ABC n°2", debit: 1500, credit: 0, lettre: null, dateLettrage: null },
  { id: "seed-4", journal: "VT", date: "2026-01-08", piece: "FAC010", compte: "411002", libelle: "Facture client XYZ", debit: 800, credit: 0, lettre: null, dateLettrage: null },
  { id: "seed-5", journal: "BQ", date: "2026-01-25", piece: "REG010", compte: "411002", libelle: "Règlement partiel XYZ", debit: 0, credit: 500, lettre: null, dateLettrage: null },
  { id: "seed-6", journal: "AC", date: "2026-01-12", piece: "FF001", compte: "401001", libelle: "Facture fournisseur DEF", debit: 0, credit: 2000, lettre: null, dateLettrage: null },
  { id: "seed-7", journal: "BQ", date: "2026-01-30", piece: "REGF001", compte: "401001", libelle: "Paiement fournisseur DEF", debit: 2000, credit: 0, lettre: null, dateLettrage: null },
];

export const STORAGE_KEY = 'smart_comptable_ecritures';
const SEED_FLAG_KEY = 'smart_comptable_ecritures_seeded';

export function initSeedData() {
  if (localStorage.getItem(SEED_FLAG_KEY)) return false;
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing && JSON.parse(existing).length > 0) return false;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_ECRITURES));
  localStorage.setItem(SEED_FLAG_KEY, '1');
  return true;
}

// ── Génération lettre ──
export function genererProchaineLettre(compte, list) {
  const used = new Set(list.filter(e => e.compte === compte && e.lettre).map(e => e.lettre));
  for (let len = 1; len <= 3; len++) {
    for (let n = 0; n < 26 ** len; n++) {
      let s = '';
      for (let v = n, i = 0; i < len; i++) { s = String.fromCharCode(65 + (v % 26)) + s; v = Math.floor(v / 26); }
      if (!used.has(s)) return s;
    }
  }
  return 'ZZZ';
}

// ── Auto-lettrage (1-to-1 exact uniquement, pas d'ambiguïté) ──
export function calculerLettrageAuto(list, compte) {
  const nonLettrees = list.filter(e => e.compte === compte && !e.lettre);
  const debits = nonLettrees.filter(e => (e.debit || 0) > 0);
  const credits = nonLettrees.filter(e => (e.credit || 0) > 0);
  const paires = [];
  const usedD = new Set();
  const usedC = new Set();

  for (const d of debits) {
    if (usedD.has(d.id)) continue;
    const candidates = credits.filter(c => !usedC.has(c.id) && Math.abs(d.debit - c.credit) <= 0.001);
    if (candidates.length === 1) {
      paires.push({ ids: [d.id, candidates[0].id], debit: d, credit: candidates[0] });
      usedD.add(d.id);
      usedC.add(candidates[0].id);
    }
  }

  return {
    paires,
    restantes: debits.concat(credits).filter(e => !usedD.has(e.id) && !usedC.has(e.id)),
  };
}

// ── Validation import Excel ──
export function validerImportExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result);
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
        const resultats = [];
        let start = 0;
        for (let i = 0; i < Math.min(rows.length, 5); i++) {
          const r = rows[i];
          if (r && /journal/i.test(String(r[0] || ''))) { start = i + 1; break; }
        }
        for (let i = start; i < rows.length; i++) {
          const r = rows[i];
          if (!r || (r.slice(0, 7).every(c => !c || String(c).trim() === ''))) continue;
          const ligne = i + 1;
          const journal = String(r[0] || '').trim();
          const dateRaw = r[1];
          const piece = String(r[2] || '').trim();
          const compte = String(r[3] || '').trim();
          const libelle = String(r[4] || '').trim();
          const debit = parseFloat(r[5]) || 0;
          const credit = parseFloat(r[6]) || 0;
          const errors = [];
          if (!compte) errors.push('compte manquant');
          if (!dateRaw) errors.push('date invalide');
          if (debit === 0 && credit === 0) errors.push('ni débit ni crédit renseigné');
          if (debit > 0 && credit > 0) errors.push('impossible d\'avoir débit et crédit');
          let date = null;
          if (dateRaw) {
            date = parseDate(dateRaw);
            if (!date && errors.length === 0) errors.push('date invalide');
          }
          resultats.push({ ligne, journal, date, piece, compte, libelle, debit, credit, valid: errors.length === 0, errors, raw: r });
        }
        resolve(resultats);
      } catch (err) {
        reject(new Error('Erreur lecture fichier : ' + err.message));
      }
    };
    reader.onerror = () => reject(new Error('Impossible de lire le fichier'));
    reader.readAsArrayBuffer(file);
  });
}

function parseDate(v) {
  if (!v) return null;
  if (typeof v === 'number') {
    const d = new Date((v - 25569) * 86400 * 1000);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{2,4})[\-\/](\d{1,2})[\-\/](\d{1,2})$/);
  if (m) {
    let [_, y, m1, d1] = m;
    if (y.length === 2) y = '20' + y;
    return `${y}-${m1.padStart(2, '0')}-${d1.padStart(2, '0')}`;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}
