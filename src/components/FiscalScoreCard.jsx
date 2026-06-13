export default function FiscalScoreCard({ score, maxScore = 100, label, level, levelColor, size = 'md' }) {
  const pct = Math.min(100, Math.max(0, (score / maxScore) * 100));
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (pct / 100) * circumference;

  const sizes = {
    sm: { svg: 80, circle: 32, text: 'text-lg', label: 'text-[10px]' },
    md: { svg: 140, circle: 54, text: 'text-3xl', label: 'text-xs' },
    lg: { svg: 180, circle: 72, text: 'text-4xl', label: 'text-sm' },
  };
  const s = sizes[size] || sizes.md;

  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
  const bgColor = score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: s.svg, height: s.svg }}>
        <svg className="w-full h-full transform -rotate-90" viewBox={`0 0 ${s.svg} ${s.svg}`}>
          <circle
            cx={s.svg / 2} cy={s.svg / 2} r={s.circle}
            stroke="currentColor" strokeWidth="8" fill="transparent"
            className="text-slate-800"
          />
          <circle
            cx={s.svg / 2} cy={s.svg / 2} r={s.circle}
            stroke={color} strokeWidth="8" fill="transparent"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`${s.text} font-extrabold ${bgColor}`}>{score}</span>
        </div>
      </div>
      {(label || level) && (
        <div className="text-center">
          {label && <p className="text-[11px] text-slate-400 font-medium">{label}</p>}
          {level && <p className={`text-sm font-bold ${levelColor || bgColor}`}>{level}</p>}
        </div>
      )}
    </div>
  );
}
