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

function syncEmployeesToSupabase(companyId) {
  if (!isSupabaseEnabled() || !navigator.onLine || !companyId) return;
  const employes = getEmployes();
  supabase.from('employees').upsert(
    employes.map(e => ({ ...e, company_id: companyId })),
    { onConflict: 'id' }
  ).catch(() => {});
}

export function saveEmploye(employe) {
  try {
    const employes = getEmployes();
    if (!employe.id) {
      employe.id = 'EMP-' + String(Date.now()).slice(-6) + String(Math.random()).slice(2, 6);
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
      if (companyId) supabase.from('payroll_slips').upsert({ ...bulletin, company_id: companyId }, { onConflict: 'id' }).catch(() => {});
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
