import { PCG_COMPLET } from './pcgComplet';

const TIERS_KEY = 'smart_tiers_codes';
const CUSTOM_PCG_KEY = 'smart_custom_pcg';

function getCompanyId() {
  try {
    return localStorage.getItem('smart_comptable_current_id') || 'default';
  } catch {
    return 'default';
  }
}

function storageKey() {
  return `${TIERS_KEY}_${getCompanyId()}`;
}

function customPcgKey() {
  return `${CUSTOM_PCG_KEY}_${getCompanyId()}`;
}

export function loadCustomAccounts() {
  try {
    return JSON.parse(localStorage.getItem(customPcgKey()) || '[]');
  } catch {
    return [];
  }
}

export function saveCustomAccounts(list) {
  localStorage.setItem(customPcgKey(), JSON.stringify(list));
}

export function addCustomAccount(account) {
  const list = loadCustomAccounts();
  if (!account.code || !account.label) return false;
  if (PCG_COMPLET[account.code]) return false;
  if (list.find(a => a.code === account.code)) return false;
  list.push({ code: account.code, label: account.label });
  saveCustomAccounts(list);
  return true;
}

export function updateCustomAccount(code, updates) {
  const list = loadCustomAccounts();
  const idx = list.findIndex(a => a.code === code);
  if (idx === -1) return false;
  list[idx] = { ...list[idx], ...updates };
  saveCustomAccounts(list);
  return true;
}

export function removeCustomAccount(code) {
  const list = loadCustomAccounts();
  const idx = list.findIndex(a => a.code === code);
  if (idx === -1) return false;
  list.splice(idx, 1);
  saveCustomAccounts(list);
  return true;
}

export function loadTiers() {
  try {
    return JSON.parse(localStorage.getItem(storageKey()) || '[]');
  } catch {
    return [];
  }
}

export function saveTiers(list) {
  localStorage.setItem(storageKey(), JSON.stringify(list));
}

export function addTier(tier) {
  const list = loadTiers();
  if (!tier.code || !tier.nom) return false;
  if (list.find(t => t.code === tier.code)) return false;
  list.push({
    code: tier.code,
    type: tier.type || 'fournisseur',
    nom: tier.nom,
    mf: tier.mf || '',
    categorie: tier.categorie || '',
    tva: tier.tva != null ? tier.tva : 19,
    timbre: tier.timbre != null ? tier.timbre : 1,
    rs_applicable: tier.rs_applicable || false,
    comptes_defaut: {
      charge: '',
      tiers: '',
      tva: '43666',
      ...tier.comptes_defaut,
    },
    actif: true,
  });
  saveTiers(list);
  return true;
}

export function updateTier(code, updates) {
  const list = loadTiers();
  const idx = list.findIndex(t => t.code === code);
  if (idx === -1) return false;
  list[idx] = { ...list[idx], ...updates };
  saveTiers(list);
  return true;
}

export function removeTier(code) {
  const list = loadTiers();
  const idx = list.findIndex(t => t.code === code);
  if (idx === -1) return false;
  list.splice(idx, 1);
  saveTiers(list);
  return true;
}

export function findTierByNom(nom) {
  if (!nom) return null;
  const list = loadTiers();
  const lower = nom.toLowerCase().trim();
  return list.find(t => t.nom.toLowerCase() === lower && t.actif) || null;
}

export function findTierByCode(code) {
  if (!code) return null;
  return loadTiers().find(t => t.code === code && t.actif) || null;
}

export function findTiersByType(type) {
  return loadTiers().filter(t => t.type === type && t.actif);
}

export function searchTiers(query) {
  if (!query) return loadTiers();
  const q = query.toLowerCase();
  return loadTiers().filter(t =>
    (t.actif && (t.code.toLowerCase().includes(q) || t.nom.toLowerCase().includes(q) || t.mf.toLowerCase().includes(q)))
  );
}

export function getDefaultAccounts(nom) {
  const tier = findTierByNom(nom);
  if (tier) return tier.comptes_defaut;
  return null;
}

export function autoSuggestCode(type) {
  const prefix = type === 'fournisseur' ? 'F' : type === 'client' ? 'C' : 'B';
  const list = loadTiers().filter(t => t.type === type);
  let max = 0;
  for (const t of list) {
    const num = parseInt(t.code.replace(prefix, ''), 10);
    if (!isNaN(num) && num > max) max = num;
  }
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

export function addTierAuto(nom, type, extra) {
  const code = autoSuggestCode(type);
  return addTier({ code, nom, type, ...extra });
}

export function autoSuggestCompte(prefix, minLen = 6) {
  const used = new Set(Object.keys(PCG_COMPLET));
  for (const t of loadTiers()) {
    if (t.comptes_defaut?.tiers) used.add(t.comptes_defaut.tiers);
    if (t.comptes_defaut?.charge) used.add(t.comptes_defaut.charge);
    if (t.comptes_defaut?.tva) used.add(t.comptes_defaut.tva);
  }
  let max = 0;
  for (const code of used) {
    if (code.startsWith(prefix) && code.length >= minLen) {
      const num = parseInt(code.slice(prefix.length), 10);
      if (!isNaN(num) && num > max) max = num;
    }
  }
  const next = `${prefix}${String(max + 1).padStart(minLen - prefix.length, '0')}`;
  return next;
}
