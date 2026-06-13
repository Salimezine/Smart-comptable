export default function PremiumCard({ children, className = '', glow = false, onClick, hover = true }) {
  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl border border-slate-800/60 bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-900/40 backdrop-blur-xl ${
        hover ? 'transition-all duration-300 hover:border-slate-700/80 hover:shadow-lg hover:-translate-y-0.5' : ''
      } ${glow ? 'shadow-[0_0_30px_rgba(99,102,241,0.08)]' : ''} ${className}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-brand-500/[0.02] to-transparent pointer-events-none" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
