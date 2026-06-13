import React, { useState, useRef, useEffect } from 'react';
import { Plus, CheckCircle2, X, Building2, ChevronDown, Sparkles } from 'lucide-react';
import { logAction, AUDIT_ACTIONS } from './utils/security/auditLog';
import { can } from './utils/auth/permissionEngine';

function CompanyAvatar({ name }) {
  const initials = (name || '?').slice(0, 2).toUpperCase();
  const hue = Array.from(name || '').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return (
    <div
      className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black text-white shrink-0"
      style={{ background: `linear-gradient(135deg, hsl(${hue},55%,28%), hsl(${hue},65%,42%))`, border: `1px solid hsl(${hue},65%,52%)` }}
    >
      {initials}
    </div>
  );
}

const CompanySwitcher = ({ companies, currentCompanyId, onCompanyChange, onCreateCompany, currentUser }) => {
  const [open, setOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [newCompany, setNewCompany] = useState({ name: '', email: '', vatNumber: '', address: '', iban: '', bic: '', currency: 'TND' });
  const ref = useRef(null);

  const canCreate = !currentUser || can(currentUser, 'manage_societe');
  const currentCompany = companies?.[currentCompanyId];
  const currentName = currentCompany?.companyDetails?.name || 'Société';

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSelect = (id) => {
    logAction(AUDIT_ACTIONS.COMPANY_SWITCH, { from: currentCompanyId, to: id });
    onCompanyChange(id);
    setOpen(false);
  };

  const handleCreate = () => {
    if (!canCreate || !newCompany.name) return;
    onCreateCompany(newCompany);
    logAction(AUDIT_ACTIONS.COMPANY_CREATE, { name: newCompany.name });
    setNewCompany({ name: '', email: '', vatNumber: '', address: '', iban: '', bic: '', currency: 'TND' });
    setShowModal(false);
  };

  const companiesList = Object.entries(companies || []);

  return (
    <div className="mb-3 relative" ref={ref}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all duration-200 group ${
          open
            ? 'bg-indigo-500/12 border-indigo-500/35 shadow-[0_0_12px_rgba(99,102,241,0.15)]'
            : 'bg-slate-900/50 border-slate-700/50 hover:border-slate-600/70 hover:bg-slate-800/40'
        }`}
      >
        <CompanyAvatar name={currentName} />
        <div className="flex-1 text-left min-w-0">
          <p className="text-xs font-bold text-slate-200 truncate">{currentName}</p>
          <p className="text-[9px] text-slate-500 font-medium">{companiesList.length} société{companiesList.length > 1 ? 's' : ''}</p>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute top-full left-0 right-0 mt-1.5 rounded-2xl border border-slate-800/60 overflow-hidden z-50"
          style={{
            background: 'rgba(8, 12, 28, 0.96)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
            animation: 'slideInUp 0.2s cubic-bezier(0.34,1.56,0.64,1) both',
          }}
        >
          {/* List */}
          <div className="py-1.5 max-h-52 overflow-y-auto">
            {companiesList.map(([id, data]) => {
              const name = data?.companyDetails?.name || 'Société';
              const isActive = id === currentCompanyId;
              return (
                <button
                  key={id}
                  onClick={() => handleSelect(id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 transition-colors text-left ${
                    isActive ? 'bg-indigo-500/12' : 'hover:bg-slate-800/50'
                  }`}
                >
                  <CompanyAvatar name={name} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold truncate ${isActive ? 'text-indigo-300' : 'text-slate-300'}`}>{name}</p>
                    {data?.companyDetails?.matriculeFiscal && (
                      <p className="text-[9px] text-slate-600 font-mono truncate">{data.companyDetails.matriculeFiscal}</p>
                    )}
                  </div>
                  {isActive && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Divider + Create */}
          {canCreate && (
            <>
              <div className="h-px bg-slate-800/60 mx-3" />
              <div className="p-1.5">
                <button
                  onClick={() => { setOpen(false); setShowModal(true); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-indigo-400 hover:bg-indigo-500/10 transition-colors text-xs font-bold"
                >
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
                    <Plus className="w-3.5 h-3.5" />
                  </div>
                  Nouvelle Société
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-[9990] p-4" style={{ backdropFilter: 'blur(8px)' }}>
          <div
            className="w-full max-w-md rounded-3xl border border-white/5 overflow-hidden"
            style={{ background: 'rgba(8,12,28,0.95)', backdropFilter: 'blur(20px)', boxShadow: '0 30px 80px rgba(0,0,0,0.6)', animation: 'slideInUp 0.3s cubic-bezier(0.34,1.56,0.64,1) both' }}
          >
            {/* Header */}
            <div className="h-1 bg-gradient-to-r from-indigo-500 to-violet-600" />
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">Nouvelle Société</h3>
                    <p className="text-[10px] text-slate-500">Données isolées par entité</p>
                  </div>
                </div>
                <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                {[
                  { key: 'name', label: 'Raison sociale *', placeholder: 'Société Tunisienne SARL', required: true },
                  { key: 'email', label: 'E-mail légal *', placeholder: 'contact@societe.tn', required: true },
                  { key: 'vatNumber', label: 'Matricule Fiscal', placeholder: '1234567/X/A/M/000' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1 block">{f.label}</label>
                    <input
                      required={f.required}
                      placeholder={f.placeholder}
                      value={newCompany[f.key]}
                      onChange={e => setNewCompany({ ...newCompany, [f.key]: e.target.value })}
                      className="w-full bg-slate-900/60 border border-slate-700/60 focus:border-indigo-500/50 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none transition-colors placeholder:text-slate-600"
                    />
                  </div>
                ))}
              </div>

              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 border border-slate-700/80 text-slate-300 rounded-xl text-sm font-semibold hover:border-slate-600 hover:bg-slate-800/30 transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newCompany.name}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-xl text-sm font-bold shadow-[0_4px_16px_rgba(99,102,241,0.35)] hover:shadow-[0_6px_24px_rgba(99,102,241,0.5)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <Sparkles className="w-4 h-4" /> Créer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanySwitcher;
