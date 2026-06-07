import { logAction, AUDIT_ACTIONS } from './auditLog';

export const BACKUP_VERSION = '1.0';

const BACKUP_KEYS = [
  'smart_companies', 'smart_users',
];

function getCompanyKeys(companyId) {
  return [
    `smart_journal_${companyId}`,
    `smart_employes_${companyId}`,
    `smart_bulletins_${companyId}`,
    `smart_invoices_${companyId}`,
    `smart_expenses_${companyId}`,
    `smart_audit_${companyId}`,
  ];
}

function getAllCompanyIds() {
  const ids = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('smart_journal_')) {
      const id = k.replace('smart_journal_', '');
      if (!ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}

export async function exportBackup(password = '', companyIds = 'all') {
  const ids = companyIds === 'all' ? getAllCompanyIds() : companyIds;
  if (!ids.length && companyIds === 'all') ids.push('default');

  const collected = {};
  for (const k of BACKUP_KEYS) {
    try {
      const raw = localStorage.getItem(k);
      if (raw) collected[k] = raw;
    } catch { }
  }
  for (const id of ids) {
    for (const k of getCompanyKeys(id)) {
      try {
        const raw = localStorage.getItem(k);
        if (raw) collected[k] = raw;
      } catch { }
    }
  }

  const backup = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    companies: ids,
    data: collected,
  };

  let output = JSON.stringify(backup, null, 2);
  if (password) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
    const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: new TextEncoder().encode('scbackup_v1'), iterations: 50000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );
    const encoded = new TextEncoder().encode(JSON.stringify(backup));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), iv.length);
    output = JSON.stringify({ encrypted: true, version: BACKUP_VERSION, exportedAt: backup.exportedAt, data: btoa(String.fromCharCode(...combined)), hash: hash.slice(0, 16) });
  }

  const blob = new Blob([output], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `smart_comptable_backup_${new Date().toISOString().slice(0, 10)}.scbak`;
  a.click();
  URL.revokeObjectURL(url);

  logAction(AUDIT_ACTIONS.BACKUP_EXPORT, { companies: ids, encrypted: !!password });
  return true;
}

export async function importBackup(file, password = '') {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        let backup = JSON.parse(e.target.result);
        if (backup.encrypted) {
          if (!password) { reject(new Error('Mot de passe requis')); return; }
          const combined = Uint8Array.from(atob(backup.data), c => c.charCodeAt(0));
          const iv = combined.slice(0, 12);
          const ciphertext = combined.slice(12);
          const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
          const key = await crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt: new TextEncoder().encode('scbackup_v1'), iterations: 50000, hash: 'SHA-256' },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['decrypt']
          );
          const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
          backup = JSON.parse(new TextDecoder().decode(decrypted));
        }
        if (backup.version !== BACKUP_VERSION) { reject(new Error('Version incompatible')); return; }
        logAction(AUDIT_ACTIONS.BACKUP_IMPORT, { companies: backup.companies, entriesCount: Object.keys(backup.data).length });
        resolve(backup);
      } catch (err) { reject(new Error('Fichier corrompu ou mot de passe incorrect')); }
    };
    reader.onerror = () => reject(new Error('Erreur de lecture'));
    reader.readAsText(file);
  });
}

export function getLastBackupDate() {
  return localStorage.getItem('smart_last_backup');
}

export function setLastBackupDate() {
  localStorage.setItem('smart_last_backup', new Date().toISOString());
}

export function isBackupOverdue(days = 7) {
  const last = getLastBackupDate();
  if (!last) return true;
  const diff = Date.now() - new Date(last).getTime();
  return diff > days * 24 * 60 * 60 * 1000;
}

export function scheduleAutoBackup(intervalDays = 7) {
  const last = getLastBackupDate();
  if (!last) return { overdue: true, message: 'Aucune sauvegarde effectuée' };
  const diff = Date.now() - new Date(last).getTime();
  const daysSince = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (daysSince >= intervalDays) {
    return { overdue: true, message: `Dernière sauvegarde il y a ${daysSince} jour(s) — veuillez exporter une backup` };
  }
  return { overdue: false, message: `Dernière sauvegarde il y a ${daysSince} jour(s)` };
}
