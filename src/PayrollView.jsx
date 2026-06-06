import React, { useState, useEffect, useCallback } from 'react';
import { calculerBulletin, genererEcrituresPaie, genererPaiementPaie, saveJournalPiece, exportBulletinPDF, exportDeclarationCNSS, exportEtat301, TAUX } from './utils/payrollEngine';
import { saveEmploye, getEmployes, deleteEmploye, saveBulletin, getBulletins, getAllBulletins } from './utils/payrollStore';
import { Plus, Save, Download, FileText, User, Users, Trash2, Calculator, AlertTriangle, CheckCircle, ChevronDown, ChevronRight, Calendar, X, Search, DollarSign } from 'lucide-react';

const moisNom = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

const fmt = (v) => {
  if (v == null || isNaN(v)) return '0,000';
  return v.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
};

function Tab({ label, active, onClick }) {
  return (
    <button onClick={onClick}
      className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${active ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30' : 'text-slate-400 hover:text-slate-200 border border-transparent'}`}>
      {label}
    </button>
  );
}

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-slate-800/50 pb-3 mb-3">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1 text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 w-full text-left">
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {title}
      </button>
      {open && children}
    </div>
  );
}

function FiscalLine({ label, value, color, bold, total, indent }) {
  return (
    <div className={`flex justify-between py-1 ${total ? 'bg-indigo-500/5 rounded-lg px-2 -mx-2' : ''}`}>
      <span className={`text-xs ${total ? 'font-bold text-brand-300' : bold ? 'font-semibold text-slate-300' : 'text-slate-400'}`}
        style={{ paddingLeft: (indent || 0) * 12 }}>
        {label}
      </span>
      <span className={`text-xs font-semibold ${color || (total ? 'text-brand-400' : 'text-slate-300')}`}>
        {fmt(value)} DT
      </span>
    </div>
  );
}

const EMPTY_EMPLOYE = { nom: '', prenom: '', cin: '', matricule: '', poste: '', salaireBase: '', regimeHoraire: 40, chefFamille: false, conjointCharge: false, nbEnfants: 0 };

