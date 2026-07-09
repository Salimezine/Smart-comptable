import React, { useState, useEffect, useRef } from 'react';
import { Bell, X, AlertTriangle, FileText, Shield, Database, Check } from 'lucide-react';
import { isBackupOverdue, getLastBackupDate } from '../utils/security/backupManager';

function getNotifications({ invoices = [], expenses = [] }) {
  const notes = [];
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  // 1. Backup overdue
  const lastBackup = getLastBackupDate();
  if (!lastBackup || isBackupOverdue(7)) {
    notes.push({
      id: 'backup',
      type: 'warning',
      icon: Database,
      title: 'Sauvegarde en retard',
      message: lastBackup ? `Dernière sauvegarde : ${new Date(lastBackup).toLocaleDateString('fr-TN')}` : 'Aucune sauvegarde trouvée',
      action: 'admin',
      actionLabel: 'Sauvegarder',
      timestamp: new Date().toISOString(),
    });
  }

  // 2. Overdue invoices
  const overdueInvoices = invoices.filter(inv =>
    inv.status !== 'PAID' && inv.dueDate && new Date(inv.dueDate) < now
  );
  if (overdueInvoices.length > 0) {
    notes.push({
      id: 'overdue-invoices',
      type: 'danger',
      icon: FileText,
      title: `${overdueInvoices.length} facture${overdueInvoices.length > 1 ? 's' : ''} en retard`,
      message: `Total : ${overdueInvoices.reduce((s, i) => s + (i.totalAmount || 0), 0).toFixed(3)} DT impayé`,
      action: 'invoicing',
      actionLabel: 'Voir les factures',
      timestamp: new Date().toISOString(),
    });
  }

  // 3. TVA deadline warning (28th of month)
  const tvaDeadline = new Date(year, month, 28);
  const daysToTVA = Math.ceil((tvaDeadline - now) / 86400000);
  if (daysToTVA >= 0 && daysToTVA <= 7) {
    notes.push({
      id: 'tva-deadline',
      type: 'warning',
      icon: AlertTriangle,
      title: `TVA due dans ${daysToTVA} jour${daysToTVA !== 1 ? 's' : ''}`,
      message: `Échéance TVA le ${tvaDeadline.toLocaleDateString('fr-TN', { day: 'numeric', month: 'long' })}`,
      action: 'fiscal',
      actionLabel: 'Voir déclarations',
      timestamp: new Date().toISOString(),
    });
  }

  // 4. Audit reminder (if no audit recently)
  const lastAuditKey = 'sc_last_audit_date';
  const lastAudit = localStorage.getItem(lastAuditKey);
  if (!lastAudit || (now - new Date(lastAudit)) > 30 * 86400000) {
    notes.push({
      id: 'audit-reminder',
      type: 'info',
      icon: Shield,
      title: 'Audit mensuel recommandé',
      message: 'Lancez un audit pour vérifier la conformité de vos écritures',
      action: 'audit',
      actionLabel: 'Lancer l\'audit',
      timestamp: new Date().toISOString(),
    });
  }

  return notes;
}

