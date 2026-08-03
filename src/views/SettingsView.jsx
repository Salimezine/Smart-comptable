import React, { useState, useEffect } from 'react';
import { Building, Sparkles, AlertCircle, CheckCircle2, Cloud, Upload, KeyRound } from 'lucide-react';
import { getLearningStats } from '../learningEngine';
import { setTTNMode, getTTNMode } from '../teif';
import { isSupabaseEnabled, migrateLocalToSupabase } from '../utils/supabaseService';
import { getOpenRouterKey, setOpenRouterKey, hasOpenRouterKey } from '../utils/aiOcr';
import OpenRouterGuide from '../components/OpenRouterGuide';

function CloudSyncSection({ companyId }) {
  const [migrating, setMigrating] = useState(false);
  const [migrated, setMigrated] = useState(false);
  const [result, setResult] = useState(null);

  const handleMigrate = async () => {
    setMigrating(true);
    setResult(null);
    const res = await migrateLocalToSupabase(companyId);
    setResult(res);
    setMigrating(false);
    if (res.success) setMigrated(true);
  };

  return (
    <div className="p-4 rounded-xl bg-brand-500/10 border border-brand-500/30 mb-4">
      <div className="flex items-center gap-2 text-brand-400 mb-3">
        <Cloud className="w-4 h-4" />
        <h4 className="text-xs font-extrabold uppercase tracking-wider">Synchronisation Cloud Supabase</h4>
      </div>
      <p className="text-[10px] text-slate-400 mb-3">
        Sauvegardez et synchronisez vos données locales vers le cloud pour y accéder depuis plusieurs appareils.
      </p>
      {result && (
        <div className={`p-3 rounded-xl text-xs mb-3 ${result.success ? 'bg-accent-500/10 text-accent-400 border border-accent-500/25' : 'bg-red-500/10 text-red-400 border border-red-500/25'}`}>
          {result.success
            ? '✅ Données synchronisées avec succès !'
            : `❌ Erreur: ${result.results?.filter(r => r.error).map(r => `${r.table}: ${r.error}`).join(', ') || 'Échec de synchronisation'}`}
        </div>
      )}
      {migrated ? (
        <div className="flex items-center gap-2 text-accent-400 text-xs">
          <CheckCircle2 className="w-4 h-4" /> Synchronisé
        </div>
      ) : (
        <button
          type="button"
          onClick={handleMigrate}
          disabled={migrating}
          className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all"
        >
          <Upload className="w-3.5 h-3.5" />
          {migrating ? 'Synchronisation...' : 'Synchroniser mes données vers le cloud'}
        </button>
      )}
    </div>
  );
}

