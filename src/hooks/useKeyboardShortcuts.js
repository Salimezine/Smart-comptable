import { useEffect, useRef } from 'react';
import { useToast } from '../components/Toast';

const SHORTCUTS_DATA = [
  { section: 'Navigation', items: [
    { label: 'Tableau de bord', keys: ['Ctrl', 'Shift', '1'] },
    { label: 'Saisie manuelle', keys: ['Ctrl', 'Shift', '2'] },
    { label: 'Scan reçus', keys: ['Ctrl', 'Shift', '3'] },
    { label: 'Journal', keys: ['Ctrl', 'Shift', '4'] },
    { label: 'Factures', keys: ['Ctrl', 'Shift', '5'] },
    { label: 'Fournisseurs', keys: ['Ctrl', 'Shift', '6'] },
    { label: 'Rapprochement', keys: ['Ctrl', 'Shift', '7'] },
    { label: 'Déclarations', keys: ['Ctrl', 'Shift', '8'] },
    { label: 'Paie', keys: ['Ctrl', 'Shift', '9'] },
    { label: 'Configuration', keys: ['Ctrl', 'Shift', '0'] },
  ]},
  { section: 'Saisie (inspiré Sage)', items: [
    { label: 'Valider / Enregistrer', keys: ['Ctrl', 'Enter'] },
    { label: 'Ajouter une ligne', keys: ['Ctrl', 'Shift', 'L'] },
    { label: 'Insérer ligne', keys: ['Ctrl', 'Ins'] },
    { label: 'Supprimer ligne', keys: ['Ctrl', 'Suppr'] },
    { label: 'Nouvelle facture', keys: ['Ctrl', 'N'] },
    { label: 'Recherche fiche', keys: ['F2'] },
    { label: 'Aide contextuelle', keys: ['F1'] },
  ]},
  { section: 'Modaux & Recherche', items: [
    { label: 'Recherche rapide', keys: ['Ctrl', 'K'] },
    { label: 'Rechercher (alt.)', keys: ['Ctrl', 'F'] },
    { label: 'Aide raccourcis', keys: ['?'] },
    { label: 'Aide raccourcis (alt.)', keys: ['Ctrl', '/'] },
    { label: 'Fermer modaux', keys: ['Esc'] },
  ]},
];

