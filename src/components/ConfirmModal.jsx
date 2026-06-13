import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertTriangle, Trash2, X, ShieldAlert, HelpCircle } from 'lucide-react';

// ── Context ───────────────────────────────────────────────────
const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);

  const confirm = useCallback(({ title, message, confirmLabel = 'Confirmer', cancelLabel = 'Annuler', type = 'warning', icon }) => {
    return new Promise((resolve) => {
      setState({ title, message, confirmLabel, cancelLabel, type, icon, resolve });
    });
  }, []);

  const handleClose = (result) => {
    state?.resolve(result);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state && <ConfirmModal {...state} onClose={handleClose} />}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx.confirm;
}

// ── Type config ───────────────────────────────────────────────
const TYPE_CONFIG = {
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-amber-500/15 border-amber-500/30',
    iconColor: 'text-amber-400',
    confirmBtn: 'bg-amber-500 hover:bg-amber-400 shadow-[0_4px_16px_rgba(245,158,11,0.35)]',
  },
  danger: {
    icon: Trash2,
    iconBg: 'bg-red-500/15 border-red-500/30',
    iconColor: 'text-red-400',
    confirmBtn: 'bg-red-500 hover:bg-red-400 shadow-[0_4px_16px_rgba(239,68,68,0.35)]',
  },
  info: {
    icon: HelpCircle,
    iconBg: 'bg-indigo-500/15 border-indigo-500/30',
    iconColor: 'text-indigo-400',
    confirmBtn: 'bg-indigo-500 hover:bg-indigo-400 shadow-[0_4px_16px_rgba(99,102,241,0.35)]',
  },
  security: {
    icon: ShieldAlert,
    iconBg: 'bg-rose-500/15 border-rose-500/30',
    iconColor: 'text-rose-400',
    confirmBtn: 'bg-rose-500 hover:bg-rose-400 shadow-[0_4px_16px_rgba(244,63,94,0.35)]',
  },
};

// ── Modal ─────────────────────────────────────────────────────
function ConfirmModal({ title, message, confirmLabel, cancelLabel, type, icon: CustomIcon, onClose }) {
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.warning;
  const Icon = CustomIcon || cfg.icon;

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
      style={{ background: 'rgba(2, 6, 23, 0.75)', backdropFilter: 'blur(8px)', animation: 'fadeIn 0.2s ease-out both' }}
    >
      <div
        className="w-full max-w-sm rounded-3xl border border-white/5 overflow-hidden"
        style={{
          background: 'rgba(10, 15, 30, 0.92)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
          animation: 'slideInUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        }}
      >
        {/* Top color bar */}
        <div className={`h-1 w-full ${
          type === 'danger' ? 'bg-gradient-to-r from-red-500 to-rose-600' :
          type === 'security' ? 'bg-gradient-to-r from-rose-500 to-pink-600' :
          type === 'info' ? 'bg-gradient-to-r from-indigo-500 to-violet-600' :
          'bg-gradient-to-r from-amber-500 to-orange-500'
        }`} />

        <div className="p-6">
          {/* Close */}
          <button
            onClick={() => onClose(false)}
            className="absolute top-5 right-5 w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-slate-800/60 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          {/* Icon */}
          <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center mx-auto mb-5 ${cfg.iconBg}`}>
            <Icon className={`w-7 h-7 ${cfg.iconColor}`} />
          </div>

          {/* Text */}
          <div className="text-center mb-6">
            <h3 className="text-base font-black text-white mb-2">{title}</h3>
            {message && <p className="text-sm text-slate-400 leading-relaxed">{message}</p>}
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => onClose(false)}
              className="flex-1 py-3 rounded-xl border border-slate-700/80 text-slate-300 hover:text-white hover:border-slate-600 text-sm font-semibold transition-all duration-200 hover:bg-slate-800/40"
            >
              {cancelLabel}
            </button>
            <button
              onClick={() => onClose(true)}
              className={`flex-1 py-3 rounded-xl text-white text-sm font-bold transition-all duration-200 ${cfg.confirmBtn}`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConfirmProvider;
