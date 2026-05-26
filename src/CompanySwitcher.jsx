import React, { useState } from 'react';
import { Plus, CheckCircle2, X } from 'lucide-react';

const CompanySwitcher = ({ companies, currentCompanyId, onCompanyChange, onCreateCompany }) => {
  const [showModal, setShowModal] = useState(false);
  const [newCompany, setNewCompany] = useState({
    name: '',
    email: '',
    vatNumber: '',
    address: '',
    iban: '',
    bic: '',
    currency: 'TND',
    geminiApiKey: '',
  });

  const handleSelect = (e) => {
    const id = e.target.value;
    if (id) onCompanyChange(id);
  };

  const handleCreate = () => {
    onCreateCompany(newCompany);
    setNewCompany({ name: '', email: '', vatNumber: '', address: '', iban: '', bic: '', currency: 'TND', geminiApiKey: '' });
    setShowModal(false);
  };

  return (
    <div className="mb-2">
      <select
        value={currentCompanyId || ''}
        onChange={handleSelect}
        className="w-full bg-slate-900/60 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 text-xs font-semibold focus:outline-none focus:border-brand-500"
      >
        <option value="" disabled>— Choisir une société —</option>
        {Object.entries(companies || {}).map(([id, data]) => (
          <option key={id} value={id}>{data?.companyDetails?.name || 'Société'}</option>
        ))}
      </select>

      <button
        onClick={() => setShowModal(true)}
        className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-brand-500/10 border border-brand-500/20 text-brand-400 rounded-xl hover:bg-brand-500/20 transition-colors text-xs font-bold"
      >
        <Plus className="w-3.5 h-3.5" /> Nouvelle Société
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-50">
          <div className="bg-surface-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold text-slate-100">Nouvelle société</h3>
            <p className="text-xs text-slate-400">Les données repartiront à zéro pour cette entité.</p>
            <div className="grid grid-cols-1 gap-2">
              <input required placeholder="Nom de la société *" value={newCompany.name}
                onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 text-sm" />
              <input required placeholder="E‑mail *" value={newCompany.email}
                onChange={(e) => setNewCompany({ ...newCompany, email: e.target.value })}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 text-sm" />
              <input required placeholder="Numéro de TVA *" value={newCompany.vatNumber}
                onChange={(e) => setNewCompany({ ...newCompany, vatNumber: e.target.value })}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 text-sm" />
              <input placeholder="Clé API Gemini (ou 'local')" value={newCompany.geminiApiKey}
                onChange={(e) => setNewCompany({ ...newCompany, geminiApiKey: e.target.value })}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 text-sm font-mono" />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowModal(false)} className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded-xl hover:bg-slate-600 text-sm">
                <X className="w-4 h-4 inline" /> Annuler
              </button>
              <button onClick={handleCreate} className="px-3 py-1.5 bg-brand-500 text-white rounded-xl hover:bg-brand-600 flex items-center gap-1 text-sm font-bold">
                <CheckCircle2 className="w-4 h-4" /> Créer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanySwitcher;
