import React, { useState, useEffect } from 'react';
import { Users, Download, Upload, FileText, AlertTriangle, CheckCircle, X, Search, Lock, Unlock, Trash2, Plus, RefreshCw, Copy, Check, Mail } from 'lucide-react';
import { getAllUsers, updateUser, createInvitation } from '../utils/auth/userStore';
import { ROLES } from '../utils/auth/permissionEngine';
import { getPlan } from '../utils/auth/plansManager';
import { getAuditLog, exportAuditCSV, getAllAuditKeys } from '../utils/security/auditLog';
import { getConfig, setConfig, lockApp } from '../utils/security/pinManager';
import { exportBackup, importBackup, getLastBackupDate, isBackupOverdue, setLastBackupDate } from '../utils/security/backupManager';
import { logAction } from '../utils/security/auditLog';
import { migrateLocalToSupabase, isMigrated } from '../utils/migrationTool';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmModal';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-TN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export default function AdminDashboardView({ currentUser }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState('users');
  const [users, setUsersState] = useState([]);
  const [auditLog, setAuditLogs] = useState([]);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'comptable' });
  const [inviteResult, setInviteResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [searchLog, setSearchLog] = useState('');
  const [importFile, setImportFile] = useState(null);
  const [importPwd, setImportPwd] = useState('');
  const [exportPwd, setExportPwd] = useState('');
  const [importPreview, setImportPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [migrateStatus, setMigrateStatus] = useState(null);
  const [migrateResult, setMigrateResult] = useState(null);

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

  const handleInvite = async () => {
    if (!inviteForm.email.trim() || !inviteForm.email.includes('@')) { toast.error('Email invalide'); return; }
    const societe = currentUser?.societeId;
    if (!societe) { toast.error('Aucune société associée'); return; }
    const inv = createInvitation({ email: inviteForm.email, role: inviteForm.role, societeId: societe, createdBy: currentUser.id });
    setInviteResult(inv);
    logAction('invite_sent', { email: inviteForm.email, role: inviteForm.role, code: inv.code });
    try {
      const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: 'Smart-Comptable',
          template_id: 'template_7k7ebdv',
          user_id: 'NhgDOZdl-hiwqNXX9',
          template_params: {
            to_email: inviteForm.email,
            to_name: '',
            otp: inv.code,
            code: inv.code,
            otp_code: inv.code,
            message: `Vous avez ete invite a rejoindre Smart Comptable.\n\nVotre code d'invitation : ${inv.code}\n\nRole : ${inviteForm.role}\nLien : ${window.location.origin}${window.location.pathname.replace(/\/+$/, '')}/\n\nCe code expire le ${inv.expiresAt}.`,
          },
        }),
      });
      if (!res.ok) {
        toast.success(`Code généré : ${inv.code} (email non envoyé)`);
      } else {
        toast.success(`Code envoyé par email à ${inviteForm.email}`);
      }
    } catch {
      toast.success(`Code d'invitation : ${inv.code}`);
    }
  };

  const handleChangeRole = (userId, newRole) => {
    updateUser(userId, { role: newRole });
    toast.success('Rôle mis à jour');
    loadUsers();
    logAction('user_role_changed', { userId, newRole });
  };

  const handleToggleActive = async (user) => {
    const action = user.actif ? 'Désactiver' : 'Réactiver';
    const ok = await confirm({
      title: `${action} l'utilisateur`,
      message: `Voulez-vous vraiment ${action.toLowerCase()} cet utilisateur ?`,
      confirmLabel: action,
      cancelLabel: 'Annuler',
      type: user.actif ? 'danger' : 'info'
    });
    if (!ok) return;
    updateUser(user.id, { actif: !user.actif });
    toast.success(`Utilisateur ${user.actif ? 'désactivé' : 'réactivé'}`);
    loadUsers();
    logAction('user_toggled', { userId: user.id, actif: !user.actif });
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportBackup(exportPwd);
      setLastBackupDate();
      toast.success('Backup exporté');
      logAction('backup_export', {});
    } catch (e) { toast.error(e.message); }
    setExporting(false);
  };

  const handleImport = async () => {
    if (!importFile) { toast.error('Sélectionnez un fichier'); return; }
    setImporting(true);
    try {
      const backup = await importBackup(importFile, importPwd);
      setImportPreview(backup);
      toast.success(`Backup chargé : ${Object.keys(backup.data).length} entrées`);
    } catch (e) { toast.error(e.message); }
    setImporting(false);
  };

  const handleRestore = async () => {
    if (!importPreview) return;
    const ok = await confirm({
      title: 'Restaurer le backup',
      message: 'Voulez-vous vraiment remplacer toutes les données existantes par celles du backup ? Cette action est irréversible.',
      confirmLabel: 'Restaurer',
      cancelLabel: 'Annuler',
      type: 'danger'
    });
    if (!ok) return;
    for (const [key, value] of Object.entries(importPreview.data)) {
      localStorage.setItem(key, value);
    }
    setLastBackupDate();
    toast.success('Données restaurées avec succès');
    logAction('backup_restore', { keys: Object.keys(importPreview.data).length });
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
    { id: 'cloud', label: 'Cloud', icon: Upload },
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

      {/* USERS */}
      {tab === 'users' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-300">Gestion des utilisateurs ({users.filter(u => u.actif).length} actifs)</h4>
            <button onClick={() => { setShowInviteForm(true); setInviteResult(null); setInviteForm({ email: '', role: 'comptable' }); }}
              className="flex items-center gap-1 px-3 py-1.5 bg-brand-500/20 hover:bg-brand-500/30 text-brand-400 text-xs font-bold rounded-xl border border-brand-500/30 transition-all">
              <Plus className="w-3 h-3" /> Inviter
            </button>
          </div>
          {showInviteForm && (
            <div className="glass-card p-4 rounded-xl border border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-bold text-slate-300">Inviter un membre</h5>
                <button onClick={() => { setShowInviteForm(false); setInviteResult(null); }} className="text-slate-500 hover:text-slate-300"><X className="w-3.5 h-3.5" /></button>
              </div>
              <input value={inviteForm.email} onChange={e => setInviteForm(p => ({ ...p, email: e.target.value }))}
                placeholder="Email du membre" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500" />
              <select value={inviteForm.role} onChange={e => setInviteForm(p => ({ ...p, role: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500">
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <button onClick={handleInvite}
                className="px-4 py-2 bg-brand-500/20 text-brand-400 text-xs font-bold rounded-xl border border-brand-500/30 hover:bg-brand-500/30 transition-all">
                Générer le code
              </button>
              {inviteResult && (
                <div className="p-3 rounded-xl bg-brand-500/10 border border-brand-500/30">
                  <p className="text-[10px] text-slate-400 mb-1">Code d'invitation (7 jours):</p>
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-bold text-brand-400 tracking-widest">{inviteResult.code}</code>
                    <button onClick={() => { navigator.clipboard.writeText(inviteResult.code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                      className="p-1 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-200">
                      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">Rôle: {inviteResult.role} · Valable jusqu'au {inviteResult.expiresAt}</p>
                </div>
              )}
            </div>
          )}
          <div className="space-y-1.5">
            {users.map(u => {
              const plan = getPlan(u.plan);
              const PLAN_COLORS = { gray: 'bg-slate-600', blue: 'bg-blue-600', violet: 'bg-violet-600', gold: 'bg-amber-500' };
              const ROLE_COLORS = { admin: 'text-violet-400', comptable: 'text-blue-400', lecteur: 'text-slate-400' };
              return (
              <div key={u.id} className={`flex items-center justify-between p-3 rounded-xl border ${u.actif ? 'bg-slate-800/30 border-slate-700/40' : 'bg-slate-800/10 border-slate-700/20 opacity-50'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center text-xs font-bold text-brand-400">
                    {(u.nom?.[0] || '?')}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-200">
                      {u.nom || u.email}
                      {!u.actif && <span className="text-red-400 ml-1">(inactif)</span>}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500">
                      <span className={ROLE_COLORS[u.role] || 'text-slate-400'}>{u.role}</span>
                      <span className="text-slate-600">·</span>
                      <span className={`text-[10px] ${PLAN_COLORS[plan.color] || 'bg-slate-600'} text-white px-1.5 py-0.5 rounded-md`}>{plan.label}</span>
                      {u.lastLogin && <><span className="text-slate-600">·</span><span>Dernière: {fmtDate(u.lastLogin)}</span></>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {u.actif && (
                    <select value={u.role} onChange={e => handleChangeRole(u.id, e.target.value)}
                      className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-[10px] text-slate-200 focus:outline-none focus:border-brand-500">
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  )}
                  <button onClick={() => handleToggleActive(u)}
                    className={`p-1.5 rounded-lg transition-all ${u.actif ? 'hover:bg-red-500/10 text-slate-400 hover:text-red-400' : 'hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-400'}`}>
                    {u.actif ? <Trash2 className="w-3.5 h-3.5" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )})}
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
              <select value={config.timeout_ms} onChange={e => { setConfig({ timeout_ms: parseInt(e.target.value) }); toast.success('Configuration mise à jour'); }}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500">
                <option value={5 * 60 * 1000}>5 minutes</option>
                <option value={10 * 60 * 1000}>10 minutes</option>
                <option value={15 * 60 * 1000}>15 minutes</option>
                <option value={30 * 60 * 1000}>30 minutes</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { lockApp(); toast.success('Application verrouillée'); }}
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

      {/* CLOUD */}
      {tab === 'cloud' && (
        <div className="space-y-4">
          <div className="glass-card p-4 rounded-xl border border-slate-700 space-y-3">
            <h4 className="text-xs font-bold text-slate-300">Synchronisation Cloud Supabase</h4>
            <p className="text-[10px] text-slate-400">
              Migrez vos données locales vers Supabase pour un accès multi-appareil.
              Les données restent disponibles en local (offline) et se synchronisent automatiquement.
            </p>
            {(() => {
              const companyId = currentUser?.societeId;
              if (!companyId) return <p className="text-[10px] text-amber-400">Aucune société sélectionnée</p>;
              const migrated = isMigrated(companyId);
              return (
                <div className="space-y-3">
                  {migrated ? (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs text-emerald-400">Données migrées vers Supabase</span>
                    </div>
                  ) : (
                    <button onClick={async () => {
                      setMigrateStatus('loading');
                      const result = await migrateLocalToSupabase(companyId);
                      setMigrateResult(result);
                      setMigrateStatus(result.errors.length === 0 ? 'success' : 'error');
                      if (result.errors.length === 0) {
                        logAction('migrate_cloud', { details: `Migration Supabase: ${result.journal} écritures, ${result.employees} employés` });
                      }
                    }} disabled={migrateStatus === 'loading'}
                      className="flex items-center gap-2 px-4 py-2 bg-brand-500/20 hover:bg-brand-500/30 text-brand-400 text-xs font-bold rounded-xl border border-brand-500/30 transition-all disabled:opacity-50">
                      {migrateStatus === 'loading' ? (
                        <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Migration en cours...</>
                      ) : (
                        <><Upload className="w-3.5 h-3.5" /> Migrer vers le cloud</>
                      )}
                    </button>
                  )}
                  {migrateStatus === 'success' && (
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                      <p className="text-xs font-bold text-emerald-400">Migration réussie</p>
                      {migrateResult?.journal > 0 && <p className="text-[10px] text-slate-300">{migrateResult.journal} écritures journal migrées</p>}
                      {migrateResult?.employees > 0 && <p className="text-[10px] text-slate-300">{migrateResult.employees} employés migrés</p>}
                    </div>
                  )}
                  {migrateStatus === 'error' && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                      <p className="text-xs font-bold text-red-400">Erreurs</p>
                      {migrateResult?.errors.map((err, i) => <p key={i} className="text-[10px] text-red-300">{err}</p>)}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
