export const AUDIT_ACTIONS = {
  LOGIN: 'login',
  LOGOUT: 'logout',
  LOGIN_FAILED: 'login_failed',
  APP_LOCKED: 'app_locked',
  APP_UNLOCKED: 'app_unlocked',
  JOURNAL_SAVE: 'journal_save',
  JOURNAL_EDIT: 'journal_edit',
  JOURNAL_DELETE: 'journal_delete',
  PAIE_VALIDATE: 'paie_validate',
  PAIE_SAVE: 'paie_save',
  BACKUP_EXPORT: 'backup_export',
  BACKUP_IMPORT: 'backup_import',
  USER_CREATE: 'user_create',
  USER_EDIT: 'user_edit',
  USER_DELETE: 'user_delete',
  COMPANY_SWITCH: 'company_switch',
  COMPANY_CREATE: 'company_create',
  SETTINGS_CHANGE: 'settings_change',
};

function getAuditKey(companyId) {
  return `smart_audit_${companyId || 'default'}`;
}

export function logAction(action, details = {}) {
  try {
    const { getCurrentUser } = require('./sessionManager');
    const { getUsers } = require('../auth/userStore');
    const currentUserId = getCurrentUser();
    const users = getUsers();
    const user = users.find(u => u.id === currentUserId);
    const companyId = details.companyId || 'default';
    const key = getAuditKey(companyId);
    let log = [];
    try {
      const raw = localStorage.getItem(key);
      if (raw) log = JSON.parse(raw);
    } catch { }
    if (!Array.isArray(log)) log = [];
    log.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      userId: currentUserId || 'system',
      userName: user ? `${user.prenom} ${user.nom}` : 'Système',
      companyId,
      action,
      details: JSON.parse(JSON.stringify(details)),
      ip: 'local',
    });
    // Keep last 1000 entries
    if (log.length > 1000) log = log.slice(0, 1000);
    localStorage.setItem(key, JSON.stringify(log));
  } catch { }
}

export function getAuditLog(companyId, filters = {}) {
  try {
    const key = getAuditKey(companyId || 'default');
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    let log = JSON.parse(raw);
    if (!Array.isArray(log)) return [];
    if (filters.userId) log = log.filter(e => e.userId === filters.userId);
    if (filters.action) log = log.filter(e => e.action === filters.action);
    if (filters.dateFrom) log = log.filter(e => new Date(e.timestamp) >= new Date(filters.dateFrom));
    if (filters.dateTo) log = log.filter(e => new Date(e.timestamp) <= new Date(filters.dateTo));
    return log;
  } catch { return []; }
}

export function exportAuditCSV(logs) {
  const header = 'Date,Utilisateur,Action,Société,Détails';
  const rows = logs.map(e => {
    const d = JSON.stringify(e.details || {}).replace(/"/g, '""');
    return `${e.timestamp},"${e.userName}","${e.action}","${e.companyId}","${d}"`;
  });
  return [header, ...rows].join('\n');
}

export function getAllAuditKeys() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('smart_audit_')) keys.push(k);
  }
  return keys;
}

export function exportAuditPDF(logs) {
  // Uses jsPDF if available, otherwise falls back to CSV download
  try {
    const { jsPDF } = require('jspdf');
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(10);
    doc.text('Audit Log — Smart Comptable', 14, 12);
    doc.setFontSize(7);
    const rows = logs.map((e, i) => [
      String(i + 1),
      new Date(e.timestamp).toLocaleDateString('fr-TN'),
      e.userName || '—',
      e.action || '—',
      e.companyId || '—',
      JSON.stringify(e.details || {}).slice(0, 80),
    ]);
    doc.autoTable({
      startY: 18,
      head: [['#', 'Date', 'Utilisateur', 'Action', 'Société', 'Détails']],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246], fontSize: 6 },
      styles: { fontSize: 6 },
      margin: { left: 8, right: 8 },
    });
    doc.save(`audit_log_${new Date().toISOString().slice(0, 10)}.pdf`);
    return true;
  } catch {
    // Fallback: CSV download
    const csv = exportAuditCSV(logs);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_log_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  }
}
