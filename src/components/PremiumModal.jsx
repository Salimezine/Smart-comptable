import { X } from 'lucide-react';

export default function PremiumModal({ open, onClose, title, subtitle, children, maxWidth = 'max-w-2xl' }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${maxWidth} max-h-[85vh] flex flex-col bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-900/90 border border-slate-800/80 rounded-3xl shadow-2xl overflow-hidden`}>
        <div className="absolute inset-0 bg-gradient-to-br from-brand-500/[0.03] to-transparent pointer-events-none" />
        <div className="relative z-10 p-6 border-b border-slate-800/50 flex items-start justify-between">
          <div>
            {title && <h3 className="text-lg font-extrabold text-white">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-800/60 text-slate-500 hover:text-white transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="relative z-10 flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
