import React, { useState, useEffect, useRef } from 'react';
import { Plus, FileText, Scan, TrendingDown, X, BookOpen } from 'lucide-react';

const actions = [
  { label: 'Nouvelle Facture', icon: FileText, color: 'from-indigo-500 to-violet-600', glow: 'rgba(99,102,241,0.45)', tab: 'invoicing' },
  { label: 'Scanner Reçu', icon: Scan, color: 'from-emerald-500 to-teal-600', glow: 'rgba(16,185,129,0.45)', tab: 'ocr' },
  { label: 'Ajouter Dépense', icon: TrendingDown, color: 'from-red-500 to-rose-600', glow: 'rgba(239,68,68,0.45)', tab: 'expenses' },
  { label: 'Saisie Manuelle', icon: BookOpen, color: 'from-amber-500 to-orange-600', glow: 'rgba(245,158,11,0.45)', tab: 'manual' },
];

export default function FAB({ onNavigate }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Esc
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleAction = (tab) => {
    onNavigate(tab);
    setOpen(false);
  };

  return (
    <div ref={ref} className="fixed bottom-6 right-6 z-40 flex flex-col-reverse items-end gap-3">
      {/* Action items */}
      {actions.map((action, i) => {
        const Icon = action.icon;
        const delay = open ? i * 50 : (actions.length - 1 - i) * 30;
        return (
          <div
            key={action.tab}
            className="flex items-center gap-3"
            style={{
              transition: `all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms`,
              opacity: open ? 1 : 0,
              transform: open ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.85)',
              pointerEvents: open ? 'auto' : 'none',
            }}
          >
            {/* Label */}
            <span
              className="text-xs font-bold text-slate-200 bg-slate-900/90 border border-slate-700/60 px-3 py-1.5 rounded-xl"
              style={{
                backdropFilter: 'blur(12px)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
              }}
            >
              {action.label}
            </span>

            {/* Icon button */}
            <button
              onClick={() => handleAction(action.tab)}
              className={`w-11 h-11 rounded-xl bg-gradient-to-br ${action.color} text-white flex items-center justify-center transition-transform duration-200 hover:scale-110 active:scale-95`}
              style={{ boxShadow: `0 4px 20px ${action.glow}` }}
              title={action.label}
            >
              <Icon className="w-4.5 h-4.5" />
            </button>
          </div>
        );
      })}

      {/* Main FAB */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center transition-all duration-300 active:scale-90"
        style={{
          boxShadow: open
            ? '0 0 0 4px rgba(99,102,241,0.2), 0 8px 32px rgba(99,102,241,0.5)'
            : '0 4px 24px rgba(99,102,241,0.4)',
        }}
        title="Actions rapides"
      >
        <div
          className="transition-transform duration-300"
          style={{ transform: open ? 'rotate(45deg)' : 'rotate(0deg)' }}
        >
          {open ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
        </div>
      </button>
    </div>
  );
}
