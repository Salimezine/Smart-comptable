import React, { useState, useEffect } from 'react';
import { Shield, Users, Key, Clock, Download, Upload, FileText, AlertTriangle, CheckCircle, X, Search, Lock, Unlock, Trash2, Plus, RefreshCw } from 'lucide-react';
import { getUsers, createUser, updateUser, deleteUser, getAllUsers } from '../utils/auth/userStore';
import { ROLE_PERMISSIONS, ROLES } from '../utils/auth/permissionEngine';
import { getAuditLog, exportAuditCSV, getAllAuditKeys } from '../utils/security/auditLog';
import { getConfig, setConfig, lockApp, isLocked } from '../utils/security/pinManager';
import { exportBackup, importBackup, getLastBackupDate, isBackupOverdue, setLastBackupDate } from '../utils/security/backupManager';
import { logAction, AUDIT_ACTIONS } from '../utils/security/auditLog';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-TN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export default function AdminDashboardView({ currentUser }) {
  const [tab, setTab] = useState('users');
  const [users, setUsersState] = useState([]);
  const [auditLog, setAuditLogs] = useState([]);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [showUserForm, setShowUserForm] = useState(false);
  const [userForm, setUserForm] = useState({ nom: '', prenom: '', email: '', role: 'comptable', pin: '', companies: [] });
  const [editingUserId, setEditingUserId] = useState(null);
  const [searchLog, setSearchLog] = useState('');
  const [importFile, setImportFile] = useState(null);
  const [importPwd, setImportPwd] = useState('');
  const [exportPwd, setExportPwd] = useState('');
  const [importPreview, setImportPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const config = getConfig();

  useEffect(() => {
    loadUsers();
    loadAudit();
  }, []);

  const loadUsers = () => setUsersState(getAllUsers());
  const loadAudit = () => {
    const keys = getAllAuditKeys();
    let all = [];
    for (const k of keys) {
      const id = k.replace('smart_audit_', '');
      all = all.concat(getAuditLog(id));
    }
    all.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    setAuditLogs(all);
  };

  const handleCreateUser = async () => {
    if (!userForm.nom || !userForm.prenom) { setMsg({ type: 'error', text: 'Nom et prénom requis' }); return; }
    const { hashPIN } = await import('../utils/security/pinManager');
    const pin_hash = userForm.pin ? await hashPIN(userForm.pin) : '';
    const data = { ...userForm, pin: pin_hash };
    if (editingUserId) {
      updateUser(editingUserId, data);
      setMsg({ type: 'success', text: 'Utilisateur modifié' });
    } else {
      const u = createUser(data);
      if (!u) { setMsg({ type: 'error', text: 'Email déjà utilisé' }); return; }
      setMsg({ type: 'success', text: 'Utilisateur créé' });
    }
    setShowUserForm(false);
    setUserForm({ nom: '', prenom: '', email: '', role: 'comptable', pin: '', companies: [] });
    setEditingUserId(null);
    loadUsers();
  };

  const handleEditUser = (u) => {
    setUserForm({ nom: u.nom, prenom: u.prenom, email: u.email, role: u.role, pin: '', companies: u.companies || [] });
    setEditingUserId(u.id);
    setShowUserForm(true);
  };

  const handleDeleteUser = (id) => {
    if (!window.confirm('Désactiver cet utilisateur ?')) return;
    deleteUser(id);
    setMsg({ type: 'success', text: 'Utilisateur désactivé' });
    loadUsers();
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportBackup(exportPwd);
      setLastBackupDate();
      setMsg({ type: 'success', text: 'Backup exporté' });
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
    setExporting(false);
  };

  const handleImport = async () => {
    if (!importFile) { setMsg({ type: 'error', text: 'Sélectionnez un fichier' }); return; }
    setImporting(true);
    try {
      const backup = await importBackup(importFile, importPwd);
      setImportPreview(backup);
      setMsg({ type: 'success', text: `Backup chargé : ${Object.keys(backup.data).length} entrées` });
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
    setImporting(false);
  };

  const handleRestore = () => {
    if (!importPreview) return;
    if (!window.confirm('Remplacer toutes les données existantes par celles du backup ? Cette action est irréversible.')) return;
    for (const [key, value] of Object.entries(importPreview.data)) {
      localStorage.setItem(key, value);
    }
    setLastBackupDate();
    setMsg({ type: 'success', text: 'Données restaurées avec succès' });
    setImportPreview(null);
    setImportFile(null);
    loadAudit();
    window.dispatchEvent(new CustomEvent('journal:updated'));
  };

  const exportCSV = () => {
    const filtered = auditLog.filter(e =>
      !searchLog || e.userName.toLowerCase().includes(searchLog.toLowerCase()) ||
      e.action.toLowerCase().includes(searchLog.toLowerCase()) ||
      e.details?.toString().toLowerCase().includes(searchLog.toLowerCase())
    );
    const csv = exportAuditCSV(filtered);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_log_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tabs = [
    { id: 'users', label: 'Utilisateurs', icon: Users },
    { id: 'security', label: 'Sécurité', icon: Lock },
    { id: 'audit', label: 'Audit Log', icon: FileText },
    { id: 'backup', label: 'Backup', icon: Download },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${tab === t.id ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30' : 'text-slate-400 hover:text-slate-200 border border-transparent'}`}>
              <Icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {msg.text && (
        <div className={`flex items-center gap-2 p-3 rounded-xl text-xs ${msg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
          {msg.type === 'success' ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
          {msg.text}
          <button onClick={() => setMsg({ type: '', text: '' })} className="ml-auto"><X className="w-3 h-3" /></button>
        </div>
      )}

      {/* USERS */}
      {tab === 'users' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-300">Gestion des utilisateurs</h4>
            <button onClick={() => { setShowUserForm(true); setEditingUserId(null); setUserForm({ nom: '', prenom: '', email: '', role: 'comptable', pin: '', companies: [] }); }}
              className="flex items-center gap-1 px-3 py-1.5 bg-brand-500/20 hover:bg-brand-500/30 text-brand-400 text-xs font-bold rounded-xl border border-brand-500/30 transition-all">
              <Plus className="w-3 h-3" /> Ajouter
            </button>
          </div>
          {showUserForm && (
            <div className="glass-card p-4 rounded-xl border border-slate-700 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input value={userForm.prenom} onChange={e => setUserForm(p => ({ ...p, prenom: e.target.value }))}
                  placeholder="Prénom" className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500" />
                <input value={userForm.nom} onChange={e => setUserForm(p => ({ ...p, nom: e.target.value }))}
                  placeholder="Nom" className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500" />
              </div>
              <input value={userForm.email} onChange={e => setUserForm(p => ({ ...p, email: e.target.value }))}
                placeholder="Email" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500" />
              <div className="grid grid-cols-2 gap-3">
                <select value={userForm.role} onChange={e => setUserForm(p => ({ ...p, role: e.target.value }))}
                  className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500">
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <input value={userForm.pin} onChange={e => setUserForm(p => ({ ...p, pin: e.target.value }))}
                  type="password" placeholder="PIN (4-6 chiffres)" maxLength={6}
                  className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500" />
              </div>
              <div className="flex gap-2">
                <button onClick={handleCreateUser}
                  className="px-4 py-2 bg-brand-500/20 text-brand-400 text-xs font-bold rounded-xl border border-brand-500/30 transition-all">
                  {editingUserId ? 'Modifier' : 'Créer'}
                </button>
                <button onClick={() => setShowUserForm(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200">Annuler</button>
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            {users.map(u => (
              <div key={u.id} className={`flex items-center justify-between p-3 rounded-xl border ${u.active ? 'bg-slate-800/30 border-slate-700/40' : 'bg-slate-800/10 border-slate-700/20 opacity-50'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center text-xs font-bold text-brand-400">
                    {(u.prenom?.[0] || '') + (u.nom?.[0] || '')}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-200">{u.prenom} {u.nom} {!u.active && <span className="text-red-400">(inactif)</span>}</p>
                    <p className="text-[10px] text-slate-400">
                      <span className="capitalize">{u.role}</span>
                      {u.last_login && <> · Dernière connexion: {fmtDate(u.last_login)}</>}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  {u.active && (
                    <button onClick={() => handleEditUser(u)}
                      className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-slate-200">
                      <Key className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {u.active && (
                    <button onClick={() => handleDeleteUser(u.id)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {!u.active && (
                    <button onClick={() => { updateUser(u.id, { active: true }); loadUsers(); }}
                      className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-400">
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECURITY */}
      {tab === 'security' && (
        <div className="space-y-4">
          <div className="glass-card p-4 rounded-xl border border-slate-700 space-y-4">
            <h4 className="text-xs font-bold text-slate-300">Configuration de sécurité</h4>
            <div>
              <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Timeout inactivité</label>
              <select value={config.timeout_ms} onChange={e => { setConfig({ timeout_ms: parseInt(e.target.value) }); setMsg({ type: 'success', text: 'Configuration mise à jour' }); }}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500">
                <option value={5 * 60 * 1000}>5 minutes</option>
                <option value={10 * 60 * 1000}>10 minutes</option>
                <option value={15 * 60 * 1000}>15 minutes</option>
                <option value={30 * 60 * 1000}>30 minutes</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { lockApp(); setMsg({ type: 'success', text: 'Application verrouillée' }); }}
                className="flex items-center gap-1 px-3 py-2 bg-amber-500/20 text-amber-400 text-xs font-bold rounded-xl border border-amber-500/30 hover:bg-amber-500/30 transition-all">
                <Lock className="w-3.5 h-3.5" /> Verrouiller maintenant
              </button>
            </div>
          </div>
          <div className="glass-card p-4 rounded-xl border border-slate-700">
            <h4 className="text-xs font-bold text-slate-300 mb-2">Dernières connexions</h4>
            <div className="space-y-1">
              {auditLog.filter(e => e.action === 'login' || e.action === 'login_failed').slice(0, 20).map(e => (
                <div key={e.id} className="flex items-center justify-between text-[10px] py-1 border-b border-slate-800 last:border-0">
                  <div className="flex items-center gap-2">
                    {e.action === 'login' ? <Unlock className="w-3 h-3 text-emerald-400" /> : <Lock className="w-3 h-3 text-red-400" />}
                    <span className="text-slate-300">{e.userName}</span>
                    <span className="text-slate-500">{e.action === 'login' ? 'Connexion' : 'Échec'}</span>
                  </div>
                  <span className="text-slate-500">{fmtDate(e.timestamp)}</span>
                </div>
              ))}
              {auditLog.filter(e => e.action === 'login' || e.action === 'login_failed').length === 0 && (
                <p className="text-[10px] text-slate-500">Aucune connexion enregistrée</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AUDIT LOG */}
      {tab === 'audit' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={searchLog} onChange={e => setSearchLog(e.target.value)}
                placeholder="Rechercher dans l'audit..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500" />
            </div>
            <button onClick={exportCSV}
              className="flex items-center gap-1 px-3 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 text-xs font-bold rounded-xl border border-indigo-500/30 transition-all">
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button onClick={loadAudit}
              className="flex items-center gap-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-bold rounded-xl border border-slate-700 transition-all">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto space-y-0.5">
            {auditLog.filter(e => !searchLog || JSON.stringify(e).toLowerCase().includes(searchLog.toLowerCase())).slice(0, 200).map(e => (
              <div key={e.id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-slate-800/40 text-[10px]">
                <span className="text-slate-500 w-20 shrink-0">{new Date(e.timestamp).toLocaleTimeString('fr-TN', { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="text-slate-400 w-20 shrink-0">{e.userName}</span>
                <span className={`w-24 shrink-0 font-semibold ${e.action.startsWith('login') ? 'text-emerald-400' : e.action.includes('delete') || e.action.includes('failed') ? 'text-red-400' : 'text-brand-400'}`}>{e.action}</span>
                <span className="text-slate-500 truncate">{JSON.stringify(e.details)}</span>
              </div>
            ))}
            {auditLog.length === 0 && <p className="text-[10px] text-slate-500 text-center py-4">Aucune entrée d'audit</p>}
          </div>
        </div>
      )}

      {/* BACKUP */}
      {tab === 'backup' && (
        <div className="space-y-4">
          <div className="glass-card p-4 rounded-xl border border-slate-700 space-y-3">
            <h4 className="text-xs font-bold text-slate-300">Exporter une sauvegarde (.scbak)</h4>
            <p className="text-[10px] text-slate-400">Toutes les données : sociétés, écritures, paie, utilisateurs.</p>
            <input value={exportPwd} onChange={e => setExportPwd(e.target.value)}
              type="password" placeholder="Mot de passe de chiffrement (optionnel)"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500" />
            <button onClick={handleExport} disabled={exporting}
              className="flex items-center gap-1 px-4 py-2 bg-brand-500/20 hover:bg-brand-500/30 text-brand-400 text-xs font-bold rounded-xl border border-brand-500/30 transition-all disabled:opacity-50">
              <Download className="w-3.5 h-3.5" /> {exporting ? 'Exportation...' : 'Exporter'}
            </button>
            <div className="text-[10px] text-slate-500">
              Dernier backup : {getLastBackupDate() ? fmtDate(getLastBackupDate()) : 'Jamais'}
              {isBackupOverdue(7) && getLastBackupDate() && <span className="text-amber-400 ml-2">⚠️ Plus de 7 jours</span>}
            </div>
          </div>

          <div className="glass-card p-4 rounded-xl border border-slate-700 space-y-3">
            <h4 className="text-xs font-bold text-slate-300">Importer une sauvegarde</h4>
            <input type="file" accept=".scbak" onChange={e => { setImportFile(e.target.files[0]); setImportPreview(null); }}
              className="text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-brand-500/20 file:text-brand-400 hover:file:bg-brand-500/30" />
            <input value={importPwd} onChange={e => setImportPwd(e.target.value)}
              type="password" placeholder="Mot de passe (si chiffré)"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500" />
            <button onClick={handleImport} disabled={importing || !importFile}
              className="flex items-center gap-1 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-xs font-bold rounded-xl border border-amber-500/30 transition-all disabled:opacity-50">
              <Upload className="w-3.5 h-3.5" /> {importing ? 'Chargement...' : 'Analyser'}
            </button>
            {importPreview && (
              <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-700 space-y-2">
                <p className="text-xs font-bold text-slate-200">Aperçu</p>
                <p className="text-[10px] text-slate-400">Version: {importPreview.version} · {importPreview.companies?.length || 0} société(s) · {Object.keys(importPreview.data).length} entrées</p>
                <div className="text-[10px] text-slate-500 max-h-32 overflow-y-auto">
                  {Object.keys(importPreview.data).slice(0, 20).map(k => <div key={k}>{k} ({(importPreview.data[k]?.length || 0).toLocaleString()} octets)</div>)}
                  {Object.keys(importPreview.data).length > 20 && <div>...et {Object.keys(importPreview.data).length - 20} autres</div>}
                </div>
                <button onClick={handleRestore}
                  className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-bold rounded-xl border border-red-500/30 transition-all">
                  Restaurer (remplace toutes les données)
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
