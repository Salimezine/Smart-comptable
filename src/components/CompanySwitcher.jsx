import React, { useState } from 'react';
import { Building2, Plus, Check, ChevronDown } from 'lucide-react';
import { can } from '../utils/auth/permissionEngine';
import { getCurrentUser } from '../utils/security/sessionManager';
import { getUserById } from '../utils/auth/userStore';
import { logAction, AUDIT_ACTIONS } from '../utils/security/auditLog';

const COMPANY_KEY = 'smart_companies';

function getCompanies() {
  try {
    const raw = localStorage.getItem(COMPANY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveCompanies(list) {
  localStorage.setItem(COMPANY_KEY, JSON.stringify(list));
}

const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export default function CompanySwitcher({ currentCompanyId, onSwitch, currentUser }) {
  const [open, setOpen] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');

  const companies = getCompanies();
  const current = companies.find(c => c.id === currentCompanyId);
  const canCreate = currentUser ? can(currentUser, 'companies', 'create') : true;

  const handleSwitch = (id) => {
    logAction(AUDIT_ACTIONS.COMPANY_SWITCH, { from: currentCompanyId, to: id });
    onSwitch(id);
    setOpen(false);
  };

  const handleCreate = () => {
    if (!newName.trim()) return;
    const id = crypto.randomUUID();
    const company = {
      id,
      name: newName.trim(),
      color: COLORS[companies.length % COLORS.length],
      createdAt: new Date().toISOString(),
    };
    companies.push(company);
    saveCompanies(companies);
    setNewName('');
    setShowNew(false);
    logAction(AUDIT_ACTIONS.COMPANY_CREATE, { companyId: id, name: company.name });
    handleSwitch(id);
  };

  if (!companies.length) return null;

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-brand-500/30 transition-all text-left">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold text-white"
          style={{ backgroundColor: current?.color || '#6366f1' }}>
          {(current?.name || 'SC').slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-100 truncate">{current?.name || 'Société'}</p>
        </div>
        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-xl py-1 max-h-60 overflow-y-auto">
          {companies.map(c => (
            <button key={c.id} onClick={() => handleSwitch(c.id)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-800 transition-all text-left">
              <div className="w-5 h-5 rounded flex items-center justify-center text-[8px] font-bold text-white"
                style={{ backgroundColor: c.color }}>
                {c.name.slice(0, 2).toUpperCase()}
              </div>
              <span className="text-xs text-slate-200 flex-1 truncate">{c.name}</span>
              {c.id === currentCompanyId && <Check className="w-3 h-3 text-brand-400" />}
            </button>
          ))}
          {canCreate && (
            <>
              <div className="border-t border-slate-700 my-1" />
              {showNew ? (
                <div className="px-3 py-2">
                  <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                    placeholder="Nom de la société"
                    className="w-full bg-slate-950 border border-slate-600 rounded-lg px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-brand-500 mb-2"
                    onKeyDown={e => e.key === 'Enter' && handleCreate()} />
                  <div className="flex gap-1">
                    <button onClick={handleCreate}
                      className="flex-1 px-2 py-1 bg-brand-500/20 text-brand-400 text-[10px] font-bold rounded-lg border border-brand-500/30">
                      Créer
                    </button>
                    <button onClick={() => { setShowNew(false); setNewName(''); }}
                      className="px-2 py-1 text-[10px] text-slate-400 hover:text-slate-200">
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowNew(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-brand-400 hover:bg-slate-800 transition-all">
                  <Plus className="w-3.5 h-3.5" /> Nouvelle société
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
