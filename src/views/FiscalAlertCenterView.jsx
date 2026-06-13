import React, { useState, useMemo } from 'react';
import { Bell, Calendar, AlertTriangle, CheckCircle2, Clock, Mail, Phone, MessageSquare } from 'lucide-react';
import { getActiveAlerts, getAlertStats, getAlertColor, markAlert } from '../utils/fiscalAlerts';
import PremiumCard from '../components/PremiumCard';
import SectionHeader from '../components/SectionHeader';

export default function FiscalAlertCenterView() {
  const [filter, setFilter] = useState('all');
  const [notificationMethod, setNotificationMethod] = useState('email');
  const [refreshKey, setRefreshKey] = useState(0);

  const alerts = useMemo(() => getActiveAlerts(), [refreshKey]);
  const stats = useMemo(() => getAlertStats(alerts), [alerts]);

  const filteredAlerts = useMemo(() => {
    if (filter === 'all') return alerts;
    if (filter === 'overdue') return alerts.filter(a => a.status === 'overdue');
    if (filter === 'urgent') return alerts.filter(a => a.daysLeft <= 7 && a.status !== 'overdue');
    if (filter === 'upcoming') return alerts.filter(a => a.status === 'upcoming' && a.daysLeft > 7);
    return alerts.filter(a => a.type === filter);
  }, [alerts, filter]);

  const getUrgencyLabel = (alert) => {
    if (alert.status === 'overdue') return { label: 'En retard', cls: 'bg-red-500/15 text-red-400 border-red-500/30' };
    if (alert.daysLeft <= 3) return { label: 'Urgent', cls: 'bg-orange-500/15 text-orange-400 border-orange-500/30' };
    if (alert.daysLeft <= 7) return { label: 'Bientôt', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
    return { label: `J-${alert.daysLeft}`, cls: 'bg-slate-500/15 text-slate-400 border-slate-500/30' };
  };

  const notificationMethods = [
    { id: 'email', icon: Mail, label: 'Email' },
    { id: 'sms', icon: Phone, label: 'SMS' },
    { id: 'whatsapp', icon: MessageSquare, label: 'WhatsApp' },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Bell}
        title="Centre d'Alertes Fiscales"
        subtitle="Notifications intelligentes pour toutes vos échéances fiscales et sociales"
        action={
          <div className="flex items-center gap-1">
            {notificationMethods.map(m => {
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  onClick={() => setNotificationMethod(m.id)}
                  className={`p-2 rounded-xl border transition-all ${
                    notificationMethod === m.id
                      ? 'bg-brand-500/20 text-brand-400 border-brand-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700/50 hover:border-slate-600'
                  }`}
                  title={`Notification par ${m.label}`}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <PremiumCard className="p-4 text-center">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Total alertes</p>
          <p className="text-3xl font-extrabold text-white mt-1">{stats.total}</p>
        </PremiumCard>
        <PremiumCard className="p-4 text-center border-red-500/20">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">En retard</p>
          <p className="text-3xl font-extrabold text-red-400 mt-1">{stats.overdue}</p>
        </PremiumCard>
        <PremiumCard className="p-4 text-center border-orange-500/20">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Imminentes</p>
          <p className="text-3xl font-extrabold text-orange-400 mt-1">{stats.dueSoon}</p>
        </PremiumCard>
        <PremiumCard className="p-4 text-center border-emerald-500/20">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">À venir</p>
          <p className="text-3xl font-extrabold text-emerald-400 mt-1">{stats.upcoming}</p>
        </PremiumCard>
      </div>

      <div className="flex gap-2 flex-wrap">
        {[
          { id: 'all', label: 'Toutes' },
          { id: 'overdue', label: '🔴 En retard' },
          { id: 'urgent', label: '🟠 Urgentes' },
          { id: 'upcoming', label: '🟢 À venir' },
          { id: 'tva', label: '💰 TVA' },
          { id: 'is', label: '🏢 IS' },
          { id: 'cnss', label: '👥 CNSS' },
          { id: 'irpp', label: '👤 IRPP' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              filter === tab.id
                ? 'bg-brand-500/20 text-brand-400 border-brand-500/30'
                : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:border-slate-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <PremiumCard className="p-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <p className="text-sm text-slate-300 font-bold">Aucune alerte</p>
            <p className="text-xs text-slate-500 mt-1">Toutes les échéances sont à jour</p>
          </PremiumCard>
        ) : filteredAlerts.map((alert, i) => {
          const alertColor = getAlertColor(alert.severity);
          const urgency = getUrgencyLabel(alert);
          return (
            <PremiumCard key={alert.id || i} className="p-5">
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${alertColor.bg}`}>
                  {alert.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-white">{alert.title}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">{alert.description}</p>
                    </div>
                    <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full border ${urgency.cls}`}>
                      {urgency.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-xs">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Calendar className="w-3.5 h-3.5" />
                      {alert.formattedDate}
                    </span>
                    <span className={`flex items-center gap-1.5 ${alertColor.text}`}>
                      <span className={`w-2 h-2 rounded-full ${alertColor.dot}`} />
                      {alert.severity === 'critical' ? 'Critique' : alert.severity === 'high' ? 'Haute' : alert.severity === 'medium' ? 'Moyenne' : 'Basse'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => { markAlert(alert.id); setRefreshKey(k => k + 1); }}
                  className="shrink-0 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-brand-400 border border-brand-500/20 transition-all"
                >
                  ✓ Marquer
                </button>
              </div>
            </PremiumCard>
          );
        })}
      </div>
    </div>
  );
}
