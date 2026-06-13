export default function FiscalAlertBadge({ count, severity = 'high', onClick, className = '' }) {
  const colors = {
    critical: 'bg-red-500 text-white',
    high: 'bg-orange-500 text-white',
    medium: 'bg-amber-500 text-white',
    low: 'bg-blue-500 text-white',
  };
  const color = colors[severity] || colors.high;

  if (!count || count <= 0) return null;
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[10px] font-bold animate-fade-in ${color} ${className}`}
    >
      {count > 99 ? '99+' : count}
    </button>
  );
}
