import React from 'react';
import { PLANS } from '../utils/auth/plansManager';
import { getUsageThisMonth, getAllUsageThisMonth } from '../utils/auth/usageTracker';

const PLAN_COLORS = {
  free: { badge: 'bg-slate-700 text-slate-300', bar: 'bg-slate-600', text: 'text-slate-400' },
  starter: { badge: 'bg-blue-600 text-white', bar: 'bg-blue-500', text: 'text-blue-400' },
  pro: { badge: 'bg-violet-600 text-white', bar: 'bg-violet-500', text: 'text-violet-400' },
  enterprise: { badge: 'bg-amber-500 text-black', bar: 'bg-amber-400', text: 'text-amber-400' },
};

export default function PlanBadge({ user, onUpgrade }) {
  if (!user) return null;
  const plan = PLANS[user.plan] || PLANS.free;
  const colors = PLAN_COLORS[user.plan] || PLAN_COLORS.free;
  const usage = getAllUsageThisMonth(user.id);

  const limits = Object.entries(plan.limits).filter(([, v]) => typeof v === 'number' && v > 0);
  const firstLimit = limits[0];
  const firstUsage = firstLimit ? (usage[firstLimit[0]] || 0) : 0;
  const firstMax = firstLimit ? firstLimit[1] : 1;
  const pct = Math.min((firstUsage / firstMax) * 100, 100);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${colors.badge}`}>
          {plan.label}
        </span>
        {user.plan !== 'enterprise' && (
          <button onClick={onUpgrade} className="text-[10px] text-violet-400 hover:text-violet-300 underline">
            Upgrader ↗
          </button>
        )}
      </div>
      {firstLimit && (
        <div>
          <div className="flex justify-between text-[9px] text-slate-500 mb-1">
            <span>{firstUsage}/{firstMax} {firstLimit[0].replace(/_/g, ' ')}</span>
            <span className={colors.text}>{pct.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-300 ${colors.bar}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}
