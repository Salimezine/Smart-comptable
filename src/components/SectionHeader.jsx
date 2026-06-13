export default function SectionHeader({ title, subtitle, icon: Icon, action, className = '' }) {
  return (
    <div className={`flex items-start justify-between gap-4 mb-6 ${className}`}>
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-brand-500/20 to-brand-600/10 border border-brand-500/20 shrink-0">
            <Icon className="w-5 h-5 text-brand-400" />
          </div>
        )}
        <div>
          <h2 className="text-lg font-extrabold text-white tracking-tight">{title}</h2>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
