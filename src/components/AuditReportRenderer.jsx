import React from 'react';

export default function AuditReportRenderer({ report }) {
  if (!report) return null;
  if (typeof report === 'string') return <p className="text-red-400">{report}</p>;

  const { score, summary, checks = [], recommendations = [], companyName, date } = report;

  const scoreTier = score >= 80 ? 'excellent' : score >= 60 ? 'acceptable' : 'critique';
  const scoreConfig = {
    excellent: { color: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30', bar: 'bg-emerald-400', label: 'Excellent', icon: '\u2714' },
    acceptable: { color: 'text-amber-400 bg-amber-500/20 border-amber-500/30', bar: 'bg-amber-400', label: 'Acceptable', icon: '\u26A0' },
    critique: { color: 'text-red-400 bg-red-500/20 border-red-500/30', bar: 'bg-red-400', label: 'Critique', icon: '\u2718' },
  }[scoreTier];

  const statusBadge = (s) => {
    const cfg = {
      pass: { label: 'Conforme', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
      warn: { label: 'Attention', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
      fail: { label: 'Non conforme', cls: 'bg-red-500/15 text-red-400 border-red-500/30' },
    }[s] || { label: 'Info', cls: 'bg-slate-500/15 text-slate-400 border-slate-500/30' };
    return cfg;
  };

  return (
    <div className="space-y-5">
      <div className="glass-card rounded-2xl border border-slate-800 p-5 shadow-card space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white">Rapport d'Audit</h2>
            <p className="text-xs text-slate-400">{companyName} &middot; {date}</p>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${scoreConfig.color}`}>
            <span className="text-lg">{scoreConfig.icon}</span>
            <span className="font-black text-sm">{score}/100</span>
            <span className="text-[10px] opacity-70">{scoreConfig.label}</span>
          </div>
        </div>
        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-1000 ${scoreConfig.bar}`}
            style={{ width: `${score}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Conformes', count: summary?.passed || 0, cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
          { label: 'Avertissements', count: summary?.warned || 0, cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
          { label: 'Non conformit\u00E9s', count: summary?.failed || 0, cls: 'text-red-400 bg-red-500/10 border-red-500/20' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border ${s.cls} p-4 text-center`}>
            <div className="text-2xl font-black">{s.count}</div>
            <div className="text-[10px] uppercase tracking-wider mt-1 opacity-70">{s.label}</div>
          </div>
        ))}
      </div>

      <div>
        <h3 className="text-base font-semibold text-slate-200 mb-3 flex items-center gap-2">
          <span className="w-1 h-5 bg-brand-400 rounded-full" />
          D\u00E9tail des contr\u00F4les
        </h3>
        <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-800/80 border-b border-slate-700">
                  <th className="px-4 py-3 text-left text-slate-400 font-semibold uppercase tracking-wider w-8">#</th>
                  <th className="px-4 py-3 text-left text-slate-400 font-semibold uppercase tracking-wider">Cat\u00E9gorie</th>
                  <th className="px-4 py-3 text-left text-slate-400 font-semibold uppercase tracking-wider">Contr\u00F4le</th>
                  <th className="px-4 py-3 text-center text-slate-400 font-semibold uppercase tracking-wider w-28">Statut</th>
                  <th className="px-4 py-3 text-left text-slate-400 font-semibold uppercase tracking-wider">D\u00E9tail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {checks.map((c, i) => {
                  const badge = statusBadge(c.status);
                  return (
                    <tr key={c.id || i} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 text-slate-500 text-center">{i + 1}</td>
                      <td className="px-4 py-3 text-slate-300 font-medium whitespace-nowrap">{c.category}</td>
                      <td className="px-4 py-3 text-slate-200">{c.label}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 max-w-xs leading-relaxed">{c.detail}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {recommendations.length > 0 && (
        <div>
          <h3 className="text-base font-semibold text-slate-200 mb-3 flex items-center gap-2">
            <span className="w-1 h-5 bg-brand-400 rounded-full" />
            Recommandations
          </h3>
          <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden shadow-card">
            <div className="divide-y divide-slate-800/50">
              {recommendations.map((r, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-800/20 transition-colors">
                  <span className="w-6 h-6 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center text-xs font-bold shrink-0">
                    {i + 1}
                  </span>
                  <p className="text-xs text-slate-300 leading-relaxed">{r}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