export default function useKeyboardShortcuts({
  setCurrentTab,
  setSearchOpen,
  searchRef,
  openCommandPalette,
}) {
  const modalElRef = useRef(null);
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const openShortcutsModal = () => {
    if (modalElRef.current) return;
    const overlay = document.createElement('div');
    overlay.id = 'shortcuts-debug';
    overlay.className = 'fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4';
    overlay.onclick = () => closeShortcutsModal();
    const renderKbd = (keys) => keys.map(k => `<kbd class="font-mono text-[11px] bg-slate-800 px-1.5 py-0.5 rounded text-brand-400 border border-slate-700/50">${k}</kbd>`).join(' <span class="text-slate-600">+</span> ');
    const renderShortcuts = (filter) => {
      const q = (filter || '').toLowerCase();
      return SHORTCUTS_DATA.map(group => {
        const filtered = group.items.filter(it => !q || it.label.toLowerCase().includes(q) || it.keys.some(k => k.toLowerCase().includes(q)));
        if (!filtered.length && q) return '';
        return `
          <div class="mb-4">
            <h4 class="text-[10px] uppercase tracking-widest text-brand-500 font-semibold mb-2">${group.section}</h4>
            <div class="space-y-1.5">
              ${filtered.map(it => `
                <div class="flex items-center justify-between py-0.5">
                  <span class="text-slate-300 text-[13px]">${it.label}</span>
                  <span class="flex items-center gap-0.5">${renderKbd(it.keys)}</span>
                </div>
              `).join('')}
            </div>
          </div>`;
      }).join('');
    };
    overlay.innerHTML = `
      <div class="bg-slate-900 rounded-2xl border border-slate-700/50 w-full max-w-lg mx-auto shadow-2xl overflow-hidden" onclick="event.stopPropagation()">
        <div class="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h3 class="text-sm font-bold text-brand-400 tracking-wide">⌨ Raccourcis Clavier</h3>
          <button onclick="document.getElementById('shortcuts-debug').remove(); window.__closeShortcutsModal && window.__closeShortcutsModal();" class="text-[11px] text-slate-500 hover:text-slate-300 transition-colors px-2 py-1 rounded-lg hover:bg-slate-800">✕ Fermer</button>
        </div>
        <div class="px-5 pt-3">
          <input id="shortcuts-search" type="text" placeholder="🔍 Rechercher un raccourci..." class="w-full bg-slate-800/80 border border-slate-700/50 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20 transition-all" oninput="window.__renderShortcuts(this.value)">
        </div>
        <div id="shortcuts-list" class="p-5 max-h-[55vh] overflow-y-auto text-[13px]">
          ${renderShortcuts('')}
        </div>
        <div class="px-5 py-3 border-t border-slate-800 flex justify-between items-center">
          <span class="text-[10px] text-slate-600">Appuie sur <kbd class="font-mono text-[10px] bg-slate-800 px-1 rounded text-slate-400">?</kbd> ou <kbd class="font-mono text-[10px] bg-slate-800 px-1 rounded text-slate-400">Esc</kbd> pour fermer</span>
          <span id="shortcuts-count" class="text-[10px] text-slate-600"></span>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    modalElRef.current = overlay;
    window.__closeShortcutsModal = () => { closeShortcutsModal(); };
    window.__renderShortcuts = (filter) => {
      const el = document.getElementById('shortcuts-list');
      if (!el) return;
      const q = (filter || '').toLowerCase();
      let total = 0;
      el.innerHTML = SHORTCUTS_DATA.map(group => {
        const filtered = group.items.filter(it => !q || it.label.toLowerCase().includes(q) || it.keys.some(k => k.toLowerCase().includes(q)));
        if (!filtered.length && q) return '';
        total += filtered.length;
        return `
          <div class="mb-4">
            <h4 class="text-[10px] uppercase tracking-widest text-brand-500 font-semibold mb-2">${group.section}</h4>
            <div class="space-y-1.5">
              ${filtered.map(it => `
                <div class="flex items-center justify-between py-0.5">
                  <span class="text-slate-300 text-[13px]">${it.label}</span>
                  <span class="flex items-center gap-0.5">${renderKbd(it.keys)}</span>
                </div>
              `).join('')}
            </div>
          </div>`;
      }).join('');
      const count = document.getElementById('shortcuts-count');
      if (count && q) count.textContent = total + ' résultat' + (total > 1 ? 's' : '');
      else if (count) count.textContent = '';
    };
  };

  const closeShortcutsModal = () => {
    if (modalElRef.current) {
      modalElRef.current.remove();
      modalElRef.current = null;
    }
  };

  const toggleShortcutsModal = () => {
    if (modalElRef.current) closeShortcutsModal();
    else openShortcutsModal();
  };

  const toggleRef = useRef(toggleShortcutsModal);
  toggleRef.current = toggleShortcutsModal;
  const closeRef = useRef(closeShortcutsModal);
  closeRef.current = closeShortcutsModal;

  useEffect(() => {
    const t = toastRef.current;
    const handleKeyDown = (e) => {
      if (e.key === 'F1') {
        e.preventDefault();
        toggleRef.current();
        document.title = '⌨ F1 → Aide';
        return;
      }
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        toggleRef.current();
        document.title = '⌨ ? → Aide';
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        toggleRef.current();
        document.title = '⌨ Ctrl+/ → Aide';
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        setCurrentTab('invoicing');
        t.info("Navigation : Factures de Ventes (Ctrl+N)");
        document.title = '⌨ Ctrl+N → Factures';
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        openCommandPalette();
        document.title = '⌨ Ctrl+K → Commandes';
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => { if (searchRef.current) searchRef.current.focus(); }, 50);
        document.title = '⌨ Ctrl+F → Recherche';
        return;
      }
      if (e.key === 'F2') {
        e.preventDefault();
        t.info("Recherche fiche (F2)");
        document.title = '⌨ F2 → Recherche fiche';
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Insert') {
        e.preventDefault();
        t.info("Insérer ligne (Ctrl+Ins) — disponible dans Saisie Manuelle");
        document.title = '⌨ Ctrl+Ins → Insérer ligne';
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Delete') {
        e.preventDefault();
        t.info("Supprimer ligne (Ctrl+Suppr) — disponible dans Saisie Manuelle");
        document.title = '⌨ Ctrl+Suppr → Supprimer ligne';
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyL') {
        e.preventDefault();
        t.info("Ajouter ligne (Ctrl+Shift+L) — disponible dans Saisie Manuelle");
        document.title = '⌨ Ctrl+Shift+L → Ajouter ligne';
        return;
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        closeRef.current();
        if (searchRef.current) searchRef.current.blur();
        document.title = '⌨ Esc → Fermer';
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey) {
        const tabMap = {
          'Digit1': 'dashboard', 'Numpad1': 'dashboard',
          'Digit2': 'manual', 'Numpad2': 'manual',
          'Digit3': 'ocr', 'Numpad3': 'ocr',
          'Digit4': 'journal', 'Numpad4': 'journal',
          'Digit5': 'invoicing', 'Numpad5': 'invoicing',
          'Digit6': 'suppliers', 'Numpad6': 'suppliers',
          'Digit7': 'bank', 'Numpad7': 'bank',
          'Digit8': 'fiscal', 'Numpad8': 'fiscal',
          'Digit9': 'payroll', 'Numpad9': 'payroll',
          'Digit0': 'settings', 'Numpad0': 'settings',
        };
        const tab = tabMap[e.code];
        if (tab) {
          e.preventDefault();
          const digit = e.code.replace('Digit', '').replace('Numpad', '');
          const labels = { dashboard: 'Tableau de bord', manual: 'Saisie Manuelle', ocr: 'Scan Reçus', journal: 'Journal', invoicing: 'Factures', suppliers: 'Fournisseurs', bank: 'Rapprochement', fiscal: 'Déclarations', payroll: 'Paie', settings: 'Configuration' };
          setCurrentTab(tab);
          t.info(`Ctrl+Shift+${digit} → ${labels[tab] || tab}`);
          document.title = `⌨ Ctrl+Shift+${digit} → ${labels[tab] || tab}`;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setCurrentTab, setSearchOpen, searchRef, openCommandPalette]);

  return {
    openShortcutsModal,
    closeShortcutsModal,
    toggleShortcutsModal,
    SHORTCUTS_DATA,
  };
}