export default function SettingsView({ companyDetails, setCompanyDetails }) {
  const [success, setSuccess] = useState(false);
  const [stats, setStats] = useState(getLearningStats());
  const [ttnMode, setTtnMode] = useState(() => getTTNMode());
  const [orKey, setOrKey] = useState(() => getOpenRouterKey());
  const [orSaved, setOrSaved] = useState(false);

  useEffect(() => { setStats(getLearningStats()); }, []);

  useEffect(() => { setTtnMode(getTTNMode()); }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    setTTNMode(ttnMode);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2500);
  };

  return (
    <form onSubmit={handleSubmit} className="glass-card p-8 rounded-2xl border border-slate-800 max-w-2xl mx-auto space-y-6">
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div>
          <h3 className="font-extrabold text-slate-100 flex items-center gap-2">
            <Building className="w-5 h-5 text-indigo-400" /> Profil de l'entreprise
          </h3>
          <p className="text-xs text-slate-400 mt-1">Configurez les mentions légales apparaissant sur vos factures et les QR codes.</p>
        </div>
      </div>

      {success && (
        <div className="p-3 bg-accent-500/10 border border-accent-500/25 rounded-xl text-xs font-bold text-accent-400 flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4" /> Paramètres enregistrés avec succès !
        </div>
      )}

      <div className="bg-slate-900/50 p-5 rounded-2xl border border-brand-500/30 space-y-3">
        <div className="flex items-center gap-2 text-brand-400">
          <Sparkles className="w-4 h-4" />
          <h4 className="text-xs font-extrabold uppercase tracking-wider">Moteur IA Local — Apprentissage Actif</h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
          <div className="bg-slate-950/60 rounded-xl p-3">
            <p className="text-xl font-black text-white">{stats.supplierCount}</p>
            <p className="text-[9px] text-slate-400 font-bold uppercase">Fournisseurs mémorisés</p>
          </div>
          <div className="bg-slate-950/60 rounded-xl p-3">
            <p className="text-xl font-black text-white">{stats.patternsCount}</p>
            <p className="text-[9px] text-slate-400 font-bold uppercase">Patterns appris</p>
          </div>
          <div className="bg-slate-950/60 rounded-xl p-3">
            <p className="text-xl font-black text-white">{Object.keys(stats.categories).length}</p>
            <p className="text-[9px] text-slate-400 font-bold uppercase">Catégories SCE</p>
          </div>
        </div>
        {stats.knownSuppliers.length > 0 && (
          <div>
            <p className="text-[10px] text-slate-500 font-bold mb-1.5 uppercase tracking-wider">Fournisseurs Appris</p>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {stats.knownSuppliers.map((s, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-1.5 bg-slate-950/40 rounded-lg">
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-slate-200 truncate block">{s.name}</span>
                    <span className="text-[9px] text-slate-500">{s.count} entrée{s.count > 1 ? 's' : ''}{s.mf ? ' — MF: ' + s.mf : ''}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0 ml-2">{s.total.toFixed(0)} DT</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <p className="text-[9px] text-slate-500 mt-1"><AlertCircle className="w-3 h-3 inline-block mr-1" />L'IA apprend de chaque facture et dépense que vous saisissez. Plus vous l'utilisez, plus les suggestions sont précises.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className="block text-[10px] text-slate-500 font-bold mb-1.5 uppercase">Raison sociale</label>
          <input 
            type="text" 
            required 
            value={companyDetails.name}
            onChange={(e) => setCompanyDetails({...companyDetails, name: e.target.value})}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-100 text-xs focus:outline-none focus:border-brand-500"
          />
        </div>
        <div>
          <label className="block text-[10px] text-slate-500 font-bold mb-1.5 uppercase">E-mail légal</label>
          <input 
            type="email" 
            required 
            value={companyDetails.email}
            onChange={(e) => setCompanyDetails({...companyDetails, email: e.target.value})}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-100 text-xs focus:outline-none focus:border-brand-500"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-[10px] text-slate-500 font-bold mb-1.5 uppercase">Adresse physique</label>
          <input 
            type="text" 
            required 
            value={companyDetails.address}
            onChange={(e) => setCompanyDetails({...companyDetails, address: e.target.value})}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-100 text-xs focus:outline-none focus:border-brand-500"
          />
        </div>
        <div>
          <label className="block text-[10px] text-slate-500 font-bold mb-1.5 uppercase">Matricule Fiscal (MF)</label>
          <input 
            type="text" 
            required 
            value={companyDetails.vatNumber}
            onChange={(e) => setCompanyDetails({...companyDetails, vatNumber: e.target.value})}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-100 text-xs focus:outline-none focus:border-brand-500"
          />
        </div>
        <div>
          <label className="block text-[10px] text-slate-500 font-bold mb-1.5 uppercase">Devise de l'exercice</label>
          <select 
            value={companyDetails.currency}
            onChange={(e) => setCompanyDetails({...companyDetails, currency: e.target.value})}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-100 text-xs focus:outline-none focus:border-brand-500"
          >
            <option value="TND">Dinar Tunisien (DT)</option>
            <option value="EUR">Euro (€)</option>
            <option value="USD">Dollar Américain ($)</option>
            <option value="MAD">Dirham Marocain (MAD)</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-slate-500 font-bold mb-1.5 uppercase">RIB Bancaire (Compte courant)</label>
          <input 
            type="text" 
            required 
            value={companyDetails.iban}
            onChange={(e) => setCompanyDetails({...companyDetails, iban: e.target.value})}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-100 text-xs focus:outline-none focus:border-brand-500"
          />
        </div>
        <div>
          <label className="block text-[10px] text-slate-500 font-bold mb-1.5 uppercase">Code Swift de la Banque</label>
          <input 
            type="text" 
            required 
            value={companyDetails.bic}
            onChange={(e) => setCompanyDetails({...companyDetails, bic: e.target.value})}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-100 text-xs focus:outline-none focus:border-brand-500"
          />
        </div>
      </div>

      {/* ── Supabase Cloud Sync ── */}
      {isSupabaseEnabled() && (
        <CloudSyncSection companyId={localStorage.getItem('smart_comptable_current_id')} />
      )}

      {/* ── Clé IA OpenRouter ── */}
      <div className="p-4 rounded-xl bg-slate-800/40 border border-indigo-500/20">
        <div className="flex items-center gap-2 text-indigo-400 mb-2">
          <KeyRound className="w-4 h-4" />
          <h4 className="text-xs font-extrabold uppercase tracking-wider">Clé IA OpenRouter (gratuite)</h4>
          {hasOpenRouterKey() && (
            <span className="ml-auto px-2 py-0.5 rounded-full bg-accent-500/15 border border-accent-500/30 text-[9px] font-bold text-accent-400">✓ Configurée</span>
          )}
        </div>
        <p className="text-[10px] text-slate-400 mb-3">
          Utilisée pour l'assistant IA (chat), l'OCR et l'analyse IA de l'audit. Stockée uniquement sur votre appareil.
        </p>
        <div className="flex gap-2">
          <input
            type="password"
            value={orKey}
            onChange={(e) => setOrKey(e.target.value)}
            placeholder="sk-or-..."
            className="flex-1 bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-slate-100 text-xs focus:outline-none font-mono"
          />
          <button
            type="button"
            onClick={() => { setOpenRouterKey(orKey.trim()); setOrSaved(true); setTimeout(() => setOrSaved(false), 2000); }}
            disabled={!orKey.trim()}
            className="px-4 py-2.5 bg-indigo-600/80 hover:bg-indigo-500 disabled:opacity-30 text-white text-xs font-bold rounded-xl transition-all"
          >
            Enregistrer
          </button>
        </div>
        {orSaved && (
          <p className="mt-2 text-[10px] font-bold text-accent-400 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Clé OpenRouter enregistrée !
          </p>
        )}
        <div className="mt-3">
          <OpenRouterGuide />
        </div>
      </div>

      <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/40">
        <h4 className="text-xs font-bold text-slate-300 mb-3"> Configuration TEIF (Facture Électronique)</h4>
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-medium text-slate-400 mb-1">RNE (Registre National des Entreprises)</label>
            <input value={companyDetails?.rne || ''} onChange={e => setCompanyDetails(p => ({...p, rne: e.target.value}))} placeholder="Numéro RNE" className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700/60 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"/>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-slate-400 mb-1">Adresse</label>
            <input value={companyDetails?.address || ''} onChange={e => setCompanyDetails(p => ({...p, address: e.target.value}))} placeholder="Adresse complète" className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700/60 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"/>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-slate-400 mb-1">Code Catégorie (TTN)</label>
            <select value={companyDetails?.ttnCategoryCode || '43211000'} onChange={e => setCompanyDetails(p => ({...p, ttnCategoryCode: e.target.value}))} className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700/60 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/50">
              <option value="43211000">43211000 - Services informatiques</option>
              <option value="47111000">47111000 - Commerce de gros</option>
              <option value="47191000">47191000 - Commerce de détail</option>
              <option value="69101000">69101000 - Services comptables</option>
              <option value="70221000">70221000 - Conseil en gestion</option>
              <option value="62011000">62011000 - Développement logiciel</option>
              <option value="86101000">86101000 - Services de santé</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-[10px] font-medium text-slate-400">Mode TTN:</label>
            <button type="button" onClick={() => {
              const modes = ['dev', 'prod', 'middleware', 'auto'];
              const idx = modes.indexOf(ttnMode);
              const next = modes[(idx + 1) % modes.length];
              setTtnMode(next);
            }} className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${ttnMode === 'auto' ? 'bg-indigo-600/80 text-indigo-200' : ttnMode === 'dev' ? 'bg-amber-600/80 text-amber-200' : ttnMode === 'prod' ? 'bg-emerald-600/80 text-emerald-200' : 'bg-blue-600/80 text-blue-200'}`}>
              {ttnMode === 'auto' ? '🤖 Auto (détection)' : ttnMode === 'dev' ? '🧪 Développement (mock)' : ttnMode === 'prod' ? '🚀 Production (SFTP)' : '🔌 Middleware (API REST)'}
            </button>
          </div>
          <p className="text-[10px] text-slate-500">En mode <strong>Auto</strong>, le système teste automatiquement la connexion TTN via le middleware ; si TTN est joignable, la soumission se fait via l'API, sinon en mode développement simulé.</p>

          {(ttnMode === 'middleware' || ttnMode === 'auto') && (
            <div className="space-y-3 mt-3 p-3 rounded-xl bg-slate-900/60 border border-blue-500/20">
              <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Configuration Middleware & NGSign {ttnMode === 'auto' ? '(requis pour le mode Auto)' : ''}</p>
              <div>
                <label className="block text-[10px] font-medium text-slate-400 mb-1">URL du middleware</label>
                <input value={companyDetails?.middlewareUrl || ''} onChange={e => setCompanyDetails(p => ({...p, middlewareUrl: e.target.value}))} placeholder="https://elfatoora-middleware-app-production.up.railway.app" className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700/60 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50"/>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-slate-400 mb-1">Token API</label>
                <input type="password" value={companyDetails?.middlewareToken || ''} onChange={e => setCompanyDetails(p => ({...p, middlewareToken: e.target.value}))} placeholder="Bearer token" className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700/60 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50"/>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-slate-400 mb-1">Email signataire NGSign</label>
                <input type="email" value={companyDetails?.ngsignSignerEmail || ''} onChange={e => setCompanyDetails(p => ({...p, ngsignSignerEmail: e.target.value}))} placeholder="signataire@entreprise.tn" className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700/60 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50"/>
              </div>
              <p className="text-[10px] text-blue-300/70">L'email du signataire est requis pour la signature NGSign. Le token API NGSign est configurable côté middleware via la route <code className="text-blue-300">/v1/clients</code>.</p>
            </div>
          )}
        </div>
      </div>

      <div className="pt-4">
        <button 
          type="submit" 
          className="w-full py-2.5 bg-gradient-brand text-white font-bold rounded-xl text-xs shadow-glow hover:opacity-90 transition-all"
        >
          Sauvegarder les modifications
        </button>
      </div>
    </form>
  );
}
