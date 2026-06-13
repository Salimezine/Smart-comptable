const SAFE_KEY_PREFIX = 'sc_digital_safe_';

export function getDocuments(type = null, companyId = null) {
  const key = companyId ? `${SAFE_KEY_PREFIX}${companyId}` : `${SAFE_KEY_PREFIX}default`;
  const docs = JSON.parse(localStorage.getItem(key) || '[]');
  return type ? docs.filter(d => d.type === type) : docs;
}

export function addDocument(doc, companyId = null) {
  const key = companyId ? `${SAFE_KEY_PREFIX}${companyId}` : `${SAFE_KEY_PREFIX}default`;
  const docs = JSON.parse(localStorage.getItem(key) || '[]');
  const newDoc = {
    id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ...doc,
    uploadedAt: new Date().toISOString(),
    size: doc.size || 0,
    verified: false,
  };
  docs.push(newDoc);
  localStorage.setItem(key, JSON.stringify(docs));
  return newDoc;
}

export function deleteDocument(docId, companyId = null) {
  const key = companyId ? `${SAFE_KEY_PREFIX}${companyId}` : `${SAFE_KEY_PREFIX}default`;
  const docs = JSON.parse(localStorage.getItem(key) || '[]');
  const filtered = docs.filter(d => d.id !== docId);
  localStorage.setItem(key, JSON.stringify(filtered));
  return filtered;
}

export function getDocumentStats(companyId = null) {
  const docs = getDocuments(null, companyId);
  return {
    total: docs.length,
    totalSize: docs.reduce((s, d) => s + (d.size || 0), 0),
    byType: {
      invoice: docs.filter(d => d.type === 'invoice').length,
      contract: docs.filter(d => d.type === 'contract').length,
      declaration: docs.filter(d => d.type === 'declaration').length,
      report: docs.filter(d => d.type === 'report').length,
      other: docs.filter(d => !['invoice', 'contract', 'declaration', 'report'].includes(d.type)).length,
    },
    lastBackup: localStorage.getItem('sc_last_backup_date') || null,
  };
}

export function markBackupComplete() {
  localStorage.setItem('sc_last_backup_date', new Date().toISOString());
}

export function getSafeCategories() {
  return [
    { id: 'invoice', label: 'Factures', icon: '📄', color: 'text-blue-400' },
    { id: 'contract', label: 'Contrats', icon: '📋', color: 'text-emerald-400' },
    { id: 'declaration', label: 'Déclarations fiscales', icon: '📊', color: 'text-amber-400' },
    { id: 'report', label: 'Rapports financiers', icon: '📈', color: 'text-violet-400' },
    { id: 'payroll', label: 'Documents paie', icon: '👥', color: 'text-cyan-400' },
    { id: 'bank', label: 'Relevés bancaires', icon: '🏦', color: 'text-indigo-400' },
    { id: 'legal', label: 'Documents légaux', icon: '⚖️', color: 'text-rose-400' },
    { id: 'other', label: 'Autres documents', icon: '📁', color: 'text-slate-400' },
  ];
}