const TYPE_STYLES = {
  danger: { dot: 'bg-red-400', bg: 'bg-red-500/8 border-red-500/20', icon: 'text-red-400 bg-red-500/15' },
  warning: { dot: 'bg-amber-400', bg: 'bg-amber-500/8 border-amber-500/20', icon: 'text-amber-400 bg-amber-500/15' },
  info: { dot: 'bg-indigo-400', bg: 'bg-indigo-500/8 border-indigo-500/20', icon: 'text-indigo-400 bg-indigo-500/15' },
  success: { dot: 'bg-emerald-400', bg: 'bg-emerald-500/8 border-emerald-500/20', icon: 'text-emerald-400 bg-emerald-500/15' },
};

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `il y a ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `il y a ${days}j`;
  return `il y a ${Math.floor(days / 7)} sem`;
}

const DISMISS_EXPIRY = 24 * 3600000; // 24h

function isDismissedValid(entry) {
  if (typeof entry === 'string') return Date.now() - 0 < DISMISS_EXPIRY; // old format: expired immediately
  return Date.now() - entry.at < DISMISS_EXPIRY;
}

export default function NotificationCenter({ invoices = [], expenses = [], onNavigate }) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('sc_dismissed_notifs') || '[]');
      return raw.filter(isDismissedValid);
    } catch { return []; }
  });
  const [tick, setTick] = useState(0);
  const ref = useRef(null);

  // Auto-refresh notifications every 30s
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  // Clean expired dismissals on mount
  useEffect(() => {
    const raw = JSON.parse(localStorage.getItem('sc_dismissed_notifs') || '[]');
    const valid = raw.filter(isDismissedValid);
    if (valid.length !== raw.length) {
      localStorage.setItem('sc_dismissed_notifs', JSON.stringify(valid));
      setDismissed(valid);
    }
  }, []);

  const notifications = getNotifications({ invoices, expenses }).filter(n => !dismissed.some(d => (d.id || d) === n.id));
  const count = notifications.length;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const dismiss = (id) => {
    const next = [...dismissed, { id, at: Date.now() }];
    setDismissed(next);
    localStorage.setItem('sc_dismissed_notifs', JSON.stringify(next));
  };

  const dismissAll = () => {
    const now = Date.now();
    const next = [...dismissed, ...notifications.map(n => ({ id: n.id, at: now }))];
    setDismissed(next);
    localStorage.setItem('sc_dismissed_notifs', JSON.stringify(next));
    setOpen(false);
  };

  const handleAction = (tab) => {
    onNavigate(tab);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`relative p-2 rounded-xl transition-all duration-200 ${
          open ? 'bg-slate-800 text-slate-200' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
        }`}
        title="Notifications"
      >
        <Bell className="w-4.5 h-4.5" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-[9px] font-black text-white flex items-center justify-center border border-slate-950 animate-pulse">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          className="fixed sm:absolute top-14 sm:top-full left-2 right-2 sm:left-auto sm:right-0 mt-0 sm:mt-2 sm:w-80 rounded-2xl border border-slate-800/60 overflow-hidden z-50"
          style={{
            background: 'rgba(8, 12, 28, 0.95)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            animation: 'slideInUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) both',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/60">
            <div className="flex items-center gap-2">
              <Bell className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-xs font-bold text-slate-200">Notifications</span>
              {count > 0 && (
                <span className="px-1.5 py-0.5 bg-indigo-500/20 text-indigo-400 text-[9px] font-bold rounded-full border border-indigo-500/30">
                  {count}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {count > 0 && (
                <button onClick={dismissAll} className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1">
                  <Check className="w-3 h-3" /> Tout lire
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-colors" title="Fermer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Notifications list */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                  <Check className="w-6 h-6 text-emerald-400" />
                </div>
                <p className="text-xs font-bold text-slate-300">Tout est en ordre !</p>
                <p className="text-[10px] text-slate-500 mt-1">Aucune notification en attente</p>
              </div>
            ) : (
              notifications.map((notif, i) => {
                const styles = TYPE_STYLES[notif.type] || TYPE_STYLES.info;
                const Icon = notif.icon;
                return (
                  <div
                    key={notif.id}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-slate-800/40 last:border-0 hover:bg-slate-800/20 transition-colors group`}
                  >
                    <div className={`w-8 h-8 rounded-xl ${styles.icon} flex items-center justify-center shrink-0 mt-0.5`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-bold text-slate-200 leading-tight">{notif.title}</p>
                        <button
                          onClick={() => dismiss(notif.id)}
                          className="shrink-0 opacity-40 hover:opacity-100 w-4 h-4 flex items-center justify-center text-slate-400 hover:text-white transition-all"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{notif.message}</p>
                      <p className="text-[8px] text-slate-700 mt-0.5">{timeAgo(notif.timestamp)}</p>
                      {notif.action && (
                        <button
                          onClick={() => handleAction(notif.action)}
                          className={`mt-1.5 text-[10px] font-bold transition-colors ${
                            notif.type === 'danger' ? 'text-red-400 hover:text-red-300' :
                            notif.type === 'warning' ? 'text-amber-400 hover:text-amber-300' :
                            'text-indigo-400 hover:text-indigo-300'
                          }`}
                        >
                          {notif.actionLabel} →
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
