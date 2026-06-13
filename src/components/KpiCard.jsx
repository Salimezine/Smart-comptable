import { TrendingUp, TrendingDown } from 'lucide-react';

export default function KpiCard({ icon: Icon, label, value, trend, trendLabel, color = 'brand', subtitle, format }) {
  const colors = {
    brand: { bg: 'bg-brand-500/10', text: 'text-brand-400', border: 'border-brand-500/20', gradient: 'from-brand-500/10 to-transparent' },
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', gradient: 'from-emerald-500/10 to-transparent' },
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', gradient: 'from-amber-500/10 to-transparent' },
    red: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20', gradient: 'from-red-500/10 to-transparent' },
    violet: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20', gradient: 'from-violet-500/10 to-transparent' },
    cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20', gradient: 'from-cyan-500/10 to-transparent' },
  };
  const c = colors[color] || colors.brand;

  return (
    <div className={`relative overflow-hidden rounded-2xl border ${c.border} ${c.bg} backdrop-blur-xl p-5 transition-all duration-300 hover:border-slate-700/80 hover:shadow-lg hover:-translate-y-0.5`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${c.gradient} pointer-events-none`} />
      <div className="relative z-10 flex items-start justify-between">
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
          <p className={`text-2xl font-extrabold tracking-tight ${c.text}`}>
            {format ? format(value) : (typeof value === 'number' ? value.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) : value)}
          </p>
          {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
          {trend !== undefined && (
            <div className="flex items-center gap-1.5 mt-1">
              {trend >= 0
                ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                : <TrendingDown className="w-3.5 h-3.5 text-red-400" />
              }
              <span className={`text-xs font-semibold ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {trend >= 0 ? '+' : ''}{trend}%
              </span>
              {trendLabel && <span className="text-[10px] text-slate-500">{trendLabel}</span>}
            </div>
          )}
        </div>
        {Icon && (
          <div className={`p-3 rounded-xl ${c.bg} border ${c.border} shrink-0`}>
            <Icon className={`w-5 h-5 ${c.text}`} />
          </div>
        )}
      </div>
    </div>
  );
}
