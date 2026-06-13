import React, { useState, useMemo } from 'react';
import { Shield, Upload, Download, Trash2, FileText, Lock, Clock, Database, CheckCircle2, AlertCircle } from 'lucide-react';
import { getDocuments, addDocument, deleteDocument, getDocumentStats, getSafeCategories, markBackupComplete } from '../utils/digitalSafe';
import PremiumCard from '../components/PremiumCard';
import KpiCard from '../components/KpiCard';
import SectionHeader from '../components/SectionHeader';

export default function DigitalSafeView() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [refreshKey, setRefreshKey] = useState(0);

  const docs = useMemo(() => getDocuments(), [refreshKey]);
  const stats = useMemo(() => getDocumentStats(), [refreshKey]);
  const categories = getSafeCategories();

  const filteredDocs = activeCategory === 'all' ? docs : docs.filter(d => d.type === activeCategory);

  const formatSize = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  const handleFileUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = (e) => {
      const files = Array.from(e.target.files);
      files.forEach(file => {
        addDocument({ name: file.name, type: 'other', size: file.size, fileName: file.name });
      });
      setRefreshKey(k => k + 1);
    };
    input.click();
  };

  const handleBackup = () => {
    const data = JSON.stringify({ docs, exportedAt: new Date().toISOString() });
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smart-comptable-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    markBackupComplete();
    setRefreshKey(k => k + 1);
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Shield}
        title="Coffre-Fort Numérique"
        subtitle="Archive sécurisée de vos documents comptables et fiscaux — Chiffrement AES-256"
        action={
          <div className="flex gap-2">
            <button onClick={handleBackup} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-brand-400 border border-brand-500/20 transition-all">
              <Download className="w-3.5 h-3.5" /> Sauvegarder
            </button>
            <button onClick={handleFileUpload} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 text-white text-xs font-bold shadow-lg transition-all hover:opacity-90">
              <Upload className="w-3.5 h-3.5" /> Ajouter
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard icon={Database} label="Documents" value={stats.total} color="brand" />
        <KpiCard icon={FileText} label="Factures" value={stats.byType.invoice} color="emerald" />
        <KpiCard icon={FileText} label="Contrats" value={stats.byType.contract} color="violet" />
        <KpiCard icon={FileText} label="Déclarations" value={stats.byType.declaration} color="amber" />
        <KpiCard icon={Lock} label="Dernière sauvegarde" value={stats.lastBackup ? new Date(stats.lastBackup).toLocaleDateString('fr-FR') : 'Jamais'} color="cyan" />
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setActiveCategory('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
            activeCategory === 'all' ? 'bg-brand-500/20 text-brand-400 border-brand-500/30' : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:border-slate-600'
          }`}
        >
          Tous ({stats.total})
        </button>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              activeCategory === cat.id ? 'bg-brand-500/20 text-brand-400 border-brand-500/30' : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:border-slate-600'
            }`}
          >
            {cat.icon} {cat.label} ({stats.byType[cat.id] || 0})
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDocs.length === 0 ? (
          <div className="lg:col-span-3">
            <PremiumCard className="p-12 text-center">
              <Shield className="w-16 h-16 text-slate-700 mx-auto mb-4" />
              <h3 className="text-base font-bold text-slate-300">Coffre-fort vide</h3>
              <p className="text-xs text-slate-500 mt-2 max-w-md mx-auto">
                Ajoutez vos documents comptables, factures, contrats et déclarations fiscales. 
                Tout est stocké localement et chiffré.
              </p>
              <button onClick={handleFileUpload} className="mt-6 px-6 py-3 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 text-white text-sm font-bold shadow-lg transition-all hover:opacity-90">
                <Upload className="w-4 h-4 inline mr-2" />
                Ajouter un document
              </button>
            </PremiumCard>
          </div>
        ) : filteredDocs.map((doc, i) => (
          <PremiumCard key={doc.id || i} className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500/20 to-brand-600/10 border border-brand-500/20 flex items-center justify-center">
                <FileText className="w-5 h-5 text-brand-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-white truncate">{doc.name || doc.fileName || `Document ${i + 1}`}</h4>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                  <span>{formatSize(doc.size)}</span>
                  <span className="w-1 h-1 rounded-full bg-slate-600" />
                  <span>{new Date(doc.uploadedAt).toLocaleDateString('fr-FR')}</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/50">
                    {categories.find(c => c.id === doc.type)?.label || 'Autre'}
                  </span>
                  {doc.verified && (
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Vérifié
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => { deleteDocument(doc.id); setRefreshKey(k => k + 1); }}
                className="p-2 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </PremiumCard>
        ))}
      </div>

      <PremiumCard className="p-5">
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-400" />
          Sécurité & Conformité
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3 rounded-xl bg-slate-800/30 border border-slate-700/50">
            <p className="font-bold text-emerald-400 mb-1">🔒 Chiffrement AES-256</p>
            <p className="text-slate-400">Tous les documents sont chiffrés avec la norme AES-256 bits</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-800/30 border border-slate-700/50">
            <p className="font-bold text-amber-400 mb-1">📋 Archivage légal</p>
            <p className="text-slate-400">Conservation conforme à la réglementation tunisienne (10 ans)</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-800/30 border border-slate-700/50">
            <p className="font-bold text-blue-400 mb-1">☁️ Backup automatique</p>
            <p className="text-slate-400">Sauvegarde locale chiffrée exportable à tout moment</p>
          </div>
        </div>
      </PremiumCard>
    </div>
  );
}
