import React, { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X, Sparkles } from 'lucide-react';

// ── Toast Context ─────────────────────────────────────────────
const ToastContext = createContext(null);

let toastId = 0;

// ── Provider ──────────────────────────────────────────────────
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback(({ message, type = 'info', duration = 4000, title }) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type, title, duration }]);
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, leaving: true } : t));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 350);
  }, []);

  // Auto-remove
  useEffect(() => {
    const timers = toasts.filter(t => !t.leaving).map(t => {
      if (!t.duration) return null;
      return setTimeout(() => removeToast(t.id), t.duration);
    });
    return () => timers.forEach(t => t && clearTimeout(t));
  }, [toasts, removeToast]);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </ToastContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  const { addToast, removeToast } = ctx;

  return {
    toast: addToast,
    success: (message, title) => addToast({ message, type: 'success', title }),
    error: (message, title) => addToast({ message, type: 'error', title, duration: 6000 }),
    warning: (message, title) => addToast({ message, type: 'warning', title }),
    info: (message, title) => addToast({ message, type: 'info', title }),
    dismiss: removeToast,
  };
}

// ── Config per type ───────────────────────────────────────────
const CONFIG = {
  success: {
    icon: CheckCircle2,
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/8',
    iconColor: 'text-emerald-400',
    bar: 'bg-emerald-400',
    glow: 'shadow-[0_0_20px_rgba(16,185,129,0.15)]',
    titleColor: 'text-emerald-300',
  },
  error: {
    icon: XCircle,
    border: 'border-red-500/30',
    bg: 'bg-red-500/8',
    iconColor: 'text-red-400',
    bar: 'bg-red-400',
    glow: 'shadow-[0_0_20px_rgba(239,68,68,0.15)]',
    titleColor: 'text-red-300',
  },
  warning: {
    icon: AlertTriangle,
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/8',
    iconColor: 'text-amber-400',
    bar: 'bg-amber-400',
    glow: 'shadow-[0_0_20px_rgba(245,158,11,0.15)]',
    titleColor: 'text-amber-300',
  },
  info: {
    icon: Info,
    border: 'border-indigo-500/30',
    bg: 'bg-indigo-500/8',
    iconColor: 'text-indigo-400',
    bar: 'bg-indigo-400',
    glow: 'shadow-[0_0_20px_rgba(99,102,241,0.15)]',
    titleColor: 'text-indigo-300',
  },
};

// ── Single Toast ──────────────────────────────────────────────
function Toast({ id, message, type, title, duration, leaving, onClose }) {
  const cfg = CONFIG[type] || CONFIG.info;
  const Icon = cfg.icon;
  const [progress, setProgress] = useState(100);
  const startTime = useRef(Date.now());
  const animRef = useRef(null);

  useEffect(() => {
    if (!duration) return;
    const tick = () => {
      const elapsed = Date.now() - startTime.current;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining > 0) animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [duration]);

  return (
    <div
      className={`
        relative w-80 max-w-full sm:w-80 rounded-2xl border backdrop-blur-xl overflow-hidden
        flex items-start gap-3 p-4 pr-10
        transition-all duration-350 ease-out
        ${cfg.border} ${cfg.bg} ${cfg.glow}
        ${leaving
          ? 'opacity-0 translate-x-4 scale-95'
          : 'opacity-100 translate-x-0 scale-100'}
      `}
      style={{
        background: 'rgba(10, 15, 30, 0.85)',
        animation: leaving ? undefined : 'slideInToast 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both',
      }}
    >
      {/* Icon */}
      <div className={`w-8 h-8 rounded-xl ${cfg.bg} border ${cfg.border} flex items-center justify-center shrink-0 mt-0.5`}>
        <Icon className={`w-4 h-4 ${cfg.iconColor}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {title && <p className={`text-xs font-bold mb-0.5 ${cfg.titleColor}`}>{title}</p>}
        <p className="text-xs text-slate-300 leading-relaxed">{message}</p>
      </div>

      {/* Close button */}
      <button
        onClick={() => onClose(id)}
        className="absolute top-3 right-3 w-5 h-5 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 transition-colors"
      >
        <X className="w-3 h-3" />
      </button>

      {/* Progress bar */}
      {duration && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-800/50 rounded-full overflow-hidden">
          <div
            className={`h-full ${cfg.bar} transition-none rounded-full`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ── Container ─────────────────────────────────────────────────
function ToastContainer({ toasts, onClose }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed top-4 right-4 left-4 sm:left-auto z-[9999] flex flex-col gap-2.5 pointer-events-none items-end">
      <style>{`
        @keyframes slideInToast {
          from { opacity: 0; transform: translateX(20px) scale(0.95); }
          to   { opacity: 1; transform: translateX(0) scale(1); }
        }
      `}</style>
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <Toast {...t} onClose={onClose} />
        </div>
      ))}
    </div>
  );
}

export default ToastProvider;
