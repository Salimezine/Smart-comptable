import React, { useState, useEffect, useMemo } from 'react';
import { Filter, RotateCcw, Search, X, Download, Eye, Edit3, Save, XCircle } from 'lucide-react';
import { computeBalances, buildBalanceGenerale } from './utils/pcgTn';
import { getDocument } from './utils/docStore';

const JOURNAL_KEY = 'smart_journal';

export default function JournalView({ formatCurrency, invoices = [], expenses = [], transactions = [] }) {
  const [journal, setJournal] = useState([]);
  const [filter, setFilter] = useState('all');
  const [showBalance, setShowBalance] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [montantMin, setMontantMin] = useState('');
  const [montantMax, setMontantMax] = useState('');
  const [docImages, setDocImages] = useState({});
  const [previewDoc, setPreviewDoc] = useState(null);
  const [detailPiece, setDetailPiece] = useState(null);
  const [editingPiece, setEditingPiece] = useState(null);
  const [editData, setEditData] = useState(null);

  const saveEditPiece = () => {
    if (!editData || !editingPiece) return;
    try {
      const raw = localStorage.getItem(JOURNAL_KEY);
      let entries = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(entries)) entries = [];
      const filtered = entries.filter(e => e.numeroPiece !== editingPiece);
      filtered.unshift(...editData.lines);
      localStorage.setItem(JOURNAL_KEY, JSON.stringify(filtered));
      window.dispatchEvent(new CustomEvent('journal:updated'));
      setEditingPiece(null);
      setEditData(null);
      setDetailPiece(null);
    } catch (e) {
      console.error('Save edit failed:', e);
    }
  };

  const startEdit = (pieceKey, lines) => {
    setEditingPiece(pieceKey);
    setEditData({
      lines: lines.map(l => ({ ...l })),
      first: { ...lines[0] },
    });
  };

  const updateEditLine = (i, field, value) => {
    setEditData(prev => {
      const lines = prev.lines.map((l, idx) => idx === i ? { ...l, [field]: value } : l);
      return { ...prev, lines };
    });
  };

  const updateEditFirst = (field, value) => {
    setEditData(prev => {
      const lines = prev.lines.map(l => ({ ...l, [field]: value }));
      return { ...prev, first: { ...prev.first, [field]: value }, lines };
    });
  };

  const loadJournal = () => {
    try {
      const raw = localStorage.getItem(JOURNAL_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        setJournal(Array.isArray(data) ? data : []);
      } else {
        setJournal([]);
      }
    } catch {
      setJournal([]);
    }
  };

  useEffect(() => {
    loadJournal();
    const handler = () => loadJournal();
    window.addEventListener('journal:updated', handler);
    return () => window.removeEventListener('journal:updated', handler);
  }, []);

  const fallbackEntries = useMemo(() => {
    return [];
  }, [invoices, expenses, transactions]);

  const displayJournal = journal.length > 0 ? journal : fallbackEntries;

  console.log('ENTRY SAMPLE:', displayJournal[0]);

  const filtered = displayJournal.filter(e => {
    if (filter !== 'all' && e.journal !== filter) return false;
    if (searchText) {
      const q = searchText.toLowerCase();
      const matchLibelle = (e.libelle || '').toLowerCase().includes(q);
      const matchCompte = (e.compte || '').toLowerCase().includes(q);
      const matchPiece = (e.numeroPiece || '').toLowerCase().includes(q);
      if (!matchLibelle && !matchCompte && !matchPiece) return false;
    }
    if (dateFrom && e.date && e.date < dateFrom) return false;
    if (dateTo && e.date && e.date > dateTo) return false;
    const mt = parseFloat(e.debit) || parseFloat(e.credit) || 0;
    if (montantMin && mt < parseFloat(montantMin)) return false;
    if (montantMax && mt > parseFloat(montantMax)) return false;
    return true;
  });

  const totalDebit = filtered.reduce((s, e) => s + (parseFloat(e.debit) || 0), 0);
  const totalCredit = filtered.reduce((s, e) => s + (parseFloat(e.credit) || 0), 0);
  const equilibre = Math.abs(totalDebit - totalCredit) < 0.01;

  useEffect(() => {
    const pieceIds = [...new Set(filtered.map(e => e.numeroPiece).filter(Boolean))];
    const justifIds = [...new Set(filtered.map(e => e.piece_justificative).filter(Boolean))];
    const allIds = [...new Set([...pieceIds, ...justifIds])];
    if (allIds.length === 0) { setDocImages({}); return; }
    let cancelled = false;
    (async () => {
      const docs = {};
      for (const id of allIds) {
        const data = await getDocument(id);
        if (data) docs[id] = data;
      }
      if (!cancelled) setDocImages(docs);
    })();
    return () => { cancelled = true; };
  }, [filtered]);

  const balances = computeBalances(displayJournal);
  const balanceGenerale = buildBalanceGenerale(balances);

  const fmt = v => typeof v === 'number' ? v.toFixed(3) : v;

  const exportPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const title = showBalance ? 'Balance Générale' : 'Journal Comptable';
    const filterLabel = filter === 'all' ? 'Tous' : filter;
    doc.setFontSize(14);
    doc.text(title, 14, 15);
    doc.setFontSize(8);
    doc.text(`Filtre: ${filterLabel} | ${filtered.length} écritures`, 14, 22);
    if (showBalance) {
      const rows = balanceGenerale.map(b => [
        b.compte, fmt(b.debitTotal), fmt(b.creditTotal),
        b.soldeDebiteur > 0 ? fmt(b.soldeDebiteur) : '-',
        b.soldeCrediteur > 0 ? fmt(b.soldeCrediteur) : '-'
      ]);
      autoTable(doc, {
        head: [['Compte', 'Total Débit', 'Total Crédit', 'Solde Débiteur', 'Solde Créditeur']],
        body: rows, startY: 28,
        styles: { fontSize: 7 },
        headStyles: { fillColor: [30, 41, 59] },
      });
    } else {
      const rows = filtered.map(e => [
        e.date || '', e.numeroPiece || '', e.compte || '',
        (e.libelle || '').substring(0, 50),
        e.debit ? fmt(e.debit) : '-', e.credit ? fmt(e.credit) : '-',
        e.journal || '', e.piece_justificative || ''
      ]);
      autoTable(doc, {
        head: [['Date', 'N° Pièce', 'Compte', 'Libellé', 'Débit', 'Crédit', 'Journal', 'Pièce justificative']],
        body: rows, startY: 28,
        styles: { fontSize: 7 },
        headStyles: { fillColor: [30, 41, 59] },
        foot: [['', '', '', 'Total', fmt(totalDebit), fmt(totalCredit), '', '']],
        footStyles: { fontSize: 7, fontStyle: 'bold' },
      });
    }
    doc.save(`comptable_${title.toLowerCase().replace(/\s/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };
  const resetFilters = () => {
    setSearchText('');
    setDateFrom('');
    setDateTo('');
    setMontantMin('');
    setMontantMax('');
    setFilter('all');
  };

  const hasActiveFilters = searchText || dateFrom || dateTo || montantMin || montantMax || filter !== 'all';

  return (
    <div className="space-y-4">
      {/* Filtres avancés */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="w-4 h-4 text-slate-400" />
        <select value={filter} onChange={e => setFilter(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-brand-500">
          <option value="all">Tous les journaux</option>
          <option value="ACH">Achats</option>
          <option value="VNT">Ventes</option>
          <option value="OD">Opérations Diverses</option>
          <option value="BQ">Banque</option>
          <option value="CAI">Caisse</option>
          <option value="AN">À Nouveau</option>
          <option value="INV">Inventaire</option>
        </select>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input type="text" placeholder="Rechercher..." value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-brand-500 w-40" />
        </div>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-brand-500 w-36" />
        <span className="text-slate-600 text-xs">→</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-brand-500 w-36" />
        <input type="number" placeholder="Min DT" value={montantMin}
          onChange={e => setMontantMin(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-brand-500 w-24" />
        <span className="text-slate-600 text-xs">→</span>
        <input type="number" placeholder="Max DT" value={montantMax}
          onChange={e => setMontantMax(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-brand-500 w-24" />
        <span className="text-[10px] text-slate-500 whitespace-nowrap">{filtered.length} écriture{filtered.length > 1 ? 's' : ''}</span>
        <div className="flex items-center gap-1 ml-auto">
          {hasActiveFilters && (
            <button onClick={resetFilters}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs rounded-xl transition-colors text-slate-400">
              <X className="w-3 h-3" /> Réinitialiser
            </button>
          )}
          <button onClick={exportPDF}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs rounded-xl transition-colors text-slate-400">
            <Download className="w-3 h-3" /> PDF
          </button>
          <button onClick={() => { loadJournal(); setShowBalance(!showBalance); }}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs rounded-xl transition-colors">
            <RotateCcw className="w-3 h-3" />
            {showBalance ? 'Journal' : 'Balance Générale'}
          </button>
        </div>
      </div>

      {showBalance ? (
        <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/50 border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                  <th className="py-4 px-6">Compte</th>
                  <th className="py-4 px-6 text-right">Total Débit</th>
                  <th className="py-4 px-6 text-right">Total Crédit</th>
                  <th className="py-4 px-6 text-right">Solde Débiteur</th>
                  <th className="py-4 px-6 text-right">Solde Créditeur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-xs">
                {balanceGenerale.length === 0 ? (
                  <tr><td colSpan={5} className="py-12 text-center text-slate-500">Aucun mouvement.</td></tr>
                ) : (
                  balanceGenerale.map((b, i) => (
                    <tr key={i} className="hover:bg-slate-800/10 transition-colors">
                      <td className="py-3 px-6 font-mono text-slate-300">{b.compte}</td>
                      <td className="py-3 px-6 text-right text-slate-300">{formatCurrency(b.debitTotal)}</td>
                      <td className="py-3 px-6 text-right text-slate-300">{formatCurrency(b.creditTotal)}</td>
                      <td className="py-3 px-6 text-right text-danger-400 font-semibold">
                        {b.soldeDebiteur > 0 ? formatCurrency(b.soldeDebiteur) : '-'}
                      </td>
                      <td className="py-3 px-6 text-right text-accent-400 font-semibold">
                        {b.soldeCrediteur > 0 ? formatCurrency(b.soldeCrediteur) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/50 border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                  <th className="py-4 px-6">Date</th>
                  <th className="py-4 px-6">N° Pièce</th>
                  <th className="py-4 px-6">Compte</th>
                  <th className="py-4 px-6">Libellé</th>
                  <th className="py-4 px-6 text-right">Débit</th>
                  <th className="py-4 px-6 text-right">Crédit</th>
                  <th className="py-4 px-6 text-center">Journal</th>
                  <th className="py-4 px-6 text-center">Pièce justificative</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-xs">
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="py-12 text-center text-slate-500">Aucune écriture trouvée. Scannez une facture pour créer une écriture.</td></tr>
                ) : (
                  (() => {
                    const groups = new Map();
                    filtered.forEach(e => {
                      const key = e.numeroPiece || 'N/A';
                      if (!groups.has(key)) groups.set(key, []);
                      groups.get(key).push(e);
                    });
                    const rows = [];
                    let idx = 0;
                    for (const [piece, lines] of groups) {
                      const totalDeb = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
                      const totalCred = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
                      const balanced = Math.abs(totalDeb - totalCred) < 0.001;
                      const date = lines[0].date || '';
                      const journal = lines[0].journal || '';
                      lines.forEach((l, li) => {
                        rows.push(
                          <tr key={idx++} className={`hover:bg-slate-800/10 transition-colors ${li === 0 ? 'border-t border-slate-700/50' : ''}`}>
                            <td className="py-4 px-6 text-slate-400 font-mono">{li === 0 ? date : ''}</td>
                            <td className="py-4 px-6 font-bold text-slate-300">
                              {li === 0 ? (
                                <button onClick={() => setDetailPiece(piece)}
                                  className="hover:text-indigo-400 transition-colors cursor-pointer underline decoration-dotted underline-offset-2">
                                  {piece}
                                </button>
                              ) : ''}
                            </td>
                            <td className="py-4 px-6 font-mono text-slate-300">{l.compte}</td>
                            <td className="py-4 px-6 text-slate-200">{l.libelle}</td>
                            <td className="py-4 px-6 text-right text-danger-400 font-semibold">
                              {l.debit && l.debit !== 0
                                ? Number(l.debit).toFixed(3) + ' DT'
                                : <span className="text-slate-600">&mdash;</span>}
                            </td>
                            <td className="py-4 px-6 text-right text-accent-400 font-semibold">
                              {l.credit && l.credit !== 0
                                ? Number(l.credit).toFixed(3) + ' DT'
                                : <span className="text-slate-600">&mdash;</span>}
                            </td>
                            <td className="py-4 px-6 text-center">
                              {li === 0 && (
                                <span className={`text-[10px] px-2 py-0.5 rounded-full ${balanced ? 'bg-indigo-500/10 text-indigo-400' : 'bg-danger-500/10 text-danger-400'}`}>
                                  {journal}{!balanced ? ' ✗' : ''}
                                </span>
                              )}
                            </td>
                            <td className="py-4 px-6 text-center">
                              {li === 0 && (
                                (() => {
                                  const docKey = docImages[piece] ? piece : (lines[0].piece_justificative && docImages[lines[0].piece_justificative] ? lines[0].piece_justificative : null);
                                  const docData = docKey ? docImages[docKey] : null;
                                  return docData ? (
                                    <button onClick={() => setPreviewDoc(docData)}
                                      className="text-indigo-400 hover:text-indigo-300 transition-colors inline-flex items-center gap-1"
                                      title="Voir la pièce justificative">
                                      <Eye className="w-3.5 h-3.5" />
                                      <span className="text-[10px]">{lines[0].piece_justificative || piece}</span>
                                    </button>
                                  ) : (
                                    <span className="text-slate-500 text-[10px]">{lines[0].piece_justificative || piece}</span>
                                  );
                                })()
                              )}
                            </td>
                          </tr>
                        );
                      });
                      if (lines.length > 1) {
                        rows.push(
                          <tr key={idx++} className="bg-slate-900/30 text-[10px] text-slate-500">
                            <td colSpan={2}></td>
                            <td className="py-2 px-6 font-bold">{balanced ? '✓ Équilibré' : '✗ Déséquilibré'}</td>
                            <td className="py-2 px-6">Total pièce</td>
                            <td className="py-2 px-6 text-right text-danger-400">{Number(totalDeb).toFixed(3)} DT</td>
                            <td className="py-2 px-6 text-right text-accent-400">{Number(totalCred).toFixed(3)} DT</td>
                            <td></td>
                            <td></td>
                          </tr>
                        );
                      }
                    }
                    return rows;
                  })()
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!showBalance && (
        <div className="flex justify-end gap-6 text-xs">
          <span>Total Débit: <strong className="text-danger-400">{formatCurrency(totalDebit)}</strong></span>
          <span>Total Crédit: <strong className="text-accent-400">{formatCurrency(totalCredit)}</strong></span>
          <span className={equilibre ? 'text-accent-400' : 'text-danger-400'}>
            {equilibre ? '✓ Équilibré' : '✗ Déséquilibré'}
          </span>
        </div>
      )}

      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPreviewDoc(null)}>
          <div className="relative max-w-3xl max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <button onClick={() => setPreviewDoc(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-lg hover:bg-slate-700 z-10">
              &times;
            </button>
            <img src={previewDoc} alt="Pièce justificative" className="max-w-full max-h-[85vh] rounded-xl border border-slate-700 shadow-2xl" />
          </div>
        </div>
      )}

      {detailPiece && !editingPiece && (() => {
        const lines = displayJournal.filter(e => e.numeroPiece === detailPiece);
        if (lines.length === 0) return null;
        const totalDeb = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
        const totalCred = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
        const balanced = Math.abs(totalDeb - totalCred) < 0.001;
        const first = lines[0];
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setDetailPiece(null)}>
            <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Pièce {detailPiece}</h3>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {first.date} &middot; Journal {first.journal}
                    {first.fournisseur ? ` &middot; ${first.fournisseur}` : ''}
                    {first.piece_justificative ? ` &middot; n° ${first.piece_justificative}` : ''}
                    {first.categorie ? ` &middot; ${first.categorie}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => startEdit(detailPiece, lines)}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 text-[10px] rounded-xl transition-colors">
                    <Edit3 className="w-3 h-3" /> Modifier
                  </button>
                  <button onClick={() => setDetailPiece(null)}
                    className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center hover:bg-slate-700 hover:text-white transition-colors">
                    &times;
                  </button>
                </div>
              </div>
              {(() => {
                const docKey = docImages[detailPiece] ? detailPiece : (first.piece_justificative && docImages[first.piece_justificative] ? first.piece_justificative : null);
                const docData = docKey ? docImages[docKey] : null;
                return docData ? (
                  <div className="flex justify-center">
                    <button onClick={() => setPreviewDoc(docData)}
                      className="group relative max-h-48 rounded-xl overflow-hidden border border-slate-700 hover:border-indigo-500 transition-all">
                      <img src={docData} alt="Pièce justificative"
                        className="max-h-48 object-contain" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                        <Eye className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </button>
                  </div>
                ) : null;
              })()}
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="text-[10px] uppercase text-slate-500 border-b border-slate-800">
                    <th className="py-2 pr-4">Compte</th>
                    <th className="py-2 pr-4">Libellé</th>
                    <th className="py-2 pr-4 text-right">Débit</th>
                    <th className="py-2 pr-4 text-right">Crédit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {lines.map((l, i) => (
                    <tr key={i} className="hover:bg-slate-800/20 transition-colors">
                      <td className="py-2 pr-4 font-mono text-slate-300">{l.compte}</td>
                      <td className="py-2 pr-4 text-slate-200">{l.libelle}</td>
                      <td className="py-2 pr-4 text-right text-danger-400">{l.debit ? Number(l.debit).toFixed(3) + ' DT' : <span className="text-slate-600">&mdash;</span>}</td>
                      <td className="py-2 pr-4 text-right text-accent-400">{l.credit ? Number(l.credit).toFixed(3) + ' DT' : <span className="text-slate-600">&mdash;</span>}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-700 text-xs font-bold">
                    <td className="py-3 pr-4"></td>
                    <td className="py-3 pr-4">{balanced ? '✓ Équilibré' : '✗ Déséquilibré'}</td>
                    <td className="py-3 pr-4 text-right text-danger-400">{totalDeb.toFixed(3)} DT</td>
                    <td className="py-3 pr-4 text-right text-accent-400">{totalCred.toFixed(3)} DT</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        );
      })()}

      {editingPiece && editData && (() => {
        const totalDeb = editData.lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
        const totalCred = editData.lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
        const balanced = Math.abs(totalDeb - totalCred) < 0.001;
        const first = editData.first;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => { setEditingPiece(null); setEditData(null); }}>
            <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between">
                <h3 className="text-sm font-bold text-white">Modifier {editingPiece}</h3>
                <div className="flex items-center gap-2">
                  <button onClick={saveEditPiece}
                    className="flex items-center gap-1 px-3 py-1.5 bg-accent-500 hover:bg-accent-400 text-white text-[10px] font-bold rounded-xl transition-colors">
                    <Save className="w-3 h-3" /> Sauvegarder
                  </button>
                  <button onClick={() => { setEditingPiece(null); setEditData(null); }}
                    className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center hover:bg-slate-700 hover:text-white transition-colors">
                    <XCircle className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">Date</label>
                  <input type="date" value={first.date || ''} onChange={e => updateEditFirst('date', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-300 focus:outline-none focus:border-brand-500" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">Journal</label>
                  <input type="text" value={first.journal || ''} onChange={e => updateEditFirst('journal', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-300 font-mono focus:outline-none focus:border-brand-500" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">Pièce justificative</label>
                  <input type="text" value={first.piece_justificative || ''} onChange={e => updateEditFirst('piece_justificative', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-300 font-mono focus:outline-none focus:border-brand-500" />
                </div>
              </div>
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="text-[10px] uppercase text-slate-500 border-b border-slate-800">
                    <th className="py-2 pr-4">Compte</th>
                    <th className="py-2 pr-4">Libellé</th>
                    <th className="py-2 pr-4 text-right w-28">Débit</th>
                    <th className="py-2 pr-4 text-right w-28">Crédit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {editData.lines.map((l, i) => (
                    <tr key={i}>
                      <td className="py-1.5 pr-2">
                        <input type="text" value={l.compte || ''} onChange={e => updateEditLine(i, 'compte', e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-300 font-mono focus:outline-none focus:border-brand-500" />
                      </td>
                      <td className="py-1.5 pr-2">
                        <input type="text" value={l.libelle || ''} onChange={e => updateEditLine(i, 'libelle', e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-300 focus:outline-none focus:border-brand-500" />
                      </td>
                      <td className="py-1.5 pr-2">
                        <input type="number" step="0.001" value={l.debit ?? ''} onChange={e => updateEditLine(i, 'debit', e.target.value === '' ? null : parseFloat(e.target.value))}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-right text-slate-300 font-mono focus:outline-none focus:border-brand-500" />
                      </td>
                      <td className="py-1.5 pr-2">
                        <input type="number" step="0.001" value={l.credit ?? ''} onChange={e => updateEditLine(i, 'credit', e.target.value === '' ? null : parseFloat(e.target.value))}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-right text-slate-300 font-mono focus:outline-none focus:border-brand-500" />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-700 text-xs font-bold">
                    <td className="py-3 pr-4"></td>
                    <td className={`py-3 pr-4 ${balanced ? 'text-accent-400' : 'text-danger-400'}`}>
                      {balanced ? '✓ Équilibré' : '✗ Déséquilibré — ' + (totalDeb - totalCred).toFixed(3) + ' DT d\'écart'}
                    </td>
                    <td className="py-3 pr-4 text-right text-danger-400">{totalDeb.toFixed(3)} DT</td>
                    <td className="py-3 pr-4 text-right text-accent-400">{totalCred.toFixed(3)} DT</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