export default function PayrollView({ companyDetails }) {
  const [tab, setTab] = useState('employes');
  const [employes, setEmployes] = useState([]);
  const [bulletins, setBulletins] = useState([]);
  const [currentBulletin, setCurrentBulletin] = useState(null);
  const [mois, setMois] = useState(new Date().getMonth() + 1);
  const [annee, setAnnee] = useState(new Date().getFullYear());
  const [employeForm, setEmployeForm] = useState(EMPTY_EMPLOYE);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState(null);
  const [selectedEmployeId, setSelectedEmployeId] = useState('all');
  const [search, setSearch] = useState('');

  const refreshEmployes = useCallback(() => setEmployes(getEmployes()), []);

  useEffect(() => { refreshEmployes(); }, [refreshEmployes]);

  useEffect(() => {
    if (tab === 'bulletins' || tab === 'declarations' || tab === 'historique') {
      setBulletins(getBulletins(mois, annee));
    }
  }, [tab, mois, annee]);

  const handleSaveEmploye = () => {
    if (!employeForm.nom || !employeForm.salaireBase) {
      setMsg({ type: 'error', text: 'Nom et salaire de base requis.' });
      return;
    }
    const saved = saveEmploye({ ...employeForm, id: editingId });
    if (saved) {
      setMsg({ type: 'success', text: `Employé ${saved.prenom} ${saved.nom} enregistré.` });
      setShowForm(false);
      setEditingId(null);
      setEmployeForm(EMPTY_EMPLOYE);
      refreshEmployes();
    }
  };

  const handleEditEmploye = (e) => {
    setEmployeForm({ ...e });
    setEditingId(e.id);
    setShowForm(true);
  };

  const handleDeleteEmploye = (id) => {
    deleteEmploye(id);
    refreshEmployes();
    setMsg({ type: 'info', text: 'Employé supprimé.' });
  };

  const handleCalculer = () => {
    const selected = selectedEmployeId === 'all' ? employes : employes.filter(e => e.id === selectedEmployeId);
    if (!selected.length) {
      setMsg({ type: 'error', text: 'Aucun employé sélectionné.' });
      return;
    }
    const params = { mois, annee, heuresSup: 0, primes: 0, avances: 0 };
    const results = selected.map(e => calculerBulletin(e, params));
    setCurrentBulletin(results.length === 1 ? results[0] : null);
    // Save all bulletins
    results.forEach(b => saveBulletin(b));
    setBulletins(getBulletins(mois, annee));
    setMsg({ type: 'success', text: `${results.length} bulletin(s) calculé(s) et enregistré(s).` });
  };

  const handleGenererEcriture = () => {
    const bs = getBulletins(mois, annee);
    if (!bs.length) { setMsg({ type: 'error', text: 'Aucun bulletin pour cette période.' }); return; }
    const piece = genererEcrituresPaie(bs, mois, annee);
    const ok = saveJournalPiece(piece);
    if (ok) setMsg({ type: 'success', text: `Écriture ${piece.id} enregistrée dans le journal (OD).` });
    else setMsg({ type: 'error', text: 'Erreur lors de l\'enregistrement.' });
  };

  const handlePaiement = (type) => {
    const bs = getBulletins(mois, annee);
    if (!bs.length) { setMsg({ type: 'error', text: 'Aucun bulletin pour cette période.' }); return; }
    const labels = { net: 'Virement salaires', cnss: 'Paiement CNSS', irpp: 'Paiement IRPP' };
    if (!window.confirm(`Confirmer ${labels[type]} ${moisNom[mois-1]} ${annee} ?`)) return;
    const piece = genererPaiementPaie(bs, type, mois, annee);
    const ok = saveJournalPiece(piece);
    if (ok) setMsg({ type: 'success', text: `${labels[type]} ${piece.id} enregistré dans le journal (BQ).` });
    else setMsg({ type: 'error', text: 'Erreur lors de l\'enregistrement.' });
  };

  const handleExportBulletin = async () => {
    if (!currentBulletin) { setMsg({ type: 'error', text: 'Calculez d\'abord un bulletin.' }); return; }
    const doc = await exportBulletinPDF(currentBulletin, companyDetails || {});
    doc.save(`Bulletin_${currentBulletin.nom}_${mois}_${annee}.pdf`);
  };

  const handleExportDMS = async () => {
    const bs = getBulletins(mois, annee);
    if (!bs.length) { setMsg({ type: 'error', text: 'Aucun bulletin.' }); return; }
    const doc = await exportDeclarationCNSS(bs, mois, annee, companyDetails || {});
    doc.save(`DMS_${annee}_${String(mois).padStart(2,'0')}.pdf`);
  };

  const handleExport301 = async () => {
    const all = getAllBulletins();
    const byMois = {};
    for (const b of all) {
      if (b.annee !== annee) continue;
      if (!byMois[b.mois]) byMois[b.mois] = [];
      byMois[b.mois].push(b);
    }
    const months = Object.values(byMois);
    if (!months.length) { setMsg({ type: 'error', text: 'Aucun bulletin pour cette année.' }); return; }
    const doc = await exportEtat301(months, annee, companyDetails || {});
    doc.save(`Etat301_${annee}.pdf`);
  };

  const filteredEmployes = employes.filter(e =>
    `${e.nom} ${e.prenom} ${e.cin || ''} ${e.matricule || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  const renderEmployes = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input type="text" placeholder="Rechercher..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 focus:border-brand-500 rounded-xl pl-9 pr-3 py-2 text-slate-100 text-xs focus:outline-none" />
        </div>
        <button onClick={() => { setEmployeForm(EMPTY_EMPLOYE); setEditingId(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-brand-500/20 hover:bg-brand-500/30 text-brand-400 text-xs font-bold rounded-xl border border-brand-500/30 transition-all">
          <Plus className="w-3.5 h-3.5" /> Ajouter
        </button>
      </div>

      {showForm && (
        <div className="glass-card p-5 rounded-2xl border border-slate-700 shadow-card animate-fade-in">
          <h4 className="text-sm font-bold text-slate-100 mb-4">{editingId ? 'Modifier' : 'Nouvel'} employé</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input placeholder="Nom *" value={employeForm.nom} onChange={e => setEmployeForm(f => ({...f, nom: e.target.value}))}
              className="col-span-1 bg-slate-950 border border-slate-700 focus:border-brand-500 rounded-xl px-3 py-2 text-slate-100 text-xs focus:outline-none" />
            <input placeholder="Prénom" value={employeForm.prenom} onChange={e => setEmployeForm(f => ({...f, prenom: e.target.value}))}
              className="col-span-1 bg-slate-950 border border-slate-700 focus:border-brand-500 rounded-xl px-3 py-2 text-slate-100 text-xs focus:outline-none" />
            <input placeholder="CIN" value={employeForm.cin} onChange={e => setEmployeForm(f => ({...f, cin: e.target.value}))}
              className="col-span-1 bg-slate-950 border border-slate-700 focus:border-brand-500 rounded-xl px-3 py-2 text-slate-100 text-xs focus:outline-none" />
            <input placeholder="Matricule" value={employeForm.matricule} onChange={e => setEmployeForm(f => ({...f, matricule: e.target.value}))}
              className="col-span-1 bg-slate-950 border border-slate-700 focus:border-brand-500 rounded-xl px-3 py-2 text-slate-100 text-xs focus:outline-none" />
            <input placeholder="Poste" value={employeForm.poste} onChange={e => setEmployeForm(f => ({...f, poste: e.target.value}))}
              className="col-span-1 bg-slate-950 border border-slate-700 focus:border-brand-500 rounded-xl px-3 py-2 text-slate-100 text-xs focus:outline-none" />
            <div>
              <input type="number" step="0.001" min="0" placeholder="Salaire base *" value={employeForm.salaireBase}
                onChange={e => setEmployeForm(f => ({...f, salaireBase: e.target.value}))}
                className="w-full bg-slate-950 border border-slate-700 focus:border-brand-500 rounded-xl px-3 py-2 text-slate-100 text-xs focus:outline-none" />
            </div>
            <div>
              <select value={employeForm.regimeHoraire} onChange={e => setEmployeForm(f => ({...f, regimeHoraire: parseInt(e.target.value)}))}
                className="w-full bg-slate-950 border border-slate-700 focus:border-brand-500 rounded-xl px-3 py-2 text-slate-100 text-xs focus:outline-none">
                <option value={40}>40h/semaine</option>
                <option value={48}>48h/semaine</option>
              </select>
            </div>
            <div className="flex items-center gap-4 col-span-2">
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input type="checkbox" checked={employeForm.chefFamille} onChange={e => setEmployeForm(f => ({...f, chefFamille: e.target.checked}))}
                  className="rounded border-slate-600 bg-slate-800 text-brand-500 focus:ring-brand-500" />
                Chef de famille
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input type="checkbox" checked={employeForm.conjointCharge} onChange={e => setEmployeForm(f => ({...f, conjointCharge: e.target.checked}))}
                  className="rounded border-slate-600 bg-slate-800 text-brand-500 focus:ring-brand-500" />
                Conjoint à charge
              </label>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">Enfants:</span>
                <input type="number" min="0" max="20" value={employeForm.nbEnfants}
                  onChange={e => setEmployeForm(f => ({...f, nbEnfants: parseInt(e.target.value) || 0}))}
                  className="w-16 bg-slate-950 border border-slate-700 rounded-xl px-2 py-1.5 text-slate-100 text-xs text-center focus:outline-none focus:border-brand-500" />
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleSaveEmploye}
              className="flex items-center gap-2 px-4 py-2 bg-brand-500/20 hover:bg-brand-500/30 text-brand-400 text-xs font-bold rounded-xl border border-brand-500/30 transition-all">
              <Save className="w-3.5 h-3.5" /> Enregistrer
            </button>
            <button onClick={() => { setShowForm(false); setEmployeForm(EMPTY_EMPLOYE); }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-bold rounded-xl transition-all">
              Annuler
            </button>
          </div>
        </div>
      )}

      {!filteredEmployes.length ? (
        <div className="p-6 bg-slate-800/50 rounded-xl text-center">
          <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-xs text-slate-400">Aucun employé. Ajoutez-en un.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredEmployes.map(e => (
            <div key={e.id} className="glass-card p-4 rounded-xl border border-slate-700/50 hover:border-brand-500/30 transition-all">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-100">{e.prenom} {e.nom}</p>
                  <p className="text-[10px] text-slate-400">{e.poste || '—'}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleEditEmploye(e)} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-all">
                    <User className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDeleteEmploye(e.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="mt-2 space-y-0.5 text-[10px] text-slate-500">
                <p>CIN: {e.cin || '—'} | Matricule: {e.matricule || '—'}</p>
                <p>Salaire: {fmt(parseFloat(e.salaireBase) || 0)} DT | {e.regimeHoraire || 40}h/sem</p>
                {e.chefFamille && <span className="text-brand-400">Chef de famille</span>}
                {e.conjointCharge && <span className="text-amber-400 ml-2">Conjoint à charge</span>}
                {e.nbEnfants > 0 && <span className="text-emerald-400 ml-2">{e.nbEnfants} enfant(s)</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderBulletins = () => {
    const selected = selectedEmployeId === 'all' ? employes : employes.filter(e => e.id === selectedEmployeId);
    return (
      <div className="space-y-4">
        <div className="glass-card p-5 rounded-2xl border border-slate-700 shadow-card">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
            <div>
              <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">Mois</label>
              <select value={mois} onChange={e => setMois(parseInt(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 focus:border-brand-500 rounded-xl px-3 py-2 text-slate-100 text-xs focus:outline-none">
                {moisNom.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">Année</label>
              <input type="number" value={annee} onChange={e => setAnnee(parseInt(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 focus:border-brand-500 rounded-xl px-3 py-2 text-slate-100 text-xs focus:outline-none" />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 font-bold mb-1 uppercase">Employé</label>
              <select value={selectedEmployeId} onChange={e => setSelectedEmployeId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 focus:border-brand-500 rounded-xl px-3 py-2 text-slate-100 text-xs focus:outline-none">
                <option value="all">Tous les employés</option>
                {employes.map(e => <option key={e.id} value={e.id}>{e.prenom} {e.nom}</option>)}
              </select>
            </div>
            <button onClick={handleCalculer}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-brand-500/20 hover:bg-brand-500/30 text-brand-400 text-xs font-bold rounded-xl border border-brand-500/30 transition-all">
              <Calculator className="w-3.5 h-3.5" /> Calculer
            </button>
            <button onClick={handleGenererEcriture}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 text-xs font-bold rounded-xl border border-amber-600/30 transition-all">
              <FileText className="w-3.5 h-3.5" /> Écriture
            </button>
          </div>
        </div>

        {bulletins.length > 0 && (
          <div className="glass-card p-5 rounded-2xl border border-emerald-700/30 shadow-card">
            <h4 className="text-sm font-bold text-emerald-400 mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4" /> Paiements
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button onClick={() => handlePaiement('net')}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-xs font-bold rounded-xl border border-emerald-600/30 transition-all">
                <DollarSign className="w-4 h-4" /> Virement salaires (net)
              </button>
              <button onClick={() => handlePaiement('cnss')}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs font-bold rounded-xl border border-blue-600/30 transition-all">
                <DollarSign className="w-4 h-4" /> Paiement CNSS
              </button>
              <button onClick={() => handlePaiement('irpp')}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 text-xs font-bold rounded-xl border border-amber-600/30 transition-all">
                <DollarSign className="w-4 h-4" /> Paiement IRPP/RS
              </button>
            </div>
          </div>
        )}

        {currentBulletin && (
          <div className="glass-card p-5 rounded-2xl border border-slate-700 shadow-card animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold text-slate-100">Bulletin — {currentBulletin.prenom} {currentBulletin.nom}</h4>
              <button onClick={handleExportBulletin}
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 text-xs font-bold rounded-xl border border-indigo-500/30 transition-all">
                <Download className="w-3.5 h-3.5" /> PDF
              </button>
            </div>
            <Section title="Gains">
              <FiscalLine label="Salaire de base" value={currentBulletin.salaireBase} />
              {currentBulletin.montantHS > 0 && <FiscalLine label="Heures supplémentaires" value={currentBulletin.montantHS} />}
              {currentBulletin.primes > 0 && <FiscalLine label="Primes" value={currentBulletin.primes} />}
              <FiscalLine label="Total brut" value={currentBulletin.brut} bold total />
            </Section>
            <Section title="Retenues">
              <FiscalLine label={`CNSS salarié (${(TAUX.cnss_sal * 100).toFixed(2)}%)`} value={currentBulletin.cnssSal} color="text-danger-400" />
              <FiscalLine label="IRPP/RS" value={currentBulletin.rsMensuelle} color="text-danger-400" />
              {currentBulletin.cssAnnuelle > 0 && <FiscalLine label="CSS" value={currentBulletin.cssAnnuelle / 12} color="text-danger-400" />}
              {currentBulletin.avances > 0 && <FiscalLine label="Avances" value={currentBulletin.avances} color="text-danger-400" />}
              <FiscalLine label="Net à payer" value={currentBulletin.netAPayer} bold total color="text-accent-400" />
            </Section>
            <Section title="Charges patronales">
              <FiscalLine label={`CNSS patronale (${(TAUX.cnss_pat * 100).toFixed(2)}%)`} value={currentBulletin.cnssPat} />
              <FiscalLine label="Coût total employeur" value={currentBulletin.coutEmployeur} bold total />
            </Section>
            <Section title="IRPP annuel" defaultOpen={false}>
              <FiscalLine label="Revenu imposable annuel" value={currentBulletin.revenuImposableAnnuel} />
              <FiscalLine label="IRPP annuel" value={currentBulletin.irppAnnuel} />
              <FiscalLine label="RS mensuelle" value={currentBulletin.rsMensuelle} total />
            </Section>
          </div>
        )}

        {!currentBulletin && bulletins.length > 0 && (
          <div className="glass-card p-5 rounded-2xl border border-slate-700 shadow-card">
            <h4 className="text-sm font-bold text-slate-100 mb-3">Bulletins enregistrés — {moisNom[mois - 1]} {annee}</h4>
            <div className="space-y-2">
              {bulletins.map(b => (
                <div key={b.employeId} className="flex items-center justify-between p-3 bg-slate-800/40 rounded-xl">
                  <div>
                    <p className="text-xs font-semibold text-slate-200">{b.prenom} {b.nom}</p>
                    <p className="text-[10px] text-slate-400">Brut: {fmt(b.brut)} DT | Net: {fmt(b.netAPayer)} DT</p>
                  </div>
                  <button onClick={() => setCurrentBulletin(b)}
                    className="text-[10px] text-brand-400 hover:underline">Voir</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {!bulletins.length && !currentBulletin && (
          <div className="p-6 bg-slate-800/50 rounded-xl text-center">
            <Calculator className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-400">Sélectionnez un mois et un employé, puis cliquez sur Calculer.</p>
          </div>
        )}
      </div>
    );
  };

  const renderDeclarations = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card p-5 rounded-2xl border border-slate-700 shadow-card">
          <h4 className="text-sm font-bold text-slate-100 mb-2">DMS — CNSS Mensuelle</h4>
          <p className="text-[10px] text-slate-400 mb-4">Déclaration Mensuelle des Salaires — à déposer avant le 15 du mois suivant.</p>
          <button onClick={handleExportDMS}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 text-xs font-bold rounded-xl border border-indigo-500/30 transition-all">
            <Download className="w-4 h-4" /> Exporter DMS {moisNom[mois - 1]} {annee} (PDF)
          </button>
        </div>
        <div className="glass-card p-5 rounded-2xl border border-slate-700 shadow-card">
          <h4 className="text-sm font-bold text-slate-100 mb-2">État N° 301 — RS Annuelle</h4>
          <p className="text-[10px] text-slate-400 mb-4">État récapitulatif des retenues à la source (IRPP) — à déposer avant le 5 décembre N+1.</p>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-slate-400">Exercice:</span>
            <input type="number" value={annee} onChange={e => setAnnee(parseInt(e.target.value))}
              className="w-24 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-slate-100 text-xs focus:outline-none focus:border-brand-500" />
          </div>
          <button onClick={handleExport301}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs font-bold rounded-xl border border-emerald-500/30 transition-all">
            <Download className="w-4 h-4" /> Exporter État 301 (PDF)
          </button>
        </div>
      </div>
    </div>
  );

  const renderHistorique = () => {
    const all = getAllBulletins();
    const grouped = {};
    for (const b of all) {
      const key = `${b.annee}-${String(b.mois).padStart(2, '0')}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(b);
    }
    const keys = Object.keys(grouped).sort().reverse();
    return (
      <div className="space-y-3">
        {!keys.length ? (
          <div className="p-6 bg-slate-800/50 rounded-xl text-center">
            <Calendar className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-400">Aucun bulletin archivé.</p>
          </div>
        ) : keys.map(k => {
          const bs = grouped[k];
          const [y, m] = k.split('-');
          const totalBrut = bs.reduce((s, b) => s + b.brut, 0);
          const totalNet = bs.reduce((s, b) => s + b.netAPayer, 0);
          return (
            <div key={k} className="glass-card p-4 rounded-xl border border-slate-700/50">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold text-slate-100">{moisNom[parseInt(m) - 1]} {y}</h4>
                <span className="text-[10px] text-slate-400">{bs.length} bulletin(s)</span>
              </div>
              <div className="space-y-1">
                {bs.map(b => (
                  <div key={b.employeId} className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">{b.prenom} {b.nom}</span>
                    <span className="text-slate-400 font-mono">{fmt(b.brut)} DT → {fmt(b.netAPayer)} DT</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-700/30 mt-2 pt-2 flex justify-between text-xs font-bold">
                <span className="text-slate-400">Totaux</span>
                <span className="text-slate-200 font-mono">{fmt(totalBrut)} DT → {fmt(totalNet)} DT</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/40 p-6 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-400" />
            Gestion de la Paie
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Salaires, CNSS, IRPP et déclarations sociales — conforme LF 2025.
          </p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-slate-800 pb-2">
        <Tab label="Employés" active={tab === 'employes'} onClick={() => setTab('employes')} />
        <Tab label="Bulletins" active={tab === 'bulletins'} onClick={() => setTab('bulletins')} />
        <Tab label="Déclarations" active={tab === 'declarations'} onClick={() => setTab('declarations')} />
        <Tab label="Historique" active={tab === 'historique'} onClick={() => setTab('historique')} />
      </div>

      {msg && (
        <div className={`px-4 py-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
          msg.type === 'success' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
          msg.type === 'error' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
          'bg-blue-500/20 text-blue-400 border border-blue-500/30'
        }`}>
          {msg.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span className="flex-1">{msg.text}</span>
          <button onClick={() => setMsg(null)}><X className="w-3.5 h-3.5 opacity-60 hover:opacity-100" /></button>
        </div>
      )}

      {tab === 'employes' && renderEmployes()}
      {tab === 'bulletins' && renderBulletins()}
      {tab === 'declarations' && renderDeclarations()}
      {tab === 'historique' && renderHistorique()}
    </div>
  );
}
