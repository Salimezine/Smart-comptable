/**
 * payrollStore.js — Persistance paie per-company
 */
import { logAction, AUDIT_ACTIONS } from './security/auditLog';
import { supabase, isSupabaseEnabled } from './supabaseClient';

function getCompanyId() {
  try {
    return localStorage.getItem('smart_comptable_current_id') || 'default';
  } catch {
    return 'default';
  }
}

function key(type) {
  return `smart_${type}_${getCompanyId()}`;
}

function employeeToDB(e, companyId) {
  return {
    id: e.id,
    company_id: companyId,
    nom: e.nom,
    prenom: e.prenom,
    cin: e.cin,
    matricule: e.matricule,
    poste: e.poste,
    salaire_base: parseFloat(e.salaireBase) || 0,
    nb_enfants: parseInt(e.nbEnfants) || 0,
    regime: e.regimeHoraire === 48 ? '48h' : '40h',
    situation_famille: e.chefFamille ? 'chef_famille' : e.conjointCharge ? 'marie' : 'celibataire',
  };
}

function dbToEmployee(e) {
  return {
    id: e.id,
    nom: e.nom,
    prenom: e.prenom,
    cin: e.cin,
    matricule: e.matricule,
    poste: e.poste,
    salaireBase: e.salaire_base ?? 0,
    regimeHoraire: e.regime === '48h' ? 48 : 40,
    chefFamille: e.situation_famille === 'chef_famille',
    conjointCharge: e.situation_famille === 'marie',
    nbEnfants: e.nb_enfants ?? 0,
  };
}

function fixEmployeeIds(employes) {
  let changed = false;
  const fixed = employes.map(e => {
    if (!e.id || !isUUID(e.id)) {
      changed = true;
      return { ...e, id: crypto.randomUUID() };
    }
    return e;
  });
  return { fixed, changed };
}

function syncEmployeesToSupabase(companyId) {
  if (!isSupabaseEnabled() || !navigator.onLine || !companyId) return;
  let employes = getEmployes();
  const { fixed, changed } = fixEmployeeIds(employes);
  if (changed) {
    localStorage.setItem(key('employes'), JSON.stringify(fixed));
  }
  const synced = fixed.map(e => employeeToDB(e, companyId));
  supabase.from('employees').upsert(synced, { onConflict: 'id' }).catch(() => {});
}

function isUUID(str) {
  return typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

function ensureUUID(record) {
  if (!record.id || !isUUID(record.id)) {
    return { ...record, id: crypto.randomUUID() };
  }
  return record;
}

export function saveEmploye(employe) {
  try {
    const employes = getEmployes();
    if (!employe.id) {
      employe.id = crypto.randomUUID();
    }
    const idx = employes.findIndex(e => e.id === employe.id);
    if (idx >= 0) employes[idx] = employe;
    else employes.push(employe);
    localStorage.setItem(key('employes'), JSON.stringify(employes));
    syncEmployeesToSupabase(localStorage.getItem('smart_comptable_current_id'));
    return employe;
  } catch { return null; }
}

export function getEmployes() {
  try {
    const raw = localStorage.getItem(key('employes'));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function deleteEmploye(id) {
  try {
    const employes = getEmployes().filter(e => e.id !== id);
    localStorage.setItem(key('employes'), JSON.stringify(employes));
    syncEmployeesToSupabase(localStorage.getItem('smart_comptable_current_id'));
    return true;
  } catch { return false; }
}

export function saveBulletin(bulletin) {
  try {
    const bulletins = getBulletins(bulletin.mois, bulletin.annee);
    const idx = bulletins.findIndex(b => b.employeId === bulletin.employeId && b.mois === bulletin.mois && b.annee === bulletin.annee);
    if (idx >= 0) bulletins[idx] = bulletin;
    else bulletins.push(bulletin);
    const allKey = key('bulletins');
    const all = getAllBulletins();
    const filtered = all.filter(b => !(b.mois === bulletin.mois && b.annee === bulletin.annee && b.employeId === bulletin.employeId));
    filtered.push(bulletin);
    localStorage.setItem(allKey, JSON.stringify(filtered));
    logAction(AUDIT_ACTIONS.PAIE_SAVE, { employeId: bulletin.employeId, nom: bulletin.nom, mois: bulletin.mois, annee: bulletin.annee, brut: bulletin.brut });
    // Sync to Supabase
    if (isSupabaseEnabled() && navigator.onLine) {
      const companyId = localStorage.getItem('smart_comptable_current_id');
      if (companyId) {
        const dbRecord = {
          id: bulletin.id || crypto.randomUUID(),
          company_id: companyId,
          employee_id: bulletin.employeId,
          nom: bulletin.nom,
          prenom: bulletin.prenom,
          mois: bulletin.mois,
          annee: bulletin.annee,
          salaire_base: parseFloat(bulletin.salaireBase) || 0,
          brut: parseFloat(bulletin.brut) || 0,
          cnss_sal: parseFloat(bulletin.cnssSal) || 0,
          cnss_pat: parseFloat(bulletin.cnssPat) || 0,
          irpp: parseFloat(bulletin.irppAnnuel) || 0,
          net_a_payer: parseFloat(bulletin.netAPayer) || 0,
          cout_employeur: parseFloat(bulletin.coutEmployeur) || 0,
        };
        supabase.from('payroll_slips').upsert(dbRecord, { onConflict: 'id' }).catch(() => {});
      }
    }
    return bulletin;
  } catch { return null; }
}

export function getBulletins(mois, annee) {
  return getAllBulletins().filter(b => b.mois === mois && b.annee === annee);
}

export function getAllBulletins() {
  try {
    const raw = localStorage.getItem(key('bulletins'));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
