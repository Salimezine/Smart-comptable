const STORAGE_KEY = 'smart_submission_audit';
const MAX_ENTRIES = 2000;

let idCounter = Date.now();

export const SUBMISSION_ACTIONS = {
  SEND: 'send',
  POLL: 'poll',
  ACCEPT: 'accept',
  REJECT: 'reject',
  CONFIRM: 'confirm',
  CALLBACK: 'callback',
  ERROR: 'error',
  GENERATE: 'generate',
};

export function logSubmission({ invoiceNumber, action, status, mode = 'dev', details = '', companyId = '' }) {
  try {
    const log = loadLog();
    const entry = {
      id: ++idCounter,
      timestamp: new Date().toISOString(),
      invoiceNumber,
      action,
      status,
      mode,
      details,
      companyId,
    };
    log.unshift(entry);
    if (log.length > MAX_ENTRIES) log.length = MAX_ENTRIES;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
    return entry;
  } catch { return null; }
}

export function getSubmissionLog({ companyId, limit = 500, offset = 0, status, mode, action } = {}) {
  try {
    let log = loadLog();
    if (companyId) log = log.filter(e => e.companyId === companyId);
    if (status) log = log.filter(e => e.status === status);
    if (mode) log = log.filter(e => e.mode === mode);
    if (action) log = log.filter(e => e.action === action);
    return log.slice(offset, offset + limit);
  } catch { return []; }
}

export function getSubmissionStats({ companyId } = {}) {
  const log = getSubmissionLog({ companyId, limit: MAX_ENTRIES });
  const stats = {
    total: log.length,
    accepted: 0,
    rejected: 0,
    pending: 0,
    errors: 0,
    byMode: { dev: 0, prod: 0, middleware: 0 },
    byAction: {},
  };
  for (const entry of log) {
    if (entry.status === 'accepted') stats.accepted++;
    else if (entry.status === 'rejected') stats.rejected++;
    else if (entry.status === 'pending' || entry.status === 'transmitted') stats.pending++;
    if (entry.action === 'error' || entry.status === 'error') stats.errors++;
    if (entry.mode && stats.byMode[entry.mode] !== undefined) stats.byMode[entry.mode]++;
    stats.byAction[entry.action] = (stats.byAction[entry.action] || 0) + 1;
  }
  return stats;
}

export function exportSubmissionCSV({ companyId } = {}) {
  const log = getSubmissionLog({ companyId, limit: MAX_ENTRIES });
  const header = 'ID,Date,Facture,Action,Statut,Mode,Détails';
  const rows = log.map(e =>
    `${e.id},${e.timestamp},${e.invoiceNumber},${e.action},${e.status},${e.mode},"${(e.details || '').replace(/"/g, '""')}"`
  );
  return header + '\n' + rows.join('\n');
}

export function clearSubmissionLog() {
  localStorage.removeItem(STORAGE_KEY);
}

function loadLog() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}
