import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { can, getPermissionLabel } from '../utils/auth/permissionEngine';
import { Lock } from 'lucide-react';

export default function PermissionTooltip({ permission, children, className = '' }) {
  const { currentUser } = useAuth();
  const hasAccess = !currentUser || can(currentUser, permission);
  const label = permission ? getPermissionLabel(permission) : '';

  if (hasAccess) return <>{children}</>;

  return (
    <div className={`relative group ${className}`} title={`Permission requise : ${label}`}>
      <div className="relative">
        {children}
        <div className="absolute inset-0 rounded-lg bg-slate-900/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-not-allowed">
          <Lock className="w-3 h-3 text-slate-400" />
        </div>
      </div>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-[9px] text-slate-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl z-50">
        ⛔ {label}
      </div>
    </div>
  );
}
