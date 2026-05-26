import React, { useState, useEffect } from 'react';
import { Plus, CheckCircle2, X } from 'lucide-react';

/**
 * CompanySwitcher – permet à l'utilisateur de créer, sélectionner et réinitialiser les données d’une société.
 * Fonctionnalités :
 *  - Liste déroulante des sociétés enregistrées (localStorage).
 *  - Bouton « Ajouter une société » ouvrant un modal pour saisir les informations de la société.
 *  - Lors du changement de société, les données liées (factures, dépenses, transactions, tableau de bord) sont
 *    chargées depuis le stockage de la société sélectionnée ou réinitialisées à zéro.
 */
const CompanySwitcher = ({ currentCompanyId, onCompanyChange }) => {
  const [companies, setCompanies] = useState({}); // {id: {companyDetails, invoices, expenses, transactions, dashboardData}}
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

  // Load all companies from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('smart_comptable_companies');
    if (stored) setCompanies(JSON.parse(stored));
  }, []);

  // Persist the catalogue of companies when it changes
  useEffect(() => {
    localStorage.setItem('smart_comptable_companies', JSON.stringify(companies));
  }, [companies]);

  const handleSelect = (e) => {
    const id = e.target.value;
    if (id && companies[id]) {
      onCompanyChange(id, companies[id]);
    }
  };

  const handleCreate = () => {
    const id = `company_${Date.now()}`;
    const emptyData = {
      companyDetails: { ...newCompany },
      invoices: [],
      expenses: [],
      transactions: [],
      dashboardData: {},
    };
    setCompanies((prev) => ({ ...prev, [id]: emptyData }));
    onCompanyChange(id, emptyData);
    setNewCompany({ name: '', email: '', vatNumber: '', address: '', iban: '', bic: '', currency: 'TND', geminiApiKey: '' });
    setShowModal(false);
  };

  return (
    <div className="mb-4">
      {/* Sélecteur */}
      <select
        value={currentCompanyId || ''}
        onChange={handleSelect}
        className="w-full bg-slate-900/60 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-brand-500"
      >
        <option value="" disabled>— Sélectionnez une société —</option>
        {Object.entries(companies).map(([id, data]) => (
          <option key={id} value={id}>{data.companyDetails.name || 'Société inconnue'}</option>
        ))}
      </select>

      {/* Bouton ajouter */}
      <button
        onClick={() => setShowModal(true)}
        className="mt-2 flex items-center gap-2 px-3 py-1.5 bg-brand-500/20 text-brand-400 rounded-xl hover:bg-brand-500/30 transition-colors"
      >
        <Plus className="w-4 h-4" /> Ajouter une société
      </button>

      {/* Modal création */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-50">
          <div className="bg-surface-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold text-slate-100">Nouvelle société</h3>
            <div className="grid grid-cols-1 gap-2">
              <input placeholder="Nom de la société" value={newCompany.name}
                onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-slate-100" />
              <input placeholder="E‑mail" value={newCompany.email}
                onChange={(e) => setNewCompany({ ...newCompany, email: e.target.value })}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-slate-100" />
              <input placeholder="Numéro de TVA" value={newCompany.vatNumber}
                onChange={(e) => setNewCompany({ ...newCompany, vatNumber: e.target.value })}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-slate-100" />
              <input placeholder="Adresse" value={newCompany.address}
                onChange={(e) => setNewCompany({ ...newCompany, address: e.target.value })}
                className="bg-slate-800 border border-slate-701 rounded-xl px-3 py-1.5 text-slate-100" />
              <input placeholder="IBAN" value={newCompany.iban}
                onChange={(e) => setNewCompany({ ...newCompany, iban: e.target.value })}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-slate-100" />
              <input placeholder="BIC" value={newCompany.bic}
                onChange={(e) => setNewCompany({ ...newCompany, bic: e.target.value })}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-slate-100" />
              <input placeholder="Clé API Gemini (ou 'local')" value={newCompany.geminiApiKey}
                onChange={(e) => setNewCompany({ ...newCompany, geminiApiKey: e.target.value })}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-slate-100" />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowModal(false)} className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded-xl hover:bg-slate-600">
                <X className="w-4 h-4 inline" /> Annuler
              </button>
              <button onClick={handleCreate} className="px-3 py-1.5 bg-brand-500 text-white rounded-xl hover:bg-brand-600 flex items-center gap-1">
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
